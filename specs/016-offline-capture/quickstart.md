# Quickstart: Offline Capture — Idempotent Writes (OFF-01)

**Feature**: OFF-01 · Cola local para conexión intermitente
**Date**: 2026-07-21

A runnable validation guide for the OFF-01 backend. Details live in
[data-model.md](./data-model.md) and [contracts/idempotency.md](./contracts/idempotency.md).

## Prerequisites

- A registered, **email-verified** member of a family (AUTH-01 + FAM-01) with at least one active
  account and (for movements) a category.
- A bearer access token. Base path: `/v1`.

## Setup

```bash
pnpm install
pnpm --filter @famifinances/api start:dev
```

Optional: set `IDEMPOTENCY_TTL_DAYS` (default `7`) to tune record retention.

## Scenario 1 — Replay a movement is safe (US1, FR-001/002)

1. `POST /v1/movements` with header `Idempotency-Key: k-abc123` and a movement body → `201` with the
   movement.
2. Re-send the **exact same** request (same key + body) 2–3 times → each returns `201` with the **same**
   `movementId`; the list shows **one** movement.
3. `GET /v1/movements` → exactly one movement was created.

**Expected**: retries never duplicate; the replay may carry `Idempotent-Replayed: true`.

## Scenario 2 — Replay a transfer is safe (US2, FR-007)

1. `POST /v1/transfers` with `Idempotency-Key: k-tra-1` and a transfer body → `201`.
2. Re-send it → same `transferId`, and the account balances reflect **one** transfer (no double move).

## Scenario 3 — Key integrity & scope (US3, FR-003/005/008)

1. Reuse `k-abc123` with a **different amount** → `409` (the key identifies a different operation).
2. As a **different member/family**, `POST /v1/movements` with `Idempotency-Key: k-abc123` → succeeds
   and creates that member's own movement (keys are per member+family).
3. `POST /v1/movements` **without** the header → behaves exactly as today (`201`, a new movement).
4. `Idempotency-Key:` (empty) or a >200-char value → `400`.

## Scenario 4 — Concurrency (FR-007)

1. Fire two identical `POST /v1/movements` with the same key **concurrently** → exactly one movement
   exists; one response is the create, the other a replay (or a `409` while in progress).

## Automated validation

```bash
pnpm --filter @famifinances/api test:e2e -- idempotency-movements
pnpm --filter @famifinances/api test:e2e -- idempotency-transfers
pnpm --filter @famifinances/api test:e2e -- idempotency-integrity
pnpm --filter @famifinances/api test:e2e -- idempotency-openapi
pnpm --filter @famifinances/api test        # unit: fingerprint, idempotency.service
```

**Green when**: replays never duplicate a movement/transfer, concurrent duplicates yield one resource,
mismatched-payload and malformed keys are rejected, keys are isolated per member/family, no-key
requests are unchanged, and the served OpenAPI documents the `Idempotency-Key` header on both creates.
