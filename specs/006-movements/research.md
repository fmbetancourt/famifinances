# Research: Income & Expense Movements (TXN-01)

**Feature**: TXN-01 · Record, edit, and history of income and expense movements
**Date**: 2026-07-18

The stack is inherited from AUTH-01/FAM-01/ACC-01/CAT-01. No open `NEEDS CLARIFICATION` remain — the two
ambiguities were closed in `/speckit-clarify` (Session 2026-07-18): a category is optional (kind-checked when
present); any verified member may edit/delete (auditable).

## R1 · Derived balance & the accounts⇄movements coupling

- **Decision**: The account balance stays an Account concern but sums movements pulled from the movements
  module. TXN-01 adds a small **`MovementBalanceService`** (exported by `MovementsModule`) with
  `netForAccount(familyId, accountId)` and `netByFamily(familyId)` backed by a Mongo aggregation
  (`$match { familyId, deletedAt: null }` → `$group by accountId` summing `+amount` for income, `−amount` for
  expense). ACC-01's `FinancialAccountsService.deriveBalance` becomes `initialBalance + net`. Movements
  validate the referenced account via ACC-01's `FinancialAccountRepository`. The mutual module dependency
  (accounts need sums; movements need account validation) is resolved with a scoped **`forwardRef`** between
  `FinancialAccountsModule` and `MovementsModule`.
- **Rationale**: Balance remains **derived** (Principle III) — only `initialBalance` and immutable movements
  are stored; no editable stored balance. Keeping the derivation in ACC keeps the account contract stable
  (`balance` field unchanged from ACC-01). A single grouped aggregation for the whole family serves the
  account list in one query (efficient at pilot scale). `forwardRef` is the idiomatic NestJS way to express a
  genuinely bidirectional domain relationship without new infrastructure.
- **Alternatives considered**: a stored running balance updated per movement (rejected — editable source of
  truth, drift, violates III); a third "balances" module owning both (more coupling, no benefit); computing
  balance only in movements and duplicating it into accounts (breaks the single ACC `balance` contract).

## R2 · Movement entity & soft delete

- **Decision**: `Movement { type(income|expense), amount(int>0), date(occurrence), accountId, familyId, categoryId|null, note|null, deletedAt|null, createdBy, timestamps }`. Deletion is a **soft delete** (`deletedAt`
  set): the row is retained but excluded from every balance aggregation and from history. `familyId` is stored
  on the movement (denormalized from the account's family) so scoping + aggregation are a direct indexed query.
- **Rationale**: Soft delete keeps balances correct (deleted movements are simply not matched) while retaining
  the row for reference alongside its audit record (FR-010/FR-011). Storing `familyId` on the movement avoids a
  join to the account on every scoped read/aggregation.
- **Alternatives considered**: hard delete + snapshot-only audit (loses the row; harder to reason about);
  deriving `familyId` via the account each query (extra lookups, no benefit).

## R3 · Audit trail (`MovementEvent`, append-only)

- **Decision**: Every create/edit/delete appends a `MovementEvent { movementId, familyId, actorId, type(created|updated|deleted), snapshot, createdAt }`, where `snapshot` captures the movement's key fields
  (type, amount, date, accountId, categoryId, note) at the time of the event. It is never updated or deleted,
  so the trail survives the movement's (soft) deletion (FR-011, SC-006). Mirrors FAM-01's `MembershipEvent`.
- **Rationale**: Financial edits must be auditable — recording *who*, *when*, *what change*, and *the resulting
  state* lets the family reconstruct history. A snapshot is cheap at pilot scale and materially stronger than
  actor+timestamp alone.
- **Alternatives considered**: actor+timestamp only (weaker — can't see what changed); full field-level diffs
  (heavier; a snapshot per event is sufficient for the MVP).

## R4 · Reference validation & kind integrity (Principle III)

- **Decision**: On create/edit, the service validates references against the **session family**:
  - Account: `FinancialAccountRepository.findInFamily(familyId, accountId)` must exist and be **active**
    (`archivedAt: null`); otherwise **400** ("account not available") — this also covers foreign/archived
    accounts without leaking existence.
  - Category (optional): if provided, `CategoryRepository.findVisible(familyId, categoryId)` must exist, be
    **active** (custom archived → rejected), and its **`kind` must equal the movement `type`**; otherwise
    **400** ("category not available" / "category kind does not match movement type").
- **Rationale**: Enforces isolation (Principle I) and kind integrity (Principle III) at the write boundary; a
  400 on a body reference is validation (doesn't disclose cross-family existence). Reuses the existing
  family-scoped repositories rather than re-deriving scope.
- **Alternatives considered**: 404 for foreign references (they are request-body references, so 400/validation
  reads more naturally); enforcing kind in the DB (can't — cross-collection rule belongs in the service).

## R5 · Roles, gate & validation

- **Decision**: Guard every route with `JwtAuthGuard` + `FamilyScopeGuard`; writes (create/edit/delete) add
  `EmailVerifiedGuard`, ordered **`FamilyScopeGuard` before `EmailVerifiedGuard`** (no-family → 404; 403 for
  the email gate) — the ACC-01 convention. No `FamilyRoleGuard` (any verified member — Clarify Q2). DTOs:
  `type` enum, `amount` `@IsInt @IsPositive`, `date` via the shared **`@IsCalendarDate`** (moved to
  `common/validators/`), `note` optional trimmed ≤ 280, `accountId`/`categoryId` id strings validated in the
  service. Whitelist rejects unknown fields.
- **Rationale**: Consistency with the hardened ACC-01/CAT-01 conventions; the clarify decision removes the role
  gate. Moving `@IsCalendarDate` to `common/` avoids cross-feature dto imports.
- **Alternatives considered**: owner-only edits (rejected in Clarify Q2); storing a signed amount (rejected —
  the type carries direction; a positive magnitude is clearer and avoids sign bugs).

## R6 · Endpoints & history

- **Decision**: `/movements` collection, family from the session:
  `POST /movements`, `GET /movements` (`?account=`, `?type=`; non-deleted, newest first),
  `GET /movements/:id`, `PATCH /movements/:id` (partial edit), `DELETE /movements/:id` (soft delete → 204).
  History returns `MovementSummary` (ids for account/category; the client resolves names from its loaded
  lists). Rich filters (period ranges, category, text) and detail views are HIS-01.
- **Rationale**: Mirrors ACC-01/CAT-01 session-implicit scoping; `DELETE` is appropriate here (movements are
  deletable, unlike archive-only accounts/categories) and is soft under the hood. Account/type filters cover
  TXN-01's history needs; HIS-01 extends them.
- **Alternatives considered**: nesting under `/accounts/{id}/movements` (exposes a client account id as the
  scope; the account is a filter, not the boundary — the family is); denormalizing account/category names into
  the response (join cost; deferred — the client already holds those lists).

## R7 · Amount & date representation

- **Decision**: `amount` is a positive whole-peso CLP integer (> 0); `date` is a calendar date (`YYYY-MM-DD`)
  validated by the shared `@IsCalendarDate`; both past and present dates allowed (no future restriction in the
  MVP). Effect on balance: `+amount` (income), `−amount` (expense).
- **Rationale**: Matches ACC-01's whole-peso CLP integers (no float rounding) and CAT-01/date-only handling;
  the type carries direction so amounts are always positive magnitudes.
- **Alternatives considered**: signed amounts (sign/type redundancy, bug-prone); minor units/cents (unneeded
  for CLP).

## Default / shared changes

- Move `IsCalendarDate` from `financial-accounts/dto/` to `common/validators/`; update the ACC-01 DTO imports.
- Export `FinancialAccountRepository` from `FinancialAccountsModule` and `CategoryRepository` from
  `CategoriesModule` so movements can validate references.

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Balance | Derived: `initial + Σ income − Σ expense` via `MovementBalanceService`; accounts⇄movements `forwardRef` — R1 |
| Entity / delete | Movement with `familyId` denormalized; soft delete (`deletedAt`) excluded from balance/history — R2 |
| Audit | Append-only `MovementEvent` (actor, type, timestamp, snapshot); survives deletion — R3 |
| Validation | Account active + own; category visible + active + kind==type; else 400 — R4 |
| Roles/gate | Any verified member; FamilyScope before EmailVerified on writes; positive int + date validation — R5 |
| Endpoints | `/movements` with `?account`/`?type`; DELETE = soft delete; ids in summary — R6 |
| Amount/date | Positive whole-peso CLP int; date-only; income +, expense − — R7 |
