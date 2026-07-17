import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AccountSummary, TokenPair } from '@famifinances/contracts';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { CodeDto } from './dto/code.dto';
import { EmailDto, ResetConfirmDto } from './dto/reset.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Account created (email unverified).' })
  async register(@Body() dto: RegisterDto): Promise<AccountSummary> {
    return this.auth.register(dto.email, dto.password);
  }

  @Post('login')
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  async resendVerification(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.resendVerification(user.accountId);
  }

  @Post('password/reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: 'Uniform response whether or not the email is registered (no enumeration).',
  })
  async requestPasswordReset(@Body() dto: EmailDto): Promise<void> {
    await this.auth.requestPasswordReset(dto.email);
  }

  @Post('password/reset/confirm')
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
