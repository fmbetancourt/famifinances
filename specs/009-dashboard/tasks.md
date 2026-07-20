---
description: "Task list for DASH-01 · Shared Monthly Dashboard"
---

# Tasks: Shared Monthly Dashboard (DASH-01)

**Input**: Design documents from `/specs/009-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboard.openapi.yaml, quickstart.md

**Tests**: TDD is mandatory (Constitution Principle IV — Test-First). Each user story's e2e tests are authored
**before** its implementation and must fail first.

**Organization**: Tasks are grouped by user story (US1–US4). DASH-01 is a **read-only aggregation** feature —
it adds no collection; it composes existing services (ACC-01 / TXN-01 / TXN-02 / BUD-01).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 / US4 (setup, foundational, polish carry no story label)
- All paths are repo-relative.

## Path Conventions

Monorepo: API in `apps/api/src/`, e2e in `apps/api/test/`, shared contracts in `packages/contracts/src/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module skeleton and shared contract types.

- [X] T001 Create the `apps/api/src/dashboard/` directory and register a `DashboardModule` placeholder in `apps/api/src/app.module.ts` (imports list only; wired fully in T010)
- [X] T002 [P] Add shared contract types in `packages/contracts/src/dashboard/index.ts` (`MoneySummary`, `DashboardAccountBalance`, `DashboardBudget`, `DashboardResponse`; reuse `AccountType` from the account module for `DashboardAccountBalance.type`, and `BudgetSummary` + `BudgetLine` from the budget module) and re-export from `packages/contracts/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The family-scoped reads and service exports the dashboard composes — required before any story.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T003 [P] Add `sumByTypeInPeriod(familyId, from, to)` (`$match { familyId, deletedAt:null, date:{ $gte,$lt } }` → `$group by type` sum `amount`) and `latestChangeAt(familyId)` (`findOne({ familyId }).sort({ updatedAt:-1 })`) to `apps/api/src/movements/movement.repository.ts`
- [X] T004 Create `MovementSummaryService` in `apps/api/src/movements/movement-summary.service.ts` — `monthlyIncomeExpense(familyId, period)` → `{ totalIncome, totalExpense, net }` (month bounds) and `latestChangeAt(familyId)` → `Date | null`; provide + **export** from `apps/api/src/movements/movements.module.ts` (depends on T003)
- [X] T005 [P] Add `latestChangeAt(familyId)` to `apps/api/src/transfers/transfer.repository.ts` (`findOne({ familyId }).sort({ updatedAt:-1 })`)
- [X] T006 Create `TransferSummaryService` in `apps/api/src/transfers/transfer-summary.service.ts` — `latestChangeAt(familyId)` → `Date | null`; provide + **export** from `apps/api/src/transfers/transfers.module.ts` (depends on T005)
- [X] T007 [P] Export `FinancialAccountsService` from `apps/api/src/financial-accounts/financial-accounts.module.ts` (add to `exports`) so the dashboard can read active accounts' derived balances
- [X] T008 [P] Export `BudgetsService` from `apps/api/src/budgets/budgets.module.ts` (add to `exports`) so the dashboard can read the budget report
- [X] T009 [P] Create `DashboardQuery` in `apps/api/src/dashboard/dto/dashboard.query.ts` — optional `period` `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)`; the service defaults it to the current month
- [X] T010 Wire `apps/api/src/dashboard/dashboard.module.ts` — import `FamiliesModule`, `FinancialAccountsModule`, `MovementsModule`, `TransfersModule`, `BudgetsModule` (all one-way, no `forwardRef`); provide `DashboardService`; register `DashboardController` (depends on T004, T006, T007, T008)

**Checkpoint**: Module compiles and is registered; user stories can begin.

---

## Phase 3: User Story 1 - See the month's money summary (Priority: P1) 🎯 MVP

**Goal**: Any member views the month's total income, total expense, and net (transfers and deleted excluded).

**Independent Test**: With income + expense movements (and a transfer) in a month, `GET /dashboard?period=`
returns `moneySummary` = the sums of those movements; the transfer and deleted movements do not change them.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T011 [P] [US1] Create `apps/api/test/dashboard-helpers.ts` (`getDashboard(app, token, period?)`) and an e2e spec `apps/api/test/dashboard-money-summary.e2e-spec.ts` — income/expense/net = sums of the month's movements; a transfer does NOT change them; deleted movement excluded; no movements → all 0

### Implementation for User Story 1

- [X] T012 [US1] Implement `DashboardService.getDashboard(familyId, period)` in `apps/api/src/dashboard/dashboard.service.ts` — assemble the `DashboardResponse`; fill `moneySummary` from `MovementSummaryService.monthlyIncomeExpense`; return placeholder `accounts: []`, `netWorth: 0`, zeroed `budget`, `lastUpdated: null` (filled in US2/US3) (depends on T004, T010)
- [X] T013 [US1] Add `GET /dashboard` to `apps/api/src/dashboard/dashboard.controller.ts` with guards `JwtAuthGuard, FamilyScopeGuard` (any member), `@CurrentFamily`, `DashboardQuery`; default `period` to the current month (depends on T012)
- [X] T014 [P] [US1] Unit test in `apps/api/src/dashboard/dashboard.service.spec.ts` — money summary/net computation, net-worth sum, and over/near highlight filtering (with mocked summary/accounts/budgets services)

**Checkpoint**: US1 functional — the money summary is served.

---

## Phase 4: User Story 2 - Account balances and net worth (Priority: P1)

**Goal**: Show each active account's derived balance, the total net worth, and a "last updated" mark.

**Independent Test**: With accounts + movements + a transfer, the dashboard shows each active account's derived
balance, `netWorth` = their sum (archived excluded), and a non-null `lastUpdated`.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T015 [P] [US2] e2e spec `apps/api/test/dashboard-networth.e2e-spec.ts` — each active account's `balance` equals its derived balance; `netWorth` = Σ active balances; an archived account is excluded from both; `lastUpdated` is a non-null ISO timestamp

### Implementation for User Story 2

- [X] T016 [US2] Extend `DashboardService.getDashboard` in `apps/api/src/dashboard/dashboard.service.ts` — fill `accounts` (map `FinancialAccountsService.listAccounts(familyId,'active')` → `{ accountId, name, type, balance }`) and `netWorth` (Σ balances); set `lastUpdated` = the later of `MovementSummaryService.latestChangeAt` / `TransferSummaryService.latestChangeAt`, ISO or null (depends on T012, T004, T006, T007)

**Checkpoint**: US1 + US2 — money summary + balances/net worth + last-updated.

---

## Phase 5: User Story 3 - Budget estimated vs real overview (Priority: P1)

**Goal**: Show the month's budget summary + the over/near category highlights (reusing the BUD-01 report).

**Independent Test**: With budgeted categories and expense movements, `budget.summary` equals the BUD-01 report
summary and `budget.highlights` contains exactly the `near`/`over` categories (never `under`).

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T017 [P] [US3] e2e spec `apps/api/test/dashboard-budget.e2e-spec.ts` — `budget.summary` equals the month's BUD-01 report summary; `highlights` contains only `near`/`over` lines (an `under` category is absent); no budgets → zeroed summary + empty highlights

### Implementation for User Story 3

- [X] T018 [US3] Extend `DashboardService.getDashboard` in `apps/api/src/dashboard/dashboard.service.ts` — set `budget` from `BudgetsService.getReport(familyId, period)`: `summary` passthrough, `highlights` = `lines.filter(status !== 'under')` (depends on T012, T008)

**Checkpoint**: US1 + US2 + US3 — the full dashboard payload.

---

## Phase 6: User Story 4 - View the dashboard for a chosen month (Priority: P2)

**Goal**: Month selection (default current) with server-side validation.

**Independent Test**: `GET /dashboard` (no period) → current month; `?period=2026-13` → 400; two months of data
yield different `moneySummary`/`budget` per month.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T019 [P] [US4] e2e spec `apps/api/test/dashboard-period.e2e-spec.ts` — default `period` = current month; `2026-13` and `2026-7` → 400; per-month `moneySummary`/`budget` differ while `accounts`/`netWorth` reflect the current state

### Implementation for User Story 4

- [X] T020 [US4] Confirm the current-month default + `@Matches` validation are wired in `apps/api/src/dashboard/dashboard.controller.ts` and `apps/api/src/dashboard/dto/dashboard.query.ts`; harden if T019 surfaces a gap (depends on T013)

**Checkpoint**: All four stories functional.

---

## Phase 7: Isolation & Contract Parity (Priority: P1)

**Goal**: Prove family isolation and lock OpenAPI ↔ implementation parity.

- [X] T021 [P] e2e spec `apps/api/test/dashboard-isolation.e2e-spec.ts` — a member of family B sees family B's own (empty/zero) dashboard with none of family A's figures; a caller with no family → 404
- [X] T022 [P] e2e spec `apps/api/test/dashboard-openapi-parity.e2e-spec.ts` — the implemented `/dashboard` surface matches `specs/009-dashboard/contracts/dashboard.openapi.yaml` (regex over the yaml, scoped to the `/dashboard` prefix; exactly 1 endpoint)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T023 [P] e2e spec `apps/api/test/dashboard-log-privacy.e2e-spec.ts` — no monetary amount (income/expense/balance/planned/real) appears in stdout/stderr while viewing the dashboard (FR-012 / SC-008)
- [X] T024 [P] Execute the `specs/009-dashboard/quickstart.md` scenarios (1–5) against the running API
- [X] T025 Run the full gate: `pnpm --filter @famifinances/contracts build`, `pnpm lint`, `pnpm --filter @famifinances/api typecheck`, `pnpm --filter @famifinances/api test`, `pnpm --filter @famifinances/api test:e2e` — all green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup; **blocks all stories**. T004→T003; T006→T005; T010→T004,T006,T007,T008.
- **US1 (P3)**: depends on Foundational. T012→T004,T010; T013→T012.
- **US2 (P4)**: depends on US1's `getDashboard` skeleton (T012) + T007/T004/T006.
- **US3 (P5)**: depends on US1's `getDashboard` skeleton (T012) + T008.
- **US4 (P6)**: depends on the controller (T013).
- **Isolation/Parity (P7)**: depends on US1–US3 (exercise the full payload).
- **Polish (P8)**: after all desired stories.

### Same-file sequencing (not parallel)

- `dashboard.service.ts`: T012 → T016 → T018 (sequential — one aggregation method built incrementally).
- `dashboard.controller.ts`: T013 → T020 (sequential).

### Parallel Opportunities

- Setup: T002 ∥ T001.
- Foundational: T003 ∥ T005 ∥ T007 ∥ T008 ∥ T009 (then T004, T006, then T010).
- Story tests: T011 ∥ T014 (US1); T015 (US2); T017 (US3); T019 (US4); T021 ∥ T022 (P7); T023 (P8) — all different files.

---

## Implementation Strategy

### MVP (US1 + US2 + US3)

1. Phase 1 Setup → Phase 2 Foundational.
2. US1 (money summary) → US2 (balances/net worth) → US3 (budget overview): the three P1 slices assemble the full
   dashboard payload — the demoable MVP.
3. US4 (month selection) and the isolation/parity/polish phases follow.

### Incremental Delivery

US1 → US2 → US3 → US4 → isolation/parity → polish. Each story is independently testable; the read-only service
is built up one facet at a time on the shared `getDashboard` method.

---

## Notes

- [P] = different files, no incomplete dependencies.
- TDD: author each story's e2e spec first and confirm it fails before implementing.
- Reuse e2e helpers (`verifiedMemberWithFamily`, `createAccount`, `createCategory`, `recordMovement`,
  `recordTransfer`, `setBudget`); e2e runs serial (`mongodb-memory-server`, `maxWorkers 1`).
- No new collection, no `forwardRef` — the dashboard reads existing services one-way.
- Commit after each task or logical group; conventional commits in English.
