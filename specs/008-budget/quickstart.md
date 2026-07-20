# Quickstart: Monthly & Per-Category Budget (BUD-01)

**Feature**: BUD-01 · Monthly and per-category budget
**Date**: 2026-07-19

Validates the family spending plan end to end: the **Owner** sets a per-category budget for a month, any member
reads the **budget report** (planned vs real spend), and the report reconciles with TXN-01 expense movements.
Contracts live in [contracts/budgets.openapi.yaml](./contracts/budgets.openapi.yaml); the entities and the
computed report shapes in [data-model.md](./data-model.md); decisions in [research.md](./research.md).

## Prerequisites

- Repo bootstrapped (`pnpm install`) with the AUTH-01 / FAM-01 / CAT-01 / TXN-01 modules present.
- API runnable via the same harness as prior features; e2e uses `mongodb-memory-server` (serial, `maxWorkers 1`).
- A verified user who is the **Owner** of a family (FAM-01), plus a second **member** in the same family, and a
  user in a **different** family (for the isolation checks). Reuse the e2e helpers
  (`verifiedMemberWithFamily`, `registerVerifiedUser`, `createCategory`, `recordMovement`).

## Run

```bash
# API unit + e2e (from repo root)
pnpm --filter @famifinances/api test
pnpm --filter @famifinances/api test:e2e

# Contract types
pnpm --filter @famifinances/contracts build
```

## Scenario 1 — Owner sets a category budget (US1, P1)

1. As the Owner, `POST /budgets` `{ "period": "2026-07", "categoryId": "<expense-cat>", "plannedAmount": 300000 }`.
2. **Expect 200** with the saved allocation `{ budgetId, period, categoryId, plannedAmount }`.
3. Re-`POST` the same `{ period, categoryId }` with `plannedAmount: 250000` → **200**, amount updated (upsert,
   no duplicate row).

**Pass**: one allocation exists for (family, month, category); the second call updated rather than duplicated.

## Scenario 2 — Any member views the report, real spend reconciles (US2 + US3, P1)

1. Record two July expense movements in that category (e.g. 120000 + 90000 = 210000) via TXN-01.
2. As **any member**, `GET /budgets?period=2026-07`.
3. **Expect 200** with a line for the category: `plannedAmount 250000`, `realSpend 210000`, `available 40000`,
   `percentConsumed 84`, `status "near"` (≥ 80%). The `summary` totals equal the sum of the lines.
4. Record one more 60000 expense (real 270000 > 250000) and re-GET → `available -20000`, `status "over"`.

**Pass**: `realSpend` equals the sum of the month's non-deleted expense movements for the category; status
flips `under → near → over` at the 80% / 100% thresholds; summary = Σ lines.

## Scenario 3 — Expense-only & validation (US3, P1)

1. `POST /budgets` with an **income** category → **400** ("category is not budgetable").
2. `POST /budgets` with `plannedAmount: 0` or a negative amount → **400**; with `period: "2026-13"` → **400**;
   with an unknown field → **400** (whitelist).
3. `GET /budgets?period=2026-13` → **400**.

**Pass**: only active expense categories are budgetable; month + positive-amount validation enforced server-side.

## Scenario 4 — Owner-only writes (US1, P1)

1. As a **non-owner** member, `POST /budgets` (valid body) → **403**; `DELETE /budgets/{id}` → **403**.
2. As an Owner **without a verified email**, `POST /budgets` → **403** (email gate after family scope).
3. The same non-owner `GET /budgets?period=2026-07` → **200** (viewing is allowed for any member).

**Pass**: management is Owner-only; viewing is any-member.

## Scenario 5 — Cross-family isolation (US3, P1)

1. As the Owner of family A, set a budget; note the `budgetId`.
2. As the Owner of family **B**, `GET /budgets?period=2026-07` → the A allocation is **absent**;
   `DELETE /budgets/{A-budgetId}` → **404**.

**Pass**: budgets are scoped to the session family; a foreign id is a 404, never a cross-family read/delete.

## Scenario 6 — Remove a budget (US4, P2)

1. As the Owner, `DELETE /budgets/{budgetId}` → **204**.
2. `GET /budgets?period=2026-07` → the line is gone; the category's **movements are unchanged** (a subsequent
   TXN-01 movement query returns the same records).
3. `DELETE` the same id again → **404** (already removed).

**Pass**: removing a budget deletes only the allocation; movements/real history are untouched.

## Done When

- [ ] Scenarios 1–6 pass against the running API.
- [ ] Report `realSpend` reconciles with the TXN-01 expense movements for the month/category (SC-002).
- [ ] Owner-only writes, expense-only, month/amount validation, and cross-family isolation all enforced.
- [ ] No monetary amount (planned or spend) appears in logs (FR-014).
