import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from './account.schema';

/** Normalizes an email for storage and comparison (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
}
