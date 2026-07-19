# Research: Transfers Between Accounts (TXN-02)

**Feature**: TXN-02 · Transfers between family accounts
**Date**: 2026-07-18

The stack + patterns are inherited from AUTH-01/FAM-01/ACC-01/TXN-01. No open `NEEDS CLARIFICATION` remain —
the one ambiguity was closed in `/speckit-clarify` (Session 2026-07-18): transfers use a separate `/transfers`
list (the TXN-01 movement history is unchanged; a unified timeline is DASH-01/HIS-01).

## R1 · Balance composition & the accounts⇄transfers coupling

- **Decision**: Model a transfer as a **single** `Transfer` record referencing two accounts (`fromAccountId`,
  `toAccountId`), stored in its own `transfers` collection — **not** as income/expense movements — so it never
  touches income/expense totals (no double counting, constitution III). TXN-02 adds a `TransferBalanceService`
  (exported by `TransfersModule`) with `netForAccount(familyId, accountId)` / `netByFamily(familyId)`, backed
  by an aggregation that emits `−amount` for the origin and `+amount` for the destination of each non-deleted
  transfer, grouped by account. ACC-01's `FinancialAccountsService` composes the balance as
  `initialBalance + movementNet + transferNet`, pulling movement-net (TXN-01) and transfer-net (TXN-02).
  Transfers validate their accounts via `FinancialAccountRepository`. The accounts⇄transfers cycle is resolved
  with a scoped **`forwardRef`** (mirroring accounts⇄movements).
- **Rationale**: A separate record keeps income/expense totals structurally untouched by transfers (III), and
  the balance stays **derived** (only `initialBalance` + immutable movements/transfers are stored). Keeping
  `deriveBalance` the pure `initialBalance + net` function (callers sum movement-net + transfer-net) means no
  TXN-01/ACC-01 unit test changes are forced. `forwardRef` is the same idiom already used for movements.
- **Alternatives considered**: modeling a transfer as two linked movements with a special "transfer" type
  (rejected — pollutes the movement type/kind logic and risks counting toward income/expense); a stored
  running balance (rejected — editable source of truth, violates III); a single unified "ledger" module
  (larger refactor, no MVP benefit).

## R2 · Transfer entity & soft delete

- **Decision**: `Transfer { amount(int>0), date, fromAccountId, toAccountId, familyId, note|null, deletedAt|null, createdBy, timestamps }`. `familyId` is denormalized from the accounts' family. Deletion is a **soft
  delete** (`deletedAt`): excluded from every balance aggregation and from the transfer list, but retained for
  audit. No category and no type field (a transfer is neither income nor expense).
- **Rationale**: Parallels TXN-01's movement (soft delete keeps balances correct and the row for audit).
  Storing `familyId` avoids a join on scoped reads/aggregations.
- **Alternatives considered**: hard delete (loses the row); deriving `familyId` per query (extra lookups).

## R3 · Audit trail (`TransferEvent`, append-only)

- **Decision**: Every create/edit/delete appends a `TransferEvent { transferId, familyId, actorId, type(created|updated|deleted), snapshot{amount,date,fromAccountId,toAccountId,note}, createdAt }`. Never updated
  or deleted, so the trail survives the transfer's soft deletion (FR-011). Identical shape to TXN-01's
  `MovementEvent`.
- **Rationale**: Financial edits must be auditable — who, when, what change, resulting state.
- **Alternatives considered**: actor+timestamp only (weaker); field-level diffs (heavier than a snapshot).

## R4 · Validation & integrity

- **Decision**: On create/edit, validate against the **session family**: both `fromAccountId` and
  `toAccountId` resolve via `FinancialAccountRepository.findInFamily` and are **active** (`archivedAt: null`),
  and `fromAccountId ≠ toAccountId`; otherwise **400** (covers foreign/archived accounts and same-account
  without leaking existence). No category/kind checks (transfers are uncategorized).
- **Rationale**: Enforces isolation (I) and the transfer invariant (distinct accounts) at the write boundary.
- **Alternatives considered**: 404 for foreign account refs (they are request-body references → 400/validation
  reads more naturally); allowing origin == destination as a no-op (rejected — meaningless, likely a mistake).

## R5 · Roles, gate & validation

- **Decision**: Guard every route with `JwtAuthGuard` + `FamilyScopeGuard`; writes (create/edit/delete) add
  `EmailVerifiedGuard`, ordered **`FamilyScopeGuard` before `EmailVerifiedGuard`** (no-family → 404; 403 for
  the email gate) — the ACC-01 convention. No `FamilyRoleGuard` (any verified member). DTOs: `amount`
  `@IsInt @IsPositive`, `date` via the shared **`@IsCalendarDate`** (already in `common/validators/`),
  `note` optional trimmed ≤ 280, account ids validated in the service. Whitelist rejects unknown fields; an
  empty PATCH → 400.
- **Rationale**: Consistency with the hardened TXN-01/ACC-01 conventions.
- **Alternatives considered**: owner-only edits (rejected — any-member per the TXN-01 precedent); signed
  amounts (n/a — the from/to direction carries the sign).

## R6 · Endpoints & list

- **Decision**: `/transfers` collection, family from the session:
  `POST /transfers`, `GET /transfers` (`?account=` — transfers where the account is origin or destination;
  non-deleted, newest first), `GET /transfers/:id`, `PATCH /transfers/:id`, `DELETE /transfers/:id`
  (soft delete → 204, idempotent). `TransferSummary` returns account ids (the client resolves names from its
  loaded accounts list). Separate from the movement history (Clarify Q1).
- **Rationale**: Mirrors TXN-01's session-implicit scoping and soft-delete DELETE; the `?account` filter serves
  the common "transfers for this account" view without extra endpoints.
- **Alternatives considered**: nesting under `/accounts/{id}/transfers` (exposes a client account id as the
  scope; the family is the boundary); merging into `/movements` (rejected in Clarify Q1).

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Balance | Derived: `initial + movementNet + transferNet`; `TransferBalanceService`; accounts⇄transfers `forwardRef` — R1 |
| Entity / delete | Transfer with `familyId` denormalized; soft delete excluded from balance/list — R2 |
| Audit | Append-only `TransferEvent` (actor, type, timestamp, snapshot); survives deletion — R3 |
| Validation | Both accounts active + own; `from ≠ to`; else 400 — R4 |
| Roles/gate | Any verified member; FamilyScope before EmailVerified on writes; positive int + date validation — R5 |
| Endpoints | `/transfers` with `?account`; DELETE = soft delete; ids in summary — R6 |
