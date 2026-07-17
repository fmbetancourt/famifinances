import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService (US2)', () => {
  const jwt = new JwtService({ secret: 'unit-test-secret' });
  const config = {
    getOrThrow: (key: string) =>
      ({ ACCESS_TOKEN_TTL: '900', REFRESH_TOKEN_TTL: '2592000' })[key],
  } as unknown as ConfigService;
  const service = new TokenService(jwt, config);

  it('signs an access token carrying sub and verifies it', () => {
    const { token, expiresIn } = service.signAccessToken('acc-1');
    expect(expiresIn).toBe(900);
    expect(service.verifyAccessToken(token).sub).toBe('acc-1');
  });

  it('rejects a token signed with a different secret', () => {
    const other = new TokenService(new JwtService({ secret: 'someone-else' }), config);
    const { token } = other.signAccessToken('acc-1');
    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it('generates distinct high-entropy refresh tokens', () => {
    const a = service.generateRefreshToken();
    const b = service.generateRefreshToken();
    expect(a).toHaveLength(64);
    expect(a).not.toBe(b);
  });

  it('hashes refresh tokens deterministically and irreversibly', () => {
    const token = service.generateRefreshToken();
    expect(service.hashRefreshToken(token)).toBe(service.hashRefreshToken(token));
    expect(service.hashRefreshToken(token)).not.toBe(token);
  });
});
