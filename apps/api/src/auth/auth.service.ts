import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import type { AccountSummary } from '@famifinances/contracts';
import { AccountRepository } from '../accounts/account.repository';
import { PasswordService } from './services/password.service';
import { evaluatePasswordPolicy } from './services/password-policy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly accounts: AccountRepository,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * US1 · Register a new account (FR-001..FR-005). Email is normalized in the
   * repository; the account starts unverified. Duplicate emails are rejected
   * with a non-committal message (no account enumeration, FR-004).
   * Verification-code issuance is wired in US6.
   */
  async register(email: string, password: string): Promise<AccountSummary> {
    const failures = evaluatePasswordPolicy(password);
    if (failures.length > 0) {
      throw new BadRequestException({ message: failures });
    }

    if (await this.accounts.existsByEmail(email)) {
      // Uniform, non-committal — does not confirm the email exists.
      throw new ConflictException('Registration could not be completed.');
    }

    const passwordHash = await this.passwords.hash(password);
    const account = await this.accounts.create({ email, passwordHash });
    this.logger.log(`account.registered id=${account.id}`);

    return {
      accountId: account.id,
      email: account.email,
      emailVerified: account.emailVerified,
    };
  }
}
