import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

try {
  process.loadEnvFile('../../.env'); // scripts run with cwd = apps/api
} catch {
  // no .env — rely on real env vars
}

async function bootstrap() {
  // One JSON object per line in production (log collectors parse it); readable text in dev.
  const logger = new ConsoleLogger({ json: process.env.NODE_ENV === 'production' });
  const app = setupApp(await NestFactory.create(AppModule, { logger }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
