import type { AccountSummary } from '@famifinances/contracts';
import { ApiError } from '../api/client';
import { resolveFamilyId } from '../api/family';
import { fetchCurrentUser } from '../api/session';
import { getAccessToken, getRefreshToken } from '../storage/secure-token-store';

/**
 * Why the session ended up as it did:
 * - `none`     — authenticated, or no prior session to restore.
 * - `expired`  — a stored session was invalid/revoked (SecureStore has been cleared).
 * - `offline`  — restoration failed on connectivity; tokens are kept for a later retry.
 */
export type SessionReason = 'none' | 'expired' | 'offline';

export interface ResolvedSession {
  readonly status: 'authenticated' | 'unauthenticated';
  readonly user: AccountSummary | null;
  readonly familyId: string | null;
  readonly reason: SessionReason;
}

const NO_SESSION: ResolvedSession = {
  status: 'unauthenticated',
  user: null,
  familyId: null,
  reason: 'none',
};

/**
 * FR-008 · Cold-start session restore. Reads the token pair from SecureStore and
 * confirms identity via `/auth/me` (through `authFetch`, which transparently rotates
 * an expired access token). On success it also resolves family membership (FR-007).
 *
 * Failure handling mirrors the spec Edge Cases:
 * - An `ApiError` (e.g. 401/403 after a failed refresh) means the session is invalid;
 *   `authFetch` has already cleared SecureStore. Resolves `unauthenticated`/`expired`,
 *   which the sign-in screen turns into a "session expired" message.
 * - A non-`ApiError` (thrown fetch) means a network failure; resolves
 *   `unauthenticated`/`offline` **without** wiping tokens, so it can be retried when
 *   connectivity returns.
 */
export async function bootstrapSession(): Promise<ResolvedSession> {
  const [accessToken, refreshToken] = await Promise.all([getAccessToken(), getRefreshToken()]);
  if (!accessToken && !refreshToken) {
    return NO_SESSION;
  }

  try {
    const user = await fetchCurrentUser();
    const familyId = await resolveFamilyId();
    return { status: 'authenticated', user, familyId, reason: 'none' };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ...NO_SESSION, reason: 'expired' };
    }
    // Network failure: keep tokens for a later retry (spec Edge Case).
    return { ...NO_SESSION, reason: 'offline' };
  }
}
