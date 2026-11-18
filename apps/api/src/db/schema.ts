import {
  BODY_TYPES,
  DOCUMENT_TYPES,
  FUEL_TYPES,
  TRANSMISSIONS,
  USER_ROLES,
  VEHICLE_STATUSES,
} from '@haupcar/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
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

export const userRole = pgEnum('user_role', USER_ROLES);

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

export const bodyType = pgEnum('body_type', BODY_TYPES);
export const transmission = pgEnum('transmission', TRANSMISSIONS);
export const fuelType = pgEnum('fuel_type', FUEL_TYPES);

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

export const vehicleStatus = pgEnum('vehicle_status', VEHICLE_STATUSES);

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

export const vehiclePhotos = pgTable(
  'vehicle_photos',
  {
    id: id(),
    vehicleId: uuid()
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    storageKey: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('vehicle_photos_vehicle_idx').on(t.vehicleId, t.createdAt)],
);

export const documentType = pgEnum('document_type', DOCUMENT_TYPES);

// Personal data (PII): only the owner and admins may read these.
export const vehicleDocuments = pgTable(
  'vehicle_documents',
  {
    id: id(),
    vehicleId: uuid()
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    type: documentType().notNull(),
    storageKey: text().notNull(),
    expiresOn: date(),
    createdAt: createdAt(),
  },
  (t) => [unique('vehicle_documents_one_per_type').on(t.vehicleId, t.type)],
);
