import type { Href } from 'expo-router';
import type { SessionState } from './session-context';

/**
 * SC-004 / FR-007 · Single source of truth for session-driven navigation. Pure so it
 * is trivially testable: unauthenticated → sign-in; authenticated without a family →
 * onboarding; authenticated with a family → the protected home.
 *
 * Note: Expo Router groups `(auth)`/`(app)`/`(family)` are omitted from URLs, so the
 * concrete paths are `/sign-in`, `/onboarding`, and `/home`.
 */
export function nextRoute(state: Pick<SessionState, 'status' | 'familyId'>): Href {
  if (state.status !== 'authenticated') {
    return '/sign-in';
  }
  if (state.familyId === null) {
    return '/onboarding';
  }
  return '/home';
}
