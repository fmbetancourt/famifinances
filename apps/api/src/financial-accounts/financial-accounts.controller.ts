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

  @Post()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, FamilyScopeGuard)
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
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, FamilyScopeGuard)
  async update(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<FinancialAccountSummary> {
    return this.accounts.updateAccount(family.familyId, accountId, dto);
  }

  @Post(':accountId/archive')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, FamilyScopeGuard)
  @HttpCode(HttpStatus.OK)
  async archive(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('accountId') accountId: string,
  ): Promise<FinancialAccountSummary> {
    return this.accounts.archive(family.familyId, accountId);
  }

  @Post(':accountId/unarchive')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, FamilyScopeGuard)
  @HttpCode(HttpStatus.OK)
  async unarchive(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('accountId') accountId: string,
  ): Promise<FinancialAccountSummary> {
    return this.accounts.unarchive(family.familyId, accountId);
  }
}
