import type { AccountSummary } from '@famifinances/contracts';
import { ApiError } from './client';
import { authFetch } from './refresh-interceptor';

/**
 * Fetches the current session identity through `authFetch`, so an expired access
 * token triggers a refresh-and-retry before the caller is treated as
 * unauthenticated (US4/SC-005 — "stay signed in").
 */
export async function fetchCurrentUser(): Promise<AccountSummary> {
  const response = await authFetch('/auth/me');
  const payload = (await response.json().catch(() => ({}))) as AccountSummary & { message?: string };
  if (!response.ok) {
    throw new ApiError(payload.message ?? 'Unauthenticated', response.status);
  }
  return payload;
}
