import { API_BASE, refreshSession } from '../api/client';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../storage/secure-token-store';

function postLogout(accessToken: string | null, refreshToken: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ refreshToken }),
  });
}

/**
 * FR-005 · Best-effort server-side session revocation, then an unconditional local
 * token wipe. Logout revokes the session identified by the refresh token in the body,
 * so it must NOT go through `authFetch`: if the access token were expired, that would
 * rotate the refresh token and revoke an already-dead session. Instead, on a 401 we
 * rotate once and revoke the CURRENT (rotated) session. Local tokens are always
 * cleared in `finally`, so a network/server failure never strands the user signed-in.
 */
export async function revokeSession(): Promise<void> {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      const response = await postLogout(await getAccessToken(), refreshToken);
      if (response.status === 401) {
        const pair = await refreshSession(refreshToken);
        await saveTokens(pair);
        await postLogout(pair.accessToken, pair.refreshToken);
      }
    }
  } catch {
    // Best-effort: fall through to always clear local state below.
  } finally {
    await clearTokens();
  }
}
