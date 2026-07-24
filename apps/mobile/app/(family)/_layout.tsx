import type { ReactElement } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/features/auth/session/session-context';

/**
 * Family-onboarding route group. Requires an authenticated session; unauthenticated
 * users are redirected to sign-in. The onboarding screen itself is a placeholder in
 * FAM-8 (full Create/Join UI ships in FAM-9).
 */
export default function FamilyLayout(): ReactElement {
  const { status } = useSession();

  if (status === 'unauthenticated') {
    return <Redirect href="/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
