# Feature Specification: Movement History with Filters (HIS-01)

**Feature Branch**: `010-history`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "HIS-01 · Historial con filtros — a family reviews its recorded movements through a filterable, paginated history: filter by date range, movement type (income/expense), account, and category, and search by note text; results are the family's non-deleted movements, newest first, returned in pages. Read-only. Built on FAM-01 (family boundary), AUTH-01 (auth), TXN-01 (movements), ACC-01 (accounts), and CAT-01 (categories)."

## Clarifications

### Session 2026-07-20

- Q: What records does the history cover? → A: **Movements only** (TXN-01 income/expense); transfers keep their own list — no unified movement+transfer timeline in the MVP.
- Q: What pagination mechanism? → A: **Offset/limit** — a `limit` (default 20, max 100) with an offset/page, returning the total count and a "more results" indication.
- Q: How does the note search match? → A: **Case-insensitive substring** — a movement matches if its note contains the term anywhere.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter the history by date range and type (Priority: P1) 🎯 MVP

A family member opens the history and narrows it to a date range (for example, "July 2026") and optionally a
movement type (income or expense), so they can review what happened in a given window.

**Why this priority**: A date-scoped, type-filtered list is the core of a usable history and the most common
review action; it is the minimal deployable slice that turns the raw movement list into a review tool.

**Independent Test**: With movements across several dates, request the history for a date range and a type, and
confirm only the family's non-deleted movements of that type within the range are returned, newest first.

**Acceptance Scenarios**:

1. **Given** movements on different dates, **When** a member requests the history for a date range, **Then**
   only movements whose occurrence date falls within the range are returned, newest first.
2. **Given** a type filter (income or expense), **When** the history is requested, **Then** only movements of
   that type are returned.
3. **Given** deleted movements in the range, **When** the history is requested, **Then** they are excluded.
4. **Given** no movements match, **When** the history is requested, **Then** an empty result is returned (not an
   error).

---

### User Story 2 - Filter by account and category (Priority: P1)

A member narrows the history to a specific account and/or a specific category, so they can review, for example,
"all Alimentación expenses on the Santander account".

**Why this priority**: Account and category are the next most-used dimensions for reviewing spending; combined
with the date/type filters they answer most review questions. Reuses ACC-01 accounts and CAT-01 categories.

**Independent Test**: With movements across accounts and categories, filter by one account and one category and
confirm only movements matching both (and the other active filters) are returned.

**Acceptance Scenarios**:

1. **Given** movements across accounts, **When** a member filters by an account, **Then** only that account's
   movements are returned.
2. **Given** movements across categories, **When** a member filters by a category, **Then** only movements with
   that category are returned.
3. **Given** several filters at once (date range, type, account, category), **When** the history is requested,
   **Then** all filters apply together (a movement must match every provided filter).
4. **Given** a foreign or unknown account/category id, **When** used as a filter, **Then** it never returns
   another family's movements (the result is empty or the request is rejected).

---

### User Story 3 - Search movements by note text (Priority: P2)

A member types a search term and sees movements whose note contains it (for example, "farmacia"), so they can
find a specific transaction without scrolling.

**Why this priority**: Text search speeds up finding a known transaction, but the filtered list is already
useful without it; hence P2.

**Independent Test**: With movements carrying notes, search a term and confirm only movements whose note
contains that term (case-insensitive) are returned, combined with any other active filters.

**Acceptance Scenarios**:

1. **Given** movements with notes, **When** a member searches a term, **Then** only movements whose note
   contains that term (case-insensitive, partial match) are returned.
2. **Given** a search term plus other filters, **When** the history is requested, **Then** the search applies
   together with the other filters.
3. **Given** movements without a note, **When** a search term is provided, **Then** those movements are excluded
   from the search results.

---

### User Story 4 - Browse the history in pages (Priority: P2)

A member browses a long history in pages, so the view stays fast and manageable, and can request the next page.

**Why this priority**: Pagination keeps large histories responsive, but small pilot families work without it at
first; hence P2.

**Independent Test**: With more movements than one page holds, request the first page and confirm it returns a
bounded number of items plus a way to know more exist; request the next page and confirm it continues without
overlap.

**Acceptance Scenarios**:

1. **Given** more movements than the page size, **When** the first page is requested, **Then** at most the page
   size are returned, in newest-first order, with an indication that more results exist.
2. **Given** a first page was returned, **When** the next page is requested, **Then** the following movements
   are returned with no overlap or gap.
3. **Given** a page size beyond the allowed maximum, **When** requested, **Then** it is capped (or rejected) by
   server-side validation.

---

### Edge Cases

- **Empty result**: a query matching nothing returns an empty page, not an error.
- **Deleted movements**: always excluded from the history (consistent with TXN-01).
- **Inverted range**: a `from` later than `to` returns an empty result (or is rejected by validation).
- **Uncategorized movements**: a category filter excludes movements with no category; without a category filter
  they appear normally.
- **Note search vs no note**: movements without a note never match a text search.
- **Foreign identifiers**: a family/account/category id in the request never widens access beyond the session
  family.
- **Transfers**: not part of this history (income/expense movements only); transfers have their own list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Any authenticated member of a family MUST be able to view the family's movement history; the
  acting family MUST be derived from the session, never from a client-supplied identifier.
- **FR-002**: The history MUST support filtering by an occurrence **date range** (`from` and/or `to`, inclusive
  calendar dates); either bound may be omitted.
- **FR-003**: The history MUST support filtering by movement **type** (income or expense).
- **FR-004**: The history MUST support filtering by **account** (one of the family's accounts).
- **FR-005**: The history MUST support filtering by **category** (one of the family's visible categories).
- **FR-006**: The history MUST support a case-insensitive **partial-text search** over the movement note; a
  blank/whitespace-only search term MUST be treated as no search filter (it must not exclude note-less
  movements).
- **FR-007**: When multiple filters are provided, they MUST apply together with AND semantics (a movement must
  match every provided filter).
- **FR-008**: The history MUST return only the family's **non-deleted** movements.
- **FR-009**: Results MUST be ordered by occurrence date descending, then creation time descending (newest
  first).
- **FR-010**: The history MUST be **paginated** via an **offset/limit** scheme — a `limit` (default 20, enforced
  maximum 100) and an offset/page — returning the **total match count** and whether **more results exist**, so
  the caller can request subsequent pages.
- **FR-011**: All filter inputs MUST be validated on the server side (valid dates, a known type, a positive
  bounded page size).
- **FR-012**: A foreign or unknown account/category filter MUST NOT return another family's movements; access is
  always authorized against the session family.
- **FR-013**: No monetary amount or note content may appear in error logs or analytics events.
- **FR-014**: The history MUST be **read-only** — viewing it MUST NOT create, edit, or delete any movement.

### Key Entities *(include if feature involves data)*

- **Movement History** *(computed query result, not stored)*: a filtered, ordered, paginated page of the
  family's movements plus paging metadata (page size, whether more results exist / a next-page reference).
- **Movement** *(from TXN-01, referenced)*: the records being filtered — type, amount, occurrence date,
  account, category, note; deleted ones are excluded.
- **Account** *(from ACC-01, referenced)*: an account filter dimension (family-scoped).
- **Category** *(from CAT-01, referenced)*: a category filter dimension (family-scoped).
- **Family / Membership** *(from FAM-01, referenced)*: the privacy boundary and session-derived family that
  authorizes all history access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can retrieve a filtered page of history in a single request in under 2 seconds at pilot
  scale.
- **SC-002**: For any combination of filters, the returned movements are exactly the family's non-deleted
  movements matching every provided filter, 100% of the time.
- **SC-003**: Results are always ordered newest-first, 100% of the time.
- **SC-004**: 100% of note searches return only movements whose note contains the term (case-insensitive).
- **SC-005**: 100% of attempts to filter by another family's account/category return no cross-family movements.
- **SC-006**: Every page returns at most the configured maximum number of items and a reliable indication of
  whether more results exist.
- **SC-007**: No monetary amount or note content appears in error or analytics logs.

## Assumptions

- **Movements-only history**: HIS-01 covers TXN-01 income/expense movements; transfers (TXN-02) are not part of
  this unified history in the MVP (they have their own list). A combined movement+transfer timeline is out of
  scope.
- **Date range is inclusive** on both bounds and expressed as calendar dates (`YYYY-MM-DD`); either bound may be
  omitted (open-ended range).
- **Note search is case-insensitive partial match** over the note text; movements without a note never match.
- **Pagination** uses an **offset/limit** scheme with `limit` defaulting to 20 and capped at 100; the page
  returns the total match count and a "more results" indication (resolved in Clarifications).
- **Ordering** is occurrence date descending, then creation time descending (newest first), consistent with the
  existing movement list.
- **Read-only**; whole-peso CLP amounts; single currency.
- **Reuses** FAM-01 (family boundary), AUTH-01 (authenticated session), TXN-01 (movements), ACC-01 (accounts),
  and CAT-01 (categories). The existing movement list (account/type filters) is the foundation this extends.
- **Delivery is API-first**: this slice ships the history API + shared contracts; the mobile history screen is
  deferred to a later mobile track, consistent with the prior feature slices.

## Dependencies

- **FAM-01** — the family boundary and session-derived family resolution. Required.
- **AUTH-01** — authenticated sessions. Required.
- **TXN-01** — the movements being filtered. Required.
- **ACC-01** — accounts as a filter dimension. Required.
- **CAT-01** — categories as a filter dimension. Required.

## Out of Scope

- A unified movement + transfer timeline (transfers keep their own list).
- Exporting the history (CSV/PDF), analytics, or charts.
- Saved/named filter presets and scheduled reports.
- Full-text search beyond the note (e.g., across categories or amounts).
- Editing or recording movements from the history (it is read-only).
