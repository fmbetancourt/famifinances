import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Soft gate for family/financial actions (FR-019, clarification Q1→B). Reads
 * `request.user.emailVerified`, which JwtStrategy populates from a fresh account
 * read on every request — so it is authoritative (not a stale token claim) and a
 * just-verified user is unlocked immediately (remediation U1), with no extra query.
 * Use together with JwtAuthGuard. FAM-01 applies this to its family/financial routes.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Email verification required.');
    }
    return true;
  }
}
