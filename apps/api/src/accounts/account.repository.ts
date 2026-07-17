import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from './account.schema';

/** Normalizes an email for storage and comparison (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lockout policy (FR-013). Tunable in the hardening pass (T075). */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;

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
   * Records a failed sign-in. Once the threshold is reached the account is
   * locked for a fixed window and the counter resets (FR-013).
   */
  async registerFailedLogin(id: string): Promise<void> {
    const account = await this.model.findById(id).exec();
    if (!account) {
      return;
    }
    account.failedLoginCount += 1;
    if (account.failedLoginCount >= MAX_FAILED_LOGINS) {
      account.lockedUntil = new Date(Date.now() + LOCK_WINDOW_MS);
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
