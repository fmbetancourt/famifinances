import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { IdempotencyRepository } from './idempotency.repository';
import { IdempotencyOperation } from './idempotency.schema';

const MAX_KEY_LENGTH = 200;

export interface IdempotencyRunInput<T> {
  /** The `Idempotency-Key` header value; `undefined` = header absent (passthrough). */
  key: string | undefined;
  familyId: string;
  ownerId: string;
  operation: IdempotencyOperation;
  /** SHA-256 fingerprint of the request payload. */
  fingerprint: string;
  /** Performs the real create; returns the new resource id + the response value. */
  create: () => Promise<{ id: string; result: T }>;
  /** Re-fetches the resource for a replay, reproducing the original response. */
  reload: (id: string) => Promise<T>;
}

export interface IdempotencyRunResult<T> {
  result: T;
  replayed: boolean;
}

/**
 * OFF-01 · centralizes the reserve → execute → complete flow so a client-supplied
 * `Idempotency-Key` makes a capture create apply at most once. A no-key request is
 * unchanged (FR-005); concurrency is serialized by the unique index (reserve-first).
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly records: IdempotencyRepository) {}

  async run<T>(input: IdempotencyRunInput<T>): Promise<IdempotencyRunResult<T>> {
    const { key, familyId, ownerId, operation, fingerprint, create, reload } = input;

    // No header → behave exactly as today (FR-005).
    if (key === undefined) {
      const { result } = await create();
      return { result, replayed: false };
    }

    const normalized = key.trim();
    if (normalized.length === 0 || key.length > MAX_KEY_LENGTH) {
      throw new BadRequestException('Idempotency-Key must be a non-empty string of at most 200 characters.');
    }

    const reserved = await this.records.reserve(familyId, ownerId, normalized, operation, fingerprint);
    if (reserved) {
      try {
        const { id, result } = await create();
        await this.records.complete(reserved.id, id);
        return { result, replayed: false };
      } catch (error) {
        await this.records.release(reserved.id);
        throw error;
      }
    }

    // The key already exists — replay, or reject a mismatch / in-progress.
    const existing = await this.records.findExisting(familyId, ownerId, normalized);
    if (!existing) {
      throw new ConflictException('This idempotency key is being processed; retry shortly.');
    }
    if (existing.operation !== operation || existing.fingerprint !== fingerprint) {
      throw new ConflictException('This idempotency key was already used for a different request.');
    }
    if (existing.status !== 'completed' || existing.resourceId === null) {
      throw new ConflictException('This idempotency key is being processed; retry shortly.');
    }
    const result = await reload(existing.resourceId.toString());
    return { result, replayed: true };
  }
}
