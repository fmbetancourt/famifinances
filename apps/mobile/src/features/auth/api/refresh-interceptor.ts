import { API_BASE, ApiError, refreshSession } from './client';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../storage/secure-token-store';

/**
 * US4 · Authenticated fetch with transparent renewal. On a 401 it rotates the
 * refresh token once, stores the new pair, and retries the original request. If
 * renewal fails, tokens are cleared so the app can route back to sign-in.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetchWithToken(path, init, await getAccessToken());
  if (response.status !== 401) {
    return response;
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return response;
  }

  try {
    const pair = await refreshSession(refreshToken);
    await saveTokens(pair);
    return fetchWithToken(path, init, pair.accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await clearTokens();
    }
    return response;
  }
}

function fetchWithToken(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
