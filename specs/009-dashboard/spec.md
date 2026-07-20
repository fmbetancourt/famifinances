# Feature Specification: Shared Monthly Dashboard (DASH-01)

**Feature Branch**: `009-dashboard`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "DASH-01 · Dashboard mensual compartido — a family opens one shared screen and sees, for a calendar month, its money summary (total income, total expense, net), each account's current balance and the family's total balance (net worth), and the budget estimated-vs-real overview (planned vs real spend, available, percent consumed, with categories over/near their limit highlighted). The dashboard is read-only, always stamped with a 'last updated' mark, and never implies real-time bank balances. Built on FAM-01 (family boundary), AUTH-01 (auth), ACC-01 (derived balances), TXN-01 (income/expense movements), TXN-02 (transfers, excluded from income/expense), and BUD-01 (budget report)."

## Clarifications

### Session 2026-07-20

- Q: How much budget detail does the dashboard show? → A: The overall summary (planned/real/available/percent) **plus only the categories flagged over or near** their limit (each with id, name, planned, real, percent, status); the full per-category table stays on the BUD-01 budget screen.
- Q: What does the "last updated" mark reflect? → A: The most recent create/edit/delete timestamp among the family's **movements and transfers** (the last time the money data changed) — budget-allocation changes do not move it.
- Q: How is the total net worth composed? → A: The sum of the **active** accounts' **current** derived balances (archived excluded; balances reflect the current derived state, not a month-end snapshot).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the month's money summary (Priority: P1) 🎯 MVP

A family member opens the shared dashboard and sees, for the current month, the family's total income, total
expense, and the net (income − expense), computed from the movements the family recorded, so everyone sees at a
glance how the month is going.

**Why this priority**: The income/expense/net summary is the headline of the dashboard and the single most
consulted figure; it is the minimal deployable slice that delivers the "shared monthly view" value.

**Independent Test**: With income and expense movements recorded in a month, open the dashboard for that month
and confirm total income, total expense, and net match the sum of those movements (transfers excluded).

**Acceptance Scenarios**:

1. **Given** a family with income and expense movements in a month, **When** a member views the dashboard for
   that month, **Then** it shows total income, total expense, and net = income − expense for that month.
2. **Given** transfers between the family's own accounts in the month, **When** the dashboard is shown, **Then**
   those transfers do not change total income or total expense (no double counting).
3. **Given** deleted movements, **When** the dashboard is shown, **Then** they are excluded from the totals.
4. **Given** a family with no movements in the month, **When** the dashboard is shown, **Then** income, expense,
   and net are all 0.

---

### User Story 2 - See account balances and total net worth (Priority: P1)

A member sees each active account's current balance and the family's total balance across accounts, with a
"last updated" mark, so the family knows where its money stands — without any claim of a live bank balance.

**Why this priority**: Balances are the second core figure of the shared view; together with the money summary
they make the dashboard useful on its own. Reuses ACC-01's derived balances.

**Independent Test**: With accounts carrying initial balances plus movements and transfers, open the dashboard
and confirm each account's balance equals its derived balance and the total equals their sum, and that a "last
updated" mark is present.

**Acceptance Scenarios**:

1. **Given** the family's active accounts, **When** the dashboard is shown, **Then** each account's current
   balance is its derived balance (initial + its movements + its transfers) and the total balance is the sum of
   the active accounts' balances.
2. **Given** an archived account, **When** the dashboard is shown, **Then** it is excluded from the total net
   worth.
3. **Given** any dashboard view, **When** it is presented, **Then** it carries a "last updated" mark and never
   states or implies a real-time bank balance.

---

### User Story 3 - See the budget estimated vs real overview (Priority: P1)

A member sees the month's budget overview — total planned vs total real spend, the available amount, the
percent consumed, and which categories are over or near their limit — so the family sees its plan against
reality in the same place.

**Why this priority**: Comparing planned vs real is the product's headline promise ("estimated vs real on a
shared dashboard"); it turns the raw totals into an actionable picture. Reuses the BUD-01 report.

**Independent Test**: With budgeted categories and expense movements in a month, open the dashboard and confirm
the budget overview's totals match the BUD-01 report for that month and that over/near categories are flagged.

**Acceptance Scenarios**:

1. **Given** budgeted categories with expense movements in the month, **When** the dashboard is shown, **Then**
   the budget overview shows total planned, total real spend, total available, and overall percent consumed,
   equal to the month's budget report.
2. **Given** a category whose real spend exceeds or nears its planned amount, **When** the dashboard is shown,
   **Then** that category is highlighted as **over** or **near**, respectively (status carried as data).
3. **Given** a family with no budgets set for the month, **When** the dashboard is shown, **Then** the budget
   overview shows zeros (nothing planned) without error.

---

### User Story 4 - View the dashboard for a chosen month (Priority: P2)

A member views the dashboard for a specific calendar month (defaulting to the current month), so the family can
review a past month's summary, balances context, and budget outcome.

**Why this priority**: Month selection extends the dashboard's usefulness beyond "today" but is not required for
the first usable slice (the current month is the default).

**Independent Test**: Record data across two months; request the dashboard for each month and confirm the money
summary and budget overview reflect that month, while the account balances reflect the current derived state.

**Acceptance Scenarios**:

1. **Given** movements/budgets in different months, **When** a member requests the dashboard for a given month,
   **Then** the money summary and budget overview reflect that month.
2. **Given** no month is provided, **When** the dashboard is requested, **Then** it defaults to the current
   calendar month.
3. **Given** an invalid month value, **When** the dashboard is requested, **Then** the request is rejected by
   server-side validation.

---

### Edge Cases

- **No data yet**: a family with no accounts, movements, or budgets sees zeros and a null / "no data yet" last-updated state, without error.
- **Transfers**: never counted as income or expense (Principle III); they only move money between accounts and are reflected in balances.
- **Deleted movements/transfers**: excluded from the summary and from derived balances (consistent with TXN-01/TXN-02).
- **Archived accounts**: excluded from total net worth; their historical movements still counted in the month summary.
- **Uncategorized expenses**: contribute to total expense but not to any budget line (no budget for a null category).
- **Over 100%**: a category whose real spend exceeds its plan shows a negative available and an **over** status.
- **Cross-month**: each month's summary and budget are computed independently; balances reflect the current derived state, not a month-end snapshot.
- **Foreign identifiers**: a family identifier in the request never widens access beyond the session family.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Any authenticated member of a family MUST be able to view the family's dashboard for a calendar
  month; the acting family MUST be derived from the session, never from a client-supplied identifier.
- **FR-002**: The dashboard MUST show, for the month, the **total income** and **total expense** as the sums of
  the family's non-deleted income and expense movements whose occurrence date falls in the month, and the
  **net** = total income − total expense.
- **FR-003**: Transfers between the family's accounts MUST NOT be counted as income or expense (no double
  counting), consistent with derived-balance integrity.
- **FR-004**: The dashboard MUST show each **active** account's current **derived balance** and the **total
  balance** (net worth) as the sum of the active accounts' balances.
- **FR-005**: Account balances MUST be **derived** (initial balance + the account's movements + transfers),
  never read from an editable stored balance; archived accounts MUST be excluded from the total net worth.
- **FR-006**: The dashboard MUST show the month's **budget overview**: total planned, total real spend, total
  available (planned − real), and overall percent consumed, equal to the BUD-01 budget report for the month.
- **FR-007**: The dashboard MUST identify the categories that are **over** or **near** their budget limit for
  the month (the actionable highlights), each carrying its id, name, planned amount, real spend, percent
  consumed, and status; the full per-category budget table is NOT part of the dashboard (it stays on BUD-01).
- **FR-008**: The dashboard MUST show a **"last updated"** mark equal to the most recent create/edit/delete
  time among the family's **movements and transfers** (null / "no data yet" when none exist); budget-allocation
  changes do not affect it. The mark MUST NOT state or imply a real-time bank balance.
- **FR-009**: Every figure MUST be scoped to the session family; another family's data MUST NOT appear on the
  dashboard.
- **FR-010**: All members of the same family MUST see the same dashboard figures for the same month.
- **FR-011**: Status MUST be surfaced as **data** (under/near/over) so the client can render it via text + icon
  + colour, never colour alone.
- **FR-012**: All amounts MUST be whole-peso CLP; no monetary amount may appear in error logs or analytics
  events.
- **FR-013**: The month input MUST be validated server-side (a valid calendar month); when omitted it defaults
  to the current calendar month.
- **FR-014**: The dashboard MUST be **read-only** — viewing it MUST NOT create, edit, or delete any financial
  data.

### Key Entities *(include if feature involves data)*

- **Dashboard** *(computed, not stored)*: the month's shared snapshot — money summary (income, expense, net),
  account balances + total net worth, budget overview (planned, real, available, percent, over/near highlights),
  and a "last updated" mark. Recomputed on demand from the underlying records.
- **Movement** *(from TXN-01, referenced)*: income/expense movements are the source of the month's income and
  expense totals.
- **Transfer** *(from TXN-02, referenced)*: excluded from income/expense; contributes to account balances only.
- **Financial Account** *(from ACC-01, referenced)*: each account's derived balance and, summed, the net worth.
- **Budget Report** *(from BUD-01, referenced)*: the planned-vs-real overview and over/near highlights.
- **Family / Membership** *(from FAM-01, referenced)*: the privacy boundary and session-derived family that
  authorizes all dashboard access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can open the dashboard and read the current month's income, expense, and net in a single
  view in under 3 seconds.
- **SC-002**: The dashboard's total income and total expense equal the sums of the month's non-deleted income
  and expense movements, and transfers never change them, 100% of the time.
- **SC-003**: The total net worth equals the sum of the active accounts' derived balances (each = initial + its
  movements + transfers), 100% of the time.
- **SC-004**: The budget overview's totals equal the sum of the month's budgeted categories' planned and real
  figures (reconciles with the BUD-01 report), 100% of the time.
- **SC-005**: 100% of attempts to view another family's dashboard are rejected.
- **SC-006**: Every category over or near its budget limit is flagged as such, 100% of the time.
- **SC-007**: Every dashboard view carries a "last updated" mark and never claims a real-time bank balance.
- **SC-008**: No monetary amount appears in error or analytics logs when viewing the dashboard.

## Assumptions

- **Read-only computed view**: DASH-01 introduces no new persisted entity; the dashboard is recomputed on
  demand by aggregating ACC-01 balances, TXN-01/TXN-02 movements, and the BUD-01 report.
- **Default month is the current calendar month**; a member may request a specific month (`YYYY-MM`). The money
  summary and budget overview are month-scoped; **account balances reflect the current derived state** (not a
  month-end snapshot), since there is no historical balance store in the MVP.
- **Net worth = sum of active accounts' derived balances**; archived accounts are excluded from the total (they
  still exist and their past movements still count in the month summary).
- **"Last updated" = the most recent create/edit/delete time** among the family's movements and transfers (the
  last time the money data changed); **budget-allocation changes do not move it**; it is null / "no data yet"
  when the family has recorded nothing.
- **Budget overview reuses the BUD-01 report**: the dashboard surfaces the overall planned/real/available/
  percent summary plus the categories flagged over or near; the full per-category table remains on the budget
  screen (BUD-01).
- **Single currency CLP**, whole-peso integer amounts.
- **Status surfaced as data** (under/near/over); the mobile client renders it via text + icon + colour, per
  Principle VII.
- **Delivery is API-first**: this slice ships the dashboard aggregation API + shared contracts; the mobile
  dashboard screen is deferred to a later mobile track, consistent with the prior feature slices.
- **Reuses** FAM-01 (family boundary), AUTH-01 (authenticated session), ACC-01 (derived balances), TXN-01
  (income/expense), TXN-02 (transfers), and BUD-01 (budget report).

## Dependencies

- **FAM-01** — the family boundary and session-derived family resolution. Required.
- **AUTH-01** — authenticated sessions. Required.
- **ACC-01** — derived account balances (net worth). Required.
- **TXN-01** — income/expense movements (the month summary source). Required.
- **TXN-02** — transfers (excluded from income/expense; reflected in balances). Required.
- **BUD-01** — the budget report (planned vs real overview). Required.

## Out of Scope

- Historical trends, multi-month charts, and history filters/search (HIS-01).
- Real-time bank balances, bank sync, or any live-institution integration.
- Editing or recording financial data from the dashboard (it is strictly read-only).
- Export, sharing, or scheduled snapshots of the dashboard.
- Expected-income planning, budget rollover, and month-end balance snapshots.
- Alerts/notifications when the budget is exceeded (NTF-01).
