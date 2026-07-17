import { normalizeEmail } from './account.repository';

describe('normalizeEmail (FR-003)', () => {
  it('trims surrounding whitespace and lowercases', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com');
  });

  it('is idempotent', () => {
    expect(normalizeEmail(normalizeEmail('A@B.com'))).toBe('a@b.com');
  });
});
