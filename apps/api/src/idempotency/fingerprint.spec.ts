import { fingerprint } from './fingerprint';

describe('fingerprint (OFF-01)', () => {
  it('is stable across calls for the same content', () => {
    const a = fingerprint({ amount: 1000, type: 'expense' });
    const b = fingerprint({ amount: 1000, type: 'expense' });
    expect(a).toBe(b);
  });

  it('is independent of object key order', () => {
    const a = fingerprint({ amount: 1000, type: 'expense', accountId: 'x' });
    const b = fingerprint({ accountId: 'x', type: 'expense', amount: 1000 });
    expect(a).toBe(b);
  });

  it('differs when any value differs', () => {
    const a = fingerprint({ amount: 1000, type: 'expense' });
    const b = fingerprint({ amount: 1001, type: 'expense' });
    expect(a).not.toBe(b);
  });

  it('produces a 64-char hex string', () => {
    expect(fingerprint({ x: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
