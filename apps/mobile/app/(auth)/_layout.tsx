import type { ReactElement } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/features/auth/session/session-context';

/**
 * Auth route group. Redirects already-authenticated users back to the launch redirect
 * (which then routes them to the app or onboarding), so signed-in users never see the
 * credential screens.
 */
export default function AuthLayout(): ReactElement {
  const { status } = useSession();

  if (status === 'authenticated') {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
