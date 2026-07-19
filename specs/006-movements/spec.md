# Feature Specification: Income & Expense Movements (TXN-01)

**Feature Branch**: `006-movements`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "TXN-01 · Registro, edición e historial de ingresos y gastos — the family's financial source of truth. A verified member records income/expense movements (amount, date, account, optional category, note); the account's balance is derived from movements; income/expense category kinds must match the movement type; edits and deletions are controlled and auditable. Transfers are out of scope (TXN-02)."

## Clarifications

### Session 2026-07-18

- Q: Is a category mandatory when recording an income/expense movement? → A: No — a category is optional for both income and expense; when a category is provided, its kind must match the movement type.
- Q: Who may edit/delete a movement — author-only or any member? → A: Any verified family member may edit or delete any of the family's movements; every change is auditable (no author-only lock).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record an income or expense (Priority: P1) 🎯 MVP

A verified member records a movement — its type (income or expense), amount, date, and account (optionally a
category and a note) — and the account's balance immediately reflects it, so the family's financial picture
stays current.

**Why this priority**: Movements are the family's financial source of truth; every balance, budget, and
dashboard figure derives from them. Without recording, nothing else has data. This is the minimal deployable
slice.

**Independent Test**: With a family account present, record an expense of a given amount and confirm the
movement is created and the account's balance decreases by that amount; record an income and confirm the
balance increases.

**Acceptance Scenarios**:

1. **Given** a verified member with a family account, **When** they record an expense with an amount, a date,
   and the account, **Then** the movement is created and the account's derived balance decreases by the
   amount.
2. **Given** a verified member, **When** they record an income, **Then** the account's derived balance
   increases by the amount.
3. **Given** a movement being recorded, **When** it is saved, **Then** its author, occurrence date, and
   creation time are recorded.
4. **Given** an unverified member, **When** they attempt to record a movement, **Then** the action is
   rejected (email-verification soft gate).
5. **Given** a record request, **When** the amount is not a positive whole-peso value, the type is not
   income/expense, or the date is invalid, **Then** the request is rejected by server-side validation.

---

### User Story 2 - See the movement history (Priority: P1)

Any member sees the family's movements — most recent first — with each movement's type, amount, date,
account, category (if any), and note, so the whole family shares one record of what happened.

**Why this priority**: Recording is only useful if the family can review what was recorded. A shared,
accurate history is the core promise and is required for the MVP alongside recording.

**Independent Test**: With several movements recorded across the family's accounts, list movements and
confirm they appear newest-first with their details, identical for every family member.

**Acceptance Scenarios**:

1. **Given** recorded movements, **When** a member lists the family's movements, **Then** they see each
   movement's type, amount, date, account, category (if any), and note, most recent first.
2. **Given** two members of the same family, **When** each lists movements, **Then** both see the identical
   set and the same account balances.
3. **Given** movements across several accounts, **When** a member lists movements filtered by account or by
   type, **Then** only the matching movements are returned.

---

### User Story 3 - Family isolation & financial integrity (Priority: P1)

Movements belong to the family from the session; a movement can only reference the family's own accounts and
categories; and a category's kind must match the movement's type — an income category only on income, an
expense category only on an expense.

**Why this priority**: This is the constitution's Family Data Isolation and Derived Balance Integrity applied
to money records. Getting it right protects the numbers the family trusts and keeps families separate.

**Independent Test**: Attempt to record a movement referencing another family's account or category and
confirm rejection; attempt to record an expense with an income category and confirm rejection; confirm a
member of family B never sees family A's movements.

**Acceptance Scenarios**:

1. **Given** a member of family A, **When** they record a movement referencing an account or category that
   belongs to family B, **Then** the request is rejected.
2. **Given** an expense movement, **When** the chosen category's kind is income (or vice versa), **Then** the
   request is rejected (kind integrity).
3. **Given** a movement owned by family A, **When** a member of family B tries to view or modify it, **Then**
   the request is rejected and no data is disclosed.
4. **Given** any member, **When** they act on movements, **Then** the acting family is derived from the
   session and any family identifier in the request is ignored.

---

### User Story 4 - Edit a movement (Priority: P2)

A verified member corrects a movement — its amount, type, date, account, category, or note — subject to the
same validation, so the family's records stay accurate; every edit is auditable.

**Why this priority**: Movements are entered quickly and will contain mistakes; correcting them keeps the
numbers trustworthy. Important but not required for the first usable slice.

**Independent Test**: Edit a movement's amount and confirm the affected account's balance recomputes; confirm
an audit record of the edit exists with its author and time.

**Acceptance Scenarios**:

1. **Given** an existing movement, **When** a verified member changes its amount, **Then** the affected
   account's balance recomputes accordingly.
2. **Given** an edit that changes the account or type, **When** it is saved, **Then** the balances of the
   affected accounts and the income/expense totals recompute correctly, and any category kind is re-checked
   against the new type.
3. **Given** an edit, **When** it fails validation (bad amount, kind mismatch, foreign account/category),
   **Then** the whole edit is rejected and the movement is unchanged.
4. **Given** an edit is applied, **When** it completes, **Then** an audit record captures the change with its
   author and timestamp.

---

### User Story 5 - Delete a movement (Priority: P2)

A verified member deletes a movement that should not have been recorded; it no longer affects any balance or
appears in history, but the deletion is auditable and the audit trail is preserved.

**Why this priority**: Erroneous or duplicate entries must be removable to keep balances correct. Valuable
but not part of the first slice.

**Independent Test**: Delete a movement and confirm the account's balance no longer includes it and it is
absent from history, while an audit record of the deletion (author + time) remains.

**Acceptance Scenarios**:

1. **Given** an existing movement, **When** a verified member deletes it, **Then** it is excluded from the
   account's balance and from the movement history.
2. **Given** a deleted movement, **When** the family reviews the audit trail, **Then** a record of the
   deletion with its author and timestamp is preserved (the audit is not lost).
3. **Given** a member of another family, **When** they attempt to delete a movement they do not own, **Then**
   the request is rejected.

---

### Edge Cases

- **Kind integrity**: an income category on an expense (or vice versa) is rejected. When a category is
  omitted, no kind check applies (see Assumptions on optional category).
- **Positive amount**: a zero or negative amount is rejected; the movement type (income/expense), not the
  sign, determines the effect on the balance.
- **Foreign references**: an account or category id from another family (or an unknown id) is rejected; the
  family always comes from the session.
- **Archived account/category**: recording against an archived account or an archived custom category is
  rejected (they are not available for new activity — ACC-01/CAT-01).
- **Deleted movement**: excluded from balances and history; its audit record survives.
- **Edit that moves an account**: both the old and new account balances recompute.
- **No double counting**: an income movement affects income totals only; an expense affects expense totals
  only (transfers, which touch two accounts without changing totals, are TXN-02).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A verified family member MUST be able to record a movement of type **income** or **expense**
  with an amount, an occurrence date, and an account; a category and a note are optional.
- **FR-002**: The amount MUST be a **positive** whole-peso CLP value (greater than zero); the type — not the
  sign — determines the effect on the balance.
- **FR-003**: A movement's account MUST belong to the caller's family and MUST be active (not archived); an
  account from another family or an archived account MUST be rejected.
- **FR-004**: If a category is provided, it MUST be visible to the caller's family (a system default or the
  family's own custom, and not archived) and its **kind MUST match** the movement type — an income category
  only on income, an expense category only on expense; a mismatch MUST be rejected.
- **FR-005**: An account's balance MUST be derived as its initial balance **plus** recorded income **minus**
  recorded expense (excluding deleted movements); the balance MUST reflect a new movement immediately for the
  recording member (on the next read).
- **FR-006**: Every movement MUST record its author, its occurrence date, and its creation timestamp.
- **FR-007**: All members of the same family MUST see the same movements and the same derived balances.
- **FR-008**: A member MUST be able to view the family's movement history, most recent first, showing each
  movement's type, amount, date, account, category (if any), and note; the history MUST be filterable at
  least by account and by type.
- **FR-009**: A verified family member MUST be able to edit a movement's amount, type, date, account,
  category, and note, subject to the same validation (FR-002–FR-004); edits recompute the affected balances.
- **FR-010**: A verified family member MUST be able to delete a movement; a deleted movement MUST be excluded
  from all balances and from history.
- **FR-011**: Every movement change — create, edit, delete — MUST be recorded in an append-only audit log
  with its author, change type, and timestamp; the audit record MUST survive the movement's deletion.
- **FR-012**: Recording, editing, and deleting a movement MUST require the member's email to be verified;
  unverified members MUST be blocked.
- **FR-013**: Every movement MUST belong to exactly one family; access MUST be authorized against the family
  derived from the session, and another family's movements MUST NOT be visible or modifiable.
- **FR-014**: An income movement MUST affect only income totals and an expense movement only expense totals
  (no double counting); balancing across two accounts without changing totals is out of scope (TXN-02).
- **FR-015**: All movement inputs MUST be validated on the server side (type in {income, expense}, amount a
  positive whole-peso integer, a valid occurrence date, and account/category ownership + kind match).
- **FR-016**: No monetary amount or note content may appear in error logs or analytics events (Principle II).

### Key Entities *(include if feature involves data)*

- **Movement**: A recorded income or expense, owned by exactly one family. Key attributes: type (income |
  expense); amount (positive whole-peso CLP); occurrence date; the account it affects; an optional category
  (whose kind matches the type); an optional note; author; deleted state; timestamps. Its effect on an
  account's balance is +amount for income, −amount for expense.
- **Movement Audit Record**: An append-only entry for each movement change (created, edited, deleted), with
  the affected family, the movement, the actor, the change type, and a timestamp. Never updated or deleted,
  so a movement's history survives its deletion.
- **Account** *(from ACC-01, referenced)*: The movement's account; its derived balance now sums movements.
- **Category** *(from CAT-01, referenced)*: The movement's optional classification; its kind must match the
  movement type.
- **Family / Membership** *(from FAM-01, referenced)*: The privacy boundary and the session-derived family
  that authorizes all movement access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A verified member can record a movement in under 1 minute (few-step fast capture).
- **SC-002**: After a movement is recorded, edited, or deleted, the affected account's balance reflects it on
  the next read 100% of the time (balance = initial + income − expense, excluding deleted).
- **SC-003**: 100% of attempts to use a category whose kind does not match the movement type are rejected.
- **SC-004**: 100% of attempts to record or edit a movement against another family's (or an archived)
  account or category are rejected.
- **SC-005**: 100% of attempts to view or modify another family's movements are rejected.
- **SC-006**: Every movement create/edit/delete leaves an audit record with its author and timestamp, and the
  record survives the movement's deletion.
- **SC-007**: A deleted movement is excluded from balances and from history 100% of the time.
- **SC-008**: 100% of movements with a non-positive amount, an invalid type, or an invalid date are rejected
  by validation.
- **SC-009**: No monetary amount or note appears in error or analytics logs across record/list/edit/delete.

## Assumptions

- **Category is optional** on an income/expense movement (to support fast capture, Principle VII, and the
  PRD's ~90% coverage goal rather than 100%); when a category is provided, its kind must match the type.
  Resolved in Clarifications (Session 2026-07-18).
- **Any verified family member** may edit and delete any of the family's movements (shared family finances),
  each change auditable — consistent with ACC-01/CAT-01; resolved in Clarifications (Session 2026-07-18).
- **Amount is a positive whole-peso CLP integer** (> 0); the type carries the direction. Single currency CLP.
- **Occurrence date** is a calendar date; past and present dates are allowed (no future-date restriction is
  imposed in the MVP).
- **Deletion is auditable and reversible in the record** (the movement is retained for audit but excluded
  from balances/history); no user-facing "trash/restore" is offered in this feature.
- **Transfers are out of scope** (TXN-02); TXN-01 covers income and expense only.
- **Balance is derived** (extends ACC-01's derived balance to sum movements); no stored editable balance.
- **Reuses AUTH-01** (verified gate), **FAM-01** (family boundary), **ACC-01** (accounts + derived balance),
  and **CAT-01** (categories + kind) — no new isolation mechanism.

## Dependencies

- **FAM-01** — the family boundary and session-derived family resolution. Required.
- **AUTH-01** — authenticated sessions and the email-verification soft gate. Required.
- **ACC-01** — accounts; TXN-01 extends the derived balance to sum movements. Required.
- **CAT-01** — categories and their immutable kind, used for kind-integrity. Required.

## Out of Scope

- Transfers between accounts (TXN-02) and their no-double-counting balancing.
- Budgets per category (BUD-01) and the dashboard (DASH-01).
- Rich history filtering and movement-detail views beyond account/type filters (HIS-01).
- Recurring/scheduled/future-dated movements, attachments/receipts, and bulk import (IMP-01).
- Multiple currencies or currency conversion.
