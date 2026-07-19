// Shared movement DTO types, mirroring specs/006-movements/contracts/movements.openapi.yaml.

export type MovementType = 'income' | 'expense';

export interface CreateMovementRequest {
  type: MovementType;
  /** Positive whole-peso CLP amount (> 0). */
  amount: number;
  /** ISO calendar date (YYYY-MM-DD) the movement occurred. */
  date: string;
  accountId: string;
  categoryId?: string | null;
  note?: string | null;
}

export interface UpdateMovementRequest {
  type?: MovementType;
  amount?: number;
  date?: string;
  accountId?: string;
  categoryId?: string | null;
  note?: string | null;
}

export interface MovementSummary {
  movementId: string;
  type: MovementType;
  /** Positive whole-peso CLP amount. */
  amount: number;
  /** ISO calendar date (YYYY-MM-DD). */
  date: string;
  accountId: string;
  categoryId: string | null;
  note: string | null;
}
