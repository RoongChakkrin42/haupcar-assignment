import { Module } from '@nestjs/common';
import { CarModelsController } from './car-models.controller.js';
import { VehicleMediaController } from './vehicle-media.controller.js';
import { VehicleMediaService } from './vehicle-media.service.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  controllers: [VehiclesController, VehicleMediaController, CarModelsController],
  providers: [VehiclesService, VehicleMediaService],
})
export class VehiclesModule {}
