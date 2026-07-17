import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { MembershipRepository } from '../../memberships/membership.repository';
import { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { CurrentFamilyContext } from '../types/current-family';

/**
 * Resolves the acting family from the caller's membership (looked up by the
 * session accountId) and attaches it as `request.family`. A family identifier in
 * the path/body/query is IGNORED — the family always comes from the session
 * membership (Principle I; FR-008, SC-003). Use with JwtAuthGuard.
 */
@Injectable()
export class FamilyScopeGuard implements CanActivate {
  constructor(private readonly memberships: MembershipRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser; family?: CurrentFamilyContext }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    const membership = await this.memberships.findByAccount(user.accountId);
    if (!membership) {
      throw new NotFoundException('You do not belong to a family.');
    }
    request.family = { familyId: membership.familyId.toString(), role: membership.role };
    return true;
  }
}
