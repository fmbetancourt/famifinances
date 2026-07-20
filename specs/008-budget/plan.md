# Implementation Plan: Monthly & Per-Category Budget (BUD-01)

**Branch**: `008-budget` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-budget/`

## Summary

BUD-01 adds the family's spending plan: the **Owner** allocates a planned amount to an expense category for a
calendar month (`BudgetAllocation`, unique per family+month+category), and any member views the **budget
report** for a month — per budgeted category the planned amount, the **real spend** (derived from TXN-01
expense movements with that category in the month, excluding deleted), the available amount (planned − real),
the percent consumed, and a status (`under`/`near`/`over`), plus an overall summary that sums the lines. Only
**expense** categories are budgetable (CAT-01 kind), and the real spend is **derived** (never stored). Access
is authorized through FAM-01: write routes are **Owner-only** (`FamilyRoleGuard` + `@Roles('owner')`, its
second consumer after FAM-01 invites); the report is any verified member. All dependencies are **one-way**
(budgets → movements/categories/families), so no `forwardRef` is needed.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Expo/React Native mobile.

**Primary Dependencies**: existing stack — NestJS, Mongoose (MongoDB), `class-validator`/`class-transformer`,
`@nestjs/throttler`, `@nestjs/swagger`. Reuses AUTH-01 (`JwtAuthGuard`, `EmailVerifiedGuard`), **FAM-01**
(`FamilyScopeGuard`, `@CurrentFamily`, and now `FamilyRoleGuard` + `@Roles('owner')`), **CAT-01**
(`CategoryRepository` — validate an expense category), and **TXN-01** (a new `MovementSpendService` sums
expense movements by category for a month).

**Storage**: MongoDB via Mongoose. New collection: `budgetAllocations`.

**Testing**: Jest + Supertest (unit + e2e, `mongodb-memory-server`). Mandatory: real-spend reconciliation
(report matches the sum of the month's expense movements per category), expense-only integrity (income
category → rejected), owner-only writes (non-owner → 403, viewing allowed), cross-family isolation, month +
positive-amount validation, near/over status, no amounts in logs.

**Target Platform**: iOS/Android (Expo); Node API in a container.

**Project Type**: Mobile + API monorepo (`apps/api`, `apps/mobile`, `packages/contracts`).

**Performance Goals**: pilot scale (3–5 families, tens of budgeted categories/month). Set a budget < 1 min
(SC-001); the report is two scoped reads (allocations + one movement aggregation) per request.

**Constraints**: budget scope + category from the session, never from caller input (Principle I); real spend
derived, never stored (Principle III); only expense categories; positive whole-peso CLP amount; owner-only
management; no monetary amount in logs.

**Scale/Scope**: invited pilot; strict isolation/privacy per the constitution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Budgets are scoped by the session `familyId`; the referenced category is validated to be the family's expense category; a foreign budget/category is rejected (404/400). Cross-family authorization e2e tests are mandatory. | PASS |
| II | Financial Privacy by Design | Server-side validation on all inputs; no monetary amount (planned or spend) in logs (FR-014); access always authorized by family; write routes owner-only; rate-limited via the global throttler. | PASS |
| III | Derived Balance Integrity | Real spend is **computed** from expense movements (never stored); only **expense** categories are budgeted (income vs expense integrity); the budget is the plan, spend is the truth from movements. | PASS |
| IV | Test-First & Definition of Done | TDD; real-spend + expense-only + owner-only + isolation + status + validation tests authored with implementation; OpenAPI documented. | PASS |
| V | Modular Monolith Simplicity | One cohesive `budgets` module with **one-way** dependencies on movements/categories/families (no `forwardRef` — budgets are not summed back into balances). Reuses the FAM-01 guards; no new infrastructure. | PASS |
| VI | Shared, Documented Contracts | OpenAPI + `packages/contracts` DTO types; TS strict, no `any`; hexagonal repository. | PASS |
| VII | Fast & Accessible Capture UX | Minimal mobile screens (set allocations; budget report) with one primary action; the `under`/`near`/`over` status rendered via text + icon + colour, not colour alone. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/budgets.openapi.yaml`. All gates hold: budgets + category scoped by session with mandatory
cross-family tests and owner-only writes (I/II); real spend derived from movements, expense-only (III);
one module with one-way deps, no new infrastructure (V); OpenAPI + shared contracts (VI). No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/008-budget/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── budgets.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files BUD-01 adds / edits

```text
apps/api/src/
├── budgets/
│   ├── budget-allocation.schema.ts    # BudgetAllocation: familyId(indexed), period 'YYYY-MM', categoryId
│   │                                  #   ref Category, plannedAmount(int>0), createdBy, timestamps;
│   │                                  #   UNIQUE {familyId, period, categoryId}
│   ├── budget-allocation.repository.ts # family-scoped: upsert, findInFamily(id), listByFamilyPeriod, deleteInFamily
│   ├── budgets.service.ts             # setAllocation (validate expense category), removeAllocation, getReport
│   │                                  #   (join allocations + category names + movement spend + status)
│   ├── budgets.controller.ts          # REST v1 /budgets; GET report (any member); POST/DELETE (owner-only)
│   ├── budgets.module.ts              # forFeature BudgetAllocation; imports FamiliesModule, CategoriesModule, MovementsModule
│   └── dto/
│       ├── set-budget.dto.ts          # period (YYYY-MM), categoryId, plannedAmount
│       └── budget-report.query.ts     # period? (defaults to the current month)
├── movements/                         # EDITED (real-spend source)
│   ├── movement.repository.ts         #   add sumExpenseByCategory(familyId, from, to) aggregation
│   ├── movement-spend.service.ts      #   NEW: expenseByCategory(familyId, period) — EXPORTED to BUD-01
│   └── movements.module.ts            #   provide + export MovementSpendService
└── families/                          # EDITED
    └── families.module.ts             #   export FamilyRoleGuard (reused by BUD-01 owner-only writes)

packages/contracts/src/budget/         # BudgetStatus, SetBudgetRequest, BudgetAllocationSummary,
                                        #   BudgetLine, BudgetReport
apps/mobile/app/(budget)/              # set-allocations screen + budget report (mobile) — DEFERRED to a
                                        #   later mobile track; this slice ships the API + contracts only
```

Reuses `apps/api/src/families/` guards, the AUTH-01 guards, and `CategoryRepository` (exported by
`CategoriesModule`). `MovementsModule` gains `MovementSpendService`; `FamiliesModule` also exports
`FamilyRoleGuard`.

**Structure Decision**: Keep the established monorepo layout. BUD-01 adds a single cohesive `budgets` domain
module. Unlike TXN-01/TXN-02 there is **no bidirectional coupling** — budgets read from movements/categories
but nothing reads from budgets, so all imports are one-way (no `forwardRef`). Real spend is computed on demand
via a `MovementSpendService` (a month-scoped expense aggregation grouped by category); the budget report joins
the family's allocations with that spend and each category's name (from CAT-01), computing available, percent
consumed, and status. Write routes reuse FAM-01's `FamilyRoleGuard` (`@Roles('owner')`) — its first reuse
outside FAM-01.

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
