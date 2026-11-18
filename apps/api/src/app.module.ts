import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DbModule } from './db/db.module.js';
import { FilesModule } from './files/files.module.js';
import { HealthController } from './health/health.controller.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';

@Module({
  imports: [DbModule, FilesModule, AuthModule, VehiclesModule],
  controllers: [HealthController],
})
export class AppModule {}
