import type { TokenPair } from '@famifinances/contracts';
import { saveTokens, getRefreshToken, getAccessToken } from '../../storage/secure-token-store';
import { revokeSession } from '../sign-out';

const TOKENS: TokenPair = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
  expiresIn: 900,
};

describe('revokeSession (FR-005)', () => {
  it('clears SecureStore after a successful server revoke', async () => {
    await saveTokens(TOKENS);
    globalThis.fetch = jest.fn(async () => ({ ok: true, status: 204, json: async () => ({}) }) as Response) as unknown as typeof fetch;

    await revokeSession();

    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('still clears local tokens when the server revoke rejects (best-effort)', async () => {
    await saveTokens(TOKENS);
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    await revokeSession();

    expect(await getRefreshToken()).toBeNull();
  });
});
