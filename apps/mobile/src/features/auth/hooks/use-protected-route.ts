import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { getMe } from '../api/client';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

/**
 * Route guard for protected screens: verifies the stored session against the API
 * and redirects to sign-in when it is missing or invalid (FR-010). Identity is
 * always confirmed server-side, never trusted from the client alone.
 */
export function useProtectedRoute(): AuthState {
  const router = useRouter();
  const [state, setState] = useState<AuthState>('checking');

  useEffect(() => {
    let active = true;
    getMe()
      .then(() => active && setState('authenticated'))
      .catch(() => {
        if (!active) {
          return;
        }
        setState('unauthenticated');
        router.replace('/(auth)/sign-in');
      });
    return () => {
      active = false;
    };
  }, [router]);

  return state;
}
