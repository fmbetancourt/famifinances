import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CaptureDefaults } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { CaptureDefaultsService } from './capture-defaults.service';

@ApiTags('capture')
@ApiBearerAuth()
@Controller({ path: 'capture-defaults', version: '1' })
export class CaptureDefaultsController {
  constructor(private readonly defaults: CaptureDefaultsService) {}

  // Read: any family member (Principle-I scope only, no email/role gate).
  @Get()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
  ): Promise<CaptureDefaults> {
    return this.defaults.getDefaults(family.familyId, user.accountId);
  }
}
