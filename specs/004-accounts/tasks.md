---

description: "Task list for ACC-01 · Family Financial Accounts"
---

# Tasks: Family Financial Accounts (ACC-01)

**Input**: Design documents from `/specs/004-accounts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/accounts.openapi.yaml, quickstart.md

**Tests**: INCLUDED (constitution Principle IV · Test-First). Mandatory coverage: cross-family isolation
(account resolved+scoped by session family, foreign id → 404), derived-balance correctness, archived
read-only (edit → 409), one-currency whole-peso validation. Test tasks are written FIRST and must FAIL
before implementation.

**Organization**: Grouped by user story (US1–US5). Builds on AUTH-01 (`JwtAuthGuard`, `@CurrentUser`,
`EmailVerifiedGuard`) and FAM-01 (`FamilyScopeGuard`, `@CurrentFamily`) — reused, not rebuilt. ACC-01 is
the first consumer of the FAM-01 family-scope guard.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task.
- **[Story]**: US1–US5 from spec.md.

---

## Phase 1: Setup (Shared Contracts)

- [X] T001 [P] Add account DTO types (`AccountType`, `CreateAccountRequest`, `UpdateAccountRequest`, `FinancialAccountSummary`, error bodies) mirroring `contracts/accounts.openapi.yaml` in `packages/contracts/src/account/index.ts` and re-export from `packages/contracts/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Account entity, its family-scoped repository, and reuse of the FAM-01 scope guard

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T002 [P] Create `FinancialAccount` Mongoose schema (collection `financialAccounts`; familyId ref Family **indexed**, name, type enum `bank|digital_wallet|cash|credit_card`, institution?, initialBalance int, currency `CLP`, startDate, `archivedAt` null|Date, createdBy ref Account [AUTH-01 user], timestamps) — named distinctly from the AUTH-01 `Account` to avoid a Mongoose model clash — in `apps/api/src/financial-accounts/financial-account.schema.ts`
- [X] T003 Create `FinancialAccountRepository` where **every** query is bound to `familyId` (create with familyId+createdBy; `findByFamily(familyId, status)`; `findInFamily(familyId, accountId)`; `updateInFamily(familyId, accountId, patch)`; `setArchived(familyId, accountId, archivedAt)`) in `apps/api/src/financial-accounts/financial-account.repository.ts`
- [X] T004 Export `FamilyScopeGuard` from `FamiliesModule` (add to `exports`, keeping its `MembershipsModule` import) so downstream feature modules can reuse the Principle-I gate in `apps/api/src/families/families.module.ts`
- [X] T005 Wire `FinancialAccountsModule` (`MongooseModule.forFeature` for Account; import `FamiliesModule` for `FamilyScopeGuard`/`@CurrentFamily` and `AuthModule`; provide `FinancialAccountsService` + `FinancialAccountRepository`) and register it in `apps/api/src/financial-accounts/financial-accounts.module.ts` and `apps/api/src/app.module.ts`

**Checkpoint**: The Account entity + family-scoped repository exist; the FAM-01 scope guard is reusable.

---

## Phase 3: User Story 1 - Create an account (Priority: P1) 🎯 MVP

**Goal**: A verified member of a family creates an account and it becomes available for movements.

**Independent Test**: verified member with a family → create with type/name/initialBalance/startDate → 201;
unverified → 403; invalid type / missing name / non-integer amount → 400; negative initial balance accepted.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T006 [P] [US1] e2e for `POST /accounts` (201; no-family → 404 regardless of email verification [FamilyScopeGuard runs before the email gate, so "no family" is uniformly 404; the 403 email soft gate is defense-in-depth for an in-family-unverified caller]; invalid type / empty name / fractional amount → 400; a client-supplied `balance` or `currency` field → 400 (whitelist, guards SC-004/FR-004); negative initialBalance accepted) in `apps/api/test/create-account.e2e-spec.ts`

### Implementation for User Story 1

- [X] T007 [P] [US1] Create `CreateAccountDto` (name 1–80, type in enum, `initialBalance` `@IsInt`, startDate valid date, institution? ≤80) in `apps/api/src/financial-accounts/dto/create-account.dto.ts`
- [X] T008 [US1] Implement `FinancialAccountsService.createAccount` (familyId + createdBy from the session context, currency `CLP`; persist; return `FinancialAccountSummary` with derived balance) in `apps/api/src/financial-accounts/financial-accounts.service.ts`
- [X] T009 [US1] Implement `POST /accounts` guarded by `JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard`, reading `@CurrentFamily`/`@CurrentUser` in `apps/api/src/financial-accounts/financial-accounts.controller.ts`
- [ ] T010 [P] [US1] Mobile create-account screen (name, type, initial balance, start date, optional institution; one primary action) in `apps/mobile/app/(accounts)/create-account.tsx`

**Checkpoint**: A verified member can create a family-scoped account.

---

## Phase 4: User Story 2 - See the family's accounts and balances (Priority: P1)

**Goal**: Any member sees the same list of the family's accounts, each with its derived balance.

**Independent Test**: with one account, two members of the same family retrieve the identical list and the
same balance; an account with no movements reports `balance == initialBalance`.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T011 [P] [US2] e2e for `GET /accounts` and `GET /accounts/{id}` (lists active accounts with derived balance; two members see the same set + balances; `balance == initialBalance` with no movements) in `apps/api/test/list-accounts.e2e-spec.ts`

### Implementation for User Story 2

- [X] T012 [P] [US2] Create `ListAccountsQuery` (`status` enum `active|archived|all`, default `active`) in `apps/api/src/financial-accounts/dto/list-accounts.query.ts`
- [X] T013 [US2] Implement `FinancialAccountsService.deriveBalance` + `FinancialAccountSummary` mapping (`balance = initialBalance + Σ movements`; no movements in ACC-01 → equals initialBalance) in `apps/api/src/financial-accounts/financial-accounts.service.ts`
- [X] T014 [US2] Implement `GET /accounts` and `GET /accounts/{id}` via `FamilyScopeGuard` (404 when not in the caller's family) + `FinancialAccountsService.listAccounts`/`getAccount`. **This task owns the `status` filter logic** in the repository/service (`active` default excludes archived; `archived`/`all` query paths), so US5 only exercises it — no archived accounts exist yet, so `archived` returns empty here in `apps/api/src/financial-accounts/financial-accounts.controller.ts` and service
- [ ] T015 [P] [US2] Mobile accounts list/home screen (accounts + balances via the session) in `apps/mobile/app/(accounts)/index.tsx`

**Checkpoint**: Members share one view of the family's accounts and balances.

---

## Phase 5: User Story 3 - Accounts stay within the family boundary (Priority: P1)

**Goal**: An account is only ever visible/modifiable by its family; the acting family comes from the session.

**Independent Test**: create an account in family A; as a member of family B, `GET/PATCH/POST` its id → 404;
a foreign `familyId` in the request is ignored; a member of no family → 404.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T016 [P] [US3] Authorization e2e: account scoped from the session family; a member of family B is rejected (404) from family A's account on read, edit, and archive; a foreign `familyId`/`accountId` in the request is ignored; no-family → 404 (FR-007, SC-003) in `apps/api/test/account-isolation.e2e-spec.ts`

### Implementation for User Story 3

- [X] T017 [US3] Ensure every read and write path resolves the account within the session family only — `getAccount`/`updateAccount`/`archive`/`unarchive` go through `findInFamily(familyId, accountId)` and return 404 on a foreign/unknown id; no caller-supplied family/account owner id is trusted (Principle I) in `apps/api/src/financial-accounts/financial-accounts.service.ts` and `apps/api/src/financial-accounts/financial-account.repository.ts`

**Checkpoint**: Cross-family isolation for accounts verified — the boundary TXN-01/BUD-01 rely on.

---

## Phase 6: User Story 4 - Edit an account (Priority: P2)

**Goal**: A verified member corrects an account's details; changing the initial balance recomputes the balance.

**Independent Test**: edit name + initialBalance → 200, balance recomputes; invalid field → 400 unchanged;
editing an archived account → 409; another family's account → 404.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T018 [P] [US4] e2e for `PATCH /accounts/{id}` (updates name/type/institution/initialBalance/startDate → 200; changing initialBalance recomputes balance; invalid field → 400 and unchanged; a client-supplied `balance` field → 400 (whitelist, guards SC-004); archived → 409; empty body → 400; date-time startDate → 400; cross-family → 404) in `apps/api/test/edit-account.e2e-spec.ts`

### Implementation for User Story 4

- [X] T019 [P] [US4] Create `UpdateAccountDto` (all fields optional, at least one present) in `apps/api/src/financial-accounts/dto/update-account.dto.ts`
- [X] T020 [US4] Implement `FinancialAccountsService.updateAccount` (reject when archived → **409 Conflict**; partial update within the session family; recompute derived balance) + `PATCH /accounts/{id}` (`JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard`) in `apps/api/src/financial-accounts/financial-accounts.service.ts` and controller
- [ ] T021 [P] [US4] Mobile edit-account screen in `apps/mobile/app/(accounts)/[accountId]/edit.tsx`

**Checkpoint**: Members can correct account details; archived accounts stay read-only.

---

## Phase 7: User Story 5 - Archive an account (Priority: P2)

**Goal**: A member archives an account (read-only, excluded from active use) and can restore it; never deletes.

**Independent Test**: archive → 200, excluded from the default list but retrievable via `status=archived`;
editing it → 409; unarchive → 200 back in the active list; no delete endpoint exists.

### Tests for User Story 5 ⚠️ (write first, must fail)

- [X] T022 [P] [US5] e2e for archive/unarchive (`POST /accounts/{id}/archive` → 200, dropped from `status=active`, present in `status=archived`/`all`; editing archived → 409; `POST /accounts/{id}/unarchive` → 200 restored; re-archiving an already-archived account is idempotent → 200 no-op; no delete route) in `apps/api/test/archive-account.e2e-spec.ts`

### Implementation for User Story 5

- [X] T023 [US5] Implement `FinancialAccountsService.archive`/`unarchive` (set/clear `archivedAt` within the session family; **idempotent** — archiving an already-archived or unarchiving an already-active account is a no-op returning the account, no error) + `POST /accounts/{id}/archive` and `POST /accounts/{id}/unarchive` (`JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard`), reusing the `status` filter implemented in T014 in `apps/api/src/financial-accounts/financial-accounts.service.ts` and controller
- [ ] T024 [P] [US5] Mobile archive/unarchive action on the account screen in `apps/mobile/app/(accounts)/[accountId]/index.tsx`

**Checkpoint**: Archive lifecycle works; accounts are archived, never destroyed.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T025 [P] No-financial-data-in-logs e2e: account name, institution, and monetary figures never appear in logs across create/edit/list/archive (FR-015, SC-007) in `apps/api/test/account-log-privacy.e2e-spec.ts`
- [X] T026 [P] OpenAPI parity check: the generated document matches `specs/004-accounts/contracts/accounts.openapi.yaml` (scoped to the `accounts` surface) in `apps/api/test/account-openapi-parity.e2e-spec.ts`
- [X] T027 [P] Unit test for `FinancialAccountsService.deriveBalance` (equals initial balance with no movements; handles negative) in `apps/api/src/financial-accounts/financial-accounts.service.spec.ts`
- [X] T028 [P] Document the accounts module and the derived-balance read path as the pattern TXN-01/BUD-01 extend, in `apps/api/README.md`
- [X] T029 Execute `specs/004-accounts/quickstart.md` end-to-end and record results, including the SC-001 (create < 1 min) timing observation
- [X] T030 [P] Verify `packages/contracts` account types compile against the API (no `any`) via `pnpm typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: contracts types — no dependencies.
- **Foundational (Phase 2)**: Account schema + family-scoped repository + reusable `FamilyScopeGuard` —
  BLOCKS all user stories.
- **User Stories (Phase 3–7)**: depend on Foundational.
  - US1 (P1): independent (create account).
  - US2 (P1): depends on US1 (accounts must exist to list) + the derive-balance mapping.
  - US3 (P1): depends on the family-scoped repository (Foundational) + at least one account (US1);
    verifies isolation across read/edit/archive.
  - US4 (P2): depends on US1/US2 (an account to edit).
  - US5 (P2): depends on US1/US2 (an account to archive) + the `status` filter from US2.
- **Polish (Phase 8)**: after the stories.

### Within Each User Story

- Tests are written and MUST FAIL before implementation.
- Schema/repository before services; services before endpoints; core before mobile.

### Parallel Opportunities

- Foundational: T002 in parallel with contract types; T003 after T002; T004 independent (families module);
  T005 after T002/T003/T004.
- Within a story, `[P]` tests and `[P]` DTOs run before their service.
- Mobile screens (`[P]`) can proceed alongside their story's API once the contract is fixed.

---

## Implementation Strategy

### MVP scope

- **Minimal deployable slice**: Foundational + **US1** (a member can create an account).
- **Recommended demo MVP**: through **US3** (create + list/balance + isolation) — the full P1 set and the
  first family-owned financial entity that unlocks TXN-01.

### Incremental delivery

1. Setup + Foundational → entity + family-scoped repository + reusable guard ready.
2. US1 → US2 → US3 (P1 core) → validate/demo.
3. US4 (edit) → US5 (archive/unarchive).
4. Polish: log-privacy, OpenAPI parity, balance unit test, docs, quickstart, contracts typecheck.

---

## Notes

- Reuses AUTH-01 (`JwtAuthGuard`, `@CurrentUser`, `EmailVerifiedGuard`) and FAM-01 (`FamilyScopeGuard`,
  `@CurrentFamily`) — ACC-01 is the first downstream consumer; T004 exports the guard for reuse.
- Constitution gates covered: family-from-session isolation (T016), derived balance / no stored editable
  balance (T027 + T013), whole-peso CLP validation (T006/T018), archived read-only (T018/T022),
  no-secrets-in-logs (T025), OpenAPI contract (T026), shared typed contracts (T001/T030).
- Balance is derived at read time so TXN-01 extends `deriveBalance` (initial + Σ movements) without
  changing the account document or the `balance` contract field.
- Verify each test fails before implementing; commit after each task or logical group (conventional commits).
