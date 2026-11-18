import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SANE_ID = /^[\w-]{1,100}$/;
const logger = new Logger('HTTP');

/**
 * Tags each request with an id (reusing a well-formed X-Request-Id from a proxy) and logs one
 * line per response. Logs the path only: query strings carry file-URL signatures, and headers
 * and bodies carry tokens and personal data.
 */
export function requestLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && SANE_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', requestId);
    const start = performance.now();
    res.on('finish', () => {
      logger.log({
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Math.round(performance.now() - start),
        ip: req.ip,
      });
    });
    next();
  };
}
