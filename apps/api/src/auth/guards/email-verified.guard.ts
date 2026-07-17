import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountRepository } from '../../accounts/account.repository';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Soft gate for family/financial actions (FR-019, clarification Q1→B). Reads the
 * AUTHORITATIVE `emailVerified` flag from the account record (not a token claim),
 * so a just-verified user is unlocked immediately (remediation U1). Use together
 * with JwtAuthGuard. FAM-01 will apply this to its family/financial routes.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly accounts: AccountRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    const account = await this.accounts.findById(user.accountId);
    if (!account || !account.emailVerified) {
      throw new ForbiddenException('Email verification required.');
    }
    return true;
  }
}
