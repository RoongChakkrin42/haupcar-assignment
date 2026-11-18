import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators.js';
import { Roles } from '../auth/roles.guard.js';
import { ApiErrors, ApiZodBody, ApiZodQuery, ApiZodResponse } from '../common/openapi.js';
import { ZodPipe } from '../common/zod.pipe.js';
import {
  type AdminListVehiclesQuery,
  adminListVehiclesSchema,
  adminVehicleDetailSchema,
  adminVehiclePageSchema,
  type SetStatusInput,
  setStatusSchema,
} from './admin-vehicles.schemas.js';
import { AdminVehiclesService } from './admin-vehicles.service.js';

const AUTH_ERRORS: [number, string][] = [
  [401, 'Missing or invalid token'],
  [403, 'Not an admin'],
];
const NOT_FOUND: [number, string] = [404, 'Vehicle not found or deleted'];

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/vehicles')
export class AdminVehiclesController {
  constructor(private readonly admin: AdminVehiclesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all vehicles',
    description: 'Every owner, excluding deleted vehicles.',
  })
  @ApiZodQuery(adminListVehiclesSchema)
  @ApiZodResponse(200, adminVehiclePageSchema)
  @ApiErrors([400, 'Invalid query'], ...AUTH_ERRORS)
  list(@Query(new ZodPipe(adminListVehiclesSchema)) query: AdminListVehiclesQuery) {
    return this.admin.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Review a vehicle',
    description: 'Includes owner contact, documents and status history.',
  })
  @ApiZodResponse(200, adminVehicleDetailSchema)
  @ApiErrors(...AUTH_ERRORS, NOT_FOUND)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.get(id);
  }

  @Post(':id/status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Approve, reject, suspend or reinstate',
    description:
      'pending_review → approved | rejected; approved → suspended; suspended → approved. ' +
      'Reject/suspend need a `reason`, which the owner sees as `statusReason`.',
  })
  @ApiZodBody(setStatusSchema)
  @ApiZodResponse(200, adminVehicleDetailSchema)
  @ApiErrors([400, 'Invalid body or missing reason'], ...AUTH_ERRORS, NOT_FOUND, [
    409,
    'Transition not allowed, or the vehicle changed since `version`',
  ])
  setStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(setStatusSchema)) body: SetStatusInput,
  ) {
    return this.admin.setStatus(user.id, id, body);
  }
}
