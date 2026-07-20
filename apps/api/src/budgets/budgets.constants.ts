/**
 * Percent-consumed at or above which a budget line is flagged `near` its limit
 * (FR-008). Over = real spend > planned; near = threshold ≤ percent < over.
 * Kept as a constant so the value can change without a contract change.
 */
export const BUDGET_NEAR_THRESHOLD = 80;

/** The current calendar month as 'YYYY-MM' (UTC) — the report's default period. */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
