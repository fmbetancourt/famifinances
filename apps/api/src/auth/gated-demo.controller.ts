import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';

/**
 * TEMPORARY test-only routes that exercise the auth guards within AUTH-01 (the
 * real family/financial routes arrive in FAM-01). Registered only under
 * NODE_ENV=test and excluded from the public OpenAPI document. Remove once
 * FAM-01 provides genuine gated endpoints.
 */
@ApiExcludeController()
@Controller({ path: 'auth', version: '1' })
export class GatedDemoController {
  @Get('gated-demo')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @ApiBearerAuth()
  demo(@CurrentUser() user: AuthenticatedUser): { ok: true; accountId: string } {
    return { ok: true, accountId: user.accountId };
  }

  @Get('whoami-demo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  whoami(
    @CurrentUser() user: AuthenticatedUser,
    // Deliberately accepts (and ignores) a caller-supplied identifier to prove
    // the identity comes only from the verified session (FR-011).
    @Query('claimedAccountId') _claimedAccountId?: string,
  ): { accountId: string } {
    return { accountId: user.accountId };
  }
}
