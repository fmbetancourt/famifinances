import { render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import type { TokenPair } from '@famifinances/contracts';
import { saveTokens } from '../../storage/secure-token-store';
import { SessionProvider, useSession } from '../session-context';

const TOKENS: TokenPair = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
  expiresIn: 900,
};

function Probe(): JSX.Element {
  const { status, reason } = useSession();
  return <Text>{`${status}:${reason}`}</Text>;
}

function res(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

// T039 · Pending-offline mode: a network failure during restore keeps tokens and marks
// the session offline; returning to the foreground reattempts and silently restores it.
describe('SessionProvider offline reattempt (spec Edge Cases)', () => {
  it('marks the session offline, then restores it when the app returns to foreground', async () => {
    await saveTokens(TOKENS);
    let online = false;

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL): Promise<Response> => {
      if (!online) {
        throw new TypeError('Network request failed');
      }
      const url = String(input);
      if (url.includes('/auth/me')) {
        return res(200, { accountId: 'a1', email: 'me@x.cl', emailVerified: true });
      }
      if (url.includes('/families/me')) {
        return res(200, { familyId: 'fam1', name: 'Casa', role: 'owner', members: [] });
      }
      return res(200, {});
    }) as unknown as typeof fetch;

    const addSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>);

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    // Initial cold start fails on connectivity → unauthenticated/offline (tokens kept).
    await waitFor(() => expect(screen.getByText('unauthenticated:offline')).toBeTruthy());

    // Connectivity returns and the app is foregrounded → reattempt succeeds.
    online = true;
    const handler = addSpy.mock.calls[0][1] as (state: string) => void;
    handler('active');

    await waitFor(() => expect(screen.getByText('authenticated:none')).toBeTruthy());

    addSpy.mockRestore();
  });
});
