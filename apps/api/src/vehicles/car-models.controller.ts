import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { asc } from 'drizzle-orm';
import { ApiZodResponse } from '../common/openapi.js';
import { DB, type Db } from '../db/db.module.js';
import { carModels } from '../db/schema.js';
import { carModelSchema } from './vehicles.schemas.js';

@ApiTags('car models')
@ApiBearerAuth()
@Controller('car-models')
export class CarModelsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @ApiOperation({ summary: 'List car models for the vehicle form' })
  @ApiZodResponse(200, carModelSchema.array())
  list() {
    return this.db
      .select()
      .from(carModels)
      .orderBy(asc(carModels.make), asc(carModels.model), asc(carModels.year));
  }
}
