import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from './auth.service.js';

const ROLES = 'roles';
export const Roles = (...roles: User['role'][]) => SetMetadata(ROLES, roles);

/** Global guard (runs after JwtAuthGuard): routes marked @Roles(...) need one of those roles, else 403. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<User['role'][] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles) return true;
    const user: User | undefined = ctx.switchToHttp().getRequest().user;
    return !!user && roles.includes(user.role);
  }
}
