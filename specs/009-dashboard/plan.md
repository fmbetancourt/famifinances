# Implementation Plan: Shared Monthly Dashboard (DASH-01)

**Branch**: `009-dashboard` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-dashboard/`

## Summary

DASH-01 adds one **read-only** shared screen: for a calendar month (default current), any family member sees
the family's **money summary** (total income, total expense, net), each **active account's derived balance** and
the **total net worth**, the **budget overview** (planned vs real spend, available, percent consumed) with the
**over/near category highlights**, and a **"last updated"** mark — never implying a real-time bank balance. It
introduces **no new persisted entity**: a `DashboardService` **aggregates** the existing feature services
(ACC-01 balances, TXN-01 income/expense, TXN-02 transfers for balances + freshness, BUD-01 report), all scoped
to the session family. Every dependency is **one-way** (the dashboard reads; nothing reads the dashboard), so
**no `forwardRef`** is required.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Expo/React Native mobile.

**Primary Dependencies**: existing stack — NestJS, Mongoose (MongoDB), `class-validator`/`class-transformer`,
`@nestjs/throttler`, `@nestjs/swagger`. Reuses AUTH-01 (`JwtAuthGuard`), **FAM-01** (`FamilyScopeGuard`,
`@CurrentFamily`), **ACC-01** (`FinancialAccountsService.listAccounts` → derived balances), **TXN-01** (a new
`MovementSummaryService` sums income/expense for a month + reports the last movement change), **TXN-02** (a new
`TransferSummaryService` reports the last transfer change), and **BUD-01** (`BudgetsService.getReport`).

**Storage**: MongoDB via Mongoose. **No new collection** — the dashboard is a computed read model.

**Testing**: Jest + Supertest (unit + e2e, `mongodb-memory-server`). Mandatory: money-summary reconciliation
(income/expense = sums of the month's movements; transfers excluded; deleted excluded), net-worth
reconciliation (= sum of active accounts' derived balances; archived excluded), budget-overview reconciliation
(= BUD-01 report; over/near highlighted), cross-family isolation, month validation + current-month default,
last-updated presence, no amounts in logs.

**Target Platform**: iOS/Android (Expo); Node API in a container.

**Project Type**: Mobile + API monorepo (`apps/api`, `apps/mobile`, `packages/contracts`).

**Performance Goals**: pilot scale (3–5 families). Dashboard read < 3 s (SC-001); one request fans out to a
small, bounded set of scoped aggregations (movement sums, account balances, budget report, two latest-change
lookups), run concurrently.

**Constraints**: family scope from the session, never from caller input (Principle I); balances/income/expense
**derived**, never stored (Principle III); transfers excluded from income/expense; read-only (no mutation);
whole-peso CLP; no monetary amount in logs; no real-time-bank claim.

**Scale/Scope**: invited pilot; strict isolation/privacy per the constitution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Every figure is scoped by the session `familyId`; the dashboard reuses already-family-scoped services and adds only family-scoped reads. A cross-family isolation e2e is mandatory. | PASS |
| II | Financial Privacy by Design | Server-side month validation; no monetary amount in logs (FR-012); read-only access authorized by family membership; rate-limited via the global throttler. | PASS |
| III | Derived Balance Integrity | Balances/income/expense are **computed** on demand (never stored); transfers are excluded from income/expense (no double counting); no month-end snapshot is persisted. | PASS |
| IV | Test-First & Definition of Done | TDD; reconciliation (money/net-worth/budget) + isolation + validation + last-updated + no-logs tests authored with implementation; OpenAPI documented. | PASS |
| V | Modular Monolith Simplicity | One cohesive `dashboard` module that **aggregates** existing services with **one-way** dependencies (no `forwardRef`); two tiny read services added to movements/transfers; no new collection, no new infrastructure. | PASS |
| VI | Shared, Documented Contracts | OpenAPI + `packages/contracts` DTO types (reusing BUD-01's `BudgetSummary`/`BudgetLine`); TS strict, no `any`; hexagonal read services. | PASS |
| VII | Fast & Accessible Capture UX | The dashboard surfaces status (`under`/`near`/`over`) as data for the client to render via text + icon + colour; shows a "last updated" mark and never implies a real-time bank balance; amounts are CLP. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/dashboard.openapi.yaml`. All gates hold: one read-only module scoped by session with mandatory
cross-family + reconciliation tests (I/III/IV); reuses existing services with one-way deps, no new collection
(V); OpenAPI + shared contracts reusing BUD-01 types (VI); status-as-data + last-updated + no real-time claim
(VII). No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── dashboard.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files DASH-01 adds / edits

```text
apps/api/src/
├── dashboard/
│   ├── dashboard.service.ts            # aggregate money summary + net worth + budget overview + last-updated
│   ├── dashboard.controller.ts         # REST v1 GET /dashboard (any member); period? (defaults to current month)
│   ├── dashboard.module.ts             # imports FamiliesModule, FinancialAccountsModule, MovementsModule,
│   │                                   #   TransfersModule, BudgetsModule (all one-way, no forwardRef)
│   └── dto/
│       └── dashboard.query.ts          # period? (YYYY-MM), defaults to the current month
├── movements/                          # EDITED
│   ├── movement.repository.ts          #   add sumByTypeInPeriod(familyId, from, to) + latestChangeAt(familyId)
│   ├── movement-summary.service.ts     #   NEW: monthlyIncomeExpense(familyId, period) + latestChangeAt — EXPORTED
│   └── movements.module.ts             #   provide + export MovementSummaryService
├── transfers/                          # EDITED
│   ├── transfer.repository.ts          #   add latestChangeAt(familyId)
│   ├── transfer-summary.service.ts     #   NEW: latestChangeAt(familyId) — EXPORTED
│   └── transfers.module.ts             #   provide + export TransferSummaryService
├── financial-accounts/                 # EDITED
│   └── financial-accounts.module.ts    #   also export FinancialAccountsService (net worth via listAccounts)
└── budgets/                            # EDITED
    └── budgets.module.ts               #   export BudgetsService (budget overview via getReport)

packages/contracts/src/dashboard/       # DashboardResponse, MoneySummary, DashboardAccountBalance,
                                        #   DashboardBudget (reuses BUD-01 BudgetSummary + BudgetLine)
apps/mobile/app/(dashboard)/            # dashboard screen (mobile) — DEFERRED to a later mobile track
```

Reuses `apps/api/src/families/` guards and the AUTH-01 guards. `MovementsModule` gains `MovementSummaryService`;
`TransfersModule` gains `TransferSummaryService`; `FinancialAccountsModule` also exports
`FinancialAccountsService`; `BudgetsModule` exports `BudgetsService`.

**Structure Decision**: Keep the established monorepo layout. DASH-01 adds a single cohesive **read-only**
`dashboard` module that composes existing feature services rather than re-deriving anything: net worth from
`FinancialAccountsService.listAccounts(familyId,'active')`, income/expense from a new `MovementSummaryService`
(a month-scoped `$group` by movement type), the budget overview from `BudgetsService.getReport`, and the "last
updated" mark from the latest `updatedAt` across movements and transfers. Unlike ACC-01/TXN-02 there is **no
bidirectional coupling** — nothing reads the dashboard — so all imports are one-way (no `forwardRef`). No new
collection is introduced (Principle III: the dashboard is entirely derived).

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
