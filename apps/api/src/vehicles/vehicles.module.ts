import { Module } from '@nestjs/common';
import { CarModelsController } from './car-models.controller.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  controllers: [VehiclesController, CarModelsController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
