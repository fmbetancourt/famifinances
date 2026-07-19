# Data Model: Income & Expense Movements (TXN-01)

**Feature**: TXN-01 · Record, edit, and history of income and expense movements
**Date**: 2026-07-18

TXN-01 adds two collections — `movements` and `movementEvents` — and **extends ACC-01's derived balance** to
sum movements. `Family`/`Membership` (FAM-01), `FinancialAccount` (ACC-01), and `Category` (CAT-01) are
referenced, not redefined.

## Entity: Movement (`movements`)

A recorded income or expense, owned by exactly one family. Its effect on the account balance is `+amount`
(income) or `−amount` (expense). Deletion is soft (retained for audit, excluded from balances/history).

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key; the `movementId` in the API. |
| `type` | string enum | Required; `income` \| `expense`. |
| `amount` | number (int) | Required; **positive** whole-peso CLP (> 0). |
| `date` | Date | Required; occurrence calendar date (`YYYY-MM-DD`, no time-of-day). |
| `accountId` | ObjectId (ref FinancialAccount) | Required; must be an **active** account of the caller's family. **Indexed.** |
| `familyId` | ObjectId (ref Family) | The owning family, from the session (denormalized for scoped queries + aggregation). **Indexed.** Never from client input. |
| `categoryId` | ObjectId (ref Category) \| null | Optional; if set, a category visible to the family whose `kind` equals `type`. |
| `note` | string \| null | Optional; trimmed, ≤ 280 chars. |
| `deletedAt` | Date \| null | `null` = active; a timestamp = soft-deleted (excluded from balances/history). |
| `createdBy` | ObjectId (ref Account) | The member who recorded it (FR-006). |
| `createdAt` | Date | Creation timestamp (Mongoose). |
| `updatedAt` | Date | Last-modification timestamp (Mongoose). |

**Indexes**: `familyId`; `accountId`; a compound `{ familyId, deletedAt, date }` for scoped history + balance
aggregation.

**Validation rules** (server-side, FR-015):

- `type` ∈ { income, expense }; `amount` an integer > 0; `date` a valid `YYYY-MM-DD`.
- `accountId`: resolves via `FinancialAccountRepository.findInFamily(familyId, accountId)`, exists, and is
  **active** (`archivedAt: null`) — else **400**.
- `categoryId` (optional): resolves via `CategoryRepository.findVisible(familyId, categoryId)`, is **active**
  (custom not archived), and `category.kind === type` — else **400**.
- `familyId`, `createdBy` = session; `scope`/ownership never from client input.

**Balance contribution** (Principle III, derived — not stored):

- `net(account) = Σ amount where type=income − Σ amount where type=expense`, over `deletedAt: null` movements
  of that account. `account.balance = initialBalance + net(account)` (ACC-01's `deriveBalance` extended).

**State transitions**:

```text
       record (type fixed at create; amount/date/account/category/note editable)
          │
          ▼
      ┌────────┐   delete    ┌───────────┐
      │ active │ ──────────▶ │  deleted  │  (deletedAt set; excluded from balance + history)
      └────────┘             │ (audited) │
          │ edit             └───────────┘
          └──────  (each create/edit/delete appends a MovementEvent)
```

- **edit**: any of amount/type/date/account/category/note, re-validated (FR-009); recomputes affected
  balances. No un-delete endpoint in this feature.

## Entity: MovementEvent (`movementEvents`)

An append-only audit record of a movement change, independent of the (soft-deletable) movement, so a
movement's history survives its deletion (FR-011).

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key. |
| `movementId` | ObjectId (ref Movement) | The movement the event describes. **Indexed.** |
| `familyId` | ObjectId (ref Family) | The owning family. **Indexed.** |
| `actorId` | ObjectId (ref Account) | The member who made the change. |
| `type` | string enum | `created` \| `updated` \| `deleted`. |
| `snapshot` | object | The movement's key fields at the event time: `{ type, amount, date, accountId, categoryId, note }`. |
| `createdAt` | Date | Event time (Mongoose, createdAt only). |

**Indexes**: `movementId`; `familyId`. Append-only — never updated or deleted.

## Relationships

- **Movement → FinancialAccount** (`accountId`): each movement affects one account; the account's balance sums
  its movements. Validated to be an active account of the session family.
- **Movement → Category** (`categoryId`, optional): the classification; its `kind` must equal the movement
  `type` (Principle III).
- **Movement → Family** (`familyId`): the privacy boundary; all access authorized against the session family.
- **Movement → Account (`createdBy`)**: the recording member (AUTH-01 user `Account`); informational (FR-006).
- **MovementEvent → Movement / Family / Account**: audit references; append-only.

## Notes

- **Derived balance**: ACC-01's `FinancialAccountsService.deriveBalance` is extended to add
  `MovementBalanceService.netForAccount`; no stored editable balance (Principle III).
- **Soft delete** keeps balances correct (deleted excluded) and the row for audit; the `MovementEvent` trail
  is the durable history.
- **No transfers**: income/expense only; transfers (two accounts, no total change) are TXN-02.
