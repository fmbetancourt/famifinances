# Data Model: Monthly & Per-Category Budget (BUD-01)

**Feature**: BUD-01 · Monthly and per-category budget
**Date**: 2026-07-19

BUD-01 adds one persisted collection, `budgetAllocations`. The **budget report** is computed on demand — real
spend is derived from TXN-01 expense movements, never stored. `Family`/`Membership` (FAM-01), `Category`
(CAT-01), and `Movement` (TXN-01) are referenced, not redefined.

## Entity: BudgetAllocation (`budgetAllocations`)

The planned amount for one expense category in one month, owned by exactly one family. Managed by the Owner.

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key; the `budgetId` in the API. |
| `familyId` | ObjectId (ref Family) | The owning family, from the session. **Indexed.** Never from client input. |
| `period` | string | Calendar month `YYYY-MM` (e.g. `2026-07`). |
| `categoryId` | ObjectId (ref Category) | An **expense** category visible to the family (system or active custom). |
| `plannedAmount` | number (int) | Required; **positive** whole-peso CLP (> 0). |
| `createdBy` | ObjectId (ref Account) | The Owner who set it (FR-001). |
| `createdAt` / `updatedAt` | Date | Mongoose timestamps. |

**Indexes**: **unique** `{ familyId, period, categoryId }` — one allocation per family+month+category (FR-005);
`{ familyId, period }` for the report query.

**Validation rules** (server-side, FR-013):

- `period`: matches `^\d{4}-(0[1-9]|1[0-2])$` (a real calendar month).
- `plannedAmount`: integer > 0.
- `categoryId`: resolves via `CategoryRepository.findVisible(familyId, categoryId)`, is **active** (custom not
  archived), and `kind === 'expense'` — else **400**. Income / foreign / archived → rejected (FR-003).
- `familyId`, `createdBy` = session; never from client input.

**Lifecycle**: **upsert** on set (create or update `plannedAmount` for the (family, period, category) key);
**hard delete** on remove. No soft delete / audit log — a budget allocation is planning configuration, not a
money record (Principle III's audit clause is for movements).

## Computed: Budget Report *(not stored)*

For a `period`, built from the family's allocations + the month's expense movements:

- **BudgetLine** (per budgeted category): `{ budgetId, categoryId, categoryName, plannedAmount, realSpend, available, percentConsumed, status }` where
  - `budgetId` = the allocation's `_id`, so the client can drive `DELETE /budgets/{budgetId}` straight from the report;
  - `realSpend` = Σ of the family's non-deleted **expense** movements with that `categoryId` and `date` in the
    month (from `MovementSpendService.expenseByCategory`);
  - `available` = `plannedAmount − realSpend` (may be negative);
  - `percentConsumed` = `round(realSpend / plannedAmount × 100)` (`plannedAmount > 0` so no division by zero);
  - `status` = **over** if `realSpend > plannedAmount`; else **near** if `percentConsumed ≥ 80`; else **under**.
- **Summary** (overall): `{ totalPlanned, totalRealSpend, totalAvailable, percentConsumed }` = the sums of the
  lines (`percentConsumed` = `round(totalRealSpend / totalPlanned × 100)`, or `0` when there are no lines).

## Relationships

- **BudgetAllocation → Category** (`categoryId`): each allocation budgets one expense category (kind
  `expense`); validated against the family's visible categories.
- **BudgetAllocation → Family** (`familyId`): the privacy boundary; all access authorized against the session
  family (Principle I).
- **BudgetAllocation → Account (`createdBy`)**: the Owner who set it (AUTH-01 user `Account`); informational.
- **Budget report → Movement** *(read-only)*: real spend sums expense movements by category + month; movements
  are never modified by BUD-01.

## Notes

- **Real spend is derived** (never stored) — the report recomputes it from movements each request (Principle
  III). Deleting/editing a movement changes the report accordingly.
- **Expense-only**: only `kind: expense` categories are budgetable (income is not budgeted).
- **One-way dependency**: budgets read movements/categories; nothing reads budgets — no `forwardRef`.
