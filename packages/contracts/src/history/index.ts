// Shared movement-history DTO types, mirroring specs/010-history/contracts/history.openapi.yaml.

import type { MovementSummary, MovementType } from '../movement/index';

export interface MovementHistoryQuery {
  /** Inclusive lower bound on the occurrence date (YYYY-MM-DD). */
  from?: string;
  /** Inclusive upper bound on the occurrence date (YYYY-MM-DD). */
  to?: string;
  type?: MovementType;
  /** Account id filter (family-scoped). */
  account?: string;
  /** Category id filter (family-scoped). */
  category?: string;
  /** Case-insensitive substring over the note; blank = no filter. */
  search?: string;
  /** Page size; default 20, max 100. */
  limit?: number;
  /** Rows to skip; default 0. */
  offset?: number;
}

export interface MovementHistoryPage {
  /** The page's movements, newest first (occurrence date desc, then creation desc). */
  items: MovementSummary[];
  /** Total movements matching the filters (ignoring paging). */
  total: number;
  limit: number;
  offset: number;
  /** offset + items.length < total. */
  hasMore: boolean;
}
