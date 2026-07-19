---

description: "Task list for TXN-02 · Transfers Between Accounts"
---

# Tasks: Transfers Between Accounts (TXN-02)

**Input**: Design documents from `/specs/007-transfers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/transfers.openapi.yaml, quickstart.md

**Tests**: INCLUDED (constitution Principle IV · Test-First). Mandatory coverage: transfer balance effect
(origin −, destination +), **no double counting** (income/expense totals / movement history unchanged by a
transfer), same-account rejection, cross-family isolation, audit trail surviving deletion, soft-delete
excluded from balance/list, positive amount + validation, no amounts/notes in logs. Test tasks are written
FIRST and must FAIL before implementation.

**Organization**: Grouped by user story (US1–US5). Builds on AUTH-01/FAM-01/ACC-01/TXN-01 — reused, not
rebuilt (structurally parallel to TXN-01's movements). Applies the ACC-01/TXN-01 conventions: `FamilyScopeGuard`
before `EmailVerifiedGuard` on writes (no-family → 404), shared `@IsCalendarDate`, note trimmed, DTO whitelist,
empty PATCH → 400, idempotent soft-delete via a family-scoped `findAny` (re-delete 204, foreign 404).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task.
- **[Story]**: US1–US5 from spec.md.

---

## Phase 1: Setup (Shared Contracts)

- [X] T001 [P] Add transfer DTO types (`CreateTransferRequest`, `UpdateTransferRequest`, `TransferSummary`) mirroring `contracts/transfers.openapi.yaml` in `packages/contracts/src/transfer/index.ts` and re-export from `packages/contracts/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Transfer + audit entities, the family-scoped repository, the balance aggregation, and the
ACC-01 balance-composition extension (movements + transfers)

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T002 [P] Create `Transfer` Mongoose schema (amount int, date, `fromAccountId` ref FinancialAccount **indexed**, `toAccountId` ref FinancialAccount **indexed**, `familyId` ref Family **indexed**, note null|string, `deletedAt` null|Date, `createdBy` ref Account, timestamps) with a compound index `{ familyId, deletedAt, date }` in `apps/api/src/transfers/transfer.schema.ts`
- [X] T003 [P] Create the append-only `TransferEvent` audit schema (transferId **indexed**, familyId **indexed**, actorId, type `created|updated|deleted`, snapshot `{amount,date,fromAccountId,toAccountId,note}`, createdAt) in `apps/api/src/transfers/transfer-event.schema.ts`
- [X] T004 Create `TransferRepository` — every query bound to `familyId`: `create`, `findInFamily(familyId, id)` (**non-deleted** — get/edit), `findAnyInFamily(familyId, id)` (regardless of `deletedAt` — the idempotent delete path), `listByFamily(familyId, { account })` (non-deleted, newest first; `account` matches origin **or** destination), `update(familyId, id, patch)`, `markDeleted(familyId, id, when)`, and `netByAccount(familyId)` aggregation (emit `−amount` for `fromAccountId` and `+amount` for `toAccountId`, `$group by account`, over `deletedAt:null`) in `apps/api/src/transfers/transfer.repository.ts`
- [X] T005 [P] Create `TransferEventRepository` (`append(input)`, `listByFamily(familyId)`, `listByTransfer(transferId)`) in `apps/api/src/transfers/transfer-event.repository.ts`
- [X] T006 Create `TransferBalanceService` (`netForAccount(familyId, accountId)`, `netByFamily(familyId)`) backed by the `netByAccount` aggregation, to be consumed by ACC-01, in `apps/api/src/transfers/transfer-balance.service.ts`
- [X] T007 Wire `TransfersModule` (`MongooseModule.forFeature` Transfer + TransferEvent; import `FamiliesModule`, `forwardRef(() => FinancialAccountsModule)`; provide `TransfersService` + repositories + `TransferBalanceService`; **export** `TransferBalanceService`) and register it in `apps/api/src/transfers/transfers.module.ts` and `apps/api/src/app.module.ts`
- [X] T008 Extend the derived balance: `FinancialAccountsModule` imports `forwardRef(() => TransfersModule)`; `FinancialAccountsService` injects `TransferBalanceService` (via `@Inject(forwardRef(...))`) and composes each account's balance as `initialBalance + movementNet + transferNet` (the callers sum the two nets; the account list fetches both `netByFamily` maps in one query each). **`deriveBalance` stays the pure `initialBalance + net` function, so no ACC-01/TXN-01 unit test changes are forced.** In `apps/api/src/financial-accounts/financial-accounts.service.ts` and `financial-accounts.module.ts`

**Checkpoint**: Transfer + audit entities exist; the family-scoped repository + balance aggregation work; an
account's balance now sums its movements and its transfers.

---

## Phase 3: User Story 1 - Record a transfer (Priority: P1) 🎯 MVP

**Goal**: A verified member records a transfer; the origin balance decreases and the destination increases.

**Independent Test**: with two family accounts (origin O, destination D), record a transfer of A → origin
becomes O−A and destination becomes D+A; author + occurrence date recorded.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T009 [P] [US1] e2e for `POST /transfers` (201; the origin balance decreases and the destination increases by the amount; author + occurrence date + creation time recorded; unverified → 403; no-family → 404; non-positive amount / invalid date / origin==destination / unknown field → 400) in `apps/api/test/create-transfer.e2e-spec.ts`

### Implementation for User Story 1

- [X] T010 [P] [US1] Create `CreateTransferDto` (`amount` `@IsInt` `@IsPositive`, `date` `@IsCalendarDate`, `fromAccountId` string, `toAccountId` string, `note?` trimmed ≤280) in `apps/api/src/transfers/dto/create-transfer.dto.ts`
- [X] T011 [US1] Implement `TransfersService.createTransfer` (validate both accounts are active + own via `FinancialAccountRepository.findInFamily`; reject `from == to`; persist with `familyId` + `createdBy` from the session; append a `created` `TransferEvent`) in `apps/api/src/transfers/transfers.service.ts`
- [X] T012 [US1] Implement `POST /transfers` guarded by `JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard` (FamilyScope before EmailVerified) in `apps/api/src/transfers/transfers.controller.ts`
- [ ] T013 [P] [US1] Mobile capture screen (amount, from, to, date, note; one primary action) in `apps/mobile/app/(transfers)/create.tsx`

**Checkpoint**: A verified member records transfers and both account balances update.

---

## Phase 4: User Story 2 - See the family's transfers (Priority: P1)

**Goal**: Any member sees the family's transfers, most recent first, with each transfer's details.

**Independent Test**: with several transfers, list them newest-first with amount/date/from/to/note; two members
of the same family see the identical list; `?account` filters to transfers touching that account.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T014 [P] [US2] e2e for `GET /transfers` and `GET /transfers/{id}` (non-deleted, newest first, with details; `?account=` matches origin or destination; two members see the same set + balances; a deleted transfer is excluded) in `apps/api/test/list-transfers.e2e-spec.ts`

### Implementation for User Story 2

- [X] T015 [P] [US2] Create `ListTransfersQuery` (`account?` string) in `apps/api/src/transfers/dto/list-transfers.query.ts`
- [X] T016 [US2] Implement `TransfersService.listTransfers` (family-scoped, non-deleted, newest first, `account` matches origin/destination) + `getTransfer` (404 when not in family / deleted) + `TransferSummary` mapping in `apps/api/src/transfers/transfers.service.ts`
- [X] T017 [US2] Implement `GET /transfers` (with `account`) and `GET /transfers/{id}` via `JwtAuthGuard` + `FamilyScopeGuard` in `apps/api/src/transfers/transfers.controller.ts`
- [ ] T018 [P] [US2] Mobile transfer list screen (newest first) in `apps/mobile/app/(transfers)/index.tsx`

**Checkpoint**: Members share one transfer list and the same balances.

---

## Phase 5: User Story 3 - Family isolation & no double counting (Priority: P1)

**Goal**: Transfers are family-scoped; both accounts must be the family's active accounts and differ; a
transfer never counts as income or expense.

**Independent Test**: recording against another family's/archived account → 400; origin==destination → 400; a
member of B cannot view/edit/delete A's transfer → 404; a transfer does not appear in the movement history and
does not change income/expense figures.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T019 [P] [US3] Authorization e2e: a foreign or archived origin/destination → 400; origin==destination → 400; a member of family B is rejected (404) from family A's transfer on read/edit/delete; a foreign `familyId`/`accountId` is ignored; no-family → 404 (FR-003, FR-013, SC-004/005) in `apps/api/test/transfer-isolation.e2e-spec.ts`

### Implementation for User Story 3

- [X] T020 [US3] Ensure `createTransfer`/`updateTransfer` validate the effective origin + destination against the session family (active + own → else 400) and `from ≠ to` (→ 400), and every read/write resolves the transfer within the session family (foreign/deleted → 404); no caller-supplied family/account id is trusted (Principle I) in `apps/api/src/transfers/transfers.service.ts` and `apps/api/src/transfers/transfer.repository.ts`

**Checkpoint**: Isolation + the transfer invariant verified; income/expense totals stay untouched.

---

## Phase 6: User Story 4 - Edit a transfer (Priority: P2)

**Goal**: A verified member edits a transfer, re-validated; affected balances recompute; the edit is auditable.

**Independent Test**: edit an amount → both balances recompute; edit that changes an account → all affected
balances recompute; invalid/same-account/foreign edit → 400 unchanged; cross-family → 404; an `updated` audit exists.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T021 [P] [US4] e2e for `PATCH /transfers/{id}` (edit amount/date/from/to/note → 200; the affected account balances recompute, including when an account changes; invalid field / origin==destination / foreign account → 400 and unchanged; empty body → 400; cross-family → 404; an `updated` audit record is appended) in `apps/api/test/edit-transfer.e2e-spec.ts`

### Implementation for User Story 4

- [X] T022 [P] [US4] Create `UpdateTransferDto` (all fields optional, at least one present; same validators; `note` trimmed ≤280; unknown fields rejected) in `apps/api/src/transfers/dto/update-transfer.dto.ts`
- [X] T023 [US4] Implement `TransfersService.updateTransfer` (re-validate the effective origin/destination + `from ≠ to`; reject an empty patch → 400; partial update within the session family; append an `updated` `TransferEvent`) + `PATCH /transfers/{id}` (`JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard`) in `apps/api/src/transfers/transfers.service.ts` and controller
- [ ] T024 [P] [US4] Mobile edit-transfer screen in `apps/mobile/app/(transfers)/[transferId]/edit.tsx`

**Checkpoint**: Members can correct transfers; balances stay accurate; edits are auditable.

---

## Phase 7: User Story 5 - Delete a transfer (Priority: P2)

**Goal**: A verified member deletes a transfer; it no longer affects balances or the list; the deletion is auditable.

**Independent Test**: delete a transfer → 204; both balances no longer include it and it is absent from the
list; a `deleted` audit record survives; cross-family delete → 404.

### Tests for User Story 5 ⚠️ (write first, must fail)

- [X] T025 [P] [US5] e2e for `DELETE /transfers/{id}` (204; excluded from both account balances and from `GET /transfers`; a `deleted` audit record survives; re-deleting is idempotent → 204; cross-family → 404) in `apps/api/test/delete-transfer.e2e-spec.ts`

### Implementation for User Story 5

- [X] T026 [US5] Implement `TransfersService.deleteTransfer` (resolve via `findAnyInFamily` — own transfer deleted-or-not → 204, foreign/unknown → 404; on the first deletion set `deletedAt` via `markDeleted` and append a `deleted` `TransferEvent`; idempotent no-op if already deleted) + `DELETE /transfers/{id}` → 204 (`JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard`) in `apps/api/src/transfers/transfers.service.ts` and controller
- [ ] T027 [P] [US5] Mobile delete action on the transfer screen in `apps/mobile/app/(transfers)/[transferId]/index.tsx`

**Checkpoint**: Erroneous transfers can be removed; balances stay correct; the audit trail is preserved.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T028 [P] Balance + no-double-counting e2e: a transfer of A makes the origin balance −A and the destination +A; the family's `GET /movements` is **unchanged** by the transfer (it is neither income nor expense — no double counting); a deleted transfer is excluded from both balances (SC-002/003/007, Principle III) in `apps/api/test/transfer-balance.e2e-spec.ts`
- [X] T029 [P] Audit-trail e2e: each create/edit/delete appends a `TransferEvent` (actor + type + timestamp + snapshot); the trail survives the transfer's deletion (FR-011, SC-006) in `apps/api/test/transfer-audit.e2e-spec.ts`
- [X] T030 [P] No-financial-data-in-logs e2e: monetary amounts and note content never appear in logs across record/list/edit/delete (FR-015, SC-009) in `apps/api/test/transfer-log-privacy.e2e-spec.ts`
- [X] T031 [P] OpenAPI parity check: the generated document matches `specs/007-transfers/contracts/transfers.openapi.yaml` (scoped to the `transfers` surface) in `apps/api/test/transfer-openapi-parity.e2e-spec.ts`
- [X] T032 [P] Document the transfers module (balance now sums movements + transfers, no double counting, soft-delete + append-only audit) as completing the income/expense/transfer money model, in `apps/api/README.md`
- [X] T033 Execute `specs/007-transfers/quickstart.md` end-to-end and record results, including the SC-002 (balances shift) / SC-003 (totals unchanged) observations
- [X] T034 [P] Verify `packages/contracts` transfer types compile against the API (no `any`) via `pnpm typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: contracts types — no dependencies.
- **Foundational (Phase 2)**: entities + repository + balance aggregation + ACC-01 balance-composition
  extension — BLOCKS all user stories. T002/T003/T005 independent; T004 after T002; T006 after T004; T007
  after T002/T003/T004/T005/T006; T008 after T006/T007.
- **User Stories (Phase 3–7)**: depend on Foundational.
  - US1 (P1): record + balances (needs the balance extension T008).
  - US2 (P1): depends on US1 (transfers must exist to list).
  - US3 (P1): depends on the family-scoped repository + validation (Foundational/US1); verifies isolation +
    no double counting.
  - US4 (P2): depends on US1/US2 (a transfer to edit).
  - US5 (P2): depends on US1/US2 (a transfer to delete).
- **Polish (Phase 8)**: after the stories.

### Within Each User Story

- Tests are written and MUST FAIL before implementation.
- Schemas/repositories before services; services before endpoints; core before mobile.

### Parallel Opportunities

- Foundational: T002, T003, T005 in parallel; then T004, T006, T007, T008 in order.
- Within a story, `[P]` tests and `[P]` DTOs run before their service.
- Mobile screens (`[P]`) can proceed alongside their story's API once the contract is fixed.

---

## Implementation Strategy

### MVP scope

- **Minimal deployable slice**: Foundational + **US1** (record a transfer; both balances shift).
- **Recommended demo MVP**: through **US3** (record + list + isolation/no-double-counting) — the full P1 set
  that completes the income/expense/transfer money model for BUD-01/DASH-01.

### Incremental delivery

1. Setup + Foundational → entities + balance extension ready.
2. US1 → US2 → US3 (P1 core) → validate/demo.
3. US4 (edit) → US5 (delete).
4. Polish: balance/no-double-counting, audit trail, log-privacy, OpenAPI parity, docs, quickstart, contracts typecheck.

---

## Notes

- Reuses AUTH-01 (`JwtAuthGuard`, `EmailVerifiedGuard`), FAM-01 (`FamilyScopeGuard`, `@CurrentFamily`), ACC-01
  (`FinancialAccountRepository`; `deriveBalance` composition extended), and the TXN-01 patterns (soft delete,
  append-only audit, shared `@IsCalendarDate`).
- The accounts⇄transfers balance/validation coupling mirrors accounts⇄movements and is resolved with a second
  `forwardRef` (research R1); `deriveBalance` stays pure so no TXN-01/ACC-01 unit changes are forced.
- Constitution gates covered: family-from-session isolation + reference validation (T019/T020), derived
  balance / no stored editable balance (T028 + T008), **no double counting** — a transfer never changes
  income/expense totals (T028), append-only audit surviving deletion (T029), soft-delete excluded from
  balance/list (T025/T028), no-secrets-in-logs (T030), OpenAPI contract (T031), shared typed contracts
  (T001/T034). Principle III is completed here.
- Verify each test fails before implementing; commit after each task or logical group (conventional commits).
