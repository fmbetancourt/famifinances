# Idempotency Contract (OFF-01)

**Feature**: OFF-01 · Offline capture — idempotent writes
**Date**: 2026-07-21

OFF-01 adds **no new endpoint**. It augments the two **capture create** endpoints with an idempotency
mechanism. This is the observable contract the e2e tests assert.

## Affected endpoints

- `POST /v1/movements` (TXN-01)
- `POST /v1/transfers` (TXN-02)

## Request — `Idempotency-Key` header

| Item | Value |
|------|-------|
| Header | `Idempotency-Key` (optional) |
| Value | An opaque, client-generated unique string per queued operation. Non-empty, ≤ 200 chars. |
| Scope | `(familyId, ownerId)` from the session — the same value from another member/family is independent. |

## Response behaviors

| Condition | Result |
|-----------|--------|
| **No header** | Unchanged from today — the resource is created (`201`). |
| **Header, first time** | The resource is created (`201`) and the key is recorded. |
| **Header, replay** (same key + same payload) | The **original response** is returned as-is (`201` + the same resource); may include `Idempotent-Replayed: true`. **No duplicate.** |
| **Header, concurrent duplicate** | Exactly one resource is created; the loser replays it (or gets `409` while the first is still in progress). |
| **Header reused, different payload** (or different operation) | `409` Conflict — the key already identifies a different operation. |
| **Malformed key** (empty / too long) | `400` Bad Request. |

## Response header

| Header | Meaning |
|--------|---------|
| `Idempotent-Replayed: true` | Present (optional) when the response is a replay of a prior create. |

## OpenAPI

Both create operations document the `Idempotency-Key` request header and the added `409` response; the
served OpenAPI document MUST expose the header parameter on both (asserted by `idempotency-openapi.e2e`).

## Guarantees (map to FR/SC)

| Guarantee | Ref |
|-----------|-----|
| A key makes a create apply **at most once**; replay returns the original resource | FR-001/FR-002, SC-001 |
| Applies to movement + transfer creates | FR-004 |
| Keys scoped/isolated per member+family | FR-003, SC-004 |
| No-key requests unchanged | FR-005, SC-005 |
| Concurrent duplicates → one resource | FR-007 |
| Same key + different payload → rejected | FR-008, SC-003 |
| No amount/note in logs or the record (hashed fingerprint) | FR-009, SC-006 |
| Records purged after a configurable window (default 7 days) | FR-006 |
