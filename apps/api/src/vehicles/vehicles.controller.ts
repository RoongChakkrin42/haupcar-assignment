import {
  type CreateVehicleInput,
  createVehicleSchema,
  type ListVehiclesQuery,
  listVehiclesSchema,
  type UpdateVehicleInput,
  updateVehicleSchema,
  vehiclePageSchema,
  vehicleSchema,
} from '@haupcar/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiErrors, ApiZodBody, ApiZodQuery, ApiZodResponse } from '../common/openapi.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { VehiclesService } from './vehicles.service.js';

const NOT_FOUND: [number, string] = [
  404,
  "Vehicle doesn't exist, is deleted, or belongs to someone else",
];
const UNAUTHORIZED: [number, string] = [401, 'Missing or invalid token'];

/** Owner-facing: every action is scoped to the caller's own vehicles. */
@ApiTags('vehicles (owner)')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @ApiOperation({
    summary: 'List my vehicles',
    description: 'Newest first. Deleted vehicles are excluded.',
  })
  @ApiZodQuery(listVehiclesSchema)
  @ApiZodResponse(200, vehiclePageSchema)
  @ApiErrors([400, 'Invalid query'], UNAUTHORIZED)
  list(
    @CurrentUser() user: User,
    @Query(new ZodPipe(listVehiclesSchema)) query: ListVehiclesQuery,
  ) {
    return this.vehicles.list(user.id, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a vehicle (draft)',
    description:
      'Only `modelId`, `plateNumber`, `plateProvince` are required for a draft. ' +
      'Plate spaces/dashes are removed and VIN is upper-cased. `ownerId`/`status` in the body are ignored.',
  })
  @ApiZodBody(createVehicleSchema)
  @ApiZodResponse(201, vehicleSchema, 'Created as `draft`')
  @ApiErrors([400, 'Invalid fields or unknown car model'], UNAUTHORIZED, [
    409,
    'Plate (same province) or VIN already registered',
  ])
  create(
    @CurrentUser() user: User,
    @Body(new ZodPipe(createVehicleSchema)) body: CreateVehicleInput,
  ) {
    return this.vehicles.create(user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of my vehicles' })
  @ApiZodResponse(200, vehicleSchema)
  @ApiErrors([400, 'Malformed id'], UNAUTHORIZED, NOT_FOUND)
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a vehicle',
    description:
      'Partial update; send `null` to clear an optional field. Requires the current `version`. ' +
      'Changing plate, province, VIN or model of an `approved` vehicle sends it back to `pending_review`.',
  })
  @ApiZodBody(updateVehicleSchema)
  @ApiZodResponse(200, vehicleSchema, 'Updated; `version` incremented')
  @ApiErrors([400, 'Invalid fields'], UNAUTHORIZED, NOT_FOUND, [
    409,
    'Stale version, or plate/VIN taken',
  ])
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateVehicleSchema)) body: UpdateVehicleInput,
  ) {
    return this.vehicles.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a vehicle',
    description: 'Soft delete: frees the plate and VIN for re-use.',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiErrors(UNAUTHORIZED, NOT_FOUND)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.remove(user.id, id);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Submit for admin review',
    description:
      '`draft` or `rejected` → `pending_review`. Needs `location`, `dailyPrice` and `pickupAddress`.',
  })
  @ApiZodResponse(200, vehicleSchema, 'Now `pending_review`')
  @ApiErrors(
    UNAUTHORIZED,
    NOT_FOUND,
    [409, 'Not in draft/rejected'],
    [422, 'Incomplete; `missing` lists the fields'],
  )
  submit(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.submit(user.id, id);
  }
}
