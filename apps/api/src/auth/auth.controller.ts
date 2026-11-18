import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZodPipe } from '../common/zod.pipe.js';
import { type RegisterInput, registerSchema } from './auth.schemas.js';
import { AuthService, type User } from './auth.service.js';
import { CurrentUser, Public } from './decorators.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body(new ZodPipe(registerSchema)) body: RegisterInput) {
    return this.auth.issueToken(await this.auth.register(body));
  }

  @Public()
  @UseGuards(AuthGuard('local'))
  @HttpCode(200)
  @Post('login')
  login(@CurrentUser() user: User) {
    return this.auth.issueToken(user);
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }
}
