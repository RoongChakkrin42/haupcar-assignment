import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/decorators.js';
import { DB, type Db } from '../db/db.module.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', db: 'ok' };
  }
}
