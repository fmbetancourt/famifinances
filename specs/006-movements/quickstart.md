# Quickstart & Validation: TXN-01 (Income & Expense Movements)

**Feature**: Movements — record/edit/delete/history of income & expense, derived balance, kind integrity
**Date**: 2026-07-18

Proves TXN-01 end-to-end. References [data-model.md](./data-model.md) and
[contracts/movements.openapi.yaml](./contracts/movements.openapi.yaml). Validation/run guide only —
implementation belongs in `tasks.md`.

## Prerequisites

- The AUTH-01 + FAM-01 + ACC-01 + CAT-01 API running with an in-memory or dev Mongo (system categories are
  seeded on startup).
- Test accounts must be **email-verified**, belong to a **family**, and the family must have at least one
  **active account** (ACC-01) to record movements. E2E tests reuse the ACC-01/CAT-01 helpers
  (`verifiedMemberWithFamily`, `createAccount`, `createCategory`).

## Automated validation (authoritative)

```bash
pnpm --filter @famifinances/api test        # unit
pnpm --filter @famifinances/api test:e2e    # integration/e2e (mongodb-memory-server)
```

Required passing checks (map to spec):

- **US1 Record + balance (SC-002)**: `POST /movements` `{ type, amount, date, accountId }` → `201`; the
  account's `GET /accounts/:id` balance decreases (expense) or increases (income) by the amount. Unverified →
  `403`. Non-positive amount / invalid type / invalid date → `400`.
- **US2 History (FR-008)**: `GET /movements` returns the family's non-deleted movements newest-first;
  `?account=` and `?type=` filter; two members of the same family see the identical list and balances.
- **US3 Isolation + integrity (SC-003/SC-004/SC-005, Principle I & III)**: recording against another family's
  account or category → `400`; an income category on an expense (or vice versa) → `400`; a member of family B
  cannot see/modify family A's movements (`GET/PATCH/DELETE /movements/{A-id}` → `404`); a foreign `familyId`
  in the request is ignored; no-family → `404`.
- **US4 Edit (SC-002/SC-006)**: `PATCH /movements/:id` changes amount/type/date/account/category/note →
  `200`; the affected account balance recomputes (including when the account changes); invalid edit → `400`,
  movement unchanged; an audit record of the edit exists.
- **US5 Delete (SC-006/SC-007)**: `DELETE /movements/:id` → `204`; the movement is excluded from the account
  balance and from `GET /movements`; an audit record of the deletion survives.
- **Audit (FR-011)**: each create/edit/delete appends a `MovementEvent` (actor + type + timestamp + snapshot)
  that survives the movement's deletion.
- **Privacy (FR-016)**: no monetary amount or note appears in logs across record/list/edit/delete.

## Manual smoke walkthrough (optional)

Using Swagger UI (`/api/docs`) with a verified member A whose family has an account (balance 100000) and a
default expense category:

1. A `POST /movements` `{ "type":"expense", "amount":30000, "date":"2026-07-05", "accountId":"<acc>",
   "categoryId":"<expense-cat>" }` → `201`.
2. A `GET /accounts/<acc>` → balance `70000` (100000 − 30000).
3. A `POST /movements` `{ "type":"income", "amount":50000, "date":"2026-07-06", "accountId":"<acc>" }` →
   `201`; `GET /accounts/<acc>` → balance `120000`.
4. A `POST /movements` with an **income** category on `type:"expense"` → `400` (kind mismatch).
5. A `GET /movements?type=expense` → lists the expense; `PATCH` its amount to `40000` → balance recomputes.
6. A `DELETE /movements/<id>` → `204`; `GET /movements` omits it; `GET /accounts/<acc>` balance rises back.
7. As a member of a **different** family, `GET /movements/<A-id>` → `404` (isolation).

## Expected outcome

All automated suites pass; account balances are derived from movements (initial + income − expense, excluding
deleted); category kinds match movement types; movements are family-scoped; edits/deletes are auditable and
the audit survives deletion. At that point TXN-01 satisfies its Success Criteria and provides the financial
source of truth that TXN-02 (transfers), BUD-01 (budgets), DASH-01 (dashboard), and HIS-01 (history) build on.

## Validation results (T035)

Executed against the automated suite (`mongodb-memory-server`, serial) — the authoritative validation.

- **Unit**: 6 suites / 18 tests pass (incl. the updated ACC-01 `deriveBalance` unit — `initial + net`).
- **E2E**: 49 suites / 120 tests pass, including all TXN-01 suites: `create-movement`, `list-movements`,
  `movement-isolation`, `edit-movement`, `delete-movement`, `movement-balance`, `movement-audit`,
  `movement-log-privacy`, `movement-openapi-parity`. No ACC-01/FAM-01/CAT-01 regressions.
- **Typecheck**: strict `tsc --noEmit` clean (T036); `packages/contracts` movement types compile against the
  API with no `any`.
- **Balance integration**: an account with no movements still reports `balance == initialBalance` (net 0);
  with movements, `balance == initial + Σ income − Σ expense`, excluding deleted.

**SC-001 (record < 1 min) / SC-002 (balance reflects)**: `POST /movements` returns in single-digit-to-low-tens
of milliseconds in e2e, and the affected account balance reflects the movement on the next read; both criteria
are met with wide margin. A full timed UX walkthrough is deferred to mobile integration.
