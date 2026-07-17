import { SetMetadata } from '@nestjs/common';
import type { FamilyRole } from '@famifinances/contracts';

export const ROLES_KEY = 'familyRoles';

/** Restricts a route to the given family role(s), enforced by FamilyRoleGuard. */
export const Roles = (...roles: FamilyRole[]) => SetMetadata(ROLES_KEY, roles);
