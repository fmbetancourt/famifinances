/**
 * Password strength policy (FR-002). Returns the list of failed rule messages;
 * an empty array means the password is acceptable. Kept pure and testable.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export function evaluatePasswordPolicy(password: string): string[] {
  const failures: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    failures.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    failures.push(`Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`);
  }
  if (!/[a-zA-Z]/.test(password)) {
    failures.push('Password must contain at least one letter.');
  }
  if (!/[0-9]/.test(password)) {
    failures.push('Password must contain at least one number.');
  }
  return failures;
}
