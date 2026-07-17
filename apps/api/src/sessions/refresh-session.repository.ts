import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefreshSession, RefreshSessionDocument } from './refresh-session.schema';

export interface CreateSessionInput {
  accountId: string;
  tokenHash: string;
  rotationChainId: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshSessionRepository {
  constructor(
    @InjectModel(RefreshSession.name) private readonly model: Model<RefreshSessionDocument>,
  ) {}

  async create(input: CreateSessionInput): Promise<RefreshSessionDocument> {
    return this.model.create({
      accountId: new Types.ObjectId(input.accountId),
      tokenHash: input.tokenHash,
      rotationChainId: input.rotationChainId,
      expiresAt: input.expiresAt,
      revokedAt: null,
      lastUsedAt: new Date(),
    });
  }

  async findActiveByTokenHash(tokenHash: string): Promise<RefreshSessionDocument | null> {
    return this.model
      .findOne({ tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } })
      .exec();
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshSessionDocument | null> {
    return this.model.findOne({ tokenHash }).exec();
  }

  /** Revokes a single session by id (rotation supersession, logout). */
  async revokeById(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { revokedAt: new Date() } }).exec();
  }

  /** Revokes every non-revoked session in a rotation chain (reuse detection). */
  async revokeChain(rotationChainId: string): Promise<void> {
    await this.model
      .updateMany({ rotationChainId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  /** Revokes all sessions for an account (logout-all / password reset). */
  async revokeAllForAccount(accountId: string): Promise<void> {
    await this.model
      .updateMany(
        { accountId: new Types.ObjectId(accountId), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }
}
