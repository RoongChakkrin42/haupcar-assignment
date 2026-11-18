import { registerSchema } from '@haupcar/shared';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../db/schema.js';
import { hashPassword } from './password.js';

/** Admins can only be created here (CLI), never through the public API. */
export async function createAdmin(
  db: NodePgDatabase,
  input: { email: string; password: string; name: string },
) {
  const { email, password, name } = registerSchema.parse(input);
  const [admin] = await db
    .insert(users)
    .values({ email, name, passwordHash: await hashPassword(password), role: 'admin' })
    .returning({ id: users.id, email: users.email });
  return admin;
}
