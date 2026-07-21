# Data Model: Offline Capture — Idempotent Writes (OFF-01)

**Feature**: OFF-01 · Cola local para conexión intermitente
**Date**: 2026-07-21

OFF-01 adds **one** persisted collection (`idempotencyRecords`). It stores no cleartext financial
data; it references the created movement/transfer by id.

## Entity: IdempotencyRecord *(persisted — collection `idempotencyRecords`)*

One record per member+key, reserving/recording a single capture operation.

| Field | Type | Rules |
|-------|------|-------|
| `familyId` | ObjectId → Family | Required; from the session (Principle I). Part of the unique key. |
| `ownerId` | ObjectId → Account | Required; the member (session `accountId`). Part of the unique key. |
| `key` | string | Required; the client-supplied `Idempotency-Key` (non-empty, ≤ 200 chars). Part of the unique key. |
| `operation` | `'movement.create' \| 'transfer.create'` | Required; which capture write this key reserved. A different operation for the same key → `409`. |
| `fingerprint` | string | Required; **SHA-256 hex** of the canonical-JSON request payload. A different fingerprint for the same key → `409`. **No cleartext amount/note.** |
| `status` | `'pending' \| 'completed'` | `pending` while the create runs; `completed` once the resource exists. |
| `resourceId` | ObjectId \| null | The created movement/transfer id; set on completion. Null while pending. |
| `createdAt` | Date | Mongoose timestamp; drives the TTL purge. |
| `updatedAt` | Date | Mongoose timestamp. |

**Indexes**

- `{ familyId: 1, ownerId: 1, key: 1 }` **unique** — one record per member+key; the reserve-first
  insert relies on this to serialize concurrent duplicates (FR-007).
- **TTL** on `createdAt` with `expireAfterSeconds = IDEMPOTENCY_TTL_DAYS × 86400` (env, default **7**) —
  automatic purge (FR-006).

**Lifecycle**: `reserve` (insert `pending`) → create runs → `complete` (`completed` + `resourceId`), or
on create failure `release` (delete). TTL eventually purges completed records past the window.

## Behavior: `IdempotencyService.run(...)`

Input: `{ key?, familyId, ownerId, operation, fingerprint, create, reload }`.

- **No key** → run `create()` and return `{ result, replayed: false }` (FR-005; unchanged behavior).
- **Key present** → validate format (else `400`), then:
  1. `reserve(familyId, ownerId, key, operation, fingerprint)`.
     - **Insert wins** → run `create()` → `{ id, result }`; `complete(record, id)`; return `{ result, replayed: false }`. On throw → `release(record)` and rethrow.
     - **Insert loses** (duplicate key) → load the existing record:
       - `operation`/`fingerprint` mismatch → **`409`** (FR-008).
       - `status = pending` → **`409` in-progress** (client retries).
       - `status = completed` → `reload(resourceId)` → return `{ result, replayed: true }` (FR-002).

`create()` performs the real movement/transfer create (TXN-01/02, validations intact) and returns the
new id + summary. `reload(id)` re-fetches the resource through the normal family-scoped path and maps
it to the same summary — so the replay response is byte-identical without storing it.

## Validation & isolation rules

- Every reserve/lookup binds `familyId` + `ownerId` from the session; the same `key` value from another
  member/family is a **different** record (unique index includes both) — no collision, no cross-access
  (Principle I, FR-003/SC-004).
- The fingerprint is a **hash**; the record never holds a cleartext amount or note (Principle II, FR-009).
- A malformed/empty/over-long key → `400` (FR-011).

## Notes

- No change to the `movements`/`transfers` collections; the create paths are wrapped, not altered.
- Retention is approximate (Mongo's TTL monitor runs periodically) — acceptable for an offline window.
