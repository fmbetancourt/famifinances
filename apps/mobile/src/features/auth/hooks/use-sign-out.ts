import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { authFetch } from '../api/refresh-interceptor';
import { clearTokens, getRefreshToken } from '../storage/secure-token-store';

/**
 * US5 · Sign out. Best-effort server-side revocation of the current session,
 * then always clears local tokens and routes to sign-in — so the user is signed
 * out locally even if the network call fails.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();

  return useCallback(async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        await authFetch('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } finally {
      await clearTokens();
      router.replace('/(auth)/sign-in');
    }
  }, [router]);
}
