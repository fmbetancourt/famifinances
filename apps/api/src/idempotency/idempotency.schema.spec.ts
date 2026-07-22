import { IdempotencyRecordSchema, IDEMPOTENCY_TTL_SECONDS } from './idempotency.schema';

/** OFF-01 · FR-003/FR-006 — the record's isolation + retention are enforced by indexes. */
describe('IdempotencyRecord indexes', () => {
  const indexes = IdempotencyRecordSchema.indexes();

  it('declares a unique index on { familyId, ownerId, key }', () => {
    const unique = indexes.find(
      ([fields, options]) =>
        fields.familyId === 1 &&
        fields.ownerId === 1 &&
        fields.key === 1 &&
        options?.unique === true,
    );
    expect(unique).toBeDefined();
  });

  it('declares a TTL index on createdAt derived from IDEMPOTENCY_TTL_DAYS', () => {
    const ttl = indexes.find(
      ([fields, options]) => fields.createdAt === 1 && typeof options?.expireAfterSeconds === 'number',
    );
    expect(ttl).toBeDefined();
    expect(ttl?.[1]?.expireAfterSeconds).toBe(IDEMPOTENCY_TTL_SECONDS);
    expect(IDEMPOTENCY_TTL_SECONDS).toBe(7 * 24 * 60 * 60); // default 7 days
  });
});
