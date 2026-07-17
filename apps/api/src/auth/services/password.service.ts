import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ARGON2_OPTIONS } from '../../config/security';

/**
 * HashingPort implementation using argon2id (research R1). Reserved for
 * low-entropy secrets (passwords). High-entropy tokens use SHA-256 elsewhere.
 */
@Injectable()
export class PasswordService {
  // Lazily-computed hash used to equalize timing when no account exists, so a
  // verify is always performed and login cannot be timed to enumerate emails.
  private dummyHashPromise?: Promise<string>;

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** A stable argon2id hash to verify against on the no-account path (timing safety). */
  dummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = this.hash('timing-equalizer-not-a-real-password');
    }
    return this.dummyHashPromise;
  }
}
