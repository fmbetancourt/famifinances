// FR-003 · Client-side password-complexity policy, mirroring the API rule set so the
// UI can give real-time feedback (US2-AS3). Pure and synchronous; the server remains
// the source of truth. Status is conveyed as text, never color alone (Principle VII).

export type PasswordRuleId = 'minLength' | 'uppercase' | 'lowercase' | 'number' | 'special';

export interface PasswordEvaluation {
  readonly valid: boolean;
  readonly missing: PasswordRuleId[];
}

const MIN_LENGTH = 12;

const RULES: ReadonlyArray<{ id: PasswordRuleId; test: (password: string) => boolean }> = [
  { id: 'minLength', test: (p) => p.length >= MIN_LENGTH },
  { id: 'uppercase', test: (p) => /[A-Z]/.test(p) },
  { id: 'lowercase', test: (p) => /[a-z]/.test(p) },
  { id: 'number', test: (p) => /[0-9]/.test(p) },
  { id: 'special', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Human-readable requirement labels for the missing-rule feedback list. */
export const PASSWORD_RULE_LABELS: Record<PasswordRuleId, string> = {
  minLength: `At least ${MIN_LENGTH} characters`,
  uppercase: 'One uppercase letter',
  lowercase: 'One lowercase letter',
  number: 'One number',
  special: 'One special character',
};

/** Evaluates a password against every rule, returning the unmet ones. */
export function evaluatePassword(password: string): PasswordEvaluation {
  const missing = RULES.filter((rule) => !rule.test(password)).map((rule) => rule.id);
  return { valid: missing.length === 0, missing };
}
