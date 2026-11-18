import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { User } from './auth.service.js';

export const IS_PUBLIC = 'isPublic';
/** Opts a route out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest().user,
);
