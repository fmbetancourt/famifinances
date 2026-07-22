import { render, waitFor } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import AppLayout from '../_layout';
import { SessionProvider } from '../../../src/features/auth/session/session-context';

// SC-004 · An unauthenticated session must never render protected content; the group
// layout redirects to sign-in. With no tokens in SecureStore, bootstrap resolves to
// `unauthenticated`.
describe('(app) protected route guard (SC-004)', () => {
  it('redirects an unauthenticated session to /sign-in', async () => {
    render(
      <SessionProvider>
        <AppLayout />
      </SessionProvider>,
    );

    await waitFor(() => {
      const redirectedToSignIn = (Redirect as jest.Mock).mock.calls.some(
        ([props]) => props?.href === '/sign-in',
      );
      expect(redirectedToSignIn).toBe(true);
    });
  });
});
