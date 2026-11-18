import {
  authTokenSchema,
  loginSchema,
  type RegisterInput,
  registerSchema,
  userSchema,
} from '@haupcar/shared';
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiErrors, ApiZodBody, ApiZodResponse } from '../common/openapi.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AuthService, type User } from './auth.service.js';
import { CurrentUser, Public } from './decorators.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  @ApiOperation({
    summary: 'Sign up as a car owner',
    description: 'Always creates role `owner`; admins are CLI-only.',
  })
  @ApiZodBody(registerSchema)
  @ApiZodResponse(201, authTokenSchema, 'Registered and logged in')
  @ApiErrors(
    [400, 'Invalid fields'],
    [409, 'Email already registered (case-insensitive)'],
    [429, 'Too many attempts from this IP; see Retry-After'],
  )
  async register(@Body(new ZodPipe(registerSchema)) body: RegisterInput) {
    return this.auth.issueToken(await this.auth.register(body));
  }

  @Public()
  @UseGuards(ThrottlerGuard, AuthGuard('local')) // throttle first so failed logins count
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiZodBody(loginSchema)
  @ApiZodResponse(200, authTokenSchema)
  @ApiErrors(
    [401, 'Wrong email or password (same response for both)'],
    [429, 'Too many attempts from this IP; see Retry-After'],
  )
  login(@CurrentUser() user: User) {
    return this.auth.issueToken(user);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user' })
  @ApiZodResponse(200, userSchema)
  @ApiErrors([401, 'Missing, invalid or expired token'])
  me(@CurrentUser() user: User) {
    return user;
  }
}
