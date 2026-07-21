# Data Model: Local Reminders (NTF-01)

**Feature**: NTF-01 · Recordatorios locales
**Date**: 2026-07-21

NTF-01 adds **one** persisted collection (`reminders`), scoped per member. No financial data, no
scheduler state.

## Entity: Reminder *(persisted — collection `reminders`)*

A personal, per-member reminder configuration the mobile app turns into an on-device local
notification.

| Field | Type | Rules |
|-------|------|-------|
| `ownerId` | ObjectId → Account | Required; the member (AUTH-01 account id) from the session. **Never from client input** (Principle I). Indexed. |
| `familyId` | ObjectId → Family | Required; from the session — defense-in-depth Principle-I scope. |
| `purpose` | `'capture' \| 'budget' \| 'custom'` | Required. `capture`/`budget` carry a device-localized default text; `custom` requires a label. |
| `cadence` | `'daily' \| 'weekly' \| 'monthly'` | Required. Determines which day selector is required/forbidden. |
| `timeOfDay` | string | Required; 24h `HH:MM` matching `^([01]\d\|2[0-3]):[0-5]\d$`. Wall-clock, device timezone. |
| `dayOfWeek` | `'monday'…'sunday' \| null` | Required **iff** `cadence = weekly`; MUST be null otherwise. |
| `dayOfMonth` | number \| null | Required **iff** `cadence = monthly`; integer 1–31; MUST be null otherwise. 29–31 clamped to the month's last day **by the device**. |
| `label` | string \| null | Optional for `capture`/`budget`; **required non-blank** for `custom`. Trimmed; ≤ 80 chars. Never logged. |
| `enabled` | boolean | Default `true`. A disabled reminder yields no notification (device schedules nothing). |
| `createdAt` / `updatedAt` | Date | Mongoose `timestamps`. |

**Indexes**

- `{ ownerId: 1, createdAt: -1 }` — list a member's reminders, newest first.

**Lifecycle**: created (enabled) → (edited / enabled↔disabled)\* → hard-deleted. Convenience data with
no audit requirement, so deletion is a real delete.

## Validation rules (authoritative — enforced in `reminders.service.ts`)

- **time**: `timeOfDay` matches the 24h `HH:MM` pattern, else `400`.
- **cadence ⇄ selector**:
  - `daily` → `dayOfWeek` and `dayOfMonth` MUST be absent, else `400`.
  - `weekly` → `dayOfWeek` present (`monday`–`sunday`) and `dayOfMonth` absent, else `400`.
  - `monthly` → `dayOfMonth` present (1–31) and `dayOfWeek` absent, else `400`.
- **purpose/label**: `custom` → `label` trimmed non-blank, else `400`; `label` ≤ 80 chars.
- **cap**: on create, the member's existing reminder `count` MUST be `< 20`, else `409` (FR-009).
- **isolation**: every read/write binds `ownerId` + `familyId` from the session; a foreign/malformed
  `:id` resolves to `null → 404` (Principle I). No owner/family id is ever read from client input.
- On **update**, the effective (patched) `cadence`/`purpose`/selectors are re-validated as a whole so a
  partial edit cannot leave an incoherent reminder.

## Relationships

```text
Account/Member (1) ──< Reminder (N)   # ownerId, session-scoped (personal)
Family (1) ──< Reminder (N)           # familyId, defense-in-depth
```

A reminder references **no** financial entity (no account, category, movement, or amount).

## Notes

- `reminders` is the only new collection; no scheduler/queue state is stored.
- Delivery is on-device: the server exposes the config; the mobile app schedules local notifications
  and applies the `dayOfMonth` last-day clamp and timezone interpretation.
