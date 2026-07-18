// Shared account DTO types, mirroring specs/004-accounts/contracts/accounts.openapi.yaml.
// "Account" here is the family financial account (ACC-01), distinct from the AUTH-01 user account.

export type AccountType = 'bank' | 'digital_wallet' | 'cash' | 'credit_card';

/** Which accounts a list request returns (default `active`). */
export type AccountStatusFilter = 'active' | 'archived' | 'all';

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  /** Whole-peso CLP amount; may be negative, zero, or positive. */
  initialBalance: number;
  /** ISO calendar date (YYYY-MM-DD) the initial balance is effective. */
  startDate: string;
  /** Optional manual institution label (never a bank connection). */
  institution?: string | null;
}

export interface UpdateAccountRequest {
  name?: string;
  type?: AccountType;
  initialBalance?: number;
  startDate?: string;
  institution?: string | null;
}

export interface FinancialAccountSummary {
  accountId: string;
  name: string;
  type: AccountType;
  institution: string | null;
  /** Whole-peso CLP initial balance. */
  initialBalance: number;
  /** Derived balance (initial balance + movements); equals initialBalance in ACC-01. */
  balance: number;
  currency: 'CLP';
  /** ISO calendar date (YYYY-MM-DD). */
  startDate: string;
  archived: boolean;
}
