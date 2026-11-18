import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { pgErrorOf } from '../common/pg-error.js';
import { DB, type Db } from '../db/db.module.js';
import { carModels, vehicleStatusHistory, vehicles } from '../db/schema.js';
import { assertTransition, requiresReReview } from './vehicle-status.js';
import type {
  CreateVehicleInput,
  ListVehiclesQuery,
  UpdateVehicleInput,
} from './vehicles.schemas.js';

type LatLng = { lat: number; lng: number };

const toPoint = (loc: LatLng | null | undefined) => (loc ? { x: loc.lng, y: loc.lat } : loc);

const vehicleColumns = {
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

const SUBMIT_REQUIRED = ['location', 'dailyPrice', 'pickupAddress'] as const;

@Injectable()
export class VehiclesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(ownerId: string, { page, pageSize, status }: ListVehiclesQuery) {
    const where = and(ownedBy(ownerId), status ? eq(vehicles.status, status) : undefined);
    const [rows, [{ total }]] = await Promise.all([
      this.select(where)
        .orderBy(desc(vehicles.createdAt), desc(vehicles.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(vehicles).where(where),
    ]);
    return { items: rows.map(toDto), total, page, pageSize };
  }

  async get(ownerId: string, id: string) {
    const [row] = await this.select(ownedBy(ownerId, id));
    if (!row) throw new NotFoundException('Vehicle not found');
    return toDto(row);
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
    await this.db
      .transaction(async (tx) => {
        const current = await this.lockOwned(tx, ownerId, id);
        if (current.version !== version) {
          throw new ConflictException('Vehicle was modified by someone else; reload and try again');
        }
        const reReview = current.status === 'approved' && requiresReReview(changes, current);
        if (reReview) assertTransition('approved', 'pending_review', 'system');

        await tx
          .update(vehicles)
          .set({
            ...changes,
            location: toPoint(changes.location),
            version: current.version + 1,
            ...(reReview && { status: 'pending_review' as const }),
          })
          .where(eq(vehicles.id, id));
        if (reReview) {
          await tx.insert(vehicleStatusHistory).values({
            vehicleId: id,
            fromStatus: 'approved',
            toStatus: 'pending_review',
            changedBy: ownerId,
            reason: 'Key fields edited after approval',
          });
        }
      })
      .catch(rethrowConstraint);
    return this.get(ownerId, id);
  }

  async submit(ownerId: string, id: string) {
    await this.db.transaction(async (tx) => {
      const current = await this.lockOwned(tx, ownerId, id);
      assertTransition(current.status, 'pending_review', 'owner');
      const missing = SUBMIT_REQUIRED.filter((f) => current[f] === null);
      if (missing.length) {
        throw new UnprocessableEntityException({
          message: 'Vehicle is incomplete',
          missing,
        });
      }
      await tx
        .update(vehicles)
        .set({ status: 'pending_review', version: current.version + 1 })
        .where(eq(vehicles.id, id));
      await tx.insert(vehicleStatusHistory).values({
        vehicleId: id,
        fromStatus: current.status,
        toStatus: 'pending_review',
        changedBy: ownerId,
      });
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

  private select(where: SQL | undefined) {
    return this.db
      .select(vehicleColumns)
      .from(vehicles)
      .innerJoin(carModels, eq(carModels.id, vehicles.modelId))
      .where(where);
  }

  private async lockOwned(tx: Pick<Db, 'select'>, ownerId: string, id: string) {
    const [row] = await tx.select().from(vehicles).where(ownedBy(ownerId, id)).for('update');
    if (!row) throw new NotFoundException('Vehicle not found');
    return row;
  }
}

function toDto({
  location,
  ...row
}: { location: { x: number; y: number } | null } & Record<string, unknown>) {
  return { ...row, location: location && { lat: location.y, lng: location.x } };
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
