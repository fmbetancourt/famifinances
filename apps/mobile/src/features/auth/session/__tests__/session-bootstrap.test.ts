import type { TokenPair } from '@famifinances/contracts';
import { saveTokens, getRefreshToken } from '../../storage/secure-token-store';
import { bootstrapSession } from '../session-bootstrap';

interface RouteResponse {
  status: number;
  body?: unknown;
  throws?: boolean;
}

const TOKENS: TokenPair = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
  expiresIn: 900,
};

/** Installs a URL-routing fetch mock. Keys are matched as substrings of the URL. */
function mockFetch(routes: Record<string, RouteResponse>): void {
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    const match = Object.keys(routes).find((key) => url.includes(key));
    if (!match) {
      throw new Error(`Unexpected fetch to ${url}`);
    }
    const route = routes[match];
    if (route.throws) {
      throw new TypeError('Network request failed');
    }
    return {
      ok: route.status < 400,
      status: route.status,
      json: async () => route.body ?? {},
    } as Response;
  }) as unknown as typeof fetch;
}

describe('bootstrapSession (FR-008)', () => {
  it('returns unauthenticated when no tokens are stored', async () => {
    mockFetch({});
    const result = await bootstrapSession();
    expect(result.status).toBe('unauthenticated');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('restores an authenticated session with a family', async () => {
    await saveTokens(TOKENS);
    mockFetch({
      '/auth/me': { status: 200, body: { accountId: 'a1', email: 'me@x.cl', emailVerified: true } },
      '/families/me': { status: 200, body: { familyId: 'fam1', name: 'Casa', role: 'owner', members: [] } },
    });

    const result = await bootstrapSession();

    expect(result.status).toBe('authenticated');
    expect(result.user?.email).toBe('me@x.cl');
    expect(result.familyId).toBe('fam1');
  });

  it('routes to onboarding (familyId null) when the user has no family', async () => {
    await saveTokens(TOKENS);
    mockFetch({
      '/auth/me': { status: 200, body: { accountId: 'a1', email: 'me@x.cl', emailVerified: true } },
      '/families/me': { status: 404 },
    });

    const result = await bootstrapSession();

    expect(result.status).toBe('authenticated');
    expect(result.familyId).toBeNull();
  });

  it('clears the session and becomes unauthenticated when refresh fails (401/403)', async () => {
    await saveTokens(TOKENS);
    mockFetch({
      '/auth/me': { status: 401 },
      '/auth/token/refresh': { status: 401 },
    });

    const result = await bootstrapSession();

    expect(result.status).toBe('unauthenticated');
    expect(result.reason).toBe('expired');
    expect(await getRefreshToken()).toBeNull();
  });

  it('stays unauthenticated-offline (keeping tokens) on a network failure', async () => {
    await saveTokens(TOKENS);
    mockFetch({ '/auth/me': { status: 0, throws: true } });

    const result = await bootstrapSession();

    expect(result.status).toBe('unauthenticated');
    expect(result.reason).toBe('offline');
    expect(await getRefreshToken()).toBe('refresh-1');
  });
});
