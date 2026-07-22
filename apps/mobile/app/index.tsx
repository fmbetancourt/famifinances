import { Redirect } from 'expo-router';
import { useSession } from '../src/features/auth/session/session-context';
import { nextRoute } from '../src/features/auth/session/routing';

/**
 * Launch redirect at `/`. Routes by the restored session: unauthenticated → sign-in,
 * authenticated without a family → onboarding (FR-007), otherwise → the protected home.
 */
export default function Index(): JSX.Element {
  const { status, familyId } = useSession();
  return <Redirect href={nextRoute({ status, familyId })} />;
}
