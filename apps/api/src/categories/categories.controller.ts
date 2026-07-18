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
import type { CategorySummary } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ListCategoriesQuery } from './dto/list-categories.query';

@ApiTags('categories')
@ApiBearerAuth()
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async list(
    @CurrentFamily() family: CurrentFamilyContext,
    @Query() query: ListCategoriesQuery,
  ): Promise<CategorySummary[]> {
    return this.categories.listCategories(family.familyId, query);
  }

  @Get(':categoryId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async getOne(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('categoryId') categoryId: string,
  ): Promise<CategorySummary> {
    return this.categories.getCategory(family.familyId, categoryId);
  }

  // Guard order: FamilyScopeGuard before EmailVerifiedGuard so "no family" is a
  // consistent 404 and 403 is reserved for the email soft gate (ACC-01 convention).
  @Post()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategorySummary> {
    return this.categories.createCategory(family.familyId, user.accountId, dto);
  }

  @Patch(':categoryId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  async rename(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategorySummary> {
    return this.categories.renameCategory(family.familyId, categoryId, dto.name);
  }

  @Post(':categoryId/archive')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  async archive(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('categoryId') categoryId: string,
  ): Promise<CategorySummary> {
    return this.categories.archive(family.familyId, categoryId);
  }

  @Post(':categoryId/unarchive')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  async unarchive(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('categoryId') categoryId: string,
  ): Promise<CategorySummary> {
    return this.categories.unarchive(family.familyId, categoryId);
  }
}
