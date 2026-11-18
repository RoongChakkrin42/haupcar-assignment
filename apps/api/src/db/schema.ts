import { sql } from 'drizzle-orm';
import {
  check,
  geometry,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const userRole = pgEnum('user_role', ['owner', 'admin']);

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    name: text().notNull(),
    phone: text(),
    role: userRole().notNull().default('owner'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`)],
);

export const bodyType = pgEnum('body_type', ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'mpv']);
export const transmission = pgEnum('transmission', ['automatic', 'manual']);
export const fuelType = pgEnum('fuel_type', ['petrol', 'diesel', 'hybrid', 'ev']);

export const carModels = pgTable(
  'car_models',
  {
    id: id(),
    make: text().notNull(),
    model: text().notNull(),
    year: smallint().notNull(),
    bodyType: bodyType().notNull(),
    transmission: transmission().notNull(),
    fuel: fuelType().notNull(),
    seats: smallint().notNull(),
  },
  (t) => [
    unique('car_models_unique').on(t.make, t.model, t.year, t.transmission, t.fuel),
    check('car_models_seats_positive', sql`${t.seats} > 0`),
  ],
);

export const vehicleStatus = pgEnum('vehicle_status', [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'suspended',
  'archived',
]);

export const vehicles = pgTable(
  'vehicles',
  {
    id: id(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    modelId: uuid()
      .notNull()
      .references(() => carModels.id),
    plateNumber: text().notNull(),
    plateProvince: text().notNull(),
    vin: text(),
    color: text(),
    mileageKm: integer(),
    // Nullable while draft; required before submitting for review (app rule).
    location: geometry({ type: 'point', mode: 'xy', srid: 4326 }),
    pickupAddress: text(),
    dailyPrice: integer(), // satang
    description: text(),
    status: vehicleStatus().notNull().default('draft'),
    version: integer().notNull().default(1),
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('vehicles_plate_unique')
      .on(t.plateNumber, t.plateProvince)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex('vehicles_vin_unique').on(t.vin).where(sql`${t.deletedAt} is null`),
    check('vehicles_daily_price_positive', sql`${t.dailyPrice} > 0`),
    check('vehicles_mileage_non_negative', sql`${t.mileageKm} >= 0`),
    index('vehicles_owner_idx').on(t.ownerId),
    index('vehicles_status_idx').on(t.status),
    index('vehicles_location_idx').using('gist', t.location),
  ],
);

export const vehicleStatusHistory = pgTable(
  'vehicle_status_history',
  {
    id: id(),
    vehicleId: uuid()
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    fromStatus: vehicleStatus(),
    toStatus: vehicleStatus().notNull(),
    changedBy: uuid()
      .notNull()
      .references(() => users.id),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [index('vehicle_status_history_vehicle_idx').on(t.vehicleId, t.createdAt)],
);
