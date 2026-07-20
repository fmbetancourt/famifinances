# Research: Shared Monthly Dashboard (DASH-01)

**Feature**: DASH-01 · Shared monthly dashboard
**Date**: 2026-07-20

The stack + patterns are inherited from ACC-01/TXN-01/TXN-02/BUD-01. No open `NEEDS CLARIFICATION` remain — the
three ambiguities were closed in `/speckit-clarify` (Session 2026-07-20): budget detail = overall summary +
over/near highlights; "last updated" = latest movement/transfer change; net worth = active accounts' current
derived balances.

## R1 · Read-only aggregation, no new persistence (one-way, no forwardRef)

- **Decision**: DASH-01 adds **no collection**. A `DashboardService` composes existing family-scoped services
  and returns a computed view. `DashboardModule` **imports** `FamiliesModule`, `FinancialAccountsModule`,
  `MovementsModule`, `TransfersModule`, and `BudgetsModule` — strictly one-way (the dashboard reads them;
  nothing reads the dashboard), so **no `forwardRef`** is needed (unlike the accounts⇄movements/⇄transfers
  cycles).
- **Rationale**: Everything the dashboard shows is already **derived** elsewhere (Principle III). Re-deriving or
  storing a snapshot would duplicate truth and risk drift. Composition keeps a single source per figure.
- **Alternatives considered**: a persisted monthly snapshot table (rejected — editable derived data, drift,
  violates III, and out of scope per the spec); a client-side aggregation calling four endpoints (rejected — the
  family must trust one server-computed, consistent view, and four round-trips hurt SC-001).

## R2 · Money summary — income/expense for the month (TXN-01)

- **Decision**: Add `MovementRepository.sumByTypeInPeriod(familyId, from, to)` — a `$match { familyId,
  deletedAt:null, date:{ $gte:from, $lt:to } }` → `$group by type` summing `amount` — returning
  `{ income, expense }` (0 for an absent type). A new `MovementSummaryService.monthlyIncomeExpense(familyId,
  period)` computes the month bounds and returns `{ totalIncome, totalExpense, net = income − expense }`.
  Exported from `MovementsModule`.
- **Rationale**: Mirrors BUD-01's `sumExpenseByCategory` month-scoped aggregation. **Transfers are a separate
  collection** and are never matched here, so they cannot inflate income/expense (FR-003, no double counting).
  Deleted movements are excluded (`deletedAt:null`).
- **Alternatives considered**: deriving income/expense from the per-account net (rejected — net mixes transfers
  and loses the income-vs-expense split); reusing `netByAccount` (rejected — it nets signed amounts, not the two
  gross totals the dashboard shows).

## R3 · Net worth — active accounts' derived balances (ACC-01)

- **Decision**: `DashboardService` calls `FinancialAccountsService.listAccounts(familyId, 'active')` (already
  returns each account's **derived** balance = initial + movement net + transfer net) and sums the balances for
  **net worth**; per-account it surfaces a compact `{ accountId, name, type, balance }`. `FinancialAccountsModule`
  **exports** `FinancialAccountsService` (previously only its repository was exported).
- **Rationale**: Reuses the single ACC-01 derivation (Principle III) — no duplicate balance math. `'active'`
  excludes archived accounts from the total (clarify Q3). Balances reflect the **current** derived state (no
  month-end snapshot — none is stored in the MVP).
- **Alternatives considered**: recomputing balances in the dashboard from the balance services + repo (rejected —
  duplicates `deriveBalance`); including archived accounts (rejected in clarify Q3).

## R4 · Budget overview — reuse the BUD-01 report

- **Decision**: `DashboardService` calls `BudgetsService.getReport(familyId, period)` and returns
  `{ summary, highlights }` where `summary` is the report's `BudgetSummary` and `highlights` are the report
  `lines` with `status !== 'under'` (i.e. `near` or `over`). `BudgetsModule` **exports** `BudgetsService`.
- **Rationale**: The budget planned-vs-real math + status already live in BUD-01 (single source). The dashboard
  surfaces the overall summary + only the actionable categories (clarify Q1); the full per-category table stays
  on the budget screen. `BudgetLine`/`BudgetSummary` contract types are reused (no duplication, Principle VI).
- **Alternatives considered**: re-implementing the budget aggregation in the dashboard (rejected — duplicates
  BUD-01); embedding all lines (rejected in clarify Q1 — duplicates the budget screen, larger payload).

## R5 · "Last updated" mark (TXN-01 + TXN-02)

- **Decision**: `lastUpdated` = the **later** of `MovementRepository.latestChangeAt(familyId)` and
  `TransferRepository.latestChangeAt(familyId)`, each a `findOne({ familyId }).sort({ updatedAt: -1 })` reading
  `updatedAt` (Mongoose `timestamps` bumps it on create, edit, and the soft-delete `updateOne`). It is **not**
  filtered by `deletedAt` — a deletion is a change worth reflecting. Returned as an ISO timestamp, or `null`
  when the family has no movements or transfers. Movement side lives on the new `MovementSummaryService`;
  transfers get a small `TransferSummaryService.latestChangeAt`, exported from `TransfersModule`.
- **Rationale**: Satisfies FR-008 ("last time the money data changed") and the constitution's "last updated"
  mark. Budget-allocation changes are intentionally excluded (clarify Q2). Two indexed single-doc lookups are
  cheap.
- **Alternatives considered**: server render time (rejected in clarify Q2 — hides staleness); including budget
  changes (rejected in clarify Q2); a stored `lastUpdated` field maintained on write (rejected — derived data,
  drift).

## R6 · Endpoint, period & validation

- **Decision**: `GET /dashboard?period=YYYY-MM` — any family member (`JwtAuthGuard` + `FamilyScopeGuard`).
  `DashboardQuery.period` is optional, validated by `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)`, defaulting to the
  current month (shared `currentPeriod()` helper). The service fans out the four reads with `Promise.all`. The
  response is a single `DashboardResponse` (money summary, accounts + net worth, budget overview, lastUpdated).
- **Rationale**: One read endpoint mirrors the session-implicit scoping of the other modules; the month regex
  reuses BUD-01's pattern; concurrent reads keep SC-001 (< 3 s) comfortable at pilot scale.
- **Alternatives considered**: four separate endpoints the client stitches (rejected — SC-001, one trusted
  view); a full ISO date accepted and truncated (rejected — a `YYYY-MM` string is explicit).

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Persistence | None — computed read model; dashboard → services one-way (no forwardRef) — R1 |
| Money summary | `MovementSummaryService.monthlyIncomeExpense` ($group by type, deleted excluded, transfers excluded) — R2 |
| Net worth | `FinancialAccountsService.listAccounts(familyId,'active')` derived balances, summed; archived excluded — R3 |
| Budget overview | `BudgetsService.getReport` summary + over/near lines; BUD-01 contract types reused — R4 |
| Last updated | later of movement/transfer `latestChangeAt` (`updatedAt`), null when none; budgets excluded — R5 |
| Endpoint | `GET /dashboard?period=` any member; period regex, defaults to current month; Promise.all fan-out — R6 |
