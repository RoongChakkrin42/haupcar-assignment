import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { JwtStrategy, LocalStrategy, requireJwtSecret } from './strategies.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({ secret: requireJwtSecret(), signOptions: { expiresIn: '1d' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    // Order matters: authenticate first, then check roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
