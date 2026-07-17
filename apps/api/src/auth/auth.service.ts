import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AccountSummary, TokenPair } from '@famifinances/contracts';
import { AccountRepository, isDuplicateKeyError } from '../accounts/account.repository';
import { RefreshSessionRepository } from '../sessions/refresh-session.repository';
import { OneTimeCodeService } from '../one-time-codes/one-time-code.service';
import { MAIL_PORT, MailPort } from '../mail/mail.port';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { evaluatePasswordPolicy } from './services/password-policy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: RefreshSessionRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly codes: OneTimeCodeService,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
  ) {}

  /** Issues an email-verification code and delivers it (FR-018/FR-021). */
  private async sendVerificationCode(accountId: string, email: string): Promise<void> {
    const code = await this.codes.issue(accountId, 'email_verification');
    await this.mail.send({
      to: email,
      subject: 'Verify your FamiFinances email',
      body: `Your FamiFinances verification code is ${code}. It expires shortly.`,
    });
  }

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

    const duplicate = new ConflictException('Registration could not be completed.');
    if (await this.accounts.existsByEmail(email)) {
      // Uniform, non-committal — does not confirm the email exists.
      throw duplicate;
    }

    const passwordHash = await this.passwords.hash(password);
    // The unique index is the source of truth: a concurrent insert that slips
    // past the check above still resolves to the same non-committal 409.
    let account;
    try {
      account = await this.accounts.create({ email, passwordHash });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw duplicate;
      }
      throw error;
    }
    this.logger.log(`account.registered id=${account.id}`);

    // Issue and deliver the email-verification code (FR-018).
    await this.sendVerificationCode(account.id, account.email);

    return {
      accountId: account.id,
      email: account.email,
      emailVerified: account.emailVerified,
    };
  }

  /**
   * US6 · Verify email with a one-time code (FR-020). On success the email is
   * marked verified, immediately unlocking family/financial actions.
   */
  async verifyEmail(accountId: string, code: string): Promise<AccountSummary> {
    const verified = await this.codes.verify(accountId, 'email_verification', code);
    if (!verified) {
      throw new BadRequestException('Invalid or expired code.');
    }
    await this.accounts.markEmailVerified(accountId);
    const account = await this.accounts.findById(accountId);
    if (!account) {
      throw new UnauthorizedException();
    }
    return {
      accountId: account.id,
      email: account.email,
      emailVerified: account.emailVerified,
    };
  }

  /** US6 · Re-send a verification code, invalidating the previous one (FR-021). */
  async resendVerification(accountId: string): Promise<void> {
    const account = await this.accounts.findById(accountId);
    if (account && !account.emailVerified) {
      await this.sendVerificationCode(account.id, account.email);
    }
  }

  /**
   * US7 · Request a password reset (FR-022). Always resolves the same way whether
   * or not the email is registered (no enumeration); a code is emailed only when
   * the account exists.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const account = await this.accounts.findByEmail(email);
    if (!account) {
      return;
    }
    const code = await this.codes.issue(account.id, 'password_reset');
    await this.mail.send({
      to: account.email,
      subject: 'Reset your FamiFinances password',
      body: `Your FamiFinances password reset code is ${code}. It expires shortly.`,
    });
  }

  /**
   * US7 · Confirm a password reset (FR-023, FR-024, FR-025). Sets the new password
   * (subject to the strength policy), revokes ALL active sessions, and marks the
   * email verified (consuming the emailed code proves inbox control).
   */
  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    const invalid = new BadRequestException('Invalid or expired code.');

    // Validate the new password first so a weak password never consumes the code.
    const failures = evaluatePasswordPolicy(newPassword);
    if (failures.length > 0) {
      throw new BadRequestException({ message: failures });
    }

    const account = await this.accounts.findByEmail(email);
    if (!account) {
      throw invalid;
    }
    const verified = await this.codes.verify(account.id, 'password_reset', code);
    if (!verified) {
      throw invalid;
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.accounts.updatePassword(account.id, passwordHash);
    await this.accounts.markEmailVerified(account.id);
    // Clear any lockout so the user can sign in immediately with the new password.
    await this.accounts.clearFailedLogin(account.id);
    await this.sessions.revokeAllForAccount(account.id);
    this.logger.log(`account.password_reset id=${account.id}`);
  }

  /**
   * US2 · Sign in (FR-006, FR-007, FR-013, FR-014). Failures return a uniform
   * message so unknown-email and wrong-password are indistinguishable (no
   * enumeration). On success, issues a short-lived access token plus a rotating
   * refresh token whose SHA-256 hash is persisted as a new session.
   */
  async login(email: string, password: string): Promise<TokenPair> {
    const invalid = new UnauthorizedException('Invalid email or password.');
    const account = await this.accounts.findByEmail(email);

    // Always run a verify (dummy hash when no account) so response time cannot
    // distinguish registered from unregistered emails (no enumeration, SC-008).
    const hash = account?.passwordHash ?? (await this.passwords.dummyHash());
    const passwordMatches = await this.passwords.verify(hash, password);

    if (!account || account.status === 'disabled') {
      throw invalid;
    }
    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      throw invalid;
    }
    if (!passwordMatches) {
      await this.accounts.registerFailedLogin(account.id);
      throw invalid;
    }

    await this.accounts.clearFailedLogin(account.id);
    const pair = await this.issueSession(account.id);
    this.logger.log(`account.signed_in id=${account.id}`);
    return pair;
  }

  /**
   * US4 · Rotate the session (FR-007, FR-008, FR-009). A valid refresh token is
   * superseded and a new one is issued within the same rotation chain. Presenting
   * an already-rotated (revoked) token is treated as theft: the whole chain is
   * revoked (reuse detection).
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const invalid = new UnauthorizedException('Invalid refresh token.');
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.sessions.findByTokenHash(tokenHash);

    if (!session) {
      throw invalid;
    }
    if (session.revokedAt) {
      // Reuse of a rotated/revoked token — revoke the entire chain (theft).
      await this.sessions.revokeChain(session.rotationChainId);
      this.logger.warn(`refresh.reuse_detected chain=${session.rotationChainId}`);
      throw invalid;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw invalid;
    }

    const accountId = session.accountId.toString();
    const account = await this.accounts.findById(accountId);
    if (!account || account.status === 'disabled') {
      throw invalid;
    }

    // Atomically supersede the current token. If another concurrent refresh won
    // the race, this returns false → treat as reuse and revoke the chain.
    const superseded = await this.sessions.revokeByIdIfActive(session.id);
    if (!superseded) {
      await this.sessions.revokeChain(session.rotationChainId);
      this.logger.warn(`refresh.reuse_detected chain=${session.rotationChainId}`);
      throw invalid;
    }
    return this.issueSession(accountId, session.rotationChainId);
  }

  /**
   * US5 · Sign out (FR-012). Revokes the presented session so its refresh token
   * can no longer be used. Idempotent: unknown tokens are silently ignored so
   * logout never reveals whether a session existed.
   */
  async logout(accountId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.sessions.findByTokenHash(tokenHash);
    // Only revoke a session that belongs to the authenticated caller — presenting
    // another account's leaked refresh token must not revoke that account's session.
    if (session && !session.revokedAt && session.accountId.toString() === accountId) {
      await this.sessions.revokeById(session.id);
      this.logger.log(`account.signed_out id=${accountId}`);
    }
  }

  /** Issues an access token + a new rotating refresh token (persisted as a hash). */
  private async issueSession(
    accountId: string,
    rotationChainId: string = randomUUID(),
  ): Promise<TokenPair> {
    const { token: accessToken, expiresIn } = this.tokens.signAccessToken(accountId);
    const refreshToken = this.tokens.generateRefreshToken();
    await this.sessions.create({
      accountId,
      tokenHash: this.tokens.hashRefreshToken(refreshToken),
      rotationChainId,
      expiresAt: new Date(Date.now() + this.tokens.refreshTtlSeconds() * 1000),
    });
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn };
  }
}
