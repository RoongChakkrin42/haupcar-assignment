import type { CreateVehicleInput, ListVehiclesQuery, UpdateVehicleInput } from '@haupcar/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import { pgErrorOf } from '../common/pg-error.js';
import { DB, type Db } from '../db/db.module.js';
import {
  carModels,
  vehicleDocuments,
  vehiclePhotos,
  vehicleStatusHistory,
  vehicles,
} from '../db/schema.js';
import { FileStorage } from '../files/file-storage.js';
import { assertTransition, requiresReReview } from './vehicle-status.js';

type LatLng = { lat: number; lng: number };
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type VehicleRow = typeof vehicles.$inferSelect;

const toPoint = (loc: LatLng | null | undefined) => (loc ? { x: loc.lng, y: loc.lat } : loc);

export const vehicleColumns = {
  id: vehicles.id,
  ownerId: vehicles.ownerId,
  status: vehicles.status,
  version: vehicles.version,
  plateNumber: vehicles.plateNumber,
  plateProvince: vehicles.plateProvince,
  vin: vehicles.vin,
  color: vehicles.color,
  mileageKm: vehicles.mileageKm,
  location: vehicles.location,
  pickupAddress: vehicles.pickupAddress,
  dailyPrice: vehicles.dailyPrice,
  description: vehicles.description,
  createdAt: vehicles.createdAt,
  updatedAt: vehicles.updatedAt,
  model: { id: carModels.id, make: carModels.make, model: carModels.model, year: carModels.year },
};

/** Every owner query goes through this: own vehicle, not deleted. */
const ownedBy = (ownerId: string, id?: string) =>
  and(
    eq(vehicles.ownerId, ownerId),
    isNull(vehicles.deletedAt),
    id ? eq(vehicles.id, id) : undefined,
  );

const notDeleted = (id: string) => and(eq(vehicles.id, id), isNull(vehicles.deletedAt));

const SUBMIT_REQUIRED = ['location', 'dailyPrice', 'pickupAddress'] as const;

export function assertVersion(current: VehicleRow, version: number) {
  if (current.version !== version) {
    throw new ConflictException('Vehicle was modified by someone else; reload and try again');
  }
}

@Injectable()
export class VehiclesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: FileStorage,
  ) {}

  async list(ownerId: string, { page, pageSize, status }: ListVehiclesQuery) {
    const where = and(ownedBy(ownerId), status ? eq(vehicles.status, status) : undefined);
    const [rows, [{ total }]] = await Promise.all([
      this.select(where)
        .orderBy(desc(vehicles.createdAt), desc(vehicles.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(vehicles).where(where),
    ]);
    return { items: await this.withMedia(rows), total, page, pageSize };
  }

  async get(ownerId: string, id: string) {
    const [row] = await this.select(ownedBy(ownerId, id));
    if (!row) throw new NotFoundException('Vehicle not found');
    const [vehicle] = await this.withMedia([row]);
    return vehicle;
  }

  async create(ownerId: string, input: CreateVehicleInput) {
    const [{ id }] = await this.db
      .insert(vehicles)
      .values({ ...input, ownerId, location: toPoint(input.location) })
      .returning({ id: vehicles.id })
      .catch(rethrowConstraint);
    return this.get(ownerId, id);
  }

  async update(ownerId: string, id: string, { version, ...changes }: UpdateVehicleInput) {
    await this.withOwnedVehicle(ownerId, id, async (tx, current) => {
      assertVersion(current, version);
      await tx
        .update(vehicles)
        .set({ ...changes, location: toPoint(changes.location), version: current.version + 1 })
        .where(eq(vehicles.id, id));
      if (requiresReReview(changes, current)) {
        await this.requeueIfApproved(tx, current, ownerId, 'Key fields edited after approval');
      }
    }).catch(rethrowConstraint);
    return this.get(ownerId, id);
  }

  async submit(ownerId: string, id: string) {
    await this.withOwnedVehicle(ownerId, id, async (tx, current) => {
      assertTransition(current.status, 'pending_review', 'owner');
      const [[photo], [registration]] = await Promise.all([
        tx
          .select({ id: vehiclePhotos.id })
          .from(vehiclePhotos)
          .where(eq(vehiclePhotos.vehicleId, id))
          .limit(1),
        tx
          .select({ id: vehicleDocuments.id })
          .from(vehicleDocuments)
          .where(
            and(eq(vehicleDocuments.vehicleId, id), eq(vehicleDocuments.type, 'registration')),
          ),
      ]);
      const missing: string[] = SUBMIT_REQUIRED.filter((f) => current[f] === null);
      if (!photo) missing.push('photos');
      if (!registration) missing.push('registrationDocument');
      if (missing.length) {
        throw new UnprocessableEntityException({ message: 'Vehicle is incomplete', missing });
      }
      await this.changeStatus(tx, current, 'pending_review', ownerId);
    });
    return this.get(ownerId, id);
  }

  async remove(ownerId: string, id: string) {
    const deleted = await this.db
      .update(vehicles)
      .set({ deletedAt: new Date() })
      .where(ownedBy(ownerId, id))
      .returning({ id: vehicles.id });
    if (!deleted.length) throw new NotFoundException('Vehicle not found');
  }

  /** Runs `fn` in a transaction holding a row lock on the caller's own vehicle (404 otherwise). */
  withOwnedVehicle<T>(
    ownerId: string,
    id: string,
    fn: (tx: Tx, current: VehicleRow) => Promise<T>,
  ) {
    return this.withLockedVehicle(ownedBy(ownerId, id), fn);
  }

  /** Admin variant: any owner's vehicle, as long as it isn't deleted. */
  withAnyVehicle<T>(id: string, fn: (tx: Tx, current: VehicleRow) => Promise<T>) {
    return this.withLockedVehicle(notDeleted(id), fn);
  }

  private withLockedVehicle<T>(
    where: SQL | undefined,
    fn: (tx: Tx, current: VehicleRow) => Promise<T>,
  ) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(vehicles).where(where).for('update');
      if (!current) throw new NotFoundException('Vehicle not found');
      return fn(tx, current);
    });
  }

  /** An approved vehicle whose checked details changed must be reviewed again. */
  async requeueIfApproved(tx: Tx, current: VehicleRow, userId: string, reason: string) {
    if (current.status !== 'approved') return;
    assertTransition('approved', 'pending_review', 'system');
    await this.changeStatus(tx, current, 'pending_review', userId, reason);
  }

  async changeStatus(
    tx: Tx,
    current: VehicleRow,
    to: VehicleRow['status'],
    userId: string,
    reason?: string,
  ) {
    await tx
      .update(vehicles)
      .set({ status: to, version: sql`${vehicles.version} + 1` })
      .where(eq(vehicles.id, current.id));
    await tx.insert(vehicleStatusHistory).values({
      vehicleId: current.id,
      fromStatus: current.status,
      toStatus: to,
      changedBy: userId,
      reason,
    });
  }

  private select(where: SQL | undefined) {
    return this.db
      .select(vehicleColumns)
      .from(vehicles)
      .innerJoin(carModels, eq(carModels.id, vehicles.modelId))
      .where(where);
  }

  /** Adds photos, documents and the latest status reason; converts location to { lat, lng }. */
  async withMedia<
    R extends {
      id: string;
      status: VehicleRow['status'];
      location: { x: number; y: number } | null;
    },
  >(rows: R[]) {
    const ids = rows.map((r) => r.id);
    const [photos, documents, latest] = ids.length
      ? await Promise.all([
          this.db
            .select()
            .from(vehiclePhotos)
            .where(inArray(vehiclePhotos.vehicleId, ids))
            .orderBy(asc(vehiclePhotos.createdAt), asc(vehiclePhotos.id)),
          this.db
            .select()
            .from(vehicleDocuments)
            .where(inArray(vehicleDocuments.vehicleId, ids))
            .orderBy(asc(vehicleDocuments.createdAt)),
          this.db
            .selectDistinctOn([vehicleStatusHistory.vehicleId])
            .from(vehicleStatusHistory)
            .where(inArray(vehicleStatusHistory.vehicleId, ids))
            .orderBy(vehicleStatusHistory.vehicleId, desc(vehicleStatusHistory.createdAt)),
        ])
      : [[], [], []];
    return rows.map(({ location, ...row }) => ({
      ...row,
      location: location && { lat: location.y, lng: location.x },
      photos: photos.filter((p) => p.vehicleId === row.id).map((p) => this.photoDto(p)),
      documents: documents.filter((d) => d.vehicleId === row.id).map((d) => this.documentDto(d)),
      statusReason: statusReason(
        row.status,
        latest.find((h) => h.vehicleId === row.id),
      ),
    }));
  }

  photoDto(p: typeof vehiclePhotos.$inferSelect) {
    return {
      id: p.id,
      url: this.storage.signedUrl(p.storageKey),
      thumbUrl: this.storage.signedUrl(p.thumbStorageKey ?? p.storageKey),
    };
  }

  documentDto(d: typeof vehicleDocuments.$inferSelect) {
    return {
      id: d.id,
      type: d.type,
      expiresOn: d.expiresOn,
      url: this.storage.signedUrl(d.storageKey),
    };
  }
}

/** The reason only matters while the vehicle is still in the status that reason was given for. */
function statusReason(
  status: VehicleRow['status'],
  last: typeof vehicleStatusHistory.$inferSelect | undefined,
) {
  const explains = (status === 'rejected' || status === 'suspended') && last?.toStatus === status;
  return explains ? last.reason : null;
}

function rethrowConstraint(e: unknown): never {
  const { code, constraint } = pgErrorOf(e);
  if (code === '23505' && constraint === 'vehicles_plate_unique') {
    throw new ConflictException('Plate number is already registered in this province');
  }
  if (code === '23505' && constraint === 'vehicles_vin_unique') {
    throw new ConflictException('VIN is already registered');
  }
  if (code === '23503' && constraint === 'vehicles_model_id_car_models_id_fk') {
    throw new BadRequestException('Unknown car model');
  }
  throw e;
}
