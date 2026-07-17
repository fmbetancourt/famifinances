import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FamilyRole } from '@famifinances/contracts';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { CurrentFamilyContext } from '../types/current-family';

/**
 * Enforces `@Roles(...)` against the family role resolved by FamilyScopeGuard.
 * MUST run after FamilyScopeGuard (which sets `request.family`).
 */
@Injectable()
export class FamilyRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<FamilyRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ family?: CurrentFamilyContext }>();
    const role = request.family?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException('This action requires the Owner role.');
    }
    return true;
  }
}
