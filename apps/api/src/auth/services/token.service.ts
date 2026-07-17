import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

export interface AccessTokenResult {
  token: string;
  expiresIn: number;
}

export interface AccessTokenPayload {
  sub: string;
}

/**
 * TokenPort implementation (research R2). Access tokens are short-lived HS256
 * JWTs carrying only `sub`. Refresh tokens are high-entropy opaque strings;
 * only their SHA-256 hash is ever persisted (not argon2 — see R2).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(accountId: string): AccessTokenResult {
    const expiresIn = Number(this.config.getOrThrow<string>('ACCESS_TOKEN_TTL'));
    const token = this.jwt.sign({ sub: accountId }, { expiresIn });
    return { token, expiresIn };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token);
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  refreshTtlSeconds(): number {
    return Number(this.config.getOrThrow<string>('REFRESH_TOKEN_TTL'));
  }
}
