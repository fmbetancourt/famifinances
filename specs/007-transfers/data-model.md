# Data Model: Transfers Between Accounts (TXN-02)

**Feature**: TXN-02 · Transfers between family accounts
**Date**: 2026-07-18

TXN-02 adds two collections — `transfers` and `transferEvents` — and **extends the derived balance** so each
account sums its movements (TXN-01) and its transfers. `Family`/`Membership` (FAM-01) and `FinancialAccount`
(ACC-01) are referenced, not redefined. Transfers carry **no category and no type** (they are neither income
nor expense).

## Entity: Transfer (`transfers`)

A move of money between two of the family's accounts, owned by exactly one family. Effect on balances:
`−amount` on the origin, `+amount` on the destination. It never affects income/expense totals. Deletion is
soft (retained for audit, excluded from balances/list).

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key; the `transferId` in the API. |
| `amount` | number (int) | Required; **positive** whole-peso CLP (> 0). |
| `date` | Date | Required; occurrence calendar date (`YYYY-MM-DD`, no time-of-day). |
| `fromAccountId` | ObjectId (ref FinancialAccount) | Required; an **active** account of the caller's family. **Indexed.** |
| `toAccountId` | ObjectId (ref FinancialAccount) | Required; an **active** account of the caller's family; **≠ `fromAccountId`**. **Indexed.** |
| `familyId` | ObjectId (ref Family) | The owning family, from the session (denormalized). **Indexed.** Never from client input. |
| `note` | string \| null | Optional; trimmed, ≤ 280 chars. |
| `deletedAt` | Date \| null | `null` = active; a timestamp = soft-deleted (excluded from balances/list). |
| `createdBy` | ObjectId (ref Account) | The member who recorded it (FR-006). |
| `createdAt` / `updatedAt` | Date | Mongoose timestamps. |

**Indexes**: `familyId`; `fromAccountId`; `toAccountId`; a compound `{ familyId, deletedAt, date }`.

**Validation rules** (server-side, FR-014):

- `amount` an integer > 0; `date` a valid `YYYY-MM-DD`.
- `fromAccountId`, `toAccountId`: each resolves via `FinancialAccountRepository.findInFamily(familyId, id)`,
  exists, and is **active** (`archivedAt: null`) — else **400**.
- `fromAccountId ≠ toAccountId` — else **400**.
- `familyId`, `createdBy` = session; never from client input.

**Balance contribution** (Principle III, derived — not stored):

- `transferNet(account) = Σ amount where toAccountId=account − Σ amount where fromAccountId=account`, over
  `deletedAt: null` transfers. `account.balance = initialBalance + movementNet + transferNet` (ACC-01's
  `deriveBalance` composition extended). Income/expense totals are **unaffected** by transfers.

**State transitions**:

```text
       record (from ≠ to; both active family accounts)
          │
          ▼
      ┌────────┐   delete    ┌───────────┐
      │ active │ ──────────▶ │  deleted  │  (deletedAt set; excluded from balances + list)
      └────────┘             │ (audited) │
          │ edit             └───────────┘
          └──────  (each create/edit/delete appends a TransferEvent)
```

- **edit**: any of amount/date/from/to/note, re-validated (FR-009); recomputes all affected account balances.
  No un-delete endpoint.

## Entity: TransferEvent (`transferEvents`)

An append-only audit record of a transfer change, independent of the (soft-deletable) transfer, so its
history survives deletion (FR-011).

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key. |
| `transferId` | ObjectId (ref Transfer) | The transfer the event describes. **Indexed.** |
| `familyId` | ObjectId (ref Family) | The owning family. **Indexed.** |
| `actorId` | ObjectId (ref Account) | The member who made the change. |
| `type` | string enum | `created` \| `updated` \| `deleted`. |
| `snapshot` | object | `{ amount, date, fromAccountId, toAccountId, note }` at the event time. |
| `createdAt` | Date | Event time (Mongoose, createdAt only). |

**Indexes**: `transferId`; `familyId`. Append-only — never updated or deleted.

## Relationships

- **Transfer → FinancialAccount** (`fromAccountId`, `toAccountId`): two active accounts of the session family;
  the transfer contributes `−amount`/`+amount` to their derived balances. Origin ≠ destination.
- **Transfer → Family** (`familyId`): the privacy boundary; all access authorized against the session family.
- **Transfer → Account (`createdBy`)**: the recording member (AUTH-01 user `Account`); informational (FR-006).
- **TransferEvent → Transfer / Family / Account**: audit references; append-only.

## Notes

- **Derived balance**: `FinancialAccountsService.deriveBalance` stays the pure `initialBalance + net`; the
  callers now pass `movementNet + transferNet`. No stored editable balance (Principle III).
- **No double counting**: transfers live in their own collection and are never summed into income/expense
  totals — a transfer only shifts balance between two accounts.
- **No category / no type**: transfers are uncategorized and are neither income nor expense.
