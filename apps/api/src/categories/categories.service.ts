import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CategoryStatusFilter, CategorySummary } from '@famifinances/contracts';
import { CategoryRepository } from './category.repository';
import { CategoryDocument } from './category.schema';
import { DEFAULT_SYSTEM_CATEGORIES } from './category.seed';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQuery } from './dto/list-categories.query';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger('Categories');

  constructor(private readonly categories: CategoryRepository) {}

  /** Idempotently seeds the system default categories (run on module init, R2). */
  async seedSystemDefaults(): Promise<void> {
    for (const { kind, name } of DEFAULT_SYSTEM_CATEGORIES) {
      await this.categories.upsertSystem(kind, name);
    }
    this.logger.log(`category.seed count=${DEFAULT_SYSTEM_CATEGORIES.length}`);
  }

  /** US1 · System defaults + the family's custom categories, scoped from the session (FR-008). */
  async listCategories(familyId: string, query: ListCategoriesQuery): Promise<CategorySummary[]> {
    const status: CategoryStatusFilter = query.status ?? 'active';
    const docs = await this.categories.listVisible(familyId, { kind: query.kind, status });
    return docs.map((doc) => this.toSummary(doc));
  }

  /** US1/US3 · One visible category (system or own custom), resolved from the session (404 otherwise). */
  async getCategory(familyId: string, categoryId: string): Promise<CategorySummary> {
    return this.toSummary(await this.requireVisible(familyId, categoryId));
  }

  /** US2 · Create a custom category for the caller's family (FR-003, FR-014). */
  async createCategory(
    familyId: string,
    createdBy: string,
    dto: CreateCategoryDto,
  ): Promise<CategorySummary> {
    const doc = await this.categories.createCustom({
      familyId,
      createdBy,
      kind: dto.kind,
      name: dto.name,
    });
    this.logger.log(`category.created id=${doc.id} family=${familyId}`);
    return this.toSummary(doc);
  }

  /** US4 · Rename a custom category. System defaults are read-only (403); archived custom is read-only (409). */
  async renameCategory(
    familyId: string,
    categoryId: string,
    name: string,
  ): Promise<CategorySummary> {
    const existing = await this.requireOwnCustom(familyId, categoryId);
    if (existing.archivedAt !== null) {
      throw new ConflictException('Category is archived; unarchive it before renaming.');
    }
    const updated = await this.categories.renameCustom(familyId, categoryId, name);
    return this.toSummary(updated ?? existing);
  }

  /** US5 · Archive a custom category (idempotent). System defaults cannot be archived (403). */
  async archive(familyId: string, categoryId: string): Promise<CategorySummary> {
    const existing = await this.requireOwnCustom(familyId, categoryId);
    if (existing.archivedAt !== null) {
      return this.toSummary(existing); // idempotent
    }
    const updated = await this.categories.setArchived(familyId, categoryId, new Date());
    this.logger.log(`category.archived id=${categoryId} family=${familyId}`);
    return this.toSummary(updated ?? existing);
  }

  /** US5 · Unarchive a custom category (idempotent). */
  async unarchive(familyId: string, categoryId: string): Promise<CategorySummary> {
    const existing = await this.requireOwnCustom(familyId, categoryId);
    if (existing.archivedAt === null) {
      return this.toSummary(existing); // idempotent
    }
    const updated = await this.categories.setArchived(familyId, categoryId, null);
    this.logger.log(`category.unarchived id=${categoryId} family=${familyId}`);
    return this.toSummary(updated ?? existing);
  }

  private async requireVisible(familyId: string, categoryId: string): Promise<CategoryDocument> {
    const category = await this.categories.findVisible(familyId, categoryId);
    if (!category) {
      throw new NotFoundException('Category not found.');
    }
    return category;
  }

  /** Resolves a mutable target: visible (else 404) and owned custom (a system default → 403). */
  private async requireOwnCustom(familyId: string, categoryId: string): Promise<CategoryDocument> {
    const category = await this.requireVisible(familyId, categoryId);
    if (category.scope === 'system') {
      throw new ForbiddenException('System categories are read-only.');
    }
    return category;
  }

  private toSummary(doc: CategoryDocument): CategorySummary {
    return {
      categoryId: doc.id,
      name: doc.name,
      kind: doc.kind,
      scope: doc.scope,
      archived: doc.archivedAt !== null,
    };
  }
}
