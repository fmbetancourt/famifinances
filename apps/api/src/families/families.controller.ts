import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FamilyDetail, FamilySummary, InviteCodeResponse } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { JoinFamilyDto } from './dto/join-family.dto';
import { FamilyScopeGuard } from './guards/family-scope.guard';
import { FamilyRoleGuard } from './guards/family-role.guard';
import { CurrentFamily } from './decorators/current-family.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentFamilyContext } from './types/current-family';

@ApiTags('families')
@ApiBearerAuth()
@Controller({ path: 'families', version: '1' })
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFamilyDto,
  ): Promise<FamilySummary> {
    return this.families.createFamily(user.accountId, dto.name);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async myFamily(@CurrentFamily() family: CurrentFamilyContext): Promise<FamilyDetail> {
    return this.families.getMyFamily(family);
  }

  @Post('me/invites')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, FamilyRoleGuard)
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  async issueInvite(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
  ): Promise<InviteCodeResponse> {
    return this.families.issueInvite(family, user.accountId);
  }

  @Post('join')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  async join(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: JoinFamilyDto,
  ): Promise<FamilySummary> {
    return this.families.joinFamily(user.accountId, dto.code);
  }
}
