import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import type { MovementType } from '@famifinances/contracts';
import { escapeRegex } from '../common/escape-regex';
import { Movement, MovementDocument } from './movement.schema';

export interface CreateMovementInput {
  familyId: string;
  createdBy: string;
  type: MovementType;
  amount: number;
  date: Date;
  accountId: string;
  categoryId: string | null;
  note: string | null;
}

export interface UpdateMovementPatch {
  type?: MovementType;
  amount?: number;
  date?: Date;
  accountId?: Types.ObjectId;
  categoryId?: Types.ObjectId | null;
  note?: string | null;
}

export interface ListMovementsFilter {
  account?: string;
  type?: MovementType;
}

export interface AccountNet {
  accountId: string;
  net: number;
}

export interface CategorySpend {
  categoryId: string;
  spend: number;
}

export interface IncomeExpenseTotals {
  income: number;
  expense: number;
}

/** HIS-01 history filters (all optional; combined with AND). */
export interface MovementHistoryFilters {
  from?: string;
  to?: string;
  type?: MovementType;
  account?: string;
  category?: string;
  search?: string;
}

export interface MovementHistoryResult {
  items: MovementDocument[];
  total: number;
}

/**
 * Family-scoped persistence for movements. EVERY query is bound to the caller's
 * `familyId` (from the session), so a foreign or unknown id resolves to null → 404
 * (Principle I). `netByAccount` powers ACC-01's derived balance.
 */
@Injectable()
export class MovementRepository {
  constructor(@InjectModel(Movement.name) private readonly model: Model<MovementDocument>) {}

  async create(input: CreateMovementInput): Promise<MovementDocument> {
    return this.model.create({
      familyId: new Types.ObjectId(input.familyId),
      createdBy: new Types.ObjectId(input.createdBy),
      type: input.type,
      amount: input.amount,
      date: input.date,
      accountId: new Types.ObjectId(input.accountId),
      categoryId: input.categoryId ? new Types.ObjectId(input.categoryId) : null,
      note: input.note,
      deletedAt: null,
    });
  }

  /** An active (non-deleted) movement of the family — for get/edit. */
  async findInFamily(familyId: string, movementId: string): Promise<MovementDocument | null> {
    if (!Types.ObjectId.isValid(movementId)) {
      return null;
    }
    return this.model
      .findOne({
        _id: new Types.ObjectId(movementId),
        familyId: new Types.ObjectId(familyId),
        deletedAt: null,
      })
      .exec();
  }

  /** A movement of the family regardless of deletion — for the idempotent delete path. */
  async findAnyInFamily(familyId: string, movementId: string): Promise<MovementDocument | null> {
    if (!Types.ObjectId.isValid(movementId)) {
      return null;
    }
    return this.model
      .findOne({ _id: new Types.ObjectId(movementId), familyId: new Types.ObjectId(familyId) })
      .exec();
  }

  async listByFamily(familyId: string, filter: ListMovementsFilter): Promise<MovementDocument[]> {
    const query: FilterQuery<MovementDocument> = {
      familyId: new Types.ObjectId(familyId),
      deletedAt: null,
    };
    if (filter.account && Types.ObjectId.isValid(filter.account)) {
      query.accountId = new Types.ObjectId(filter.account);
    } else if (filter.account) {
      return []; // malformed account filter → no matches
    }
    if (filter.type) {
      query.type = filter.type;
    }
    return this.model.find(query).sort({ date: -1, createdAt: -1 }).exec();
  }

  async update(
    familyId: string,
    movementId: string,
    patch: UpdateMovementPatch,
  ): Promise<MovementDocument | null> {
    if (!Types.ObjectId.isValid(movementId)) {
      return null;
    }
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(movementId), familyId: new Types.ObjectId(familyId), deletedAt: null },
        { $set: patch },
        { new: true },
      )
      .exec();
  }

  async markDeleted(familyId: string, movementId: string, when: Date): Promise<void> {
    await this.model
      .updateOne(
        { _id: new Types.ObjectId(movementId), familyId: new Types.ObjectId(familyId) },
        { $set: { deletedAt: when } },
      )
      .exec();
  }

  /** Net movement effect per account (income +amount, expense −amount), excluding deleted. */
  async netByAccount(familyId: string): Promise<AccountNet[]> {
    const rows = await this.model
      .aggregate<{ _id: Types.ObjectId; net: number }>([
        { $match: { familyId: new Types.ObjectId(familyId), deletedAt: null } },
        {
          $group: {
            _id: '$accountId',
            net: {
              $sum: {
                $cond: [{ $eq: ['$type', 'income'] }, '$amount', { $multiply: ['$amount', -1] }],
              },
            },
          },
        },
      ])
      .exec();
    return rows.map((r) => ({ accountId: r._id.toString(), net: r.net }));
  }

  /**
   * Sum of the family's categorized expense movements per category in the
   * half-open date range [from, to), excluding deleted — BUD-01's real spend
   * (Principle III: derived, never stored). Uncategorized expenses contribute
   * to no budget line.
   */
  async sumExpenseByCategory(familyId: string, from: Date, to: Date): Promise<CategorySpend[]> {
    const rows = await this.model
      .aggregate<{ _id: Types.ObjectId; spend: number }>([
        {
          $match: {
            familyId: new Types.ObjectId(familyId),
            type: 'expense',
            deletedAt: null,
            categoryId: { $ne: null },
            date: { $gte: from, $lt: to },
          },
        },
        { $group: { _id: '$categoryId', spend: { $sum: '$amount' } } },
      ])
      .exec();
    return rows.map((r) => ({ categoryId: r._id.toString(), spend: r.spend }));
  }

  /**
   * Gross income and expense totals for the family in the half-open range [from, to),
   * excluding deleted — DASH-01's money summary. Transfers live in a separate
   * collection and are never matched here (FR-003, no double counting).
   */
  async sumByTypeInPeriod(familyId: string, from: Date, to: Date): Promise<IncomeExpenseTotals> {
    const rows = await this.model
      .aggregate<{ _id: MovementType; total: number }>([
        {
          $match: {
            familyId: new Types.ObjectId(familyId),
            deletedAt: null,
            date: { $gte: from, $lt: to },
          },
        },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ])
      .exec();
    const totals: IncomeExpenseTotals = { income: 0, expense: 0 };
    for (const row of rows) {
      if (row._id === 'income') totals.income = row.total;
      else if (row._id === 'expense') totals.expense = row.total;
    }
    return totals;
  }

  /**
   * HIS-01 · a filtered, ordered, paginated page of the family's non-deleted movements
   * plus the total match count. All provided filters combine with AND. Foreign/malformed
   * account or category ids short-circuit to an empty result (never a cross-family read).
   * A blank note `search` is ignored so note-less movements are not excluded.
   */
  /**
   * Builds the family-scoped, non-deleted filter for the HIS-01 filter set. Returns
   * `null` when a provided account/category id is malformed — the caller treats that
   * as "no matches" (a bad/foreign id can never widen access). Shared by
   * `searchHistory` (HIS-01) and `findForExport` (EXP-01) so the two never diverge.
   */
  private buildHistoryFilter(
    familyId: string,
    filters: MovementHistoryFilters,
  ): FilterQuery<MovementDocument> | null {
    const query: FilterQuery<MovementDocument> = {
      familyId: new Types.ObjectId(familyId),
      deletedAt: null,
    };

    if (filters.from || filters.to) {
      // Occurrence dates are stored at UTC midnight, so an inclusive $lte on the `to`
      // day's midnight includes that whole day.
      const dateClause: { $gte?: Date; $lte?: Date } = {};
      if (filters.from) dateClause.$gte = new Date(`${filters.from}T00:00:00.000Z`);
      if (filters.to) dateClause.$lte = new Date(`${filters.to}T00:00:00.000Z`);
      query.date = dateClause;
    }
    if (filters.type) {
      query.type = filters.type;
    }
    if (filters.account) {
      if (!Types.ObjectId.isValid(filters.account)) {
        return null;
      }
      query.accountId = new Types.ObjectId(filters.account);
    }
    if (filters.category) {
      if (!Types.ObjectId.isValid(filters.category)) {
        return null;
      }
      query.categoryId = new Types.ObjectId(filters.category);
    }
    const search = filters.search?.trim();
    if (search) {
      query.note = { $regex: escapeRegex(search), $options: 'i' };
    }
    return query;
  }

  async searchHistory(
    familyId: string,
    filters: MovementHistoryFilters,
    page: { limit: number; offset: number },
  ): Promise<MovementHistoryResult> {
    const query = this.buildHistoryFilter(familyId, filters);
    if (query === null) {
      return { items: [], total: 0 };
    }

    const [items, total] = await Promise.all([
      this.model.find(query).sort({ date: -1, createdAt: -1 }).skip(page.offset).limit(page.limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  /**
   * EXP-01 · all the family's non-deleted movements matching the HIS-01 filters, newest
   * first, **unpaginated** (an export is the whole matching set). A malformed account/
   * category id yields an empty result (header-only file).
   */
  async findForExport(
    familyId: string,
    filters: MovementHistoryFilters,
  ): Promise<MovementDocument[]> {
    const query = this.buildHistoryFilter(familyId, filters);
    if (query === null) {
      return [];
    }
    return this.model.find(query).sort({ date: -1, createdAt: -1 }).exec();
  }

  /**
   * The member's most recent non-deleted movement (UX-01 capture defaults). Scoped
   * to the family + the member's `createdBy`, newest by occurrence then creation.
   * Null when the member has recorded none. Read-only; adds no write coupling.
   */
  async findLatestByMember(
    familyId: string,
    memberId: string,
  ): Promise<MovementDocument | null> {
    if (!Types.ObjectId.isValid(memberId)) {
      return null;
    }
    return this.model
      .findOne({
        familyId: new Types.ObjectId(familyId),
        createdBy: new Types.ObjectId(memberId),
        deletedAt: null,
      })
      .sort({ date: -1, createdAt: -1 })
      .exec();
  }

  /**
   * The most recent change time across the family's movements (create/edit/soft-delete
   * all bump `updatedAt`), regardless of deletion — a deletion is a change worth
   * reflecting. Null when the family has no movements. Powers DASH-01's "last updated".
   */
  async latestChangeAt(familyId: string): Promise<Date | null> {
    const doc = await this.model
      .findOne({ familyId: new Types.ObjectId(familyId) })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean<{ updatedAt?: Date }>()
      .exec();
    return doc?.updatedAt ?? null;
  }
}
