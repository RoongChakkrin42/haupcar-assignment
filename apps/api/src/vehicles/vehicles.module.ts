import { Module } from '@nestjs/common';
import { AdminVehiclesController } from './admin-vehicles.controller.js';
import { AdminVehiclesService } from './admin-vehicles.service.js';
import { CarModelsController } from './car-models.controller.js';
import { VehicleMediaController } from './vehicle-media.controller.js';
import { VehicleMediaService } from './vehicle-media.service.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  controllers: [
    VehiclesController,
    VehicleMediaController,
    CarModelsController,
    AdminVehiclesController,
  ],
  providers: [VehiclesService, VehicleMediaService, AdminVehiclesService],
})
export class VehiclesModule {}
