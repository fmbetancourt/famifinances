# Quickstart & Validation: ACC-01 (Family Financial Accounts)

**Feature**: Accounts — types, institution label, initial balance, derived balance
**Date**: 2026-07-17

Proves ACC-01 end-to-end. References [data-model.md](./data-model.md) and
[contracts/accounts.openapi.yaml](./contracts/accounts.openapi.yaml). Validation/run guide only —
implementation belongs in `tasks.md`.

## Prerequisites

- The AUTH-01 + FAM-01 API running (auth, sessions, email verification, families & memberships) with an
  in-memory or dev Mongo.
- Test accounts must be **email-verified** and belong to a **family** (via FAM-01) to manage accounts. E2E
  tests reuse the FAM-01 helpers (`registerVerifiedUser`, create-family, invite/join) to set up members.

## Automated validation (authoritative)

```bash
pnpm --filter @famifinances/api test        # unit
pnpm --filter @famifinances/api test:e2e    # integration/e2e (mongodb-memory-server)
```

Required passing checks (map to spec):

- **US1 Create account**: a verified member of a family `POST /accounts` with `name`, `type`,
  `initialBalance`, `startDate` (optional `institution`) → `201`; the account is listed and ready for
  movements. Unverified → `403`. Invalid type / missing name / non-integer amount → `400`.
- **US2 See accounts + balances**: `GET /accounts` returns the family's active accounts; each account's
  `balance` equals its `initialBalance` (no movements yet); two members of the same family see the identical
  list and balances (SC-002).
- **US3 Isolation (SC-003, Principle I)**: an account created in family A is invisible to a member of
  family B; `GET/PATCH/POST /accounts/{id}` for A's id as a B member → `404`; a foreign `familyId` in the
  request is ignored (family comes from the session); a user with no family → `403`.
- **US4 Edit account**: `PATCH /accounts/{id}` updates name/type/institution/initialBalance/startDate →
  `200`; changing `initialBalance` recomputes `balance`; invalid field → `400`, account unchanged.
- **US5 Archive/unarchive**: `POST /accounts/{id}/archive` → `200`, the account drops out of the default
  (`status=active`) list but is retrievable via `status=archived`/`all`; editing it → `409` (read-only);
  `POST /accounts/{id}/unarchive` → `200`, it returns to the active list. No delete endpoint exists.
- **Derived balance (SC-004)**: no persisted editable `balance` field exists; the reported `balance` is
  always `initialBalance` + movements (equals `initialBalance` in ACC-01).
- **Privacy (SC-007)**: no account name, institution, or monetary figure appears in logs across create,
  edit, list, and archive flows.

## Manual smoke walkthrough (optional)

Using Swagger UI (`/api/docs`) with a verified member A of a family:

1. A `POST /accounts` `{ "name": "Cuenta Santander", "type": "bank", "institution": "Santander",
   "initialBalance": 150000, "startDate": "2026-07-01" }` → `201`, `balance` = 150000.
2. A `POST /accounts` `{ "name": "Tarjeta", "type": "credit_card", "initialBalance": -80000,
   "startDate": "2026-07-01" }` → `201` (negative initial balance allowed).
3. A `GET /accounts` → both accounts listed with their balances.
4. A `PATCH /accounts/{id}` `{ "initialBalance": 200000 }` on the bank account → `200`, `balance` = 200000.
5. A `POST /accounts/{id}/archive` → `200`, `archived: true`; `GET /accounts` no longer lists it;
   `GET /accounts?status=archived` does; `PATCH` on it → `409`.
6. A `POST /accounts/{id}/unarchive` → `200`, it returns to `GET /accounts`.
7. As a member of a **different** family, `GET /accounts/{A-account-id}` → `404` (isolation).

## Expected outcome

All automated suites pass; accounts are scoped to the session family; cross-family access returns 404;
balances are derived (no editable stored balance); archived accounts are read-only and never deleted;
amounts are whole-peso CLP. At that point ACC-01 satisfies its Success Criteria and provides the first
family-owned financial entity that TXN-01 (movements) and BUD-01 (budgets) build on.

## SC timing note

**SC-001 (create account < 1 min)** is a user-task-time budget; the underlying `POST /accounts` completes
in single-digit-to-low-tens of milliseconds in e2e, leaving the whole budget to the user. A full timed UX
walkthrough is deferred to mobile integration.

## Validation results (T029)

Executed against the automated suite (`mongodb-memory-server`, serial) — the authoritative validation.

- **Unit**: 6 suites / 18 tests pass (incl. `financial-accounts.service.spec.ts` — derived balance).
- **E2E**: 32 suites / 75 tests pass, including all ACC-01 suites: `create-account`, `list-accounts`,
  `account-isolation`, `edit-account`, `archive-account`, `account-log-privacy`, `account-openapi-parity`.
- **Typecheck**: strict `tsc --noEmit` clean (T030); `packages/contracts` account types compile against
  the API with no `any`.
- **Implementation note**: financial accounts are implemented under `apps/api/src/financial-accounts/`
  (class `FinancialAccount`, contract type `FinancialAccountSummary`) to avoid a name clash with the
  AUTH-01 `Account`/`AccountSummary`; the REST surface and `account` contract module are unchanged. A
  member with no family gets **404** (from `FamilyScopeGuard`); **403** is reserved for an unverified email.
