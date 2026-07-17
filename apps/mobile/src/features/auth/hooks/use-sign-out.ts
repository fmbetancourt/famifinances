import { useCallback } from 'react';
import { useRouter } from 'expo-router';
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
 * US5 · Sign out. Best-effort server-side revocation, then always clears local
 * tokens and routes to sign-in.
 *
 * Logout revokes the session identified by the refresh token in the body, so it
 * must NOT go through authFetch: if the access token were expired, authFetch would
 * rotate the refresh token and retry with the *old* body, revoking an already-dead
 * session and stranding the freshly-rotated one. Instead, on a 401 we rotate once
 * and then revoke the CURRENT (rotated) session with its own refresh token.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();

  return useCallback(async () => {
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
      router.replace('/(auth)/sign-in');
    }
  }, [router]);
}
