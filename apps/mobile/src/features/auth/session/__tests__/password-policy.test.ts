import { evaluatePassword } from '../password-policy';

describe('evaluatePassword (FR-003)', () => {
  it('accepts a password meeting every rule', () => {
    const result = evaluatePassword('Abcdef123456!');
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('reports every unmet rule for an empty password', () => {
    const result = evaluatePassword('');
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['minLength', 'uppercase', 'lowercase', 'number', 'special']);
  });

  it('flags a too-short password that otherwise passes', () => {
    const result = evaluatePassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['minLength']);
  });

  it('flags a long password missing a special character', () => {
    const result = evaluatePassword('Abcdef123456');
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['special']);
  });
});
