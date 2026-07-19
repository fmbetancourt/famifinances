// Shared transfer DTO types, mirroring specs/007-transfers/contracts/transfers.openapi.yaml.

export interface CreateTransferRequest {
  /** Positive whole-peso CLP amount (> 0). */
  amount: number;
  /** ISO calendar date (YYYY-MM-DD) the transfer occurred. */
  date: string;
  fromAccountId: string;
  toAccountId: string;
  note?: string | null;
}

export interface UpdateTransferRequest {
  amount?: number;
  date?: string;
  fromAccountId?: string;
  toAccountId?: string;
  note?: string | null;
}

export interface TransferSummary {
  transferId: string;
  /** Positive whole-peso CLP amount. */
  amount: number;
  /** ISO calendar date (YYYY-MM-DD). */
  date: string;
  fromAccountId: string;
  toAccountId: string;
  note: string | null;
}
