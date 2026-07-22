import type { TokenPair } from '@famifinances/contracts';
import { saveTokens, getAccessToken } from '../../storage/secure-token-store';
import { authFetch } from '../refresh-interceptor';

const TOKENS: TokenPair = {
  accessToken: 'stale',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
  expiresIn: 900,
};

const ROTATED: TokenPair = {
  accessToken: 'fresh',
  refreshToken: 'refresh-2',
  tokenType: 'Bearer',
  expiresIn: 900,
};

describe('authFetch single-flight rotation (FR-002)', () => {
  it('coalesces concurrent 401s into one refresh and retries with the rotated token', async () => {
    await saveTokens(TOKENS);
    let refreshCalls = 0;

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const auth = new Headers(init?.headers).get('Authorization');

      if (url.includes('/auth/token/refresh')) {
        refreshCalls += 1;
        return { ok: true, status: 200, json: async () => ROTATED } as Response;
      }
      // Protected resource: 401 with the stale token, 200 once rotated.
      const ok = auth === `Bearer ${ROTATED.accessToken}`;
      return { ok, status: ok ? 200 : 401, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const [a, b] = await Promise.all([authFetch('/protected'), authFetch('/protected')]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(refreshCalls).toBe(1);
    expect(await getAccessToken()).toBe('fresh');
  });
});
