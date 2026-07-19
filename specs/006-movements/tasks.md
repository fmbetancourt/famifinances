---

description: "Task list for TXN-01 · Income & Expense Movements"
---

# Tasks: Income & Expense Movements (TXN-01)

**Input**: Design documents from `/specs/006-movements/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/movements.openapi.yaml, quickstart.md

**Tests**: INCLUDED (constitution Principle IV · Test-First). Mandatory coverage: derived-balance math
(initial + income − expense, excluding deleted), kind integrity (income category only on income), cross-family
isolation (account/category/movement scoped by session family), audit trail (created/updated/deleted survives
deletion), soft-delete excluded from balance/history, positive-amount + validation, no amounts/notes in logs.
Test tasks are written FIRST and must FAIL before implementation.

**Organization**: Grouped by user story (US1–US5). Builds on AUTH-01/FAM-01/ACC-01/CAT-01 — reused, not
rebuilt. Applies the ACC-01/CAT-01 conventions: `FamilyScopeGuard` before `EmailVerifiedGuard` on writes
(no-family → 404), name/note trimmed before validation, DTO whitelist rejects unknown fields.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task.
- **[Story]**: US1–US5 from spec.md.

---

## Phase 1: Setup (Shared Contracts)

- [X] T001 [P] Add movement DTO types (`MovementType`, `CreateMovementRequest`, `UpdateMovementRequest`, `MovementSummary`) mirroring `contracts/movements.openapi.yaml` in `packages/contracts/src/movement/index.ts` and re-export from `packages/contracts/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Movement + audit entities, the family-scoped repository, the balance aggregation, and the
ACC-01 derived-balance integration

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T002 [P] Move the `IsCalendarDate` validator from `apps/api/src/financial-accounts/dto/is-calendar-date.validator.ts` to `apps/api/src/common/validators/is-calendar-date.validator.ts` and update the ACC-01 DTO imports (`financial-accounts/dto/create-account.dto.ts`, `update-account.dto.ts`)
- [X] T003 [P] Create `Movement` Mongoose schema (type `income|expense`, amount int, date, `accountId` ref FinancialAccount **indexed**, `familyId` ref Family **indexed**, `categoryId` null|ObjectId, note null|string, `deletedAt` null|Date, `createdBy` ref Account, timestamps) with a compound index `{ familyId, deletedAt, date }` in `apps/api/src/movements/movement.schema.ts`
- [X] T004 [P] Create the append-only `MovementEvent` audit schema (movementId **indexed**, familyId **indexed**, actorId, type `created|updated|deleted`, snapshot `{type,amount,date,accountId,categoryId,note}`, createdAt) in `apps/api/src/movements/movement-event.schema.ts`
- [X] T005 Create `MovementRepository` — every query bound to `familyId`: `create`, `findInFamily(familyId, id)` (**non-deleted** — for get/edit), `listByFamily(familyId, { account, type })` (non-deleted, newest first), `update(familyId, id, patch)`, `softDelete(familyId, id)` (matches by `{ _id, familyId }` **regardless of `deletedAt`** and sets `deletedAt`, so re-deleting is a 204 no-op while a foreign/unknown id returns no match → 404), and `netByAccount(familyId)` aggregation (`$match {familyId, deletedAt:null}` → `$group by accountId` summing `+amount` income / `−amount` expense) in `apps/api/src/movements/movement.repository.ts`
- [X] T006 [P] Create `MovementEventRepository` (`append(input)`, `listByFamily(familyId)`, `listByMovement(movementId)`) in `apps/api/src/movements/movement-event.repository.ts`
- [X] T007 Create `MovementBalanceService` (`netForAccount(familyId, accountId)`, `netByFamily(familyId)`) backed by the `netByAccount` aggregation, to be consumed by ACC-01 in `apps/api/src/movements/movement-balance.service.ts`
- [X] T008 Export `FinancialAccountRepository` from `FinancialAccountsModule` and `CategoryRepository` from `CategoriesModule` so movements can validate the referenced account/category, in `apps/api/src/financial-accounts/financial-accounts.module.ts` and `apps/api/src/categories/categories.module.ts`
- [X] T009 Wire `MovementsModule` (`MongooseModule.forFeature` Movement + MovementEvent; import `FamiliesModule`, `CategoriesModule`, `forwardRef(() => FinancialAccountsModule)`; provide `MovementsService` + repositories + `MovementBalanceService`; **export** `MovementBalanceService`) and register it in `apps/api/src/movements/movements.module.ts` and `apps/api/src/app.module.ts`
- [X] T010 Integrate the derived balance: `FinancialAccountsModule` imports `forwardRef(() => MovementsModule)`; the account balance becomes `initialBalance + MovementBalanceService.net(...)` (inject via `@Inject(forwardRef(...))`); the account list fetches `netByFamily` in one query and adds each account's net. **Preserve the ACC-01 invariant `net = 0 ⇒ balance = initialBalance` and UPDATE the ACC-01 unit test `apps/api/src/financial-accounts/financial-accounts.service.spec.ts` (currently asserts `deriveBalance === initialBalance`) to reflect the movement-inclusive computation; re-run the ACC-01 suite as a regression gate.** In `apps/api/src/financial-accounts/financial-accounts.service.ts`, `financial-accounts.module.ts`, and `financial-accounts.service.spec.ts`

**Checkpoint**: Movement + audit entities exist; the family-scoped repository + balance aggregation work; an
account's balance now sums its movements.

---

## Phase 3: User Story 1 - Record an income or expense (Priority: P1) 🎯 MVP

**Goal**: A verified member records a movement and the account's balance immediately reflects it.

**Independent Test**: with a family account (balance B), record an expense of A → 201 and the account balance
becomes B−A; record an income of C → balance becomes B−A+C; author + occurrence date recorded.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T011 [P] [US1] e2e for `POST /movements` (201; an expense decreases the account balance, an income increases it; author + occurrence date + creation time recorded; unverified → 403; no-family → 404; non-positive amount / invalid type / invalid date / unknown field → 400) in `apps/api/test/create-movement.e2e-spec.ts`

### Implementation for User Story 1

- [X] T012 [P] [US1] Create `CreateMovementDto` (type in `income|expense`, `amount` `@IsInt` `@IsPositive`, `date` `@IsCalendarDate`, `accountId` string, `categoryId?` string, `note?` trimmed ≤280) in `apps/api/src/movements/dto/create-movement.dto.ts`
- [X] T013 [US1] Implement `MovementsService.createMovement` (validate the account is active + own via `FinancialAccountRepository.findInFamily`; if a category is given, validate it is visible + active + `kind === type` via `CategoryRepository.findVisible`; persist with `familyId` + `createdBy` from the session; append a `created` `MovementEvent`) in `apps/api/src/movements/movements.service.ts`
- [X] T014 [US1] Implement `POST /movements` guarded by `JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard` (FamilyScope before EmailVerified) in `apps/api/src/movements/movements.controller.ts`
- [ ] T015 [P] [US1] Mobile capture screen (amount, type, account, optional category, note; one primary action) in `apps/mobile/app/(movements)/create.tsx`

**Checkpoint**: A verified member records movements and account balances update.

---

## Phase 4: User Story 2 - See the movement history (Priority: P1)

**Goal**: Any member sees the family's movements, most recent first, with each movement's details.

**Independent Test**: with several movements, list them newest-first with type/amount/date/account/category/
note; two members of the same family see the identical list; `?account`/`?type` filter.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T016 [P] [US2] e2e for `GET /movements` and `GET /movements/{id}` (non-deleted, newest first, with details; `?account=`/`?type=` filter; two members see the same set + balances; a deleted movement is excluded) in `apps/api/test/list-movements.e2e-spec.ts`

### Implementation for User Story 2

- [X] T017 [P] [US2] Create `ListMovementsQuery` (`account?` string, `type?` `income|expense`) in `apps/api/src/movements/dto/list-movements.query.ts`
- [X] T018 [US2] Implement `MovementsService.listMovements` (family-scoped, non-deleted, newest first, `account`/`type` filters) + `getMovement` (404 when not in family / deleted) + `MovementSummary` mapping in `apps/api/src/movements/movements.service.ts`
- [X] T019 [US2] Implement `GET /movements` (with `account`/`type`) and `GET /movements/{id}` via `JwtAuthGuard` + `FamilyScopeGuard` in `apps/api/src/movements/movements.controller.ts`
- [ ] T020 [P] [US2] Mobile history list screen (newest first; type via text+icon) in `apps/mobile/app/(movements)/index.tsx`

**Checkpoint**: Members share one movement history and the same balances.

---

## Phase 5: User Story 3 - Family isolation & financial integrity (Priority: P1)

**Goal**: Movements are family-scoped; account/category references must be the family's; a category's kind must match the type.

**Independent Test**: recording against another family's account/category → 400; an income category on an
expense → 400; a member of family B cannot view/edit/delete A's movements → 404; a foreign `familyId` is
ignored; no-family → 404.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T021 [P] [US3] Authorization + integrity e2e: a foreign or archived account/category → 400; an income category on an expense (and vice versa) → 400; a member of family B is rejected (404) from family A's movement on read/edit/delete; a foreign `familyId`/`accountId`/`categoryId` is ignored; no-family → 404 (FR-003, FR-004, FR-013, SC-003/004/005) in `apps/api/test/movement-isolation.e2e-spec.ts`

### Implementation for User Story 3

- [X] T022 [US3] Ensure `createMovement`/`updateMovement` validate references against the session family (account active + own → else 400; category visible + active + `kind === type` → else 400) and that every read/write resolves the movement within the session family (foreign/deleted → 404); no caller-supplied family/account/category owner id is trusted (Principle I) in `apps/api/src/movements/movements.service.ts` and `apps/api/src/movements/movement.repository.ts`

**Checkpoint**: Isolation + kind integrity verified — the financial source of truth is safe.

---

## Phase 6: User Story 4 - Edit a movement (Priority: P2)

**Goal**: A verified member edits a movement, re-validated; affected balances recompute; the edit is auditable.

**Independent Test**: edit an amount → balance recomputes; edit that changes the account → both balances
recompute; invalid edit → 400 unchanged; kind mismatch → 400; cross-family → 404; an `updated` audit record exists.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T023 [P] [US4] e2e for `PATCH /movements/{id}` (edit amount/type/date/account/category/note → 200; the affected account balance recomputes, including when the account changes; invalid field / kind mismatch / foreign account-category → 400 and unchanged; empty body → 400; cross-family → 404; an `updated` audit record is appended) in `apps/api/test/edit-movement.e2e-spec.ts`

### Implementation for User Story 4

- [X] T024 [P] [US4] Create `UpdateMovementDto` (all fields optional, at least one present; same validators; `note` trimmed ≤280; unknown fields rejected) in `apps/api/src/movements/dto/update-movement.dto.ts`
- [X] T025 [US4] Implement `MovementsService.updateMovement` (re-validate references + kind for provided/effective fields; reject an empty patch → 400; partial update within the session family; append an `updated` `MovementEvent` snapshot) + `PATCH /movements/{id}` (`JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard`) in `apps/api/src/movements/movements.service.ts` and controller
- [ ] T026 [P] [US4] Mobile edit-movement screen in `apps/mobile/app/(movements)/[movementId]/edit.tsx`

**Checkpoint**: Members can correct movements; balances stay accurate; edits are auditable.

---

## Phase 7: User Story 5 - Delete a movement (Priority: P2)

**Goal**: A verified member deletes a movement; it no longer affects balances or history; the deletion is auditable.

**Independent Test**: delete a movement → 204; the account balance no longer includes it and it is absent from
history; a `deleted` audit record survives; cross-family delete → 404.

### Tests for User Story 5 ⚠️ (write first, must fail)

- [X] T027 [P] [US5] e2e for `DELETE /movements/{id}` (204; excluded from the account balance and from `GET /movements`; a `deleted` audit record survives; re-deleting is idempotent → 204; cross-family → 404) in `apps/api/test/delete-movement.e2e-spec.ts`

### Implementation for User Story 5

- [X] T028 [US5] Implement `MovementsService.deleteMovement` (soft delete via `softDelete` which resolves by `{ familyId, _id }` **regardless of `deletedAt`** — an own movement, deleted or not → 204; a foreign/unknown id → 404; append a `deleted` `MovementEvent` on the first deletion, idempotent no-op if already deleted) + `DELETE /movements/{id}` → 204 (`JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard`) in `apps/api/src/movements/movements.service.ts` and controller
- [ ] T029 [P] [US5] Mobile delete action on the movement screen in `apps/mobile/app/(movements)/[movementId]/index.tsx`

**Checkpoint**: Erroneous movements can be removed; balances stay correct; the audit trail is preserved.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T030 [P] Derived-balance e2e: an account balance equals `initial + Σ income − Σ expense` across several movements, and excludes a deleted movement; balance updates after create/edit/delete (SC-002, Principle III) in `apps/api/test/movement-balance.e2e-spec.ts`
- [X] T031 [P] Audit-trail e2e: each create/edit/delete appends a `MovementEvent` (actor + type + timestamp + snapshot); the trail survives the movement's deletion (FR-011, SC-006) in `apps/api/test/movement-audit.e2e-spec.ts`
- [X] T032 [P] No-financial-data-in-logs e2e: monetary amounts and note content never appear in logs across record/list/edit/delete (FR-016, SC-009) in `apps/api/test/movement-log-privacy.e2e-spec.ts`
- [X] T033 [P] OpenAPI parity check: the generated document matches `specs/006-movements/contracts/movements.openapi.yaml` (scoped to the `movements` surface) in `apps/api/test/movement-openapi-parity.e2e-spec.ts`
- [X] T034 [P] Document the movements module (derived balance now sums movements, kind integrity, soft-delete + append-only audit) as the financial source of truth TXN-02/BUD-01/DASH-01/HIS-01 build on, in `apps/api/README.md`
- [X] T035 Execute `specs/006-movements/quickstart.md` end-to-end and record results, including the SC-001 (record < 1 min) / SC-002 (balance reflects) observations
- [X] T036 [P] Verify `packages/contracts` movement types compile against the API (no `any`) via `pnpm typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: contracts types — no dependencies.
- **Foundational (Phase 2)**: entities + repository + balance aggregation + ACC-01 balance integration —
  BLOCKS all user stories. T002 (shared validator) and T003/T004 (schemas) are independent; T005 after T003;
  T007 after T005; T008 independent (ACC/CAT exports); T009 after T003/T004/T005/T006/T007/T008; T010 after
  T007/T009.
- **User Stories (Phase 3–7)**: depend on Foundational.
  - US1 (P1): record + balance (needs the balance integration T010).
  - US2 (P1): depends on US1 (movements must exist to list).
  - US3 (P1): depends on the family-scoped repository + reference validation (Foundational/US1) + at least one
    movement; verifies isolation + kind integrity.
  - US4 (P2): depends on US1/US2 (a movement to edit).
  - US5 (P2): depends on US1/US2 (a movement to delete).
- **Polish (Phase 8)**: after the stories.

### Within Each User Story

- Tests are written and MUST FAIL before implementation.
- Schemas/repositories before services; services before endpoints; core before mobile.

### Parallel Opportunities

- Foundational: T002, T003, T004, T006, T008 in parallel; then T005, T007, T009, T010 in order.
- Within a story, `[P]` tests and `[P]` DTOs run before their service.
- Mobile screens (`[P]`) can proceed alongside their story's API once the contract is fixed.

---

## Implementation Strategy

### MVP scope

- **Minimal deployable slice**: Foundational + **US1** (record a movement; balance reflects it).
- **Recommended demo MVP**: through **US3** (record + history + isolation/integrity) — the full P1 set and the
  financial source of truth that unlocks TXN-02/BUD-01/DASH-01.

### Incremental delivery

1. Setup + Foundational → entities + balance integration ready.
2. US1 → US2 → US3 (P1 core) → validate/demo.
3. US4 (edit) → US5 (delete).
4. Polish: balance math, audit trail, log-privacy, OpenAPI parity, docs, quickstart, contracts typecheck.

---

## Notes

- Reuses AUTH-01 (`JwtAuthGuard`, `EmailVerifiedGuard`), FAM-01 (`FamilyScopeGuard`, `@CurrentFamily`), ACC-01
  (`FinancialAccountRepository`; `deriveBalance` extended), CAT-01 (`CategoryRepository.findVisible` + kind).
- The accounts⇄movements balance/validation coupling is resolved with `forwardRef` (research R1); the
  `IsCalendarDate` validator moves to `common/validators/` (T002) for reuse.
- Constitution gates covered: family-from-session isolation + reference validation (T021/T022), derived
  balance / no stored editable balance (T030 + T010), kind integrity (T021), append-only audit surviving
  deletion (T031), soft-delete excluded from balance/history (T027/T030), no-secrets-in-logs (T032), OpenAPI
  contract (T033), shared typed contracts (T001/T036). Principle III is realized in full here.
- Verify each test fails before implementing; commit after each task or logical group (conventional commits).
