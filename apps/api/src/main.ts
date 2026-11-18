import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

try {
  process.loadEnvFile('../../.env'); // scripts run with cwd = apps/api
} catch {
  // no .env — rely on real env vars
}

async function bootstrap() {
  const app = setupApp(await NestFactory.create(AppModule));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
