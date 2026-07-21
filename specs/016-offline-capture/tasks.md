# Tasks: Offline Capture — Idempotent Writes (OFF-01)

**Feature**: OFF-01 · Cola local para conexión intermitente
**Branch**: `016-offline-capture`
**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/idempotency.md`, `quickstart.md`

Tests are **included** — the constitution (Principle IV) makes authorization + money-movement coverage
mandatory, and every prior slice ships e2e.

**Key rules** (from plan/research): the key travels in the **`Idempotency-Key`** header; scope is
`(familyId, ownerId)` from the session (Principle I); the record stores a **hashed fingerprint +
resource id**, never cleartext amount/note (Principle II); **no-key requests are unchanged** (FR-005);
concurrency is **reserve-first** under a unique index. The real create still runs through TXN-01/02.

---

## Phase 1: Setup

- [X] T001 [P] Create the fingerprint util `apps/api/src/idempotency/fingerprint.ts` — `fingerprint(payload: unknown): string` returning the SHA-256 hex of canonical JSON (object keys sorted, so key order does not change the hash), using Node's built-in `crypto`.
- [X] T002 [P] Unit `apps/api/src/idempotency/fingerprint.spec.ts` — same content in different key order hashes equal; different content hashes differ; stable across calls.

---

## Phase 2: Foundational (the idempotency core — blocks US1 and US2)

- [X] T003 Add `IDEMPOTENCY_TTL_DAYS` (default **7**, positive integer) to `apps/api/src/config/env.validation.ts` (with `@Type(() => Number)` coercion, mirroring the existing env knobs).
- [X] T004 Create `apps/api/src/idempotency/idempotency.schema.ts` — collection `idempotencyRecords` with `familyId`, `ownerId`, `key`, `operation`, `fingerprint`, `status` (`pending|completed`), `resourceId`, timestamps; a **unique** index `{ familyId, ownerId, key }` and a **TTL** index on `createdAt` (`expireAfterSeconds` from `IDEMPOTENCY_TTL_DAYS`). Add a small **unit** `apps/api/src/idempotency/idempotency.schema.spec.ts` asserting the schema declares the unique `{familyId,ownerId,key}` index and a TTL index with `expireAfterSeconds` derived from `IDEMPOTENCY_TTL_DAYS` (FR-006 — TTL purge is a standard Mongo behavior, verified by index configuration rather than a timed test).
- [X] T005 Create `apps/api/src/idempotency/idempotency.repository.ts` — `reserve(familyId, ownerId, key, operation, fingerprint)` (insert `pending`; on duplicate-key E11000 return null), `findExisting(familyId, ownerId, key)`, `complete(recordId, resourceId)`, `release(recordId)` (delete).
- [X] T006 Create `apps/api/src/idempotency/idempotency.service.ts` — `run<T>({ key?, familyId, ownerId, operation, fingerprint, create, reload })`: no key → `create()` (`replayed:false`); key → validate (non-empty, ≤200 chars, else `BadRequestException`), `reserve`; insert wins → `create()` → `complete`, on throw `release` + rethrow; insert loses → load existing → `409` on operation/fingerprint mismatch, `409` while `pending`, else `reload(resourceId)` (`replayed:true`).
- [X] T007 [P] Unit `apps/api/src/idempotency/idempotency.service.spec.ts` — with repo/fingerprint stubs: no-key passthrough; first-time create+complete; replay returns reloaded resource; mismatch → 409; pending → 409; malformed key → 400; create failure releases the reservation.
- [X] T008 Create `apps/api/src/idempotency/idempotency.module.ts` — registers the schema, repository and service; **exports `IdempotencyService`**.
- [X] T009 [P] Create shared e2e helpers `apps/api/test/idempotency-helpers.ts` — send a create with an `Idempotency-Key` header, resend the same request, and a helper to fire two concurrent identical requests.

**Checkpoint**: the idempotency core compiles, is unit-tested, and is exportable.

---

## Phase 3: User Story 1 — Idempotent movement capture (Priority: P1) 🎯 MVP

**Goal**: A movement create carrying an `Idempotency-Key` is applied at most once; replays return the
same movement, never a duplicate.

**Independent test**: `POST /v1/movements` with a key, resent 3×, yields **one** movement and the same
`movementId`; no key behaves as today; a malformed key → 400.

- [X] T010 [US1] Edit `apps/api/src/movements/movements.module.ts` to import `IdempotencyModule`.
- [X] T011 [US1] Wrap the create in `apps/api/src/movements/movements.service.ts` — accept an optional `idempotencyKey`; call `IdempotencyService.run({ key, familyId, ownerId, operation: 'movement.create', fingerprint: fingerprint(dto), create: () => <existing create returning {id, summary}>, reload: (id) => <fetch + map to MovementSummary> })`; return `{ result, replayed }`.
- [X] T012 [US1] Edit `apps/api/src/movements/movements.controller.ts` — read `@Headers('idempotency-key')`, pass it to the service, set `Idempotent-Replayed: true` on replays (via `@Res({ passthrough: true })`), and document it with `@ApiHeader({ name: 'Idempotency-Key', required: false })`.
- [X] T013 [P] [US1] e2e `apps/api/test/idempotency-movements.e2e-spec.ts` — replay same key+body → one movement, same id; **N distinct keys → N movements, and replaying all of them leaves exactly N** (SC-002, the queued-batch case); no-key → normal create; empty/over-long key → 400; two concurrent identical requests → exactly one movement.

**Checkpoint**: US1 is independently shippable — movement capture is retry-safe.

---

## Phase 4: User Story 2 — Idempotent transfer capture (Priority: P2)

**Goal**: A transfer create with an `Idempotency-Key` is applied at most once; replays return the same
transfer without moving balances twice.

**Independent test**: `POST /v1/transfers` with a key, resent, yields one transfer and the balances
reflect a single move.

- [X] T014 [US2] Edit `apps/api/src/transfers/transfers.module.ts` to import `IdempotencyModule`.
- [X] T015 [US2] Wrap the create in `apps/api/src/transfers/transfers.service.ts` via `IdempotencyService.run({ …, operation: 'transfer.create', fingerprint: fingerprint(dto), create, reload })`.
- [X] T016 [US2] Edit `apps/api/src/transfers/transfers.controller.ts` — same `Idempotency-Key` header handling + `@ApiHeader` as movements.
- [X] T017 [P] [US2] e2e `apps/api/test/idempotency-transfers.e2e-spec.ts` — replay same key → one transfer, same id, balances reflect a single move.

**Checkpoint**: US2 complete — transfer capture is retry-safe.

---

## Phase 5: User Story 3 — Key integrity & scope (Priority: P3)

**Goal**: A key reused with different content is rejected; keys are isolated per member/family;
no-key requests are unchanged.

**Independent test**: reusing a key with a different amount → 409; the same key value from another
member/family creates its own resource; a no-key create behaves as today.

> **Note (intentional)**: US3 has **no production tasks** — mismatch rejection (FR-008), per-member/
> family scope (FR-003) and the no-key path (FR-005) all live in `IdempotencyService` (T006). US3 is
> the test phase that proves them; this is by design, not a coverage gap.

- [X] T018 [P] [US3] e2e `apps/api/test/idempotency-integrity.e2e-spec.ts` — same key + different payload → 409; same key value from a second member of the same family → independent create; same key value from a second family → independent create; no-key create unchanged.

**Checkpoint**: all three stories complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] e2e `apps/api/test/idempotency-openapi.e2e-spec.ts` — the served OpenAPI documents the `Idempotency-Key` request header on `POST /v1/movements` and `POST /v1/transfers`.
- [X] T020 [P] e2e `apps/api/test/idempotency-log-privacy.e2e-spec.ts` — creating and replaying a movement with an amount + note emits **no** amount/note in captured logs (only key/operation/ids), FR-009.
- [X] T021 Run `pnpm --filter @famifinances/api test:cov` and confirm `idempotency.repository.ts` meets QLT-01's ≥90% high-risk floor; add targeted unit cases if a branch is short.
- [X] T022 Validate the full gate locally: `pnpm --filter @famifinances/api typecheck && pnpm lint && pnpm --filter @famifinances/api build && pnpm --filter @famifinances/api test:e2e`; walk `quickstart.md` scenarios 1–4. Confirm the existing movements/transfers suites still pass (no regression from the create-path wrapping).

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T009)** block everything; the idempotency core is a shared prerequisite for both capture stories.
- **US1 (T010–T013)** depends on Foundational — it is the **MVP** and can ship alone.
- **US2 (T014–T017)** depends on Foundational; independent of US1 (different module/files).
- **US3 (T018)** depends on US1/US2 being wired (it exercises both creates); no new production code.
- **Polish (T019–T022)** runs after the stories; gate last.
- Same-file chains are sequential within a module: `movements.service`/`controller`/`module` (US1), `transfers.service`/`controller`/`module` (US2). `[P]` marks different-file, dependency-free tasks.

## Parallel Execution Examples

- **Setup**: T001 + T002 `[P]` (util + unit) together.
- **Foundational**: T007 `[P]` (service unit) and T009 `[P]` (helpers) alongside the core build; T003–T006/T008 are a mostly-sequential chain (schema → repo → service → module).
- **US1**: T013 `[P]` (e2e) authored alongside T010–T012.
- **US1 vs US2**: the two stories touch different modules and can proceed in parallel once Foundational is done.
- **Polish**: T019/T020 `[P]` together; T021 then T022 last.

## Implementation Strategy

- **MVP = US1** (idempotent movement capture): the primary offline-captured write; ships without transfers.
- **Incremental**: US2 adds transfers (same mechanism); US3 proves integrity/scope. Each phase ends at a green, independently testable checkpoint.
- **TDD**: write each story's e2e/unit alongside its implementation; keep the suite green (QLT-01 retry harness), never log an amount/note, and confirm no-key behavior is unchanged at every step.
