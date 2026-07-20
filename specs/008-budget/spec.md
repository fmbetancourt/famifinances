# Feature Specification: Monthly & Per-Category Budget (BUD-01)

**Feature Branch**: `008-budget`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "BUD-01 · Presupuesto mensual y por categoría — a family plans its monthly spending by allocating a planned amount to each expense category for a month, and the app compares planned vs real spend (from TXN-01 expense movements), the available amount, and the percent consumed, highlighting categories over or near their limit. Budgets are for expense categories only. Built on FAM-01/AUTH-01/CAT-01/TXN-01."

## Clarifications

### Session 2026-07-19

- Q: Is budget management owner-only or any verified member? → A: Owner-only — only the family's Owner may create, update, or remove budget allocations; any verified member may view the budget report (the PRD's US-05 is framed "Como owner", unlike accounts/movements).
- Q: Is the monthly total an independent cap or the sum of per-category allocations? → A: The sum of the per-category allocations — there is no independent overall cap and no "unallocated" bucket; the overall summary aggregates the category lines.
- Q: Do the US1/US4 narratives say a "member" or the "Owner" manages the budget? → A: The **Owner** — the US1/US4 story text and acceptance scenarios are normalized to the family's Owner (management is owner-only; viewing stays any-member).
- Q: Does a budget report line carry the allocation id? → A: Yes — each `BudgetLine` includes its `budgetId` so a member can drive `DELETE /budgets/{budgetId}` from the report.
- Q: Are the BUD-01 mobile screens in scope for this slice? → A: Deferred — this vertical slice ships the `/budgets` API + shared contracts; the mobile budget screens are a later mobile track (status is surfaced as data for the client to render).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plan a category's monthly budget (Priority: P1) 🎯 MVP

The family's Owner (verified) sets a planned amount for an expense category for a given month (for example,
"Alimentación → 200.000 for July 2026"), so the family has a spending plan to measure against.

**Why this priority**: A budget is the plan every comparison is measured against; without setting
allocations there is nothing to compare real spend to. This is the minimal deployable slice.

**Independent Test**: As the Owner, for the current month, set a planned amount on an expense category and
confirm it is saved and appears in the month's budget with that planned amount.

**Acceptance Scenarios**:

1. **Given** the family's verified Owner, **When** they set a planned amount for an expense category for a
   month, **Then** the allocation is saved for that (month, category).
2. **Given** an allocation already exists for a (month, category), **When** the Owner sets it again with a
   new amount, **Then** the existing allocation is updated (one allocation per month + category).
3. **Given** the Owner setting an allocation, **When** the chosen category is an income category (or a
   foreign/archived category), **Then** the request is rejected — only the family's expense categories can be
   budgeted.
4. **Given** an unverified Owner, **When** they attempt to set a budget, **Then** the action is rejected
   (email-verification soft gate).
5. **Given** a non-owner member, **When** they attempt to set/remove a budget, **Then** the action is
   rejected (owner-only); they may still view the report.
6. **Given** a set request, **When** the amount is not a positive whole-peso value or the month is invalid,
   **Then** the request is rejected by server-side validation.

---

### User Story 2 - See the month's budget vs real spend (Priority: P1)

Any member views the month's budget report — for each budgeted category, the planned amount, the real spend,
the remaining available amount, and the percent consumed, plus an overall summary — so the family sees at a
glance where it stands against its plan.

**Why this priority**: Comparing planned vs real is the core value of the feature; the plan is only useful
when measured against actual spending. Required for the MVP alongside setting allocations.

**Independent Test**: With a category budgeted at 200.000 and expense movements totalling 120.000 in that
category for the month, confirm the report shows planned 200.000, real 120.000, available 80.000, and 60%
consumed, and that the overall summary sums the categories.

**Acceptance Scenarios**:

1. **Given** budgeted categories with expense movements in the month, **When** a member views the budget
   report for that month, **Then** each category shows planned, real spend, available (planned − real), and
   percent consumed, computed from the month's expense movements.
2. **Given** the report, **When** it is presented, **Then** an overall summary shows total planned, total real
   spend, total available, and overall percent consumed.
3. **Given** a category whose real spend exceeds its planned amount, **When** the report is shown, **Then**
   that category is flagged **over** its limit; one at or above the near-limit threshold is flagged **near**;
   otherwise **under**.
4. **Given** a category with a budget but no movements yet, **When** the report is shown, **Then** its real
   spend is 0, available equals planned, and 0% is consumed.

---

### User Story 3 - Budgets stay within the family & only expense categories (Priority: P1)

A budget belongs to the family from the session; only the family's own expense categories can be budgeted;
another family's budget is never visible or modifiable.

**Why this priority**: This applies the constitution's Family Data Isolation and the income-vs-expense
integrity (only expenses are budgeted) to the budget, protecting the family's private planning.

**Independent Test**: Create a budget in family A; as a member of family B, confirm A's budget is not visible
and cannot be modified; confirm budgeting an income category is rejected.

**Acceptance Scenarios**:

1. **Given** a budget owned by family A, **When** a member of family B views or tries to modify it, **Then**
   it is neither visible to nor modifiable by family B.
2. **Given** a member of family A, **When** they set or view a budget, **Then** the acting family is derived
   from the session and any family identifier in the request is ignored.
3. **Given** a member budgeting a category, **When** the category's kind is income, **Then** the request is
   rejected (only expense categories are budgeted).

---

### User Story 4 - Remove a category's budget (Priority: P2)

The family's Owner (verified) removes a category's planned budget for a month (for example, because it no
longer applies), without affecting any recorded movements.

**Why this priority**: Plans change; removing an allocation keeps the budget tidy. Valuable but not part of
the first usable slice.

**Independent Test**: As the Owner, remove a budgeted category for the month and confirm it no longer appears
in the report, while the category's expense movements are unchanged.

**Acceptance Scenarios**:

1. **Given** a budgeted category for a month, **When** the Owner removes its allocation, **Then** it no longer
   appears in that month's budget report.
2. **Given** an allocation is removed, **When** the family reviews movements, **Then** the category's
   expense movements are unchanged (removing a budget never touches money records).
3. **Given** a member of another family, **When** they attempt to remove an allocation they do not own,
   **Then** the request is rejected.

---

### Edge Cases

- **Income category**: budgeting an income category is rejected (only expenses are budgeted).
- **Foreign / archived category**: a category from another family or an archived custom category is rejected.
- **Positive amount**: a zero or negative planned amount is rejected.
- **No movements yet**: a budgeted category with no expense movements shows real spend 0 and available =
  planned.
- **Over 100%**: real spend may exceed planned; available goes negative and the category is flagged over.
- **Deleted movements**: excluded from the real-spend computation (consistent with TXN-01).
- **Category used across months**: budgets and spend are computed per month; each month is independent (no
  rollover of unused budget).
- **Foreign identifiers**: a family/budget identifier in the request never widens access beyond the session
  family.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The family's **Owner** (verified) MUST be able to set (create or update) a planned budget amount
  for an expense category for a given calendar month; a non-owner member MUST be rejected from managing the
  budget (any member may still view it — FR-007).
- **FR-002**: The planned amount MUST be a **positive** whole-peso CLP value (greater than zero).
- **FR-003**: A budget allocation's category MUST be an **expense** category visible to the family (a system
  default or the family's own active custom); an income category, or a foreign/archived category, MUST be
  rejected.
- **FR-004**: A budget MUST be scoped to a **calendar month**; each month's budget is independent, with no
  rollover of unused budget between months.
- **FR-005**: There MUST be at most **one** allocation per (family, month, category); setting it again updates
  the existing allocation.
- **FR-006**: The system MUST compute each category's **real spend** for a month as the sum of the family's
  expense movements in that month with that category, excluding deleted movements.
- **FR-007**: A member MUST be able to view the month's budget report showing, per budgeted category: the
  planned amount, the real spend, the available amount (planned − real), and the percent consumed; and an
  overall summary (total planned, total real spend, total available, overall percent consumed).
- **FR-008**: Each budgeted category in the report MUST carry a status of **under**, **near**, or **over** its
  limit (near = percent consumed at or above the near-limit threshold; over = real spend exceeds planned).
- **FR-009**: All members of the same family MUST see the same budget and the same computed figures.
- **FR-010**: The family's **Owner** (verified) MUST be able to remove a category's allocation for a month;
  removal MUST NOT affect any recorded movements. A non-owner member MUST be rejected.
- **FR-011**: Every budget MUST belong to exactly one family; access MUST be authorized against the family
  derived from the session, and another family's budget MUST NOT be visible or modifiable.
- **FR-012**: Setting, updating, and removing a budget MUST require the Owner's email to be verified;
  unverified Owners MUST be blocked. Viewing the budget report requires only family membership (any member).
- **FR-013**: All budget inputs MUST be validated on the server side (a valid calendar month, a positive
  whole-peso amount, and a category that is one of the family's expense categories).
- **FR-014**: No monetary amount (planned or real spend) may appear in error logs or analytics events
  (Principle II).

### Key Entities *(include if feature involves data)*

- **Budget Allocation**: The planned amount for one expense category in one month, owned by exactly one
  family. Key attributes: family; period (calendar month); category (an expense category); planned amount
  (positive whole-peso CLP); author; timestamps. Unique per (family, month, category).
- **Budget Report** *(computed, not stored)*: For a month, the per-category lines (allocation id, planned,
  real spend, available, percent consumed, status) plus an overall summary. Each line carries its allocation
  id so the Owner can remove it from the report. Real spend is derived from expense movements.
- **Category** *(from CAT-01, referenced)*: The budgeted category; its immutable kind must be **expense**.
- **Movement** *(from TXN-01, referenced)*: Expense movements are the source of real spend, summed by category
  and month.
- **Family / Membership** *(from FAM-01, referenced)*: The privacy boundary and session-derived family that
  authorizes all budget access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The verified Owner can set a category's monthly budget in under 1 minute.
- **SC-002**: For each budgeted category, the report's real spend equals the sum of that category's expense
  movements in the month, and available = planned − real and percent consumed reconcile with it, 100% of the
  time.
- **SC-003**: 100% of attempts to budget an income category, or a foreign/archived category, are rejected.
- **SC-004**: A category whose real spend exceeds its plan is flagged **over**, and one at or above the
  near-limit threshold is flagged **near**, 100% of the time.
- **SC-005**: 100% of attempts to view or modify another family's budget are rejected.
- **SC-006**: 100% of budget inputs with an invalid month, a non-positive amount, or a non-expense category
  are rejected by server-side validation.
- **SC-007**: The overall summary's totals equal the sum of the per-category planned and real figures.
- **SC-008**: No monetary amount appears in error or analytics logs across setting, viewing, and removing a
  budget.

## Assumptions

- **Only the family's Owner** may set, update, and remove budget allocations (US-05 is framed "Como owner",
  unlike accounts/movements); any verified member may view the budget report. Resolved in Clarifications
  (Session 2026-07-19); enforced with the FAM-01 owner-role guard on write routes.
- **The overall monthly total equals the sum of the per-category allocations** — the family budgets per
  category and the total is their sum (no separate independent overall cap / "unallocated" bucket). Resolved
  in Clarifications (Session 2026-07-19).
- **The near-limit threshold is 80% consumed** (accepted default; the exact value is a configuration detail
  for the plan). Over = real spend > planned; near = 80% ≤ percent < 100%; otherwise under.
- **Budgets are per calendar month, independent, with no rollover** of unused budget (out of scope).
- **Only expense categories are budgeted**; income is not budgeted (constitution III: income vs expense).
- **Real spend is derived** from non-deleted expense movements whose occurrence date falls in the month; it is
  never stored. Removing/deleting movements changes real spend accordingly.
- **The planned amount is a positive whole-peso CLP integer**; single currency CLP.
- **No separate audit log for budget changes** — an allocation records its author + timestamps (consistent
  with ACC-01/CAT-01); the append-only audit is reserved for money movements (TXN-01/TXN-02).
- **Reuses AUTH-01** (verified gate), **FAM-01** (family boundary), **CAT-01** (expense categories + immutable
  kind), and **TXN-01** (expense movements as the real-spend source).
- **Status is surfaced as data** (under/near/over); the mobile client renders it via text + icon + colour (not
  colour alone), per Principle VII.
- **Delivery is API-first**: this vertical slice ships the `/budgets` API + shared `packages/contracts` types;
  the mobile budget screens (set allocations + report) are **deferred to a later mobile track**, consistent
  with the prior feature slices. Status/amounts are returned as data for the client to render.

## Dependencies

- **FAM-01** — the family boundary and session-derived family resolution. Required.
- **AUTH-01** — authenticated sessions and the email-verification soft gate. Required.
- **CAT-01** — categories and their immutable kind; only expense categories are budgetable. Required.
- **TXN-01** — expense movements are the source of real spend, summed by category and month. Required.

## Out of Scope

- The full dashboard estimated-vs-real view (DASH-01); BUD-01 provides the per-month budget report, which the
  dashboard later aggregates with income and balances.
- Rollover of unused budget between months, expected-income planning, and multi-month / future-month planning
  beyond the single-month model.
- Budgeting income categories, transfers, or per-account budgets.
- Alerts/notifications when a budget is exceeded (NTF-01).
