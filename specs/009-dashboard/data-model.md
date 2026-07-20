# Data Model: Shared Monthly Dashboard (DASH-01)

**Feature**: DASH-01 · Shared monthly dashboard
**Date**: 2026-07-20

DASH-01 adds **no persisted collection**. The dashboard is a **computed read model** assembled on demand from
ACC-01 accounts, TXN-01 movements, TXN-02 transfers, and the BUD-01 report — all scoped to the session family
(Principle I) and all **derived** (Principle III). This document defines the computed shapes and the reads that
feed them.

## Computed: Dashboard *(not stored)*

For a `period` (calendar month `YYYY-MM`, default the current month), `DashboardService.getDashboard(familyId,
period)` returns:

| Field | Type | Source |
|-------|------|--------|
| `period` | string `YYYY-MM` | the request (or the current month) |
| `moneySummary` | `MoneySummary` | TXN-01 movements in the month (R2) |
| `accounts` | `DashboardAccountBalance[]` | ACC-01 active accounts' derived balances (R3) |
| `netWorth` | int (CLP) | Σ of `accounts[].balance` (R3) |
| `budget` | `DashboardBudget` | BUD-01 report for the month (R4) |
| `lastUpdated` | string (ISO) \| `null` | latest movement/transfer `updatedAt`, or null (R5) |

### MoneySummary

| Field | Type | Rule |
|-------|------|------|
| `totalIncome` | int (CLP) | Σ of the month's non-deleted **income** movements' `amount` (0 if none) |
| `totalExpense` | int (CLP) | Σ of the month's non-deleted **expense** movements' `amount` (0 if none) |
| `net` | int (CLP) | `totalIncome − totalExpense` (may be negative) |

Transfers are **not** included (FR-003). Deleted movements are excluded.

### DashboardAccountBalance *(compact, per active account)*

| Field | Type | Source |
|-------|------|--------|
| `accountId` | string | ACC-01 `FinancialAccountSummary.accountId` |
| `name` | string | account name |
| `type` | `AccountType` (bank / digital_wallet / cash / credit_card) | account type — reuses ACC-01's shared `AccountType` (not redefined) |
| `balance` | int (CLP) | **derived** balance (initial + movement net + transfer net) |

Only **active** accounts appear; archived accounts are excluded (they and their history still count in
`moneySummary`). `netWorth` = Σ `balance` across these active accounts.

### DashboardBudget

| Field | Type | Source |
|-------|------|--------|
| `summary` | `BudgetSummary` (BUD-01) | the report's overall `{ totalPlanned, totalRealSpend, totalAvailable, percentConsumed }` |
| `highlights` | `BudgetLine[]` (BUD-01) | the report `lines` with `status ∈ { near, over }`, in report order |

Reuses BUD-01's `BudgetSummary` and `BudgetLine` contract types verbatim (Principle VI). When no budgets exist
for the month, `summary` is all zeros and `highlights` is empty.

## Reads that feed the model *(no writes)*

- **`MovementSummaryService.monthlyIncomeExpense(familyId, period)`** → `{ totalIncome, totalExpense, net }`,
  backed by `MovementRepository.sumByTypeInPeriod(familyId, from, to)` (`$match { familyId, deletedAt:null,
  date:{ $gte:from, $lt:to } }` → `$group by type` sum `amount`).
- **`MovementSummaryService.latestChangeAt(familyId)`** / **`TransferSummaryService.latestChangeAt(familyId)`**
  → `Date | null`, each `findOne({ familyId }).sort({ updatedAt: -1 })` reading `updatedAt` (bumped on
  create/edit/soft-delete). `lastUpdated` = the later of the two, ISO-formatted, or `null`.
- **`FinancialAccountsService.listAccounts(familyId, 'active')`** → `FinancialAccountSummary[]` (derived
  balances); mapped to `DashboardAccountBalance` and summed for `netWorth`.
- **`BudgetsService.getReport(familyId, period)`** → `BudgetReport`; `summary` passed through, `lines` filtered
  to `near`/`over` for `highlights`.

## Validation rules

- `period`: matches `^\d{4}-(0[1-9]|1[0-2])$` (server-side, FR-013); omitted → current calendar month.
- `familyId`: always the session family (Principle I); never from client input; a caller with no family → 404
  (FamilyScopeGuard), consistent with the other modules.
- The endpoint is **read-only** (FR-014): it performs no create/update/delete.

## Relationships

- **Dashboard → Movement / Transfer / Financial Account / Budget Report** *(read-only)*: the dashboard reads
  each source and never modifies it. All access is authorized against the session family (Principle I).

## Notes

- **Fully derived** (Principle III): income/expense, balances, net worth, and the budget overview are computed
  each request; nothing is stored, so a later movement/transfer/budget change is reflected immediately.
- **Transfers excluded from income/expense** (FR-003); they affect balances only.
- **Balances are current** (not a month-end snapshot); the month scopes only `moneySummary` and `budget`.
- **One-way dependency**: the dashboard reads movements/transfers/accounts/budgets; nothing reads the dashboard
  — no `forwardRef`.
