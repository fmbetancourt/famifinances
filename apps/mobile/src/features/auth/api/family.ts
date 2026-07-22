import type { FamilyDetail } from '@famifinances/contracts';
import { ApiError } from './client';
import { authFetch } from './refresh-interceptor';

/**
 * FR-007 · Resolves the caller's family membership from the session-scoped
 * `GET /families/me`. The server derives family scope from the token (Principle I);
 * the client never sends a `familyId`. A `403`/`404` means the user belongs to no
 * family yet and must be routed to onboarding.
 */
export async function resolveFamilyId(): Promise<string | null> {
  const response = await authFetch('/families/me');
  if (response.status === 403 || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError('Could not resolve family membership', response.status);
  }
  const family = (await response.json()) as FamilyDetail;
  return family.familyId;
}
