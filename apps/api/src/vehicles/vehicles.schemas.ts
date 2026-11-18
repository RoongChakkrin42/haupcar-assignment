import { z } from 'zod';
import { bodyType, documentType, fuelType, transmission, vehicleStatus } from '../db/schema.js';

// "1กข 1234", "1กข-1234" and "1กข1234" are the same plate.
const plateNumber = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().min(1).max(20));

const vin = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().min(1).max(17));

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const vehicleFields = {
  modelId: z.uuid(),
  plateNumber,
  plateProvince: z.string().trim().min(1).max(50),
  vin: vin.nullish(),
  color: z.string().trim().max(30).nullish(),
  mileageKm: z.int().min(0).max(2_000_000).nullish(),
  location: locationSchema.nullish(),
  pickupAddress: z.string().trim().max(300).nullish(),
  dailyPrice: z.int().positive().max(100_000_000).nullish().describe('Satang (120000 = ฿1,200)'),
  description: z.string().trim().max(2000).nullish(),
};

// Unknown keys (ownerId, status, ...) are stripped, so clients can never set them.
export const createVehicleSchema = z.object(vehicleFields);
export const updateVehicleSchema = z
  .object(vehicleFields)
  .partial()
  .extend({ version: z.int().positive() });

export const listVehiclesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(vehicleStatus.enumValues).optional(),
});

// Response shapes (strict: tests fail if the API returns undocumented fields).
export const carModelSchema = z.strictObject({
  id: z.uuid(),
  make: z.string(),
  model: z.string(),
  year: z.int(),
  bodyType: z.enum(bodyType.enumValues),
  transmission: z.enum(transmission.enumValues),
  fuel: z.enum(fuelType.enumValues),
  seats: z.int(),
});

export const documentUploadSchema = z.object({
  type: z.enum(documentType.enumValues),
  expiresOn: z.iso.date().optional().describe('YYYY-MM-DD, e.g. insurance end date'),
});
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

const signedUrl = z.string().describe('Signed, expires in 1 hour; usable as <img src>');

export const photoSchema = z.strictObject({ id: z.uuid(), url: signedUrl });

export const documentSchema = z.strictObject({
  id: z.uuid(),
  type: z.enum(documentType.enumValues),
  expiresOn: z.iso.date().nullable(),
  url: signedUrl,
});

export const vehicleSchema = z.strictObject({
  id: z.uuid(),
  ownerId: z.uuid(),
  status: z.enum(vehicleStatus.enumValues),
  version: z.int(),
  plateNumber: z.string(),
  plateProvince: z.string(),
  vin: z.string().nullable(),
  color: z.string().nullable(),
  mileageKm: z.int().nullable(),
  location: locationSchema.nullable(),
  pickupAddress: z.string().nullable(),
  dailyPrice: z.int().nullable().describe('Satang'),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  model: carModelSchema.pick({ id: true, make: true, model: true, year: true }),
  photos: z.array(photoSchema).describe('Upload order; the first is the cover'),
  documents: z.array(documentSchema),
  statusReason: z.string().nullable().describe('Why the vehicle was rejected or suspended'),
});

export const vehiclePageSchema = z.strictObject({
  items: z.array(vehicleSchema),
  total: z.int(),
  page: z.int(),
  pageSize: z.int(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof listVehiclesSchema>;
