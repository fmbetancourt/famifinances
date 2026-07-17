import type { FamilyRole } from '@famifinances/contracts';

/**
 * The family scope attached to a request by FamilyScopeGuard. Derived from the
 * caller's membership (via the session accountId), never from client input.
 */
export interface CurrentFamilyContext {
  familyId: string;
  role: FamilyRole;
}
