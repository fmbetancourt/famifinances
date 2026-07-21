# Quickstart: Local Reminders (NTF-01)

**Feature**: NTF-01 · Recordatorios locales
**Date**: 2026-07-21

A runnable validation guide for the NTF-01 backend. Details live in
[data-model.md](./data-model.md) and [contracts/reminder.openapi.yaml](./contracts/reminder.openapi.yaml).

## Prerequisites

- A registered, **email-verified** user who is a member of a family (AUTH-01 + FAM-01).
- A bearer access token for the session. Base path: `/v1`.

## Setup

```bash
pnpm install
pnpm --filter @famifinances/api start:dev      # API on http://localhost:3000
```

## Scenario 1 — Daily capture reminder (US1, FR-001/002)

1. `POST /v1/reminders`
   `{ "purpose": "capture", "cadence": "daily", "timeOfDay": "20:00" }`
   → `201` with `{ purpose: "capture", cadence: "daily", timeOfDay: "20:00", dayOfWeek: null, dayOfMonth: null, label: null, enabled: true }`.
2. `GET /v1/reminders` → the list includes it with all fields the device needs to schedule the local notification.

**Expected**: a daily reminder round-trips exactly; it is enabled by default.

## Scenario 2 — Weekly & monthly reminders (US2, FR-001/007)

1. `POST /v1/reminders`
   `{ "purpose": "budget", "cadence": "monthly", "timeOfDay": "09:00", "dayOfMonth": 1 }` → `201`.
2. `POST /v1/reminders`
   `{ "purpose": "custom", "cadence": "weekly", "timeOfDay": "08:00", "dayOfWeek": "monday", "label": "Revisar la semana" }` → `201`.
3. A monthly reminder with `dayOfMonth: 31` is accepted; the **device** fires it on the last day of shorter months.

**Expected**: cadence-appropriate day selectors are stored; `custom` keeps its label.

## Scenario 3 — Validation (FR-007/009)

1. Bad time `"24:00"` → `400`.
2. `cadence: "weekly"` without `dayOfWeek`, or with a `dayOfMonth` → `400`.
3. `cadence: "daily"` with any day selector → `400`.
4. `purpose: "custom"` with a blank/absent `label` → `400`.
5. Creating a **21st** reminder for the member → `409` (cap 20).

**Expected**: every invalid configuration is rejected with a clear message.

## Scenario 4 — Enable / disable / edit / delete (US3, FR-003/004/005)

1. `PATCH /v1/reminders/{id}` `{ "timeOfDay": "21:30" }` → `200` updated.
2. `PATCH /v1/reminders/{id}` `{ "enabled": false }` → `200`; the reminder is retained but silenced (device schedules nothing).
3. `PATCH /v1/reminders/{id}` `{ "enabled": true }` → `200` re-enabled.
4. `DELETE /v1/reminders/{id}` → `204`; it disappears from the list.

**Expected**: silencing keeps the config; editing/deleting behave as expected.

## Scenario 5 — Per-member & family isolation (FR-006, Principle I)

1. Member **B** (same family) `GET /v1/reminders/{id-from-A}` → `404`; `B`'s own list does not include A's reminder.
2. A member of **family F2** cannot read/patch/delete an F1 reminder → `404`.

**Expected**: reminders are private to their owner; no cross-member or cross-family access.

## Automated validation

```bash
pnpm --filter @famifinances/api test:e2e -- reminder-crud
pnpm --filter @famifinances/api test:e2e -- reminder-validation
pnpm --filter @famifinances/api test:e2e -- reminder-isolation
pnpm --filter @famifinances/api test:e2e -- reminder-openapi-parity
pnpm --filter @famifinances/api test:e2e -- reminder-log-privacy
pnpm --filter @famifinances/api test        # unit: reminders.service.spec
```

**Green when**: CRUD + validation + per-member/family isolation hold, the served Swagger matches
`reminder.openapi.yaml`, and no label/content appears in logs.
