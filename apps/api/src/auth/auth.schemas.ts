import { z } from 'zod';
import { userRole } from '../db/schema.js';

export const registerSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(72), // bcrypt ignores bytes past 72
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(20).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email: z.email(), password: z.string() });

// Response shapes (strict: tests fail if the API returns undocumented fields).
export const userSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  phone: z.string().nullable(),
  role: z.enum(userRole.enumValues),
});
export const authTokenSchema = z.strictObject({
  accessToken: z
    .string()
    .describe('JWT, send as `Authorization: Bearer <token>`; expires in 1 day'),
  user: userSchema,
});
