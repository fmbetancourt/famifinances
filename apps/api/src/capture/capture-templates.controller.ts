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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MovementTemplateSummary } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { CaptureTemplatesService } from './capture-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@ApiTags('capture')
@ApiBearerAuth()
@Controller({ path: 'capture-templates', version: '1' })
export class CaptureTemplatesController {
  constructor(private readonly templates: CaptureTemplatesService) {}

  // Writes: any family member + verified email. Guard order FamilyScope → Email keeps
  // no-family = 404 and unverified = 403 (ACC-01 convention); no role gate (FR-013).
  @Post()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Body() dto: CreateTemplateDto,
  ): Promise<MovementTemplateSummary> {
    return this.templates.create(family.familyId, user.accountId, dto);
  }

  // Reads: any family member (Principle-I scope only).
  @Get()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async list(@CurrentFamily() family: CurrentFamilyContext): Promise<MovementTemplateSummary[]> {
    return this.templates.list(family.familyId);
  }

  @Get(':templateId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async getOne(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('templateId') templateId: string,
  ): Promise<MovementTemplateSummary> {
    return this.templates.get(family.familyId, templateId);
  }

  @Patch(':templateId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  async update(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateTemplateDto,
  ): Promise<MovementTemplateSummary> {
    return this.templates.update(family.familyId, templateId, dto);
  }

  @Delete(':templateId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('templateId') templateId: string,
  ): Promise<void> {
    await this.templates.delete(family.familyId, templateId);
  }
}
