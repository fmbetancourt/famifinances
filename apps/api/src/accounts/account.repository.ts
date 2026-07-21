import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from './account.schema';
import { LOGIN_LOCKOUT } from '../config/security';

/** Normalizes an email for storage and comparison (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when an error is a MongoDB duplicate-key violation (E11000). */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export interface CreateAccountInput {
  email: string;
  passwordHash: string;
}

@Injectable()
export class AccountRepository {
  constructor(@InjectModel(Account.name) private readonly model: Model<AccountDocument>) {}

  async existsByEmail(email: string): Promise<boolean> {
    const found = await this.model.exists({ email: normalizeEmail(email) });
    return found !== null;
  }

  async findByEmail(email: string): Promise<AccountDocument | null> {
    return this.model.findOne({ email: normalizeEmail(email) }).exec();
  }

  async create(input: CreateAccountInput): Promise<AccountDocument> {
    return this.model.create({
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      emailVerified: false,
      status: 'active',
      failedLoginCount: 0,
      lockedUntil: null,
    });
  }

  async findById(id: string): Promise<AccountDocument | null> {
    return this.model.findById(id).exec();
  }

  /**
   * EXP-01 · maps the given account ids to their emails in one query (author
   * resolution for the CSV export). NOTE: this method is intentionally **not**
   * family-scoped — callers MUST pass only `createdBy` ids derived from their own
   * family's rows (the export service does). Isolation rests on that id-set, and the
   * cross-family export e2e proves no foreign email can appear.
   */
  async findEmailsByIds(ids: string[]): Promise<Map<string, string>> {
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) {
      return new Map();
    }
    const docs = await this.model
      .find({ _id: { $in: objectIds } })
      .select('email')
      .lean<{ _id: Types.ObjectId; email: string }[]>()
      .exec();
    return new Map(docs.map((doc) => [doc._id.toString(), doc.email]));
  }

  /**
   * Records a failed sign-in. Once the threshold is reached the account is
   * locked for a fixed window and the counter resets (FR-013).
   */
  async registerFailedLogin(id: string): Promise<void> {
    const account = await this.model.findById(id).exec();
    if (!account) {
      return;
    }
    account.failedLoginCount += 1;
    if (account.failedLoginCount >= LOGIN_LOCKOUT.maxFailedAttempts) {
      account.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT.lockWindowMs);
      account.failedLoginCount = 0;
    }
    await account.save();
  }

  async clearFailedLogin(id: string): Promise<void> {
    await this.model
      .updateOne({ _id: id }, { $set: { failedLoginCount: 0, lockedUntil: null } })
      .exec();
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { emailVerified: true } }).exec();
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { passwordHash } }).exec();
  }
}
