import { z } from 'zod';
import { userRole, vehicleStatus } from '../db/schema.js';
import { listVehiclesSchema, vehicleSchema } from './vehicles.schemas.js';

export const adminListVehiclesSchema = listVehiclesSchema.extend({
  order: z
    .enum(['newest', 'oldest'])
    .default('newest')
    .describe('By last update; use `oldest` for a FIFO review queue'),
});

const REASON_REQUIRED = ['rejected', 'suspended'];

export const setStatusSchema = z
  .object({
    status: z
      .enum(['approved', 'rejected', 'suspended'])
      .describe(
        'approve/reject a pending vehicle, suspend an approved one, or approve a suspended one (reinstate)',
      ),
    reason: z
      .string()
      .trim()
      .max(500)
      .optional()
      .describe('Required for rejected/suspended; shown to the owner'),
    version: z
      .int()
      .positive()
      .describe('Version you reviewed; 409 if the owner changed the vehicle since'),
  })
  .refine((b) => !REASON_REQUIRED.includes(b.status) || !!b.reason, {
    path: ['reason'],
    message: 'A reason is required to reject or suspend',
  });

export type AdminListVehiclesQuery = z.infer<typeof adminListVehiclesSchema>;
export type SetStatusInput = z.infer<typeof setStatusSchema>;

export const adminVehicleSchema = vehicleSchema.extend({
  owner: z.strictObject({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    phone: z.string().nullable(),
  }),
});

export const statusHistorySchema = z.strictObject({
  fromStatus: z.enum(vehicleStatus.enumValues).nullable(),
  toStatus: z.enum(vehicleStatus.enumValues),
  reason: z.string().nullable(),
  changedBy: z.strictObject({ id: z.uuid(), name: z.string(), role: z.enum(userRole.enumValues) }),
  createdAt: z.iso.datetime(),
});

export const adminVehicleDetailSchema = adminVehicleSchema.extend({
  history: z.array(statusHistorySchema).describe('Oldest first'),
});

export const adminVehiclePageSchema = z.strictObject({
  items: z.array(adminVehicleSchema),
  total: z.int(),
  page: z.int(),
  pageSize: z.int(),
});
