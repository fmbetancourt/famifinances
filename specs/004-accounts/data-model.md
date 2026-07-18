# Data Model: Family Financial Accounts (ACC-01)

**Feature**: ACC-01 · Accounts, types, institution label, initial balance
**Date**: 2026-07-17

ACC-01 adds one persisted collection, `financialAccounts`, owned by the FAM-01 `Family`. It introduces
**no** monetary movements — the current balance is derived (see [research.md](./research.md) R3), and
movements arrive in TXN-01. `Family` and `Membership` are referenced from FAM-01, not redefined here.

## Entity: FinancialAccount (`financialAccounts`)

A place where a family's money is held, owned by exactly one family. Created and managed by any verified
member of that family. Its current balance is **derived**, never stored as an editable field. The class is
named `FinancialAccount` (not `Account`) to avoid a Mongoose model clash with the AUTH-01 user `Account`.

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key; the `accountId` in the API. |
| `familyId` | ObjectId (ref Family) | The owning family, set from the session (`@CurrentFamily`), never from client input. **Indexed.** |
| `name` | string | Required; 1–80 chars (trimmed). Not unique within a family (Clarify Q2). |
| `type` | string enum | Required; one of `bank` \| `digital_wallet` \| `cash` \| `credit_card`. |
| `institution` | string \| null | Optional free-text label (0–80 chars); a suggestion only, never a bank connection. |
| `initialBalance` | number (int) | Required; whole-peso **CLP** integer. May be negative, zero, or positive (Clarify Q1). |
| `currency` | string | Constant `CLP` (not user-settable). |
| `startDate` | Date | Required; the calendar date the initial balance is effective (no time-of-day). |
| `archivedAt` | Date \| null | `null` = active; a timestamp = archived (read-only). |
| `createdBy` | ObjectId (ref Account) | The member (session `accountId`) who created it (FR-014). |
| `createdAt` | Date | Creation timestamp (Mongoose). |
| `updatedAt` | Date | Last-modification timestamp (Mongoose); attributes edits (FR-014). |

**Indexes**: `familyId` (list scoping); compound lookups use `{ _id, familyId }` for scoped get/update.

**Derived (not stored)**:

- `balance` = `initialBalance` + Σ(movements for this account). In ACC-01 there are no movements, so
  `balance === initialBalance`. Computed by `FinancialAccountsService` at read time; TXN-01 extends the derivation.

**Validation rules** (server-side, FR-013):

- `name`: present, trimmed length 1–80.
- `type`: within the enum set; anything else → rejected.
- `institution`: optional; if present, length ≤ 80.
- `initialBalance`: integer (no decimals); any sign allowed.
- `startDate`: a valid date.
- `currency`: only `CLP` accepted (if supplied); otherwise defaulted to `CLP`.

**State transitions**:

```text
        create
          │
          ▼
      ┌────────┐   archive    ┌──────────┐
      │ active │ ───────────▶ │ archived │
      │        │ ◀─────────── │ (read-   │
      └────────┘  unarchive   │  only)   │
          │                   └──────────┘
          │ edit (active only)      │
          └─────────────────────────┘   (edit on archived → 409 Conflict)

      delete: not supported (FR-010) — accounts are archived, never destroyed.
```

- **active → archived**: `archivedAt` set to now; excluded from the default (active) listing; not
  available for new activity.
- **archived → active**: `unarchive` clears `archivedAt`.
- **edit**: allowed only while active; on an archived account → **409 Conflict** (Clarify Q3, FR-009a).
- Editing `initialBalance` recomputes the derived `balance` (FR-008); no stored balance to update.

## Relationships

- **FinancialAccount → Family** (`familyId`): many accounts per family; an account references the family,
  not an individual, so membership changes never alter account ownership. All access is authorized against
  the session family (Principle I).
- **FinancialAccount → Account (`createdBy`)**: the creating member (an AUTH-01 user `Account`);
  informational (FR-014), not an access control input.
- **FinancialAccount → Movement** *(future, TXN-01)*: movements will reference `accountId`; their sum feeds
  the derived balance. Out of scope for ACC-01.

## Notes

- **Family owns data**: consistent with FAM-01 (`data references familyId, not the individual`), so
  removing/leaving a membership never cascades to accounts.
- **No new isolation mechanism**: scoping is entirely via FAM-01's `FamilyScopeGuard`/`@CurrentFamily`.
- **CLP integer**: whole pesos; no minor-unit/cents field.
