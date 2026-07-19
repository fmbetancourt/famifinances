# Quickstart & Validation: TXN-02 (Transfers Between Accounts)

**Feature**: Transfers — move money between two family accounts, no double counting, derived balance
**Date**: 2026-07-18

Proves TXN-02 end-to-end. References [data-model.md](./data-model.md) and
[contracts/transfers.openapi.yaml](./contracts/transfers.openapi.yaml). Validation/run guide only —
implementation belongs in `tasks.md`.

## Prerequisites

- The AUTH-01 + FAM-01 + ACC-01 + TXN-01 API running with an in-memory or dev Mongo.
- Test accounts must be **email-verified**, belong to a **family**, and the family must have at least **two
  active accounts** (ACC-01). E2E tests reuse the ACC-01/TXN-01 helpers (`setupMemberWithAccount`,
  `createAccount`, `recordMovement`, `accountBalance`).

## Automated validation (authoritative)

```bash
pnpm --filter @famifinances/api test        # unit
pnpm --filter @famifinances/api test:e2e    # integration/e2e (mongodb-memory-server)
```

Required passing checks (map to spec):

- **US1 Record + balances (SC-002)**: `POST /transfers` `{ amount, date, fromAccountId, toAccountId }` →
  `201`; the origin's `GET /accounts/:id` balance decreases by the amount and the destination's increases by
  the same amount. Unverified → `403`. Non-positive amount / invalid date / same account → `400`.
- **No double counting (SC-003, Principle III)**: record movements, capture the family's income/expense
  situation, record a transfer, and confirm the income and expense figures are **unchanged** (only the two
  account balances shifted).
- **US2 List (FR-008)**: `GET /transfers` returns the family's non-deleted transfers newest-first; `?account=`
  filters to transfers touching that account; two members of the same family see the identical list.
- **US3 Isolation + integrity (SC-004/005)**: a transfer using another family's or an archived account → `400`;
  origin == destination → `400`; a member of family B cannot see/modify family A's transfer
  (`GET/PATCH/DELETE /transfers/{A-id}` → `404`); a foreign `familyId` is ignored; no-family → `404`.
- **US4 Edit (SC-002/006)**: `PATCH /transfers/:id` changes amount/date/from/to/note → `200`; the affected
  account balances recompute (including when an account changes); invalid edit → `400`; an audit record exists.
- **US5 Delete (SC-006/007)**: `DELETE /transfers/:id` → `204`; excluded from both balances and the list; a
  `deleted` audit record survives; re-deleting is idempotent (`204`).
- **Audit (FR-011)**: each create/edit/delete appends a `TransferEvent` (actor + type + timestamp + snapshot)
  that survives the transfer's deletion.
- **Privacy (FR-015)**: no monetary amount or note appears in logs across record/list/edit/delete.

## Manual smoke walkthrough (optional)

Using Swagger UI (`/api/docs`) with a verified member A whose family has account X (balance 100000) and
account Y (balance 20000):

1. A `POST /transfers` `{ "amount":30000, "date":"2026-07-05", "fromAccountId":"X", "toAccountId":"Y" }` →
   `201`.
2. A `GET /accounts/X` → balance `70000`; `GET /accounts/Y` → balance `50000`.
3. A `POST /transfers` with `fromAccountId == toAccountId` → `400` (same account).
4. A `PATCH` the transfer's amount to `40000` → both balances recompute (X `60000`, Y `60000`).
5. A `DELETE` the transfer → `204`; balances restored (X `100000`, Y `20000`); `GET /transfers` omits it.
6. As a member of a **different** family, `GET /transfers/<A-id>` → `404` (isolation).

## Expected outcome

All automated suites pass; a transfer shifts balance between two accounts (origin −, destination +) without
changing income/expense totals; both accounts are validated as active and distinct; transfers are
family-scoped; edits/deletes are auditable and the audit survives deletion. At that point TXN-02 completes the
income/expense/transfer money model that BUD-01 (budgets), DASH-01 (dashboard), and HIS-01 (history) build on.

## Validation results (T033)

Executed against the automated suite (`mongodb-memory-server`, serial) — the authoritative validation.

- **Unit**: 6 suites / 18 tests pass (incl. the ACC-01 `deriveBalance` unit — `initial + net` with movements
  + transfers).
- **E2E**: 58 suites / 140 tests pass, including all TXN-02 suites: `create-transfer`, `list-transfers`,
  `transfer-isolation`, `edit-transfer`, `delete-transfer`, `transfer-balance`, `transfer-audit`,
  `transfer-log-privacy`, `transfer-openapi-parity`. No ACC-01/TXN-01 regressions (transferNet 0 with no
  transfers preserves prior balances).
- **Typecheck**: strict `tsc --noEmit` clean (T034); `packages/contracts` transfer types compile against the
  API with no `any`.
- **No double counting (SC-003)**: verified that recording a transfer leaves `GET /movements` byte-for-byte
  unchanged (a transfer is neither income nor expense) while both account balances shift.

**SC-002 (balances shift) / SC-003 (totals unchanged)**: met with wide margin; `POST /transfers` returns in
single-digit-to-low-tens of milliseconds in e2e. A full timed UX walkthrough is deferred to mobile integration.
