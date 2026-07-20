import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BudgetAllocation, BudgetAllocationDocument } from './budget-allocation.schema';

/**
 * Family-scoped persistence for budget allocations. EVERY query is bound to the
 * caller's `familyId` (from the session), so a foreign or unknown id resolves to
 * null/false → 404 (Principle I). `familyId` is never taken from client input.
 */
@Injectable()
export class BudgetAllocationRepository {
  constructor(
    @InjectModel(BudgetAllocation.name)
    private readonly model: Model<BudgetAllocationDocument>,
  ) {}

  /** Create or update the planned amount for the (family, period, category) key (FR-005). */
  async upsert(
    familyId: string,
    period: string,
    categoryId: string,
    plannedAmount: number,
    createdBy: string,
  ): Promise<BudgetAllocationDocument> {
    return this.model
      .findOneAndUpdate(
        {
          familyId: new Types.ObjectId(familyId),
          period,
          categoryId: new Types.ObjectId(categoryId),
        },
        { $set: { plannedAmount }, $setOnInsert: { createdBy: new Types.ObjectId(createdBy) } },
        { new: true, upsert: true },
      )
      .exec();
  }

  /** One allocation of the family (regardless of category); else null (→ 404). */
  async findInFamily(familyId: string, budgetId: string): Promise<BudgetAllocationDocument | null> {
    if (!Types.ObjectId.isValid(budgetId)) {
      return null;
    }
    return this.model
      .findOne({ _id: new Types.ObjectId(budgetId), familyId: new Types.ObjectId(familyId) })
      .exec();
  }

  /** The family's allocations for a month, oldest first (for the report). */
  async listByFamilyPeriod(familyId: string, period: string): Promise<BudgetAllocationDocument[]> {
    return this.model
      .find({ familyId: new Types.ObjectId(familyId), period })
      .sort({ createdAt: 1 })
      .exec();
  }

  /** Hard-deletes an allocation of the family; returns whether a row was removed. */
  async deleteInFamily(familyId: string, budgetId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(budgetId)) {
      return false;
    }
    const result = await this.model
      .deleteOne({ _id: new Types.ObjectId(budgetId), familyId: new Types.ObjectId(familyId) })
      .exec();
    return result.deletedCount > 0;
  }
}
