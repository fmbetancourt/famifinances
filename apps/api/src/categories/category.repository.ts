import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import type { CategoryKind, CategoryStatusFilter } from '@famifinances/contracts';
import { Category, CategoryDocument } from './category.schema';

export interface CreateCustomCategoryInput {
  familyId: string;
  createdBy: string;
  kind: CategoryKind;
  name: string;
}

export interface ListCategoriesFilter {
  kind?: CategoryKind;
  status: CategoryStatusFilter;
}

/**
 * Persistence for categories. System defaults are shared; custom categories are
 * bound to the caller's `familyId` on every query, so a foreign custom id resolves
 * to null → 404 (Principle I, FR-009). `familyId` is never taken from client input.
 */
@Injectable()
export class CategoryRepository {
  constructor(@InjectModel(Category.name) private readonly model: Model<CategoryDocument>) {}

  /** Idempotently ensures a system default exists (upsert by scope+kind+name). */
  async upsertSystem(kind: CategoryKind, name: string): Promise<void> {
    await this.model
      .updateOne(
        { scope: 'system', kind, name },
        { $setOnInsert: { scope: 'system', kind, name, familyId: null, archivedAt: null, createdBy: null } },
        { upsert: true },
      )
      .exec();
  }

  /** System defaults + the caller family's custom categories, per the status/kind filter. */
  async listVisible(familyId: string, filter: ListCategoriesFilter): Promise<CategoryDocument[]> {
    const family = new Types.ObjectId(familyId);
    let query: FilterQuery<CategoryDocument>;
    if (filter.status === 'archived') {
      // Archived custom only — system defaults are never archived, so they are excluded.
      query = { scope: 'family', familyId: family, archivedAt: { $ne: null } };
    } else {
      const familyClause: FilterQuery<CategoryDocument> =
        filter.status === 'all'
          ? { scope: 'family', familyId: family }
          : { scope: 'family', familyId: family, archivedAt: null };
      query = { $or: [{ scope: 'system' }, familyClause] };
    }
    if (filter.kind) {
      query = { ...query, kind: filter.kind };
    }
    return this.model.find(query).sort({ kind: 1, name: 1 }).exec();
  }

  /** A system default or a custom category owned by the caller's family; else null (→ 404). */
  async findVisible(familyId: string, categoryId: string): Promise<CategoryDocument | null> {
    if (!Types.ObjectId.isValid(categoryId)) {
      return null;
    }
    return this.model
      .findOne({
        _id: new Types.ObjectId(categoryId),
        $or: [{ scope: 'system' }, { scope: 'family', familyId: new Types.ObjectId(familyId) }],
      })
      .exec();
  }

  async createCustom(input: CreateCustomCategoryInput): Promise<CategoryDocument> {
    return this.model.create({
      scope: 'family',
      kind: input.kind,
      name: input.name,
      familyId: new Types.ObjectId(input.familyId),
      createdBy: new Types.ObjectId(input.createdBy),
      archivedAt: null,
    });
  }

  /** Renames a custom category owned by the caller's family (name only). */
  async renameCustom(
    familyId: string,
    categoryId: string,
    name: string,
  ): Promise<CategoryDocument | null> {
    if (!Types.ObjectId.isValid(categoryId)) {
      return null;
    }
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(categoryId), scope: 'family', familyId: new Types.ObjectId(familyId) },
        { $set: { name } },
        { new: true },
      )
      .exec();
  }

  async setArchived(
    familyId: string,
    categoryId: string,
    archivedAt: Date | null,
  ): Promise<CategoryDocument | null> {
    if (!Types.ObjectId.isValid(categoryId)) {
      return null;
    }
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(categoryId), scope: 'family', familyId: new Types.ObjectId(familyId) },
        { $set: { archivedAt } },
        { new: true },
      )
      .exec();
  }
}
