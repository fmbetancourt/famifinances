import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import { OneTimeCodeRepository } from './one-time-code.repository';
import { OneTimeCodeType } from './one-time-code.schema';

export const OTP_LENGTH = 6;
export const MAX_OTP_ATTEMPTS = 5;

/**
 * Issues and verifies one-time codes (research R3). Codes are 6-digit numeric,
 * CSPRNG-generated, stored only as an argon2id hash, single-use, and capped at a
 * fixed number of attempts. The short expiry + attempt cap + rate limiting are
 * the primary defenses given the small keyspace (research R3 security note).
 */
@Injectable()
export class OneTimeCodeService {
  private readonly hashOptions: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  };

  constructor(
    private readonly repo: OneTimeCodeRepository,
    private readonly config: ConfigService,
  ) {}

  /** Generates a fresh code, invalidating any previous unused code of this type. */
  async issue(accountId: string, type: OneTimeCodeType): Promise<string> {
    await this.repo.deleteUnconsumed(accountId, type);
    const code = randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
    const codeHash = await argon2.hash(code, this.hashOptions);
    const ttlSeconds = Number(this.config.getOrThrow<string>('OTP_TTL'));
    await this.repo.create({
      accountId,
      type,
      codeHash,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });
    return code;
  }

  /** Consumes the active code if `submitted` matches; false otherwise. */
  async verify(accountId: string, type: OneTimeCodeType, submitted: string): Promise<boolean> {
    const doc = await this.repo.findActive(accountId, type);
    if (!doc || doc.attemptCount >= MAX_OTP_ATTEMPTS) {
      return false;
    }
    await this.repo.incrementAttempt(doc.id);
    const matches = await argon2.verify(doc.codeHash, submitted).catch(() => false);
    if (matches) {
      await this.repo.markConsumed(doc.id);
      return true;
    }
    return false;
  }
}
