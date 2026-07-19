# Feature Specification: Transfers Between Accounts (TXN-02)

**Feature Branch**: `007-transfers`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "TXN-02 · Transferencias entre cuentas — move money between two of the family's accounts. A transfer decreases the origin account and increases the destination by the same amount, and MUST NOT change income or expense totals (no double counting). Transfers are recorded, edited, deleted, and listed, with an auditable trail, building on TXN-01's movements/balance patterns."

## Clarifications

### Session 2026-07-18

- Q: Do transfers appear only in a separate list, or also in the movement history? → A: A separate `/transfers` list only; the TXN-01 movement history (`GET /movements`) is unchanged, and a unified movements+transfers timeline is deferred to DASH-01/HIS-01.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a transfer (Priority: P1) 🎯 MVP

A verified member records a transfer between two of the family's accounts — an amount, a date, an origin
account and a destination account (optionally a note) — and both balances update: the origin decreases and
the destination increases by the same amount, without changing income or expense totals.

**Why this priority**: Families move money between accounts (e.g., cash → wallet, bank → credit card).
Without transfers, such moves would be mis-recorded as an expense on one account and an income on another,
double-counting the family's income/expense figures. This is the minimal deployable slice.

**Independent Test**: With two family accounts (origin balance O, destination balance D), record a transfer
of A → the origin becomes O−A and the destination becomes D+A, and the family's total income and total
expense are unchanged.

**Acceptance Scenarios**:

1. **Given** a verified member with two family accounts, **When** they record a transfer of an amount from
   the origin to the destination, **Then** the origin balance decreases by the amount and the destination
   balance increases by the same amount.
2. **Given** a recorded transfer, **When** the family's income and expense totals are computed, **Then** the
   transfer does not appear in either total (it is neither income nor expense).
3. **Given** a transfer being recorded, **When** it is saved, **Then** its author, occurrence date, and
   creation time are recorded.
4. **Given** an unverified member, **When** they attempt to record a transfer, **Then** the action is
   rejected (email-verification soft gate).
5. **Given** a transfer request, **When** the amount is not a positive whole-peso value, the date is invalid,
   or the origin equals the destination, **Then** the request is rejected by server-side validation.

---

### User Story 2 - See the family's transfers (Priority: P1)

Any member sees the family's transfers — most recent first — with each transfer's amount, date, origin
account, destination account, and note, so the whole family shares one record of money moved between
accounts.

**Why this priority**: Recording is only useful if the family can review it; a shared, accurate transfer
list is required for the MVP alongside recording, and it keeps transfers visibly distinct from
income/expense movements.

**Independent Test**: With several transfers recorded, list them and confirm they appear newest-first with
their origin/destination/amount/date, identical for every family member.

**Acceptance Scenarios**:

1. **Given** recorded transfers, **When** a member lists the family's transfers, **Then** they see each
   transfer's amount, date, origin account, destination account, and note, most recent first.
2. **Given** two members of the same family, **When** each lists transfers, **Then** both see the identical
   set and the same account balances.

---

### User Story 3 - Family isolation & no double counting (Priority: P1)

A transfer belongs to the family from the session; both accounts must be the family's own active accounts and
must be different; and a transfer never counts as income or expense.

**Why this priority**: This applies the constitution's Family Data Isolation and Derived Balance Integrity to
inter-account moves — protecting the numbers the family trusts and keeping families separate.

**Independent Test**: Attempt to transfer using another family's account, or with the same account as origin
and destination, and confirm rejection; confirm a member of family B never sees family A's transfers; confirm
income/expense totals are unaffected by transfers.

**Acceptance Scenarios**:

1. **Given** a member of family A, **When** they record a transfer whose origin or destination belongs to
   family B (or is archived), **Then** the request is rejected.
2. **Given** a transfer request, **When** the origin account equals the destination account, **Then** the
   request is rejected.
3. **Given** a transfer owned by family A, **When** a member of family B tries to view or modify it, **Then**
   the request is rejected and no data is disclosed.
4. **Given** transfers exist, **When** the family's income and expense totals are computed, **Then** they are
   unchanged by any transfer (no double counting).

---

### User Story 4 - Edit a transfer (Priority: P2)

A verified member corrects a transfer — its amount, date, origin, destination, or note — subject to the same
validation, so balances stay accurate; every edit is auditable.

**Why this priority**: Transfers are entered quickly and will contain mistakes; correcting them keeps the
numbers trustworthy. Important but not required for the first slice.

**Independent Test**: Edit a transfer's amount and confirm both affected account balances recompute; confirm
an audit record of the edit exists.

**Acceptance Scenarios**:

1. **Given** an existing transfer, **When** a verified member changes its amount, **Then** the origin and
   destination balances recompute accordingly.
2. **Given** an edit that changes an account, **When** it is saved, **Then** the balances of all affected
   accounts (old and new origin/destination) recompute correctly.
3. **Given** an edit, **When** it fails validation (bad amount, same account, foreign/archived account),
   **Then** the whole edit is rejected and the transfer is unchanged.
4. **Given** an edit is applied, **When** it completes, **Then** an audit record captures the change with its
   author and timestamp.

---

### User Story 5 - Delete a transfer (Priority: P2)

A verified member deletes a transfer that should not have been recorded; it no longer affects any balance or
appears in the transfer list, but the deletion is auditable and the audit trail is preserved.

**Why this priority**: Erroneous or duplicate transfers must be removable to keep balances correct. Valuable
but not part of the first slice.

**Independent Test**: Delete a transfer and confirm both account balances no longer include it and it is
absent from the transfer list, while an audit record of the deletion remains.

**Acceptance Scenarios**:

1. **Given** an existing transfer, **When** a verified member deletes it, **Then** it is excluded from both
   account balances and from the transfer list.
2. **Given** a deleted transfer, **When** the family reviews the audit trail, **Then** a record of the
   deletion with its author and timestamp is preserved.
3. **Given** a member of another family, **When** they attempt to delete a transfer they do not own, **Then**
   the request is rejected.

---

### Edge Cases

- **Same account**: a transfer whose origin equals its destination is rejected.
- **Positive amount**: a zero or negative amount is rejected.
- **Foreign / archived account**: an origin or destination from another family, or an archived account, is
  rejected; the family always comes from the session.
- **No double counting**: a transfer affects only the two account balances (origin −, destination +), never
  income or expense totals.
- **Deleted transfer**: excluded from both balances and the list; its audit record survives.
- **Edit that moves an account**: the old and new origin/destination balances all recompute.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A verified family member MUST be able to record a transfer with an amount, an occurrence date,
  an origin account, and a destination account; a note is optional.
- **FR-002**: The amount MUST be a **positive** whole-peso CLP value (greater than zero).
- **FR-003**: The origin and destination MUST both be **active** accounts of the caller's family and MUST be
  **different**; an account from another family, an archived account, or origin == destination MUST be
  rejected.
- **FR-004**: A transfer MUST decrease the origin account's balance by the amount and increase the
  destination account's balance by the same amount.
- **FR-005**: A transfer MUST NOT change the family's income or expense totals (no double counting); it is
  neither an income nor an expense and is not categorized.
- **FR-006**: Every transfer MUST record its author, its occurrence date, and its creation timestamp.
- **FR-007**: All members of the same family MUST see the same transfers and the same derived balances.
- **FR-008**: A member MUST be able to view the family's transfers, most recent first, showing each
  transfer's amount, date, origin account, destination account, and note.
- **FR-009**: A verified family member MUST be able to edit a transfer's amount, date, origin, destination,
  and note, subject to the same validation; edits recompute the affected account balances.
- **FR-010**: A verified family member MUST be able to delete a transfer; a deleted transfer MUST be excluded
  from all balances and from the transfer list.
- **FR-011**: Every transfer change — create, edit, delete — MUST be recorded in an append-only audit log
  with its author, change type, and timestamp; the audit record MUST survive the transfer's deletion.
- **FR-012**: Recording, editing, and deleting a transfer MUST require the member's email to be verified;
  unverified members MUST be blocked.
- **FR-013**: Every transfer MUST belong to exactly one family; access MUST be authorized against the family
  derived from the session, and another family's transfers MUST NOT be visible or modifiable.
- **FR-014**: All transfer inputs MUST be validated on the server side (amount a positive whole-peso integer,
  a valid occurrence date, origin/destination ownership + active, origin ≠ destination).
- **FR-015**: No monetary amount or note content may appear in error logs or analytics events (Principle II).

### Key Entities *(include if feature involves data)*

- **Transfer**: A movement of money between two of the family's accounts, owned by exactly one family. Key
  attributes: amount (positive whole-peso CLP); occurrence date; origin account; destination account (≠
  origin); an optional note; author; deleted state; timestamps. Its effect on balances is −amount on the
  origin and +amount on the destination; it never affects income/expense totals.
- **Transfer Audit Record**: An append-only entry for each transfer change (created, edited, deleted), with
  the affected family, the transfer, the actor, the change type, and a timestamp. Never updated or deleted,
  so a transfer's history survives its deletion.
- **Account** *(from ACC-01, referenced)*: The origin/destination; its derived balance now also sums
  transfers (−out, +in) alongside income/expense movements.
- **Family / Membership** *(from FAM-01, referenced)*: The privacy boundary and session-derived family that
  authorizes all transfer access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A verified member can record a transfer in under 1 minute (few-step fast capture).
- **SC-002**: After a transfer of amount A, the origin balance is its previous value − A and the destination
  is its previous value + A, on the next read, 100% of the time.
- **SC-003**: 100% of transfers leave the family's total income and total expense unchanged (no double
  counting), verified by comparing totals before and after.
- **SC-004**: 100% of attempts to transfer using another family's or an archived account, or with origin ==
  destination, are rejected.
- **SC-005**: 100% of attempts to view or modify another family's transfers are rejected.
- **SC-006**: Every transfer create/edit/delete leaves an audit record with its author and timestamp, and the
  record survives the transfer's deletion.
- **SC-007**: A deleted transfer is excluded from both account balances and from the transfer list 100% of
  the time.
- **SC-008**: 100% of transfers with a non-positive amount, an invalid date, or origin == destination are
  rejected by validation.
- **SC-009**: No monetary amount or note appears in error or analytics logs across record/list/edit/delete.

## Assumptions

- **Any verified family member** may record, edit, and delete any of the family's transfers (shared family
  finances), each change auditable — consistent with TXN-01 and ACC-01/CAT-01.
- **Amount is a positive whole-peso CLP integer** (> 0). Single currency CLP; both accounts share the same
  currency (CLP), so no conversion is involved.
- **Occurrence date** is a calendar date; past and present dates are allowed (no future-date restriction).
- **Transfers are listed separately** from income/expense movements (a distinct `transfers` list); the TXN-01
  movement history is unchanged, and a unified timeline of movements + transfers is a dashboard/history
  concern (DASH-01/HIS-01). Resolved in Clarifications (Session 2026-07-18).
- **Deletion is soft** (the transfer is retained for audit but excluded from balances/list); no user-facing
  trash/restore is offered.
- **Balance is derived** (extends the ACC-01/TXN-01 derived balance to also sum transfers: −out, +in); no
  stored editable balance.
- **Reuses AUTH-01** (verified gate), **FAM-01** (family boundary), **ACC-01** (accounts + derived balance),
  and the **TXN-01** patterns (soft delete, append-only audit) — no new isolation mechanism.

## Dependencies

- **FAM-01** — the family boundary and session-derived family resolution. Required.
- **AUTH-01** — authenticated sessions and the email-verification soft gate. Required.
- **ACC-01** — accounts; TXN-02 extends the derived balance to sum transfers. Required.
- **TXN-01** — the movements + derived-balance + audit patterns TXN-02 builds on (income/expense totals must
  stay unaffected by transfers). Required.

## Out of Scope

- Income and expense movements (TXN-01) — transfers are a distinct record type.
- Budgets (BUD-01), the dashboard estimated-vs-real (DASH-01), and rich history filters / unified timeline
  (HIS-01).
- Transfers across different currencies or currency conversion (single-currency CLP MVP).
- Recurring/scheduled transfers, attachments, and bulk import.
