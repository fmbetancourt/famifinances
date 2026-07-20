# Quickstart: Shared Monthly Dashboard (DASH-01)

**Feature**: DASH-01 · Shared monthly dashboard
**Date**: 2026-07-20

Validates the shared dashboard end to end: for a month, the money summary (income/expense/net) reconciles with
TXN-01 movements (transfers excluded), the net worth equals the sum of active accounts' derived balances, the
budget overview matches the BUD-01 report with over/near highlights, and a "last updated" mark is present.
Contracts: [contracts/dashboard.openapi.yaml](./contracts/dashboard.openapi.yaml); computed shapes:
[data-model.md](./data-model.md); decisions: [research.md](./research.md).

## Prerequisites

- Repo bootstrapped (`pnpm install`) with the ACC-01 / TXN-01 / TXN-02 / BUD-01 modules present.
- API runnable via the same harness as prior features; e2e uses `mongodb-memory-server` (serial, `maxWorkers 1`).
- A verified member who is the Owner of a family (for setting budgets), plus a user in a **different** family
  (isolation). Reuse the e2e helpers (`verifiedMemberWithFamily`, `createAccount`, `createCategory`,
  `recordMovement`, `recordTransfer`, `setBudget`, `getReport`).

## Run

```bash
# API unit + e2e (from repo root)
pnpm --filter @famifinances/api test
pnpm --filter @famifinances/api test:e2e

# Contract types
pnpm --filter @famifinances/contracts build
```

## Scenario 1 — Money summary reconciles; transfers excluded (US1, P1)

1. Create two accounts; record July income 500000 and expenses 120000 + 80000; record a **transfer** 50000
   between the two accounts.
2. `GET /dashboard?period=2026-07`.
3. **Expect 200** with `moneySummary` = `{ totalIncome: 500000, totalExpense: 200000, net: 300000 }` — the
   transfer does **not** change income or expense.
4. Delete one 80000 expense and re-GET → `totalExpense 120000`, `net 380000` (deleted excluded).

**Pass**: income/expense equal the sums of the month's non-deleted movements; transfers never move them.

## Scenario 2 — Account balances and net worth (US2, P1)

1. With the accounts + movements + transfer above (account A initial 500000, account B initial 0), `GET
   /dashboard?period=2026-07`.
2. **Expect** each entry in `accounts` to carry its **derived** balance, and `netWorth` to equal the sum of the
   active accounts' balances (matches each `GET /accounts/{id}` balance).
3. Archive account B and re-GET → B is absent from `accounts` and excluded from `netWorth`.
4. **Expect** a non-null `lastUpdated` ISO timestamp.

**Pass**: net worth = Σ active accounts' derived balances; archived excluded; a "last updated" mark is present.

## Scenario 3 — Budget overview with over/near highlights (US3, P1)

1. As the Owner, set a July budget of 200000 on an expense category; record 180000 of expenses in it (90% →
   near). Set a second budget of 100000 with 130000 spent (over).
2. `GET /dashboard?period=2026-07`.
3. **Expect** `budget.summary` to equal the BUD-01 report summary for July, and `budget.highlights` to contain
   both categories with status `near` and `over` (never `under`), in report order.
4. A category budgeted at 200000 with only 20000 spent (10% → under) is **absent** from `highlights`.

**Pass**: the budget overview reconciles with the BUD-01 report; only over/near categories are highlighted.

## Scenario 4 — Period default & validation (US4, P2)

1. `GET /dashboard` (no `period`) → **200** with `period` = the current calendar month.
2. `GET /dashboard?period=2026-13` → **400**; `?period=2026-7` → **400** (server-side validation).
3. Record data in June and July; `GET /dashboard?period=2026-06` vs `?period=2026-07` → the `moneySummary` and
   `budget` differ per month, while `accounts`/`netWorth` reflect the current derived state.

**Pass**: default = current month; invalid months rejected; month scopes the summary + budget.

## Scenario 5 — Cross-family isolation (US1–US3, P1)

1. Family A records movements/accounts/budgets for July.
2. As a member of family **B**, `GET /dashboard?period=2026-07` → **200** with family B's own (empty/zero) view;
   none of family A's figures appear.
3. A caller with **no family** → **404**.

**Pass**: every figure is scoped to the session family; a foreign family never leaks in.

## Done When

- [ ] Scenarios 1–5 pass against the running API.
- [ ] `moneySummary` reconciles with TXN-01 movements (transfers/deleted excluded) — SC-002.
- [ ] `netWorth` reconciles with active accounts' derived balances — SC-003.
- [ ] `budget` reconciles with the BUD-01 report; over/near highlighted — SC-004/SC-006.
- [ ] `lastUpdated` present; no real-time-bank claim — SC-007.
- [ ] No monetary amount appears in logs (FR-012 / SC-008).
