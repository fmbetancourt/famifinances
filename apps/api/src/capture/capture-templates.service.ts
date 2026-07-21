import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import type { MovementTemplateSummary, MovementType } from '@famifinances/contracts';
import { FinancialAccountRepository } from '../financial-accounts/financial-account.repository';
import { CategoryRepository } from '../categories/category.repository';
import { CategoryDocument } from '../categories/category.schema';
import { FinancialAccountDocument } from '../financial-accounts/financial-account.schema';
import {
  MovementTemplateRepository,
  UpdateTemplatePatch,
} from './movement-template.repository';
import { MovementTemplateDocument } from './movement-template.schema';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class CaptureTemplatesService {
  private readonly logger = new Logger('CaptureTemplates');

  constructor(
    private readonly templates: MovementTemplateRepository,
    private readonly accounts: FinancialAccountRepository,
    private readonly categories: CategoryRepository,
  ) {}

  /** Create a family template (any member); references + kind + unique name validated. */
  async create(
    familyId: string,
    createdBy: string,
    dto: CreateTemplateDto,
  ): Promise<MovementTemplateSummary> {
    const name = dto.name.trim();
    await this.assertNameFree(familyId, name);
    await this.validateAccount(familyId, dto.accountId);
    await this.validateCategory(familyId, dto.categoryId, dto.type);

    const doc = await this.templates.create({
      familyId,
      createdBy,
      name,
      type: dto.type,
      accountId: dto.accountId,
      categoryId: dto.categoryId,
      amount: dto.amount ?? null,
      note: dto.note ?? null,
    });
    this.logger.log(`template.created id=${doc.id} family=${familyId}`);
    // Just validated, so both references are available.
    return this.toSummary(doc, true, true);
  }

  /** The family's templates with per-row reference-availability flags (set-based resolve). */
  async list(familyId: string): Promise<MovementTemplateSummary[]> {
    const docs = await this.templates.listByFamily(familyId);
    return this.withAvailability(familyId, docs);
  }

  /** One template of the family (404 otherwise) with its availability flags. */
  async get(familyId: string, templateId: string): Promise<MovementTemplateSummary> {
    const doc = await this.requireInFamily(familyId, templateId);
    const [summary] = await this.withAvailability(familyId, [doc]);
    return summary;
  }

  /** Edit a template (any member); effective references + kind + unique name re-validated. */
  async update(
    familyId: string,
    templateId: string,
    dto: UpdateTemplateDto,
  ): Promise<MovementTemplateSummary> {
    const existing = await this.requireInFamily(familyId, templateId);

    const patch = this.buildPatch(dto);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Provide at least one field to update.');
    }

    if (patch.name !== undefined) {
      await this.assertNameFree(familyId, patch.name, templateId);
    }

    // Re-validate the effective account + category against the effective type.
    const type: MovementType = dto.type ?? existing.type;
    const accountId = dto.accountId ?? existing.accountId.toString();
    await this.validateAccount(familyId, accountId);
    const categoryId = dto.categoryId ?? existing.categoryId.toString();
    await this.validateCategory(familyId, categoryId, type);

    const updated = (await this.templates.update(familyId, templateId, patch)) ?? existing;
    this.logger.log(`template.updated id=${templateId} family=${familyId}`);
    const [summary] = await this.withAvailability(familyId, [updated]);
    return summary;
  }

  /** Delete a template of the family (404 when absent). */
  async delete(familyId: string, templateId: string): Promise<void> {
    const removed = await this.templates.deleteInFamily(familyId, templateId);
    if (!removed) {
      throw new NotFoundException('Template not found in this family.');
    }
    this.logger.log(`template.deleted id=${templateId} family=${familyId}`);
  }

  private async assertNameFree(familyId: string, name: string, excludeId?: string): Promise<void> {
    if (await this.templates.existsByName(familyId, name, excludeId)) {
      throw new ConflictException('A template with this name already exists.');
    }
  }

  private async validateAccount(familyId: string, accountId: string): Promise<void> {
    const account = await this.accounts.findInFamily(familyId, accountId);
    if (!account || account.archivedAt !== null) {
      throw new BadRequestException('Account is not available.');
    }
  }

  private async validateCategory(
    familyId: string,
    categoryId: string,
    type: MovementType,
  ): Promise<void> {
    const category = await this.categories.findVisible(familyId, categoryId);
    if (!category || (category.scope === 'family' && category.archivedAt !== null)) {
      throw new BadRequestException('Category is not available.');
    }
    if (category.kind !== type) {
      throw new BadRequestException('Category kind does not match the template type.');
    }
  }

  private buildPatch(dto: UpdateTemplateDto): UpdateTemplatePatch {
    const patch: UpdateTemplatePatch = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.accountId !== undefined) patch.accountId = new Types.ObjectId(dto.accountId);
    if (dto.categoryId !== undefined) patch.categoryId = new Types.ObjectId(dto.categoryId);
    if (dto.amount !== undefined) patch.amount = dto.amount;
    if (dto.note !== undefined) patch.note = dto.note;
    return patch;
  }

  private async requireInFamily(
    familyId: string,
    templateId: string,
  ): Promise<MovementTemplateDocument> {
    const template = await this.templates.findInFamily(familyId, templateId);
    if (!template) {
      throw new NotFoundException('Template not found in this family.');
    }
    return template;
  }

  /** Resolves reference availability for a batch of templates in two set-based queries. */
  private async withAvailability(
    familyId: string,
    docs: MovementTemplateDocument[],
  ): Promise<MovementTemplateSummary[]> {
    if (docs.length === 0) {
      return [];
    }
    const accountIds = [...new Set(docs.map((d) => d.accountId.toString()))];
    const categoryIds = [...new Set(docs.map((d) => d.categoryId.toString()))];
    const [accounts, categories] = await Promise.all([
      this.accounts.findManyInFamily(familyId, accountIds),
      this.categories.findManyVisible(familyId, categoryIds),
    ]);
    const accountById = new Map<string, FinancialAccountDocument>(accounts.map((a) => [a.id, a]));
    const categoryById = new Map<string, CategoryDocument>(categories.map((c) => [c.id, c]));

    return docs.map((doc) => {
      const account = accountById.get(doc.accountId.toString());
      const category = categoryById.get(doc.categoryId.toString());
      const accountAvailable = !!account && account.archivedAt === null;
      const categoryAvailable =
        !!category &&
        category.kind === doc.type &&
        !(category.scope === 'family' && category.archivedAt !== null);
      return this.toSummary(doc, accountAvailable, categoryAvailable);
    });
  }

  private toSummary(
    doc: MovementTemplateDocument,
    accountAvailable: boolean,
    categoryAvailable: boolean,
  ): MovementTemplateSummary {
    return {
      templateId: doc.id,
      name: doc.name,
      type: doc.type,
      accountId: doc.accountId.toString(),
      categoryId: doc.categoryId.toString(),
      amount: doc.amount,
      note: doc.note,
      accountAvailable,
      categoryAvailable,
    };
  }
}
