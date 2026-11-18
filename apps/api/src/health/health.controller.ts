import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { Public } from '../auth/decorators.js';
import { ApiZodResponse } from '../common/openapi.js';
import { DB, type Db } from '../db/db.module.js';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @ApiOperation({ summary: 'API and database liveness' })
  @ApiZodResponse(200, z.strictObject({ status: z.literal('ok'), db: z.literal('ok') }))
  async check() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', db: 'ok' };
  }
}
