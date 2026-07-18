import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FinancialAccountSummary } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { FinancialAccountsService } from './financial-accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ListAccountsQuery } from './dto/list-accounts.query';

@ApiTags('accounts')
@ApiBearerAuth()
@Controller({ path: 'accounts', version: '1' })
export class FinancialAccountsController {
  constructor(private readonly accounts: FinancialAccountsService) {}

  // Guard order matters: FamilyScopeGuard runs before EmailVerifiedGuard so the
  // Principle-I family boundary is evaluated first — "no family" is consistently a
  // 404 across every route, and the 403 email soft gate (FR-011) is reserved for an
  // in-family-but-unverified caller (defense-in-depth; the domain never produces one,
  // since joining a family already requires a verified email).
  @Post()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Body() dto: CreateAccountDto,
  ): Promise<FinancialAccountSummary> {
    return this.accounts.createAccount(family.familyId, user.accountId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async list(
    @CurrentFamily() family: CurrentFamilyContext,
    @Query() query: ListAccountsQuery,
  ): Promise<FinancialAccountSummary[]> {
    return this.accounts.listAccounts(family.familyId, query.status ?? 'active');
  }

  @Get(':accountId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async getOne(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('accountId') accountId: string,
  ): Promise<FinancialAccountSummary> {
    return this.accounts.getAccount(family.familyId, accountId);
  }

  @Patch(':accountId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  async update(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<FinancialAccountSummary> {
    return this.accounts.updateAccount(family.familyId, accountId, dto);
  }

  @Post(':accountId/archive')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  async archive(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('accountId') accountId: string,
  ): Promise<FinancialAccountSummary> {
    return this.accounts.archive(family.familyId, accountId);
  }

  @Post(':accountId/unarchive')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  async unarchive(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('accountId') accountId: string,
  ): Promise<FinancialAccountSummary> {
    return this.accounts.unarchive(family.familyId, accountId);
  }
}
