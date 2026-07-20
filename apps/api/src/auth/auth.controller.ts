import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccountSummary, TokenPair } from '@famifinances/contracts';
import { AUTH_THROTTLE } from '../config/security';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { CodeDto } from './dto/code.dto';
import { EmailDto, ResetConfirmDto } from './dto/reset.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';

/**
 * SEC-01 · stricter per-IP rate limit for credential endpoints (FR-004), overriding
 * the global throttler on these routes and layered on the per-account sign-in lockout.
 */
const CREDENTIAL_THROTTLE = {
  default: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttlMs },
};

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle(CREDENTIAL_THROTTLE)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Account created (email unverified).' })
  async register(@Body() dto: RegisterDto): Promise<AccountSummary> {
    return this.auth.register(dto.email, dto.password);
  }

  @Post('login')
  @Throttle(CREDENTIAL_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Authenticated; returns an access + refresh token pair.' })
  async login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Rotated; returns a new access + refresh token pair.' })
  async refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Session revoked; the refresh token can no longer be used.' })
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(user.accountId, dto.refreshToken);
  }

  @Post('email/verify')
  @Throttle(CREDENTIAL_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Email verified; family/financial actions unlocked.' })
  async verifyEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CodeDto,
  ): Promise<AccountSummary> {
    return this.auth.verifyEmail(user.accountId, dto.code);
  }

  @Post('email/verify/resend')
  @Throttle(CREDENTIAL_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  async resendVerification(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.resendVerification(user.accountId);
  }

  @Post('password/reset/request')
  @Throttle(CREDENTIAL_THROTTLE)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: 'Uniform response whether or not the email is registered (no enumeration).',
  })
  async requestPasswordReset(@Body() dto: EmailDto): Promise<void> {
    await this.auth.requestPasswordReset(dto.email);
  }

  @Post('password/reset/confirm')
  @Throttle(CREDENTIAL_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Password updated; all sessions revoked and email marked verified.',
  })
  async confirmPasswordReset(@Body() dto: ResetConfirmDto): Promise<void> {
    await this.auth.confirmPasswordReset(dto.email, dto.code, dto.newPassword);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'The identity of the token bearer (derived from the session).' })
  me(@CurrentUser() user: AuthenticatedUser): AccountSummary {
    return {
      accountId: user.accountId,
      email: user.email,
      emailVerified: user.emailVerified,
    };
  }
}
