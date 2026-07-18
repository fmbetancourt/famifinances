# Feature Specification: System & Family Categories (CAT-01)

**Feature Branch**: `005-categories`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "CAT-01 · Categorías de sistema y categorías de familia — a curated set of default income/expense categories available to every family, plus family-owned custom categories (create/rename/archive). Each category has a fixed kind (income or expense) so movements can be classified and the income-vs-expense integrity rule enforced later (TXN-01)."

## Clarifications

### Session 2026-07-18

- Q: Who manages the family's custom categories — owner-only or any member? → A: Any verified family member (Owner or Member) may create, rename, and archive custom categories; no owner-only restriction.
- Q: What can a family do with the system default categories? → A: System defaults are global, read-only, shared across all families; a family cannot edit, hide, archive, or delete them — it only manages its own custom categories alongside them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the family's categories (Priority: P1) 🎯 MVP

A member of a family sees the categories available for classifying money, split into **income** and
**expense** — the system defaults plus the family's own custom categories — so they can pick one when
recording a movement.

**Why this priority**: Categories are the vocabulary every movement and budget uses. A family must have a
usable set from day one (zero setup) to classify anything. This is the minimal deployable slice.

**Independent Test**: Sign in as a verified member of a brand-new family and confirm the category list is
non-empty out of the box, contains both income and expense categories, and each is labelled with its kind.

**Acceptance Scenarios**:

1. **Given** a verified member of a newly created family, **When** they list categories, **Then** they see
   a non-empty set of default categories covering both income and expense kinds, with no setup required.
2. **Given** a family with one or more custom categories, **When** a member lists categories, **Then** the
   result includes the system defaults plus that family's active custom categories, grouped by kind.
3. **Given** any category, **When** it is presented, **Then** its kind (income or expense) is shown.

---

### User Story 2 - Create a custom category (Priority: P1)

A verified member adds a category specific to their family — giving it a name and a kind (income or
expense) — so the family can classify money in ways the defaults don't cover.

**Why this priority**: Families have their own vocabulary (e.g., "Colegio", "Feria"). Custom categories are
needed alongside the defaults for the classification to be useful and adopted.

**Independent Test**: Create a custom expense category, then confirm it appears in the family's category
list under the expense kind and is available for classification.

**Acceptance Scenarios**:

1. **Given** a verified member, **When** they create a category with a name and a kind, **Then** it is
   added to their family's categories under that kind.
2. **Given** a category being created, **When** the kind is set, **Then** that kind is fixed and cannot be
   changed later.
3. **Given** an unverified member, **When** they attempt to create a category, **Then** the action is
   rejected (email-verification soft gate).
4. **Given** a create request, **When** the name is missing or the kind is not income/expense, **Then** the
   request is rejected by server-side validation.

---

### User Story 3 - Categories stay within the family boundary (Priority: P1)

A family's custom categories are visible and editable only by that family; the system defaults are shared
by everyone. The acting family is always taken from the session, never from the request.

**Why this priority**: Categories can reveal how a family spends. Applying the constitution's Family Data
Isolation principle to custom categories keeps that private, while defaults stay a shared convenience.

**Independent Test**: Create a custom category in family A; as a member of family B, confirm A's custom
category never appears in B's list and cannot be modified by B, while both families still see the shared
defaults.

**Acceptance Scenarios**:

1. **Given** a custom category owned by family A, **When** a member of family B lists or tries to modify it,
   **Then** it is neither visible to nor modifiable by family B.
2. **Given** a member of family A, **When** they list or act on categories, **Then** the acting family is
   derived from their session and any family identifier in the request is ignored.
3. **Given** the system default categories, **When** any family lists categories, **Then** those defaults
   are visible to every family (shared, read-only).

---

### User Story 4 - Rename a custom category (Priority: P2)

A verified member corrects or clarifies the name of one of their family's custom categories, so the
family's vocabulary stays accurate. The kind never changes.

**Why this priority**: Names are entered quickly and evolve; renaming keeps the set tidy. Important but not
required for the first usable slice.

**Independent Test**: Rename a family custom category and confirm the new name is shown to all members while
its kind is unchanged.

**Acceptance Scenarios**:

1. **Given** a family custom category, **When** a verified member renames it, **Then** the new name is saved
   and visible to all members, and the kind is unchanged.
2. **Given** a system default category, **When** a member attempts to rename it, **Then** the request is
   rejected (defaults are read-only).
3. **Given** a rename request, **When** the name is empty or whitespace-only, **Then** it is rejected and the
   category is unchanged.

---

### User Story 5 - Archive a custom category (Priority: P2)

A verified member archives a family custom category that is no longer used — removing it from the set
offered for new classification without deleting it — and can restore it later.

**Why this priority**: Families stop using some categories over time; archiving keeps the picker clean while
preserving history that future movements depend on. Valuable but not part of the first slice.

**Independent Test**: Archive a custom category, confirm it disappears from the active set yet remains
retrievable, and cannot be picked for a new classification; then unarchive it and confirm it returns.

**Acceptance Scenarios**:

1. **Given** an active custom category, **When** a member archives it, **Then** it is excluded from the set
   offered for new classification but its data is preserved.
2. **Given** an archived custom category, **When** a member unarchives it, **Then** it returns to the active
   set.
3. **Given** a system default category, **When** a member attempts to archive or delete it, **Then** the
   request is rejected (defaults are never removed by a family).
4. **Given** any category, **When** a member attempts to permanently delete it, **Then** there is no such
   action — custom categories are archived, defaults are immutable.

---

### Edge Cases

- **Kind integrity (constitution III)**: an income category must never be applied to an expense, nor an
  expense category to income. CAT-01 fixes each category's kind; the cross-type rejection is enforced when
  movements are recorded (TXN-01).
- **Immutable kind**: the kind cannot be changed after creation, so existing classifications never flip
  meaning.
- **Duplicate names**: a family may have a custom category whose name matches a default or another custom
  category; names are not required to be unique. (See Assumptions.)
- **System defaults are read-only for families**: rename/archive/delete of a default by a family is
  rejected. (See Assumptions.)
- **Whitespace-only name**: a name that is blank after trimming is rejected.
- **Foreign identifiers**: a family or category identifier supplied in the request is never trusted to widen
  access beyond the session's family.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an initial set of default categories covering **both** the income and
  expense kinds, available to every family with no setup.
- **FR-002**: Every category MUST have a **kind**: exactly one of **income** or **expense**.
- **FR-003**: A verified family member MUST be able to create a custom category for their family with a name
  and a kind.
- **FR-004**: A category's kind MUST be fixed at creation and MUST NOT change afterward.
- **FR-005**: A verified family member MUST be able to rename their family's custom categories; the kind is
  never affected.
- **FR-006**: A verified family member MUST be able to archive a custom category — removing it from the set
  offered for new classification without deleting its data — and MUST be able to unarchive it.
- **FR-007**: System default categories MUST be shared, read-only defaults: a family MUST NOT rename,
  archive, or delete them; families manage only their own custom categories.
- **FR-008**: A member MUST see, as their family's category set, the system defaults plus their family's own
  **active** custom categories, grouped by kind.
- **FR-009**: Every custom category MUST belong to exactly one family; access MUST be authorized against the
  family derived from the authenticated session, and another family's custom categories MUST NOT be visible
  or modifiable.
- **FR-010**: A category's kind MUST support the integrity rule that an income category applies only to
  income and an expense category only to expenses; this rule is enforced when movements are recorded
  (TXN-01), building on the kind defined here.
- **FR-011**: Creating, renaming, and archiving a category MUST require the member's email to be verified;
  unverified members MUST be blocked from these actions.
- **FR-012**: The system MUST NOT permanently delete categories; custom categories are archived, and system
  defaults are immutable — preserving referential integrity for later movement history.
- **FR-013**: All category inputs MUST be validated on the server side (name present within a bounded
  length after trimming; kind within {income, expense}).
- **FR-014**: Every custom category MUST record its author (the creating member) and creation timestamp;
  subsequent changes MUST be attributable via an update timestamp.
- **FR-015**: No category name may appear in error logs or analytics events (a category name can hint at how
  a family spends) — constitution Principle II.

### Key Entities *(include if feature involves data)*

- **Category**: A label used to classify money, carrying a fixed **kind** (income or expense). Two scopes:
  **system** (a curated default, shared read-only across all families, not owned by any family) and
  **family** (custom, owned by exactly one family, create/rename/archive by its members). Key attributes:
  name; kind; scope; owning family (for custom); archived state; author and timestamps (for custom).
- **Family** *(from FAM-01, referenced)*: The privacy boundary that owns custom categories.
- **Membership** *(from FAM-01, referenced)*: Resolves the acting family from the session; CAT-01
  authorizes custom-category access through it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member of a brand-new family sees a usable category list (defaults, both kinds) immediately,
  with zero setup.
- **SC-002**: A verified member can create a custom category and see it in the family's list, under the
  correct kind, in under 1 minute.
- **SC-003**: 100% of attempts to view or modify another family's custom categories are rejected, verified
  by cross-family authorization tests.
- **SC-004**: 100% of categories carry a kind (income or expense), and a category's kind never changes after
  creation.
- **SC-005**: 100% of attempts by a family to rename, archive, or delete a system default category are
  rejected.
- **SC-006**: 100% of create/rename requests with a missing/whitespace-only name or an invalid kind are
  rejected by server-side validation.
- **SC-007**: 100% of archived custom categories are excluded from the set offered for new classification
  while remaining retrievable; unarchiving restores them.
- **SC-008**: No category name appears in error or analytics logs across the seed, list, create, rename, and
  archive flows.

## Assumptions

- **Any verified family member** (Owner or Member) may create, rename, and archive the family's custom
  categories — consistent with ACC-01 and low-friction capture (Principle VII); resolved in Clarifications
  (Session 2026-07-18).
- **System default categories are global, shared, read-only** for families: they can be used but not
  renamed, archived, hidden, or deleted by a family. Families add their own custom categories alongside
  them. Resolved in Clarifications (Session 2026-07-18).
- **A category's kind is immutable** after creation, so existing classifications never change meaning
  (also stated as FR-004) — accepted default; not raised in clarify.
- **Category names are not required to be unique** within a family or against the defaults — accepted
  default, consistent with the ACC-01 decision; not raised in clarify.
- **Custom categories are archived, never hard-deleted** (system defaults are immutable), so future movement
  history (TXN-01) stays intact.
- **The exact default category list** is a seed detail; the spec requires only that it covers both kinds with
  a curated set suitable for Chilean households.
- **Categories are flat** (no sub-categories/hierarchy, icons, or colours) for the MVP.
- **Reuses AUTH-01** (session identity + email-verification soft gate) and **FAM-01** (the family boundary
  and session-derived family resolution) — no new isolation mechanism.

## Dependencies

- **FAM-01** — the family boundary and session-derived family resolution that custom-category access is
  authorized through. Required.
- **AUTH-01** — authenticated sessions and the email-verification soft gate. Required.

## Out of Scope

- Recording movements or applying categories to transactions, and the cross-type (income vs expense)
  enforcement at recording time (TXN-01).
- Budgets per category (BUD-01) and the dashboard (DASH-01).
- Sub-categories, hierarchies, category icons/colours, merging, or bulk re-categorization.
- Per-family customization (editing/hiding/deleting) of the system default categories.
- Permanent deletion of categories.
