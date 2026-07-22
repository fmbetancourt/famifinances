# Implementation Plan: Offline Capture — Idempotent Writes (OFF-01)

**Branch**: `016-offline-capture` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-offline-capture/`

## Summary

OFF-01 delivers the **backend idempotency layer** that lets a mobile offline queue safely **replay**
queued capture writes on reconnect without creating duplicates. A create request (movement or
transfer) may carry an **`Idempotency-Key`** header; the server guarantees the operation runs **at
most once** and a replay returns the **original response** (same `201` + resource), never a duplicate.
This is a **per-request dedup**, explicitly **not** live sync / WebSockets / distributed architecture
(Principle V). It is **backend-only**: the on-device queue, offline storage, connectivity detection,
and replay orchestration are the larger, **deferred mobile** part. Idempotency records store a
**hashed fingerprint + the resource id** (no cleartext amounts/notes) and are purged by a
**configurable TTL (default 7 days)**.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS 10; Mongoose 8; pnpm 10.

**Primary Dependencies**: existing stack — NestJS, `@nestjs/mongoose`, `@nestjs/swagger`,
`class-validator`. Node's built-in `crypto` for the fingerprint (SHA-256). **No new runtime
dependency.** Reuses AUTH-01/FAM-01 (session → `familyId` + member `accountId`), TXN-01 (movement
create) and TXN-02 (transfer create), whose create paths are wrapped.

**Storage**: MongoDB. One **new** collection `idempotencyRecords` with a **TTL index** for automatic
purge. No change to movement/transfer data.

**Testing**: Jest + Supertest e2e on the shared harness (QLT-01), plus unit specs for the fingerprint
and the idempotency service. New e2e: replay movement, replay transfer, concurrency (single resource),
mismatched-payload → 409, per-member/family key isolation, no-key unchanged, malformed key → 400.

**Target Platform**: `apps/api`. No `apps/mobile` change this slice.

**Project Type**: Mobile + API monorepo; this feature touches the **API** only.

**Performance Goals**: pilot scale. Each create adds one indexed idempotency lookup/insert; the replay
path is one lookup + one re-fetch of the created resource.

**Constraints**: Principle I isolation (key scoped to `familyId` + member from session); no cleartext
amount/note in the record or logs (II); **no sync/WebSockets/queue/scheduler** — a stateless
per-request dedup (V); TS strict, OpenAPI-documented header (VI). Backward compatible: **no-key
requests are unchanged** (FR-005).

**Scale/Scope**: one new module (`idempotency`), one collection, thin wrappers on the two capture
create paths (movements, transfers), an env knob for the TTL.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Every idempotency record and lookup binds `familyId` **and** the member `accountId` from the session; the unique key is `(familyId, ownerId, key)`, so the same key value from another member/family is independent and never collides or leaks. Cross-member/family isolation e2e is mandatory and included. | PASS |
| II | Financial Privacy by Design | The record stores a **SHA-256 fingerprint** of the request + the created **resource id** — **no cleartext amount or note**. Logs carry key/ids only. The replay re-fetches the resource through the normal family-scoped path. | PASS |
| III | Derived Balance Integrity | Idempotency **protects** balances: a replayed capture cannot double-count a movement/transfer. The actual create still runs through TXN-01/TXN-02 unchanged (validations intact). | PASS |
| IV | Test-First & Definition of Done | e2e + unit ship with the code; the new `idempotency.repository.ts` falls in QLT-01's ≥90% high-risk coverage scope. Backend-first → no mobile-UX change, so the physical-device DoD gate does not apply this slice (Assumptions). | PASS |
| V | Modular Monolith Simplicity (YAGNI) | One module + one collection + a TTL index; built-in `crypto`, **no new dependency**. It is a **per-request dedup**, explicitly **not** live sync, WebSockets, a queue, or distributed architecture — the minimal enablement for offline replay (documented). | PASS |
| VI | Shared, Documented Contracts | OpenAPI documents the `Idempotency-Key` request header, the `Idempotent-Replayed` response header, and the `409` responses on the two create endpoints; behavioral contract in `contracts/idempotency.md`. TS strict, no `any`, named exports. | PASS |
| VII | Fast & Accessible Capture UX | Enables reliable offline capture (the capture-discipline goal). The on-device queue/UX ships with the deferred mobile track. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/idempotency.md`. All gates hold: key scoped to family+member (I); hashed fingerprint + id,
no cleartext financial data (II); replay prevents double-count (III); tests + coverage (IV); one
module, no new dependency, not sync (V); OpenAPI header + behavioral contract (VI). No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/016-offline-capture/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (IdempotencyRecord)
├── quickstart.md        # Phase 1 output (runnable validation guide)
├── contracts/
│   └── idempotency.md   # Behavioral contract: header, fingerprint, response codes
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files OFF-01 adds / edits

```text
apps/api/src/idempotency/                    # NEW module
├── fingerprint.ts                           # NEW: canonical-JSON SHA-256 of the request payload
├── fingerprint.spec.ts                      # NEW: unit — stable hash, key-order independent
├── idempotency.schema.ts                    # NEW: collection 'idempotencyRecords' + unique + TTL index
├── idempotency.repository.ts                # NEW: reserve / findExisting / complete / release
├── idempotency.service.ts                   # NEW: run<T>({ key, familyId, ownerId, operation, fingerprint, create, reload })
├── idempotency.service.spec.ts              # NEW: unit — reserve/replay/mismatch/in-progress/no-key
└── idempotency.module.ts                    # NEW: exports IdempotencyService

apps/api/src/movements/movements.service.ts  # EDITED: wrap createMovement via IdempotencyService
apps/api/src/movements/movements.controller.ts # EDITED: read Idempotency-Key header, set Idempotent-Replayed, @ApiHeader
apps/api/src/movements/movements.module.ts   # EDITED: import IdempotencyModule
apps/api/src/transfers/transfers.service.ts  # EDITED: wrap create via IdempotencyService
apps/api/src/transfers/transfers.controller.ts # EDITED: same header handling
apps/api/src/transfers/transfers.module.ts   # EDITED: import IdempotencyModule
apps/api/src/config/env.validation.ts        # EDITED: IDEMPOTENCY_TTL_DAYS (default 7)

apps/api/test/
├── idempotency-movements.e2e-spec.ts        # NEW: replay, concurrency, no-key, malformed key
├── idempotency-transfers.e2e-spec.ts        # NEW: replay a transfer, no double balance move
├── idempotency-integrity.e2e-spec.ts        # NEW: same key + different payload → 409; per-member/family isolation
├── idempotency-openapi.e2e-spec.ts          # NEW: served OpenAPI documents the Idempotency-Key header on both creates
└── idempotency-helpers.ts                   # NEW: suite helpers (send create with a key, repeat)
```

**Structure Decision**: A new `apps/api/src/idempotency/` module owns the mechanism: a
`fingerprint` util (SHA-256 over canonical JSON), a family+member-scoped repository over a new
`idempotencyRecords` collection, and an `IdempotencyService.run(...)` that centralizes the
reserve → execute → complete flow. The two capture services (movements, transfers) inject
`IdempotencyService` (their modules import `IdempotencyModule` **one-way → no `forwardRef`**) and wrap
their create in `run({ key, familyId, ownerId, operation, fingerprint, create, reload })`. **Concurrency**
is handled reserve-first: a unique index on `(familyId, ownerId, key)` means only one concurrent
request inserts the `pending` record and runs the create; the loser reads the record and either
**replays** the stored result (once `completed`), returns **409** on a fingerprint/operation mismatch,
or **409 in-progress** while `pending` (the offline client retries). On a create failure the
reservation is released so the key is not consumed. The controllers read the **`Idempotency-Key`**
header (absent → unchanged behavior, FR-005), pass it down, and set an **`Idempotent-Replayed`**
response header on replays. Records hold a **hashed fingerprint + resource id** (no cleartext
amount/note, Principle II) and are auto-purged by a **TTL index** whose window is `IDEMPOTENCY_TTL_DAYS`
(default 7). No new endpoint, no new dependency.

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
