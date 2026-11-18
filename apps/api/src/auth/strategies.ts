import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategyBase } from 'passport-jwt';
import { Strategy as LocalStrategyBase } from 'passport-local';
import { AuthService, type JwtPayload, type User } from './auth.service.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(LocalStrategyBase) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<User> {
    const user = await this.auth.validateCredentials(email, password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return user;
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(JwtStrategyBase) {
  constructor(private readonly auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: requireJwtSecret(),
    });
  }

  // Re-read the user so deleted users and role changes take effect immediately.
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.auth.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}
