import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import type { MovementType } from '@famifinances/contracts';
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
}
