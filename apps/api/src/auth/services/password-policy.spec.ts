import { evaluatePasswordPolicy } from './password-policy';

describe('evaluatePasswordPolicy (FR-002)', () => {
  it('accepts a strong password', () => {
    expect(evaluatePasswordPolicy('strongpassword1')).toEqual([]);
  });

  it('rejects a password shorter than 12 characters', () => {
    expect(evaluatePasswordPolicy('short1')).toContainEqual(expect.stringContaining('at least 12'));
  });

  it('requires at least one number', () => {
    expect(evaluatePasswordPolicy('abcdefghijkl')).toContainEqual(
      expect.stringContaining('number'),
    );
  });

  it('requires at least one letter', () => {
    expect(evaluatePasswordPolicy('123456789012')).toContainEqual(
      expect.stringContaining('letter'),
    );
  });
});
