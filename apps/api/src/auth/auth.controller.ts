import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AccountSummary, TokenPair } from '@famifinances/contracts';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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
