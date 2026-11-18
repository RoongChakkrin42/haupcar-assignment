import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';

@Module({
  imports: [DbModule, AuthModule, VehiclesModule],
  controllers: [HealthController],
})
export class AppModule {}
