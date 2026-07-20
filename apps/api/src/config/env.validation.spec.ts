import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('validateEnv (SEC-01 fail-fast)', () => {
  const complete = { MONGODB_URI: 'mongodb://localhost/x', JWT_SECRET: 'a-secret' };

  it('passes with a complete config (defaults applied)', () => {
    const env = validateEnv({ ...complete });
    expect(env.AUTH_RATE_LIMIT).toBe(5);
    expect(env.REQUEST_BODY_LIMIT).toBe('100kb');
  });

  it('fails fast when a required secret is missing', () => {
    expect(() => validateEnv({ MONGODB_URI: 'mongodb://localhost/x' })).toThrow(); // no JWT_SECRET
    expect(() => validateEnv({ JWT_SECRET: 'a-secret' })).toThrow(); // no MONGODB_URI
  });

  it('rejects an out-of-range credential rate limit', () => {
    expect(() => validateEnv({ ...complete, AUTH_RATE_LIMIT: 0 })).toThrow();
    expect(() => validateEnv({ ...complete, AUTH_RATE_TTL_MS: 100 })).toThrow();
  });
});
