// Shared capture DTO types (UX-01), mirroring specs/013-capture-templates/contracts/capture.openapi.yaml.

import type { MovementType } from '../movement/index';

/**
 * Per-member capture defaults, derived on read from the member's most recent
 * movement. Each reference is null when absent or no longer usable; `date` is
 * always today (server clock, YYYY-MM-DD).
 */
export interface CaptureDefaults {
  type: MovementType | null;
  accountId: string | null;
  categoryId: string | null;
  /** Today, YYYY-MM-DD. */
  date: string;
}

export interface CreateTemplateRequest {
  /** Non-blank; unique within the family (case-insensitive). */
  name: string;
  type: MovementType;
  accountId: string;
  categoryId: string;
  /** Optional suggested amount; positive whole-peso CLP when present. */
  amount?: number | null;
  note?: string | null;
}

/** Partial update; at least one field, same per-field rules as create. */
export interface UpdateTemplateRequest {
  name?: string;
  type?: MovementType;
  accountId?: string;
  categoryId?: string;
  amount?: number | null;
  note?: string | null;
}

export interface MovementTemplateSummary {
  templateId: string;
  name: string;
  type: MovementType;
  accountId: string;
  categoryId: string;
  amount: number | null;
  note: string | null;
  /** False when the referenced account is archived/missing (needs reselection). */
  accountAvailable: boolean;
  /** False when the referenced category is archived/missing or its kind ≠ type. */
  categoryAvailable: boolean;
}
