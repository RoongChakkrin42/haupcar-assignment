import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(72), // bcrypt ignores bytes past 72
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(20).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;
