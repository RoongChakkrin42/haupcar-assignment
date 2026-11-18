import { registerSchema } from '@haupcar/shared';
import { eq, sql } from 'drizzle-orm';
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

/** For container start-up: creates the admin unless that email already exists (any case). */
export async function ensureAdmin(
  db: NodePgDatabase,
  input: { email: string; password: string; name: string },
) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, input.email.toLowerCase()));
  if (existing) return { created: false };
  await createAdmin(db, input);
  return { created: true };
}
