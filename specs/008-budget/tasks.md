---
description: "Task list for BUD-01 · Monthly & Per-Category Budget"
---

# Tasks: Monthly & Per-Category Budget (BUD-01)

**Input**: Design documents from `/specs/008-budget/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/budgets.openapi.yaml, quickstart.md

**Tests**: TDD is mandatory (Constitution Principle IV — Test-First). Each user story's e2e tests are authored
**before** its implementation and must fail first.

**Organization**: Tasks are grouped by user story (US1–US4) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 / US4 (setup, foundational, polish carry no story label)
- All paths are repo-relative.

## Path Conventions

Monorepo: API in `apps/api/src/`, e2e in `apps/api/test/`, shared contracts in `packages/contracts/src/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module skeleton and shared contract types.

- [X] T001 Create the `apps/api/src/budgets/` directory and register a `BudgetsModule` placeholder in `apps/api/src/app.module.ts` (imports list only; wired fully in T007)
- [X] T002 [P] Add shared contract types in `packages/contracts/src/budget/index.ts` (`BudgetStatus`, `SetBudgetRequest`, `BudgetAllocationSummary`, `BudgetLine`, `BudgetSummary`, `BudgetReport`) and re-export from `packages/contracts/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence, module wiring, and the reused owner-role guard — required before any story.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T003 [P] Create the `BudgetAllocation` schema in `apps/api/src/budgets/budget-allocation.schema.ts` (`familyId` indexed, `period` 'YYYY-MM', `categoryId` ref Category, `plannedAmount` int>0, `createdBy`, timestamps; **unique** index `{ familyId, period, categoryId }`; `{ familyId, period }` index for the report)
- [X] T004 [P] Add the `BUDGET_NEAR_THRESHOLD` constant (80) in `apps/api/src/budgets/budgets.constants.ts`
- [X] T005 [P] Export `FamilyRoleGuard` from `apps/api/src/families/families.module.ts` (add to `exports`) so BUD-01 can reuse it
- [X] T006 Create `BudgetAllocationRepository` in `apps/api/src/budgets/budget-allocation.repository.ts` — family-scoped only: `upsert(familyId, period, categoryId, plannedAmount, createdBy)`, `findInFamily(familyId, id)`, `listByFamilyPeriod(familyId, period)`, `deleteInFamily(familyId, id)` (depends on T003)
- [X] T007 Wire `apps/api/src/budgets/budgets.module.ts` — `MongooseModule.forFeature(BudgetAllocation)`, import `FamiliesModule`, `CategoriesModule`, `MovementsModule`; provide repository + service; register controller (depends on T003, T006)

**Checkpoint**: Module compiles and is registered; user stories can begin.

---

## Phase 3: User Story 1 - Plan a category's monthly budget (Priority: P1) 🎯 MVP

**Goal**: The Owner sets (creates or updates) a positive planned amount for an expense category for a month.

**Independent Test**: Set a planned amount on an expense category for the current month; confirm it is saved
and re-setting it updates (not duplicates) the allocation; non-owner / unverified / income-category / invalid
amount are rejected.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T008 [P] [US1] e2e spec in `apps/api/test/budgets/set-budget.e2e-spec.ts` — POST /budgets: create → 200 saved allocation; re-POST same (period, category) updates amount (no duplicate); income/foreign/archived category → 400; non-owner member → 403; unverified owner → 403; zero/negative amount and invalid month → 400; unknown field → 400 (whitelist)

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `SetBudgetDto` in `apps/api/src/budgets/dto/set-budget.dto.ts` — `period` `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)`, `categoryId` string, `plannedAmount` `@IsInt @IsPositive`; `@Transform` trim strings; whitelist-friendly
- [X] T010 [US1] Implement `BudgetsService.setAllocation` in `apps/api/src/budgets/budgets.service.ts` — validate the category via `CategoryRepository.findVisible(familyId, categoryId)` (must exist, be active, `kind === 'expense'`, else 400), then `repository.upsert(...)`; return the allocation summary (depends on T006, T009)
- [X] T011 [US1] Add `POST /budgets` to `apps/api/src/budgets/budgets.controller.ts` with guards `JwtAuthGuard, FamilyScopeGuard, FamilyRoleGuard(@Roles('owner')), EmailVerifiedGuard`; `@CurrentFamily`/`@CurrentUser`; returns 200 with the saved allocation (depends on T010)
- [X] T012 [P] [US1] Unit test for `setAllocation` category validation (expense accepted; income/archived/foreign → error) in `apps/api/src/budgets/budgets.service.spec.ts`

**Checkpoint**: US1 fully functional — the Owner can set/update a category budget.

---

## Phase 4: User Story 2 - See the month's budget vs real spend (Priority: P1)

**Goal**: Any member views the month's report — per category planned / real / available / percent / status, plus
an overall summary that sums the lines.

**Independent Test**: With a category budgeted at 200.000 and 120.000 of expense movements in the month, the
report shows planned 200.000, real 120.000, available 80.000, 60% (under); a budgeted category with no
movements shows real 0 / available = planned / 0%; the summary equals the sum of the lines.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T013 [P] [US2] e2e spec in `apps/api/test/budgets/budget-report.e2e-spec.ts` — GET /budgets?period=: per-line planned/real/available/percent reconciles with the month's expense movements; deleted movements excluded; status under→near(≥80%)→over(real>planned); no-movements line shows real 0 / available = planned / 0%; summary totals = Σ lines; period defaults to current month; any member (non-owner) can view (200)

### Implementation for User Story 2

- [X] T014 [US2] Add `sumExpenseByCategory(familyId, from, to)` aggregation to `apps/api/src/movements/movement.repository.ts` — `$match { familyId, type:'expense', deletedAt:null, categoryId:{ $ne:null }, date:{ $gte:from, $lt:to } }` → `$group` by `categoryId` summing `amount`
- [X] T015 [US2] Create `MovementSpendService.expenseByCategory(familyId, period)` in `apps/api/src/movements/movement-spend.service.ts` (compute month bounds, return `Record<categoryId, spend>`) and provide + **export** it from `apps/api/src/movements/movements.module.ts` (depends on T014)
- [X] T016 [P] [US2] Create `BudgetReportQuery` in `apps/api/src/budgets/dto/budget-report.query.ts` — optional `period` (same regex), defaults to the current month
- [X] T017 [US2] Implement `BudgetsService.getReport(familyId, period)` in `apps/api/src/budgets/budgets.service.ts` — load allocations (`listByFamilyPeriod`), get `MovementSpendService.expenseByCategory`, resolve category names (CAT-01), build lines `{ budgetId, categoryId, categoryName, plannedAmount, realSpend, available, percentConsumed, status }` (status via `BUDGET_NEAR_THRESHOLD`) + summary sums (percent 0 when no lines) (depends on T007, T015)
- [X] T018 [US2] Add `GET /budgets` to `apps/api/src/budgets/budgets.controller.ts` with guards `JwtAuthGuard, FamilyScopeGuard` (any member); returns the `BudgetReport` (depends on T016, T017)
- [X] T019 [P] [US2] Unit test for line/summary/status computation (under/near/over boundaries, empty report) in `apps/api/src/budgets/budgets.service.spec.ts`

**Checkpoint**: US1 + US2 work — set budgets and read the reconciled report.

---

## Phase 5: User Story 3 - Budgets stay within the family & expense-only (Priority: P1)

**Goal**: Enforce and prove family isolation and expense-only budgeting across the write/read routes.

**Independent Test**: A budget set in family A is invisible and unmodifiable to family B (foreign id → 404); a
family identifier in the request never widens access; budgeting an income category is rejected.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T020 [P] [US3] e2e spec in `apps/api/test/budgets/budget-isolation.e2e-spec.ts` — family B GET does not surface A's allocation; family B DELETE of A's `budgetId` → 404; a `familyId` field in the body/query is ignored (session wins); income category → 400 on set
- [X] T021 [P] [US3] OpenAPI parity e2e in `apps/api/test/budgets/budgets.openapi.e2e-spec.ts` — assert the routes/status codes/schemas in `specs/008-budget/contracts/budgets.openapi.yaml` match the implemented `/budgets` surface (regex over the yaml, scoped to the `/budgets` prefix)

### Implementation for User Story 3

- [X] T022 [US3] Audit `apps/api/src/budgets/budget-allocation.repository.ts` and `budgets.service.ts` so every read/write is bound to the session `familyId` (no method accepts a client family id); confirm foreign ids resolve to 404 via `findInFamily` — harden if T020 surfaces a gap

**Checkpoint**: Isolation + expense-only proven; contract parity locked.

---

## Phase 6: User Story 4 - Remove a category's budget (Priority: P2)

**Goal**: The Owner removes an allocation for a month without touching any movements.

**Independent Test**: Remove a budgeted category for the month; it disappears from the report while the
category's expense movements are unchanged; removing again → 404; a foreign/non-owner removal is rejected.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T023 [P] [US4] e2e spec in `apps/api/test/budgets/delete-budget.e2e-spec.ts` — DELETE /budgets/{budgetId} → 204; line gone from the report; the category's movements unchanged; second DELETE → 404; foreign family → 404; non-owner → 403; unverified owner → 403

### Implementation for User Story 4

- [X] T024 [US4] Implement `BudgetsService.removeAllocation(familyId, budgetId)` in `apps/api/src/budgets/budgets.service.ts` — `repository.deleteInFamily`; 404 when absent; never touches movements (depends on T006)
- [X] T025 [US4] Add `DELETE /budgets/:budgetId` to `apps/api/src/budgets/budgets.controller.ts` with owner-only guards (`JwtAuthGuard, FamilyScopeGuard, FamilyRoleGuard(@Roles('owner')), EmailVerifiedGuard`); returns 204 (depends on T024)

**Checkpoint**: All four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T026 [P] Verify no monetary amount (planned or real spend) appears in logs across set/report/remove (FR-014) — review `budgets.service.ts`, `budgets.controller.ts`, `movement-spend.service.ts`
- [X] T027 [P] Execute the `specs/008-budget/quickstart.md` scenarios (1–6) against the running API
- [X] T028 Run the full gate: `pnpm --filter @famifinances/contracts build`, `pnpm --filter @famifinances/api lint`, `pnpm --filter @famifinances/api test`, `pnpm --filter @famifinances/api test:e2e` — all green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup; **blocks all stories**. T006→T003; T007→T003,T006.
- **US1 (P3)**: depends on Foundational. T010→T006,T009; T011→T010.
- **US2 (P4)**: depends on Foundational. T015→T014; T017→T007,T015; T018→T016,T017. (T014/T015 touch `movements/`; independent of US1.)
- **US3 (P5)**: depends on US1 + US2 existing (tests exercise both routes).
- **US4 (P6)**: depends on Foundational (T024→T006); independent of US2/US3.
- **Polish (P7)**: after all desired stories.

### Same-file sequencing (not parallel)

- `budgets.service.ts`: T010 → T017 → T024 (sequential).
- `budgets.controller.ts`: T011 → T018 → T025 (sequential).
- `budgets.service.spec.ts`: T012 → T019 (sequential).

### Parallel Opportunities

- Setup: T002 ∥ T001.
- Foundational: T003 ∥ T004 ∥ T005 (then T006, then T007).
- US1 tests/DTO: T008 ∥ T009 ∥ T012.
- US2: T013 (test) ∥ T016; T014→T015 on the movements side run alongside US1.
- US3: T020 ∥ T021.
- Whole stories: US4 can proceed in parallel with US2/US3 once Foundational is done.

---

## Implementation Strategy

### MVP (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 US1 (set budget) → validate independently.
3. Phase 4 US2 (report) → validate the reconciliation — this is the demoable MVP (plan + comparison).

### Incremental Delivery

US1 → US2 → US3 (isolation/parity hardening) → US4 (remove) → Polish. Each story is independently testable and
adds value without breaking the previous ones.

---

## Notes

- [P] = different files, no incomplete dependencies.
- TDD: author each story's e2e spec first and confirm it fails before implementing.
- Reuse e2e helpers (`verifiedMemberWithFamily`, `createCategory`, `recordMovement`, etc.); e2e runs serial
  (`mongodb-memory-server`, `maxWorkers 1`).
- Commit after each task or logical group; conventional commits in English.
