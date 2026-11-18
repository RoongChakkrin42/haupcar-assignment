import type { INestApplication } from '@nestjs/common';

// Shared by main.ts and tests so both run the app the same way.
export function setupApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  return app;
}
