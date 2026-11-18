import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, sql } from 'drizzle-orm';
import { isUniqueViolation } from '../common/pg-error.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import type { RegisterInput } from './auth.schemas.js';
import { hashPassword, verifyPassword } from './password.js';

export type User = Pick<typeof users.$inferSelect, 'id' | 'email' | 'name' | 'phone' | 'role'>;
export type JwtPayload = { sub: string };

const publicColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  phone: users.phone,
  role: users.role,
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<User> {
    try {
      const [user] = await this.db
        .insert(users)
        .values({ ...input, passwordHash: await hashPassword(input.password), role: 'owner' })
        .returning(publicColumns);
      return user;
    } catch (e) {
      if (isUniqueViolation(e, 'users_email_unique')) {
        throw new ConflictException('Email is already registered');
      }
      throw e;
    }
  }

  /** Returns the user if the credentials match, otherwise null. */
  async validateCredentials(email: string, password: string): Promise<User | null> {
    const [row] = await this.db
      .select({ ...publicColumns, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(sql`lower(${users.email})`, email.toLowerCase()));
    if (!(await verifyPassword(password, row?.passwordHash))) return null;
    const { passwordHash: _, ...user } = row;
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db.select(publicColumns).from(users).where(eq(users.id, id));
    return user ?? null;
  }

  issueToken(user: User) {
    return { accessToken: this.jwt.sign({ sub: user.id } satisfies JwtPayload), user };
  }
}
