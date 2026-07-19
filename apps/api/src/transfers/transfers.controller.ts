import {
  Body,
  Controller,
  Delete,
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
import type { TransferSummary } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';
import { ListTransfersQuery } from './dto/list-transfers.query';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller({ path: 'transfers', version: '1' })
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  // Guard order: FamilyScopeGuard before EmailVerifiedGuard so "no family" is a
  // consistent 404 and 403 is reserved for the email soft gate (ACC-01 convention).
  @Post()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Body() dto: CreateTransferDto,
  ): Promise<TransferSummary> {
    return this.transfers.createTransfer(family.familyId, user.accountId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async list(
    @CurrentFamily() family: CurrentFamilyContext,
    @Query() query: ListTransfersQuery,
  ): Promise<TransferSummary[]> {
    return this.transfers.listTransfers(family.familyId, query);
  }

  @Get(':transferId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async getOne(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('transferId') transferId: string,
  ): Promise<TransferSummary> {
    return this.transfers.getTransfer(family.familyId, transferId);
  }

  @Patch(':transferId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('transferId') transferId: string,
    @Body() dto: UpdateTransferDto,
  ): Promise<TransferSummary> {
    return this.transfers.updateTransfer(family.familyId, user.accountId, transferId, dto);
  }

  @Delete(':transferId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('transferId') transferId: string,
  ): Promise<void> {
    await this.transfers.deleteTransfer(family.familyId, user.accountId, transferId);
  }
}
