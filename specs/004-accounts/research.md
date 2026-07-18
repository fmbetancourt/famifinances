# Research: Family Financial Accounts (ACC-01)

**Feature**: ACC-01 · Accounts, types, institution label, initial balance
**Date**: 2026-07-17

All Technical Context items are resolved (the stack is inherited from AUTH-01/FAM-01). No open
`NEEDS CLARIFICATION` remain — the three spec ambiguities were closed in `/speckit-clarify` (Session
2026-07-17): negative initial balance allowed, no name uniqueness, archived accounts read-only.

## R1 · Family scoping — reuse FAM-01's `FamilyScopeGuard`/`@CurrentFamily`

- **Decision**: Guard every account route with `JwtAuthGuard` + `FamilyScopeGuard`; read the acting family
  from `@CurrentFamily()` (`{ familyId, role }`). The repository binds **every** query to that `familyId`
  (create sets it; list/get/update/archive filter by `{ _id, familyId }`), so a foreign account id resolves
  to 404 and no cross-family data is disclosed.
- **Rationale**: FAM-01 built this exact enforcement point for ACC-01/TXN-01/BUD-01 to reuse (Principle I).
  Re-deriving scope per feature would risk drift; the guard is the single boundary.
- **Alternatives considered**: a per-controller family lookup (duplicates FAM-01, drift risk); passing
  `familyId` in the request (rejected — violates Principle I).

## R2 · Roles — any verified member manages accounts (no owner-only)

- **Decision**: Do **not** apply `FamilyRoleGuard`. Any verified family member (Owner or Member) may
  create/edit/archive accounts; writes additionally require `EmailVerifiedGuard`.
- **Rationale**: PRD US-02 is written from the Integrante (member) persona ("Como integrante, quiero crear
  una cuenta"); account management is a shared family activity, unlike FAM-01's owner-only invitations.
- **Alternatives considered**: owner-only account management (rejected — contradicts the PRD persona and
  adds friction against Principle VII).

## R3 · Derived balance (Principle III)

- **Decision**: Persist only `initialBalance`. Expose the account's `balance` as a value **computed at read
  time** by `AccountsService` (a small `deriveBalance(account)` step). In ACC-01, `balance =
  initialBalance` because no movements exist yet. TXN-01 will replace the derivation with
  `initialBalance + Σ(movements for the account)` (aggregation or a maintained projection) without changing
  the account document or the contract's `balance` field.
- **Rationale**: The constitution forbids an editable stored balance as the source of truth. Computing at
  read time keeps a single source of truth (initial balance + immutable movements) and is forward-compatible
  with TXN-01. At pilot scale a per-request derivation is trivially cheap; if a hot path emerges later, a
  maintained running total is an internal optimization that does not change the contract.
- **Alternatives considered**: a stored `balance` field updated on each movement (rejected — editable
  source of truth, drift risk, violates III); computing balance only in the client (rejected — clients must
  not own financial truth; other consumers need it server-side).

## R4 · Money representation — whole-peso CLP integer

- **Decision**: Store `initialBalance` as an integer number of whole Chilean pesos (CLP has no minor unit).
  Validate with an integer check (`@IsInt`); reject fractional amounts. Values may be negative, zero, or
  positive (Clarify Q1). Currency is a fixed constant `CLP`, not a user-settable field.
- **Rationale**: CLP is a zero-decimal currency, so integer pesos avoid floating-point rounding entirely and
  match how amounts are entered. A fixed currency keeps the MVP single-currency (PRD) and the schema simple.
- **Alternatives considered**: storing minor units/cents (unnecessary for CLP, invites confusion); a
  decimal/float amount (rejected — rounding risk on money); a user-provided currency (out of MVP scope).

## R5 · Account type — closed enum; institution — free-text label

- **Decision**: `type` is a closed enum: `bank | digital_wallet | cash | credit_card` (validated
  server-side). `institution` is an **optional free-text** label (bounded length), never validated against a
  fixed list; the named banks/wallets (Santander, Banco Falabella, Mercado Pago, BCI, MACHBANK) are client
  suggestions only and imply no connection.
- **Rationale**: The four types are fixed by the PRD (RF-02) and drive future behavior (e.g., credit card),
  so a closed enum is correct. Institutions are open-ended and change often; a free-text label avoids
  maintaining an enum and matches "etiqueta manual".
- **Alternatives considered**: institution as an enum (rejected — brittle, incomplete, not required);
  free-text account type (rejected — type must be a known set for later logic).

## R6 · Lifecycle — archive/unarchive, read-only when archived, never delete

- **Decision**: Model archival with a nullable `archivedAt` timestamp (null = active). Provide explicit
  `POST /accounts/:id/archive` and `POST /accounts/:id/unarchive` actions. While `archivedAt` is set the
  account is **read-only**: create-movement (future) and edit are rejected (**409 Conflict**); only
  unarchive is allowed (Clarify Q3). There is no delete endpoint (FR-010) — archival preserves data for
  TXN-01 history integrity. Active listing excludes archived accounts by default; a `status` query
  (`active` default | `archived` | `all`) exposes them.
- **Rationale**: A nullable timestamp is the simplest reversible state and records *when* it happened for
  audit. Explicit archive/unarchive actions read more clearly than a magic PATCH flag (mirrors FAM-01's
  `POST /families/me/leave`). Read-only-when-archived keeps the derived balance unambiguous.
- **Alternatives considered**: a boolean `archived` (loses the timestamp); hard delete (rejected — breaks
  future movement history, FR-010); editing archived accounts (rejected in Clarify Q3).

## R7 · Endpoint shape & scoping

- **Decision**: Resource collection `/accounts` with the family taken from the session (never in the path):
  `POST /accounts`, `GET /accounts` (with `?status=`), `GET /accounts/:id`, `PATCH /accounts/:id`,
  `POST /accounts/:id/archive`, `POST /accounts/:id/unarchive`. `:id` is always resolved within the caller's
  family. Writes (`POST`/`PATCH`/archive/unarchive) require `EmailVerifiedGuard`; reads require only a valid
  session + family membership.
- **Rationale**: Mirrors FAM-01's session-implicit scoping (`/families/me/...`) — no family/account owner id
  is trusted from the client. `PATCH` for partial edits; sub-resource POST actions for state changes.
- **Alternatives considered**: nesting under `/families/{familyId}/accounts` (rejected — exposes a client
  family id, against Principle I); `PUT` full-replacement edits (rejected — partial edits are the common case
  and safer).

## R8 · Author & timestamps

- **Decision**: Store `createdBy` (the member's `accountId` from the session) plus `createdAt`/`updatedAt`
  (Mongoose timestamps). No separate audit-event collection in ACC-01 (unlike FAM-01's `MembershipEvent`):
  the PRD/constitution require an audit trail for **movements** (TXN-01), not for account descriptor edits;
  `updatedAt` + `createdBy` satisfy FR-014 for accounts.
- **Rationale**: Right-sized to the requirement (FR-014 asks for author + creation timestamp and
  attributable updates), avoiding premature machinery (Principle V/YAGNI). SEC-01/TXN-01 introduce the
  movement audit log where integrity truly matters.
- **Alternatives considered**: a full `AccountEvent` audit log (rejected for ACC-01 — YAGNI; movements are
  where auditability is mandated).

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Family scope | Reuse FAM-01 `FamilyScopeGuard`/`@CurrentFamily`; every query bound to session `familyId` — R1 |
| Roles | Any verified member (no owner-only); `EmailVerifiedGuard` on writes — R2 |
| Balance | Derived at read time (`initialBalance` + movements); no stored editable balance — R3 |
| Money | Whole-peso CLP integer; may be negative; fixed currency — R4 |
| Type / institution | Closed enum type; free-text institution label — R5 |
| Lifecycle | `archivedAt` nullable; archive/unarchive actions; read-only when archived; no delete — R6 |
| Endpoints | `/accounts` collection, family from session, `?status=` filter — R7 |
| Author/timestamps | `createdBy` + timestamps; no separate audit log in ACC-01 — R8 |
