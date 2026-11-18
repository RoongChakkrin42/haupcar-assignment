import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import { requestLogging } from './common/request-logging.js';

// Shared by main.ts and tests so both run the app the same way.
export function setupApp<T extends INestApplication>(app: T): T {
  // Behind nginx/docker, take the client IP from X-Forwarded-For — but only when the request
  // comes from a private/loopback address, so outside clients can't spoof their IP.
  const express = app.getHttpAdapter().getInstance() as Express;
  express.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(requestLogging());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Haupcar API')
    .setDescription(
      'P2P car rental marketplace — vehicle registry.\n\n' +
        'Log in via `POST /auth/login`, then click **Authorize** and paste the `accessToken`.\n\n' +
        'Money is integer satang. Owners only ever see their own vehicles (others → 404).',
    )
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));
  return app;
}
