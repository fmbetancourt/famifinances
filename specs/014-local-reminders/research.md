# Research: Local Reminders (NTF-01)

**Feature**: NTF-01 · Recordatorios locales
**Date**: 2026-07-21

All open decisions were closed in `/speckit-clarify` (Session 2026-07-21): backend-only scope;
day-of-week as an English enum `monday`–`sunday`; purpose enum `{capture, budget, custom}` with a
required non-blank label for `custom`; a per-member cap of 20. This document records the resulting
technical decisions and the patterns inherited from the `capture`/`budgets` modules.

## R1 · On-device delivery only — no server push, no scheduler (the core scope call)

- **Decision**: The server **only persists reminder configuration**; it never sends a notification and
  runs **no scheduler, queue, or timer**. The mobile app reads a member's reminders and schedules the
  matching **local notifications** on-device (Expo local notifications), interpreting `timeOfDay` in
  the device's timezone. NTF-01 ships the config API + contracts; the on-device scheduling and UI are
  deferred to the mobile track.
- **Rationale**: "Local reminders" are by definition device-scheduled — no push server is needed, and
  adding one (FCM/APNs) or a server cron would introduce infrastructure the constitution forbids
  without a justified need (Principle V). Storing wall-clock `HH:MM` + cadence keeps the server
  stateless about time; the device owns firing. This mirrors the backend-first pattern of all prior
  slices.
- **Alternatives considered**: server push via FCM/APNs (**rejected** — new infra, external service,
  credential handling; out of MVP scope); a server-side scheduler that computes "due" reminders
  (**rejected** — needs a timer/cron + timezone storage for no benefit when delivery is local);
  content-aware alerts that read financial state (**rejected/out of scope** — would require push and
  couple reminders to the money domain, breaching the "no financial data in reminders" rule).

## R2 · Per-member scoping (personal resource within the family boundary)

- **Decision**: A new family-scoped collection `reminders` in a NestJS `reminders` module. A reminder
  is **owned by one member**: every query binds `ownerId` (the caller's `accountId` from
  `@CurrentUser`) **and** `familyId` (from `@CurrentFamily`) — both from the session, never from
  client input. A member reads/writes only their own reminders; a foreign/malformed id → null → 404.
  Reads use `JwtAuthGuard` + `FamilyScopeGuard`; writes add `EmailVerifiedGuard` (order
  `FamilyScope → Email`), **no `FamilyRoleGuard`** (personal resource, no Owner gate).
- **Rationale**: Reminders are personal alarms, so per-member is the correct boundary; keeping
  `familyId` too gives defense-in-depth and a consistent Principle-I scope with the rest of the app.
  The module imports **only** `FamiliesModule` (guard) — it needs no financial repository — so there
  is no dependency cycle and no `forwardRef` (Principle V).
- **Alternatives considered**: family-shared reminders (**rejected** in clarify — reminders are
  personal); scoping by `familyId` only (**rejected** — would let a member see another member's
  reminders, violating the personal boundary).

## R3 · Reminder shape & validation (cadence ⇄ day coherence, time, purpose, cap)

- **Decision**: A reminder holds `purpose` (`capture|budget|custom`), `cadence`
  (`daily|weekly|monthly`), `timeOfDay` (`HH:MM`, 24h), `dayOfWeek` (`monday`–`sunday`, weekly only),
  `dayOfMonth` (1–31, monthly only), `label` (optional; **required non-blank for `custom`**),
  `enabled` (default true). Service validation:
  - `timeOfDay` matches `^([01]\d|2[0-3]):[0-5]\d$`.
  - `daily` → both day selectors absent; `weekly` → `dayOfWeek` present (enum), `dayOfMonth` absent;
    `monthly` → `dayOfMonth` present (1–31), `dayOfWeek` absent. A wrong/missing selector → `400`.
  - `custom` → non-blank `label` (trimmed) else `400`; `label` ≤ 80 chars.
  - On create, the member's reminder `count` must be `< 20` else `409` (the cap, FR-009).
  - `dayOfMonth` **29–31** is accepted and stored; the **device** clamps to the month's last day at
    schedule time (documented — the server does not compute calendar dates).
- **Rationale**: Matching cadence to exactly its own selector prevents ambiguous configs the device
  cannot schedule. The English weekday enum is self-documenting and dodges the 0-vs-1 / week-start
  ambiguity (clarify Q). The cap bounds abuse and list size. Storing `dayOfMonth` up to 31 with a
  documented device-side last-day clamp keeps the server calendar-free (no timezone/date math).
- **Alternatives considered**: numeric weekday 0–6/1–7 (**rejected** in clarify — ambiguous);
  server-side last-day computation (**rejected** — needs a timezone + calendar logic the server
  otherwise never touches); enforcing "no duplicates" (**rejected** — a member may legitimately want
  two same-time reminders of different purpose; no uniqueness constraint).

## R4 · Contracts, privacy & no financial data

- **Decision**: Shared types in `packages/contracts/src/reminder` (enums + request/summary); the REST
  surface (5 endpoints) is documented in `contracts/reminder.openapi.yaml` (**OpenAPI 3.0.3**, nulls
  as `nullable: true` to match `@nestjs/swagger` output). An OpenAPI-parity e2e asserts the served
  Swagger matches. Log lines use ids only (`reminder.created id=… owner=…`) — **never the label**.
  Reminders are never populated from the money domain, so they carry no amount or note.
- **Rationale**: Principle VI (documented, shared, typed contracts) and Principle II (nothing sensitive
  leaves the boundary; the free-text label is opaque and unlogged). The 3.0.3 + `nullable: true`
  choice avoids the 3.1 mismatch that a prior slice hit against NestJS's generated 3.0 document.
- **Alternatives considered**: OpenAPI 3.1 null syntax (**rejected** — NestJS emits 3.0, breaks
  parity); logging the label for debuggability (**rejected** — it is user free text, kept out of
  logs by policy).

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Delivery | On-device local only; server persists config, no push/scheduler/queue — R1 |
| Scoping | Per-member (`ownerId` + `familyId` from session); Families-only import, no `forwardRef` — R2 |
| Shape/validation | purpose/cadence/time/day enums; cadence⇄selector coherence; custom→label; cap 20 — R3 |
| Contracts/privacy | `packages/contracts/src/reminder` + OpenAPI 3.0.3 parity; label never logged — R4 |
