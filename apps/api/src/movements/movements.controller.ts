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
import type { MovementSummary } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';
import { ListMovementsQuery } from './dto/list-movements.query';

@ApiTags('movements')
@ApiBearerAuth()
@Controller({ path: 'movements', version: '1' })
export class MovementsController {
  constructor(private readonly movements: MovementsService) {}

  // Guard order: FamilyScopeGuard before EmailVerifiedGuard so "no family" is a
  // consistent 404 and 403 is reserved for the email soft gate (ACC-01 convention).
  @Post()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Body() dto: CreateMovementDto,
  ): Promise<MovementSummary> {
    return this.movements.createMovement(family.familyId, user.accountId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async list(
    @CurrentFamily() family: CurrentFamilyContext,
    @Query() query: ListMovementsQuery,
  ): Promise<MovementSummary[]> {
    return this.movements.listMovements(family.familyId, query);
  }

  @Get(':movementId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async getOne(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('movementId') movementId: string,
  ): Promise<MovementSummary> {
    return this.movements.getMovement(family.familyId, movementId);
  }

  @Patch(':movementId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('movementId') movementId: string,
    @Body() dto: UpdateMovementDto,
  ): Promise<MovementSummary> {
    return this.movements.updateMovement(family.familyId, user.accountId, movementId, dto);
  }

  @Delete(':movementId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('movementId') movementId: string,
  ): Promise<void> {
    await this.movements.deleteMovement(family.familyId, user.accountId, movementId);
  }
}
