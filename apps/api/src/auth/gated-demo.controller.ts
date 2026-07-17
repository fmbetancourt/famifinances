import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';

/**
 * TEMPORARY test-only route to exercise the EmailVerifiedGuard within AUTH-01
 * (the real family/financial routes arrive in FAM-01). Excluded from the public
 * OpenAPI document. Remove once FAM-01 provides genuine gated endpoints.
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
}
