import type { TokenPair } from '@famifinances/contracts';
import { login } from '../../api/client';
import { saveTokens } from '../../storage/secure-token-store';
import { bootstrapSession } from '../session-bootstrap';
import { revokeSession } from '../sign-out';

// FR-006 / SC-003 · No token or password value may reach console output anywhere in
// the auth/session code path.
const SECRETS = ['S3cret-password!!', 'access-secret-xyz', 'refresh-secret-xyz'];

const TOKENS: TokenPair = {
  accessToken: 'access-secret-xyz',
  refreshToken: 'refresh-secret-xyz',
  tokenType: 'Bearer',
  expiresIn: 900,
};

describe('no secret logging (FR-006, SC-003)', () => {
  it('never writes tokens or passwords to console during login → bootstrap → sign-out', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation(() => undefined),
    );

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes('/auth/login')) {
        return { ok: true, status: 200, json: async () => TOKENS } as Response;
      }
      if (url.includes('/auth/me')) {
        return { ok: true, status: 200, json: async () => ({ accountId: 'a1', email: 'me@x.cl', emailVerified: true }) } as Response;
      }
      if (url.includes('/families/me')) {
        return { ok: true, status: 200, json: async () => ({ familyId: 'fam1', name: 'Casa', role: 'owner', members: [] }) } as Response;
      }
      return { ok: true, status: 204, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const tokens = await login({ email: 'me@x.cl', password: 'S3cret-password!!' });
    await saveTokens(tokens);
    await bootstrapSession();
    await revokeSession();

    const logged = spies.flatMap((spy) => spy.mock.calls.flat()).map(String).join(' | ');
    for (const secret of SECRETS) {
      expect(logged).not.toContain(secret);
    }

    spies.forEach((spy) => spy.mockRestore());
  });
});
