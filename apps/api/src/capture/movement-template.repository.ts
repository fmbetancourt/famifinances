import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { MovementType } from '@famifinances/contracts';
import { escapeRegex } from '../common/escape-regex';
import { MovementTemplate, MovementTemplateDocument } from './movement-template.schema';

export interface CreateTemplateInput {
  familyId: string;
  createdBy: string;
  name: string;
  type: MovementType;
  accountId: string;
  categoryId: string;
  amount: number | null;
  note: string | null;
}

export interface UpdateTemplatePatch {
  name?: string;
  type?: MovementType;
  accountId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  amount?: number | null;
  note?: string | null;
}

/**
 * Family-scoped persistence for movement templates. EVERY query is bound to the
 * caller's `familyId` (from the session), so a foreign or unknown id resolves to
 * null/false → 404 (Principle I). `familyId` is never taken from client input.
 */
@Injectable()
export class MovementTemplateRepository {
  constructor(
    @InjectModel(MovementTemplate.name)
    private readonly model: Model<MovementTemplateDocument>,
  ) {}

  async create(input: CreateTemplateInput): Promise<MovementTemplateDocument> {
    return this.model.create({
      familyId: new Types.ObjectId(input.familyId),
      createdBy: new Types.ObjectId(input.createdBy),
      name: input.name,
      type: input.type,
      accountId: new Types.ObjectId(input.accountId),
      categoryId: new Types.ObjectId(input.categoryId),
      amount: input.amount,
      note: input.note,
    });
  }

  /** One template of the family; else null (→ 404). */
  async findInFamily(familyId: string, templateId: string): Promise<MovementTemplateDocument | null> {
    if (!Types.ObjectId.isValid(templateId)) {
      return null;
    }
    return this.model
      .findOne({ _id: new Types.ObjectId(templateId), familyId: new Types.ObjectId(familyId) })
      .exec();
  }

  /** The family's templates, newest first. */
  async listByFamily(familyId: string): Promise<MovementTemplateDocument[]> {
    return this.model
      .find({ familyId: new Types.ObjectId(familyId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** True if the family already has a template with this name (case-insensitive), excluding `excludeId`. */
  async existsByName(familyId: string, name: string, excludeId?: string): Promise<boolean> {
    const query: Record<string, unknown> = {
      familyId: new Types.ObjectId(familyId),
      name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
    };
    if (excludeId && Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: new Types.ObjectId(excludeId) };
    }
    const found = await this.model.exists(query).exec();
    return found !== null;
  }

  async update(
    familyId: string,
    templateId: string,
    patch: UpdateTemplatePatch,
  ): Promise<MovementTemplateDocument | null> {
    if (!Types.ObjectId.isValid(templateId)) {
      return null;
    }
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(templateId), familyId: new Types.ObjectId(familyId) },
        { $set: patch },
        { new: true },
      )
      .exec();
  }

  /** Hard-deletes a template of the family; returns whether a row was removed. */
  async deleteInFamily(familyId: string, templateId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(templateId)) {
      return false;
    }
    const result = await this.model
      .deleteOne({ _id: new Types.ObjectId(templateId), familyId: new Types.ObjectId(familyId) })
      .exec();
    return result.deletedCount > 0;
  }
}
