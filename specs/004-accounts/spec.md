# Feature Specification: Family Financial Accounts (ACC-01)

**Feature Branch**: `004-accounts`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "ACC-01 · Cuentas, tipos, institución y saldo inicial — family financial accounts (create/edit/archive), with type, manual institution label, initial balance + start date, CLP only, and a derived (never stored-as-editable) balance."

## Clarifications

### Session 2026-07-17

- Q: Initial balance — are negative values allowed? → A: Yes — negative, zero, or positive (whole-peso CLP) for any account type; no per-type sign restriction.
- Q: Must an account name be unique within a family? → A: No — duplicate account names are allowed within the same family; no uniqueness constraint.
- Q: What can a member do with an archived account? → A: Archived accounts are read-only; the only permitted action is unarchive. Editing any field requires unarchiving first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an account (Priority: P1) 🎯 MVP

A verified member of a family creates a financial account — giving it a name, a type (bank, digital
wallet, cash, or credit card), an initial balance, and a start date (optionally tagging its institution) —
so the family can start representing where its money is.

**Why this priority**: Accounts are the container every future movement, transfer, and budget figure
references. Nothing financial can be recorded until at least one account exists. This is the minimal
deployable slice of ACC-01.

**Independent Test**: Sign in as a verified family member with no accounts, create one with a valid type,
name, initial balance, and start date, and confirm it appears in the family's account list ready to
receive movements.

**Acceptance Scenarios**:

1. **Given** a verified member of a family, **When** they create an account with a name, a type, an
   initial balance, and a start date, **Then** the account is created and available for recording
   movements.
2. **Given** a member creating an account, **When** they choose an institution (e.g., "Santander"),
   **Then** it is stored as a manual label only and implies no bank connection or data retrieval.
3. **Given** an unverified member, **When** they attempt to create an account, **Then** the action is
   rejected (email-verification soft gate).
4. **Given** a member creating an account, **When** the type is not one of the allowed types, the name is
   missing, or the amount is not a valid CLP whole-peso value, **Then** the request is rejected by
   server-side validation.

---

### User Story 2 - See the family's accounts and balances (Priority: P1)

Any member of a family sees the same list of the family's accounts, each showing its current balance, so
the whole family shares one view of where its money is.

**Why this priority**: Creating accounts is only useful if members can see them and their balances. Shared
visibility is the product's core promise; it is required for the MVP alongside US1.

**Independent Test**: With two members of the same family and one account created, confirm both members
retrieve the identical account list and the same balance for that account.

**Acceptance Scenarios**:

1. **Given** a family with one or more accounts, **When** any member lists the family's accounts, **Then**
   they see every active account with its type, institution label, and current balance.
2. **Given** an account with no movements yet, **When** a member views it, **Then** its current balance
   equals its initial balance (the balance is derived, not an editable stored figure).
3. **Given** two members of the same family, **When** each lists the accounts, **Then** both see the
   identical set of accounts and the same balances.

---

### User Story 3 - Accounts stay within the family boundary (Priority: P1)

An account belongs to exactly one family, and it is only ever visible or modifiable by that family's
members — the acting family comes from the authenticated session, never from the request.

**Why this priority**: This is the constitution's non-negotiable Family Data Isolation principle applied
to the first family-owned financial entity. Getting it right here is what makes every later financial
feature safe.

**Independent Test**: Create an account in family A; as a member of family B, attempt to view or modify it
by its identifier and confirm the request is rejected; confirm a member of A only ever sees A's accounts.

**Acceptance Scenarios**:

1. **Given** an account owned by family A, **When** a member of family B tries to read or modify it,
   **Then** the request is rejected and no data about A's account is disclosed.
2. **Given** a member of family A, **When** they list or act on accounts, **Then** the acting family is
   derived from their session membership and any family identifier supplied in the request is ignored.
3. **Given** a member who belongs to no family, **When** they attempt any account action, **Then** the
   request is rejected.

---

### User Story 4 - Edit an account (Priority: P2)

A verified member corrects an account's details — its name, type, institution label, initial balance, or
start date — so the family's records stay accurate.

**Why this priority**: Details are entered quickly and will contain mistakes; correcting them is important
but not required for the first usable slice.

**Independent Test**: Edit an existing account's name and initial balance, then confirm the changes
persist and the account's current balance reflects the new initial balance.

**Acceptance Scenarios**:

1. **Given** an existing account, **When** a verified member updates its name, type, institution, or start
   date, **Then** the changes are saved and visible to all members.
2. **Given** an account with no movements, **When** a member changes its initial balance, **Then** the
   account's current balance recomputes to the new initial balance.
3. **Given** an edit request, **When** any field fails validation (unknown type, empty name, invalid
   amount), **Then** the whole edit is rejected and the account is unchanged.

---

### User Story 5 - Archive an account (Priority: P2)

A verified member archives an account that is no longer in active use — hiding it from the active list
without deleting its data — and can restore it later.

**Why this priority**: Families close wallets and cards over time. Archiving keeps the active view clean
while preserving history that future movements depend on. Valuable but not part of the first slice.

**Independent Test**: Archive an account, confirm it disappears from the active accounts list yet remains
retrievable, and that it is unavailable for new activity; then unarchive it and confirm it returns.

**Acceptance Scenarios**:

1. **Given** an active account, **When** a member archives it, **Then** it is removed from the active
   accounts list and is no longer available for new activity, but its data is preserved.
2. **Given** an archived account, **When** a member unarchives it, **Then** it returns to the active list.
3. **Given** an archived account, **When** a member tries to edit any of its fields, **Then** the edit is
   rejected until the account is unarchived (archived accounts are read-only).
4. **Given** any account, **When** a member attempts to permanently delete it, **Then** there is no such
   action — accounts are archived, never destroyed.

---

### Edge Cases

- **Negative initial balance**: a credit-card account may start with a negative balance (representing
  debt); zero and positive balances are also valid. (See Assumptions.)
- **Duplicate names**: two accounts in the same family may share a name (e.g., two "Efectivo"); names are
  not required to be unique. (See Assumptions.)
- **Non-CLP amount**: any amount with decimals or a non-CLP currency is rejected — CLP is a whole-peso
  currency and the only supported one.
- **Archived account activity**: an archived account cannot receive new movements (when TXN-01 lands), is
  excluded from active listings until unarchived, and is **read-only** — an edit to any field is rejected
  until the account is unarchived.
- **Redundant archive/unarchive**: archiving an already-archived account, or unarchiving an already-active
  account, is **idempotent** — it is a no-op that succeeds and returns the account in its current state
  (no error).
- **Missing family**: a session whose account belongs to no family cannot create or view accounts.
- **Foreign identifiers**: a family or account identifier supplied in the request body/params is never
  trusted to widen access beyond the session's family.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A verified family member MUST be able to create an account with a name, a type, an initial
  balance, and a start date; an institution label is optional.
- **FR-002**: Account type MUST be exactly one of: **bank**, **digital wallet**, **cash**, **credit card**.
- **FR-003**: Institution MUST be an optional, user-provided free-text label (examples: Santander, Banco
  Falabella, Mercado Pago, BCI, MACHBANK); it MUST be treated as a label only and MUST NOT imply any bank
  connection, credential storage, or data retrieval.
- **FR-004**: Every account MUST use a single currency, **CLP** (whole pesos, no decimals); the system
  MUST reject any other currency or a fractional amount.
- **FR-005**: An account's current balance MUST be **derived** from its initial balance plus its movements;
  the system MUST NOT keep an editable stored balance as the source of truth. Until movements exist
  (TXN-01), the derived balance equals the initial balance.
- **FR-006**: All members of the same family MUST see the same set of the family's accounts and the same
  derived balances.
- **FR-007**: Every account MUST belong to exactly one family; access MUST be authorized against the family
  derived from the authenticated session, and any request for another family's account MUST be rejected.
- **FR-008**: A verified family member MUST be able to edit an account's name, type, institution, initial
  balance, and start date; an edit MUST recompute the derived balance.
- **FR-009**: A verified family member MUST be able to archive an account — removing it from the active
  accounts list and from new activity without deleting its data — and MUST be able to unarchive it.
- **FR-009a**: While an account is archived it MUST be read-only: the only permitted change is unarchiving
  it. Any attempt to edit an archived account's fields MUST be rejected; the member must unarchive it first.
- **FR-010**: The system MUST NOT permanently delete accounts; archival is the only removal, preserving
  data for later movement-history integrity.
- **FR-011**: Creating, editing, and archiving an account MUST require the member's email to be verified;
  unverified members MUST be blocked from these actions.
- **FR-012**: The initial balance MAY be negative (e.g., a credit card representing debt), zero, or
  positive; it MUST be a whole-peso CLP amount.
- **FR-013**: All account inputs MUST be validated on the server side (name present within a bounded
  length, type within the allowed set, amount a valid whole-peso CLP value, start date a valid calendar
  date).
- **FR-014**: Every account MUST record its author (the member who created it) and creation timestamp;
  subsequent changes MUST be attributable via an update timestamp. *(Editing `initialBalance` shifts the
  derived balance; for ACC-01 the creator + update timestamp are sufficient attribution — a full
  change-audit trail for financially significant edits arrives with SEC-01/TXN-01, where movement
  integrity is mandated. Constitution Principle III's audit clause is scoped to movements, not account
  descriptors.)*
- **FR-015**: No account name, institution, balance, or other financial figure may appear in error logs or
  analytics events.

### Key Entities *(include if feature involves data)*

- **Account**: A place where a family's money is held, owned by exactly one family. Key attributes: name;
  type (bank | digital wallet | cash | credit card); institution (optional manual label); initial balance
  (whole-peso CLP, may be negative); start date; archived state; author (creating member) and timestamps.
  Its **current balance is derived** (initial balance + movements), never stored as an editable field.
- **Family** *(from FAM-01, referenced)*: The privacy boundary that owns accounts. An account references
  the family, not an individual, so membership changes never alter account ownership.
- **Membership** *(from FAM-01, referenced)*: Resolves the acting family + role from the authenticated
  session; ACC-01 authorizes all account access through it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A verified member can create an account and see it in the family's account list in under 1
  minute.
- **SC-002**: 100% of a family's members see the same set of accounts and identical derived balances for
  the same family state.
- **SC-003**: 100% of attempts to read or modify another family's account are rejected, verified by
  cross-family authorization tests.
- **SC-004**: An account's reported balance always equals its initial balance plus its movements (equal to
  the initial balance in ACC-01), with no editable stored-balance field acting as the source of truth.
- **SC-005**: 100% of archived accounts are excluded from the active accounts list while their data
  remains retrievable, and unarchiving restores them. *(The "unavailable for new activity" clause concerns
  movements, delivered by TXN-01; in ACC-01 it is enforced structurally — archived accounts are read-only —
  and the movement-block is asserted once TXN-01 lands.)*
- **SC-006**: 100% of create/edit requests with an unknown type, a missing name, or a non-CLP/fractional
  amount are rejected by server-side validation.
- **SC-007**: No account name, institution, or monetary figure appears in error or analytics logs across
  create, edit, list, and archive flows.

## Assumptions

- **Any verified family member** (Owner or Member) may create, edit, and archive accounts — per PRD US-02
  ("Como integrante…"); there is no owner-only restriction on account management.
- **CLP is a zero-decimal currency**; balances are whole-peso integer amounts, and the app is
  single-currency for the MVP.
- **Initial balance may be negative** (credit-card debt or bank overdraft), zero, or positive, for any
  account type — resolved in Clarifications (Session 2026-07-17).
- **Account names are not required to be unique** within a family — resolved in Clarifications (Session
  2026-07-17); members distinguish accounts by type/institution.
- **Accounts are archived, never hard-deleted** (RF-02 lists create/edit/archive, not delete), so that
  future movement history (TXN-01) stays intact.
- **Start date is a calendar date** (no time-of-day component).
- **Movements do not exist yet** (delivered by TXN-01). ACC-01 MUST expose balance as a derived value so
  TXN-01 plugs in without changing the account's shape; until then the derived balance equals the initial
  balance.
- **Institution is free text**; the named banks/wallets are examples and suggestions, not an enforced
  list.
- **Reuses AUTH-01** (session identity + email-verification soft gate) and **FAM-01** (the family boundary
  and the session-derived family/role resolution) — no new isolation mechanism is introduced.

## Dependencies

- **FAM-01** — the family boundary and the session-derived family resolution that every account action is
  authorized through. Required.
- **AUTH-01** — authenticated sessions and the email-verification soft gate. Required.

## Out of Scope

- Recording movements, income, or expenses (TXN-01) and transfers between accounts (TXN-02).
- Categories (CAT-01), budgets (BUD-01), and the dashboard (DASH-01).
- Multiple currencies or currency conversion; bank synchronization or statement import.
- Permanent deletion of accounts, and any per-account permission model beyond family membership.
