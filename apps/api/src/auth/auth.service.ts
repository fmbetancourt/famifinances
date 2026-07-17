import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AccountSummary, TokenPair } from '@famifinances/contracts';
import { AccountRepository } from '../accounts/account.repository';
import { RefreshSessionRepository } from '../sessions/refresh-session.repository';
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

  /**
   * US2 · Sign in (FR-006, FR-007, FR-013, FR-014). Failures return a uniform
   * message so unknown-email and wrong-password are indistinguishable (no
   * enumeration). On success, issues a short-lived access token plus a rotating
   * refresh token whose SHA-256 hash is persisted as a new session.
   */
  async login(email: string, password: string): Promise<TokenPair> {
    const invalid = new UnauthorizedException('Invalid email or password.');
    const account = await this.accounts.findByEmail(email);

    if (!account || account.status === 'disabled') {
      throw invalid;
    }
    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      throw invalid;
    }

    const passwordMatches = await this.passwords.verify(account.passwordHash, password);
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

    // Supersede the current token and issue a new one in the same chain.
    await this.sessions.revokeById(session.id);
    return this.issueSession(accountId, session.rotationChainId);
  }

  /**
   * US5 · Sign out (FR-012). Revokes the presented session so its refresh token
   * can no longer be used. Idempotent: unknown tokens are silently ignored so
   * logout never reveals whether a session existed.
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (session && !session.revokedAt) {
      await this.sessions.revokeById(session.id);
      this.logger.log(`account.signed_out id=${session.accountId.toString()}`);
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
