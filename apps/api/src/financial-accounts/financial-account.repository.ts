import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import type { AccountStatusFilter, AccountType } from '@famifinances/contracts';
import { FinancialAccount, FinancialAccountDocument } from './financial-account.schema';

export interface CreateFinancialAccountInput {
  familyId: string;
  createdBy: string;
  name: string;
  type: AccountType;
  institution: string | null;
  initialBalance: number;
  startDate: Date;
}

export interface UpdateFinancialAccountPatch {
  name?: string;
  type?: AccountType;
  institution?: string | null;
  initialBalance?: number;
  startDate?: Date;
}

/**
 * Family-scoped persistence for financial accounts. EVERY query is bound to the
 * caller's `familyId` (from the session), so a foreign or unknown id resolves to
 * null → 404 and no cross-family data is disclosed (Principle I, FR-007).
 */
@Injectable()
export class FinancialAccountRepository {
  constructor(
    @InjectModel(FinancialAccount.name)
    private readonly model: Model<FinancialAccountDocument>,
  ) {}

  /** Maps a list filter to the archived-state query fragment. */
  private statusFilter(status: AccountStatusFilter): FilterQuery<FinancialAccountDocument> {
    if (status === 'active') {
      return { archivedAt: null };
    }
    if (status === 'archived') {
      return { archivedAt: { $ne: null } };
    }
    return {};
  }

  async create(input: CreateFinancialAccountInput): Promise<FinancialAccountDocument> {
    return this.model.create({
      familyId: new Types.ObjectId(input.familyId),
      createdBy: new Types.ObjectId(input.createdBy),
      name: input.name,
      type: input.type,
      institution: input.institution,
      initialBalance: input.initialBalance,
      startDate: input.startDate,
      currency: 'CLP',
      archivedAt: null,
    });
  }

  async findByFamily(
    familyId: string,
    status: AccountStatusFilter,
  ): Promise<FinancialAccountDocument[]> {
    return this.model
      .find({ familyId: new Types.ObjectId(familyId), ...this.statusFilter(status) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async findInFamily(
    familyId: string,
    accountId: string,
  ): Promise<FinancialAccountDocument | null> {
    if (!Types.ObjectId.isValid(accountId)) {
      return null; // malformed/foreign id → treated as not found
    }
    return this.model
      .findOne({ _id: new Types.ObjectId(accountId), familyId: new Types.ObjectId(familyId) })
      .exec();
  }

  /** The family's accounts among the given ids, in one query (UX-01 availability resolve). */
  async findManyInFamily(
    familyId: string,
    accountIds: string[],
  ): Promise<FinancialAccountDocument[]> {
    const ids = accountIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (ids.length === 0) {
      return [];
    }
    return this.model
      .find({ _id: { $in: ids }, familyId: new Types.ObjectId(familyId) })
      .exec();
  }

  async updateInFamily(
    familyId: string,
    accountId: string,
    patch: UpdateFinancialAccountPatch,
  ): Promise<FinancialAccountDocument | null> {
    if (!Types.ObjectId.isValid(accountId)) {
      return null;
    }
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(accountId), familyId: new Types.ObjectId(familyId) },
        { $set: patch },
        { new: true },
      )
      .exec();
  }

  async setArchived(
    familyId: string,
    accountId: string,
    archivedAt: Date | null,
  ): Promise<FinancialAccountDocument | null> {
    if (!Types.ObjectId.isValid(accountId)) {
      return null;
    }
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(accountId), familyId: new Types.ObjectId(familyId) },
        { $set: { archivedAt } },
        { new: true },
      )
      .exec();
  }
}
