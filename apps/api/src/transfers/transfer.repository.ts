import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Transfer, TransferDocument } from './transfer.schema';

export interface CreateTransferInput {
  familyId: string;
  createdBy: string;
  amount: number;
  date: Date;
  fromAccountId: string;
  toAccountId: string;
  note: string | null;
}

export interface UpdateTransferPatch {
  amount?: number;
  date?: Date;
  fromAccountId?: Types.ObjectId;
  toAccountId?: Types.ObjectId;
  note?: string | null;
}

export interface ListTransfersFilter {
  account?: string;
}

export interface AccountNet {
  accountId: string;
  net: number;
}

/**
 * Family-scoped persistence for transfers. EVERY query is bound to the caller's
 * `familyId` (from the session), so a foreign or unknown id resolves to null → 404
 * (Principle I). `netByAccount` feeds ACC-01's derived balance.
 */
@Injectable()
export class TransferRepository {
  constructor(@InjectModel(Transfer.name) private readonly model: Model<TransferDocument>) {}

  async create(input: CreateTransferInput): Promise<TransferDocument> {
    return this.model.create({
      familyId: new Types.ObjectId(input.familyId),
      createdBy: new Types.ObjectId(input.createdBy),
      amount: input.amount,
      date: input.date,
      fromAccountId: new Types.ObjectId(input.fromAccountId),
      toAccountId: new Types.ObjectId(input.toAccountId),
      note: input.note,
      deletedAt: null,
    });
  }

  /** An active (non-deleted) transfer of the family — for get/edit. */
  async findInFamily(familyId: string, transferId: string): Promise<TransferDocument | null> {
    if (!Types.ObjectId.isValid(transferId)) {
      return null;
    }
    return this.model
      .findOne({
        _id: new Types.ObjectId(transferId),
        familyId: new Types.ObjectId(familyId),
        deletedAt: null,
      })
      .exec();
  }

  /** A transfer of the family regardless of deletion — for the idempotent delete path. */
  async findAnyInFamily(familyId: string, transferId: string): Promise<TransferDocument | null> {
    if (!Types.ObjectId.isValid(transferId)) {
      return null;
    }
    return this.model
      .findOne({ _id: new Types.ObjectId(transferId), familyId: new Types.ObjectId(familyId) })
      .exec();
  }

  async listByFamily(familyId: string, filter: ListTransfersFilter): Promise<TransferDocument[]> {
    const query: FilterQuery<TransferDocument> = {
      familyId: new Types.ObjectId(familyId),
      deletedAt: null,
    };
    if (filter.account && Types.ObjectId.isValid(filter.account)) {
      const account = new Types.ObjectId(filter.account);
      query.$or = [{ fromAccountId: account }, { toAccountId: account }];
    } else if (filter.account) {
      return []; // malformed account filter → no matches
    }
    return this.model.find(query).sort({ date: -1, createdAt: -1 }).exec();
  }

  async update(
    familyId: string,
    transferId: string,
    patch: UpdateTransferPatch,
  ): Promise<TransferDocument | null> {
    if (!Types.ObjectId.isValid(transferId)) {
      return null;
    }
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(transferId), familyId: new Types.ObjectId(familyId), deletedAt: null },
        { $set: patch },
        { new: true },
      )
      .exec();
  }

  async markDeleted(familyId: string, transferId: string, when: Date): Promise<void> {
    await this.model
      .updateOne(
        { _id: new Types.ObjectId(transferId), familyId: new Types.ObjectId(familyId) },
        { $set: { deletedAt: when } },
      )
      .exec();
  }

  /** Net transfer effect per account (−amount origin, +amount destination), excluding deleted. */
  async netByAccount(familyId: string): Promise<AccountNet[]> {
    const rows = await this.model
      .aggregate<{ _id: Types.ObjectId; net: number }>([
        { $match: { familyId: new Types.ObjectId(familyId), deletedAt: null } },
        {
          $project: {
            entries: [
              { account: '$fromAccountId', delta: { $multiply: ['$amount', -1] } },
              { account: '$toAccountId', delta: '$amount' },
            ],
          },
        },
        { $unwind: '$entries' },
        { $group: { _id: '$entries.account', net: { $sum: '$entries.delta' } } },
      ])
      .exec();
    return rows.map((r) => ({ accountId: r._id.toString(), net: r.net }));
  }

  /**
   * The most recent change time across the family's transfers (create/edit/soft-delete
   * all bump `updatedAt`), regardless of deletion. Null when the family has no transfers.
   * Combined with the movement equivalent for DASH-01's "last updated" mark.
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
