import type { ReactElement } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/features/auth/session/session-context';

/**
 * Protected route group (SC-004). Unauthenticated users are redirected to sign-in;
 * authenticated users without a family are routed to onboarding (FR-007). Only a
 * fully-onboarded session renders the app stack.
 */
export default function AppLayout(): ReactElement {
  const { status, familyId } = useSession();

  if (status === 'unauthenticated') {
    return <Redirect href="/sign-in" />;
  }
  if (status === 'authenticated' && familyId === null) {
    return <Redirect href="/onboarding" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
