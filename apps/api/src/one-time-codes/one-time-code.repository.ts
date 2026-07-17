import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OneTimeCode, OneTimeCodeDocument, OneTimeCodeType } from './one-time-code.schema';

export interface CreateCodeInput {
  accountId: string;
  type: OneTimeCodeType;
  codeHash: string;
  expiresAt: Date;
}

@Injectable()
export class OneTimeCodeRepository {
  constructor(
    @InjectModel(OneTimeCode.name) private readonly model: Model<OneTimeCodeDocument>,
  ) {}

  async create(input: CreateCodeInput): Promise<OneTimeCodeDocument> {
    return this.model.create({
      accountId: new Types.ObjectId(input.accountId),
      type: input.type,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      consumedAt: null,
      attemptCount: 0,
    });
  }

  /** Latest non-consumed, non-expired code for an account + type. */
  async findActive(
    accountId: string,
    type: OneTimeCodeType,
  ): Promise<OneTimeCodeDocument | null> {
    return this.model
      .findOne({
        accountId: new Types.ObjectId(accountId),
        type,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Invalidates any previous unused code of the same type (FR-021). */
  async deleteUnconsumed(accountId: string, type: OneTimeCodeType): Promise<void> {
    await this.model
      .deleteMany({ accountId: new Types.ObjectId(accountId), type, consumedAt: null })
      .exec();
  }

  async incrementAttempt(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $inc: { attemptCount: 1 } }).exec();
  }

  async markConsumed(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { consumedAt: new Date() } }).exec();
  }
}
