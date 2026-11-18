import type { AdminListVehiclesQuery, SetStatusInput } from '@haupcar/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { carModels, users, vehicleStatusHistory, vehicles } from '../db/schema.js';
import { assertTransition } from './vehicle-status.js';
import { assertVersion, VehiclesService, vehicleColumns } from './vehicles.service.js';

const adminColumns = {
  ...vehicleColumns,
  owner: { id: users.id, name: users.name, email: users.email, phone: users.phone },
};

/** Admin view: every owner's vehicles (never deleted ones). */
@Injectable()
export class AdminVehiclesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly vehicles: VehiclesService,
  ) {}

  async list({ page, pageSize, status, order }: AdminListVehiclesQuery) {
    const where = and(isNull(vehicles.deletedAt), status ? eq(vehicles.status, status) : undefined);
    const by = order === 'oldest' ? asc : desc;
    const [rows, [{ total }]] = await Promise.all([
      this.select(where)
        .orderBy(by(vehicles.updatedAt), by(vehicles.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(vehicles).where(where),
    ]);
    return { items: await this.vehicles.withMedia(rows), total, page, pageSize };
  }

  async get(id: string) {
    const [row] = await this.select(and(eq(vehicles.id, id), isNull(vehicles.deletedAt)));
    if (!row) throw new NotFoundException('Vehicle not found');
    const [[vehicle], history] = await Promise.all([
      this.vehicles.withMedia([row]),
      this.history(id),
    ]);
    return { ...vehicle, history };
  }

  async setStatus(adminId: string, id: string, { status, reason, version }: SetStatusInput) {
    await this.vehicles.withAnyVehicle(id, async (tx, current) => {
      assertVersion(current, version);
      assertTransition(current.status, status, 'admin');
      await this.vehicles.changeStatus(tx, current, status, adminId, reason);
    });
    return this.get(id);
  }

  private select(where: SQL | undefined) {
    return this.db
      .select(adminColumns)
      .from(vehicles)
      .innerJoin(carModels, eq(carModels.id, vehicles.modelId))
      .innerJoin(users, eq(users.id, vehicles.ownerId))
      .where(where);
  }

  private history(vehicleId: string) {
    return this.db
      .select({
        fromStatus: vehicleStatusHistory.fromStatus,
        toStatus: vehicleStatusHistory.toStatus,
        reason: vehicleStatusHistory.reason,
        changedBy: { id: users.id, name: users.name, role: users.role },
        createdAt: vehicleStatusHistory.createdAt,
      })
      .from(vehicleStatusHistory)
      .innerJoin(users, eq(users.id, vehicleStatusHistory.changedBy))
      .where(eq(vehicleStatusHistory.vehicleId, vehicleId))
      .orderBy(asc(vehicleStatusHistory.createdAt), asc(vehicleStatusHistory.id));
  }
}
