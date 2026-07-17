import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccountRepository } from '../../accounts/account.repository';
import { AuthenticatedUser } from '../types/authenticated-user';

interface AccessTokenPayload {
  sub: string;
}

/**
 * Validates the access token and resolves the acting identity from the account
 * record. Expired/tampered tokens are rejected by passport; missing or disabled
 * accounts are rejected here (FR-009, FR-016). The returned object becomes
 * `request.user` — the only source of identity for protected routes.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly accounts: AccountRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const account = await this.accounts.findById(payload.sub);
    if (!account || account.status === 'disabled') {
      throw new UnauthorizedException();
    }
    return {
      accountId: account.id,
      email: account.email,
      emailVerified: account.emailVerified,
    };
  }
}
