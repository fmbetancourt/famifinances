# Implementation Plan: Local Reminders (NTF-01)

**Branch**: `014-local-reminders` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-local-reminders/`

## Summary

NTF-01 lets each family member configure **personal reminders** (daily capture nudge, weekly/monthly
budget-review) that the mobile app turns into **on-device local notifications** — sustaining the
capture discipline the MVP's accuracy depends on (Principle VII). This slice is **backend-only**: a
documented REST surface that persists each member's reminder configuration (purpose, cadence, time,
day selector, label, enabled) scoped to the authenticated member. **The server never sends push
notifications and runs no scheduler** — delivery is on-device (Expo local notifications), deferred to
the mobile track. Reminders carry **no financial data**. It reuses AUTH-01/FAM-01 only (session +
family gate); it references no financial domain module, so the new `reminders` module has **no
dependency cycle and no `forwardRef`**.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS 10; Mongoose 8; pnpm 10.

**Primary Dependencies**: existing stack — NestJS, `@nestjs/mongoose`, `@nestjs/swagger`,
`class-validator`/`class-transformer`, `@famifinances/contracts`. Reuses AUTH-01 (`JwtAuthGuard`,
`EmailVerifiedGuard`, `@CurrentUser`) and FAM-01 (`FamilyScopeGuard`, `@CurrentFamily`). **No new
runtime dependency; no notification/push library** (delivery is on-device, out of this slice).

**Storage**: MongoDB. One **new** collection `reminders`, scoped per member. No scheduler, no queue.

**Testing**: Jest + Supertest e2e on the shared `mongodb-memory-server` harness (QLT-01), plus a unit
spec for the reminder validation. New e2e suites: CRUD, validation (cadence/day/time/label/limit),
per-member + cross-family isolation, OpenAPI parity, log privacy.

**Target Platform**: `apps/api` (Ubuntu CI + container runtime). No `apps/mobile` change this slice.

**Project Type**: Mobile + API monorepo; this feature touches the **API** and `packages/contracts`.

**Performance Goals**: pilot scale (3–5 families). All reminder ops are single indexed queries scoped
by `ownerId`; the per-member cap (20) bounds list size.

**Constraints**: Principle I isolation (owner + family from session only); no financial data or amount
in reminders/logs (II); **no server push / no scheduler / no external notification service** (V);
TS strict, named exports, OpenAPI documented (VI). Time is wall-clock `HH:MM`, interpreted by the
device's timezone — the server neither stores a timezone nor fires anything.

**Scale/Scope**: one new NestJS module (`reminders`), one collection, 5 endpoints, shared contract
types, OpenAPI doc. No change to any financial module.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Every reminder query binds `ownerId` (the member's account id) **and** `familyId` from the session, never from client input; reminders are **personal** — a member sees only their own. A foreign/malformed id resolves to null → 404. Per-member + cross-family isolation e2e are mandatory and included. | PASS |
| II | Financial Privacy by Design | Reminders carry **no financial data** — they are never populated from the money domain. The optional label is opaque user text and is **never written to logs**; log lines use ids only. | PASS |
| III | Derived Balance Integrity | Not applicable — reminders touch no balances or movements. | PASS |
| IV | Test-First & Definition of Done | e2e + unit written with the code; the new per-member `reminder.repository.ts` falls in QLT-01's ≥90% high-risk coverage scope. Backend-first → no mobile-UX change, so the physical-device DoD gate does not apply this slice (recorded in Assumptions). | PASS |
| V | Modular Monolith Simplicity (YAGNI) | One new module + one collection. **No push infrastructure, no scheduler, no queue, no external notification service** — delivery is on-device local notifications (out of this slice). One-way deps (Families only) → **no `forwardRef`**. | PASS |
| VI | Shared, Documented Contracts | OpenAPI (`contracts/reminder.openapi.yaml`) + `packages/contracts/src/reminder`; TS strict, no `any`, named exports; SOLID controller→service→repository. | PASS |
| VII | Fast & Accessible Capture UX | This feature's purpose **is** capture discipline: the daily reminder nudges timely recording. The on-device notification UX ships with the deferred mobile screen. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/reminder.openapi.yaml`. All gates hold: per-member + family isolation in the repository
(I); no financial data, label never logged (II); N/A (III); tests + coverage scope (IV); one module,
no push/scheduler/queue, no `forwardRef` (V); OpenAPI + contracts, strict TS (VI). No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/014-local-reminders/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (Reminder entity)
├── quickstart.md        # Phase 1 output (runnable validation guide)
├── contracts/
│   └── reminder.openapi.yaml   # The 5-endpoint REST contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files NTF-01 adds / edits

```text
apps/api/src/reminders/                    # NEW module
├── reminder.schema.ts                     # NEW: Mongoose schema (collection 'reminders')
├── reminder.repository.ts                 # NEW: per-member persistence (CRUD + count for the cap)
├── reminders.service.ts                   # NEW: cadence/day/time/label/limit validation + CRUD
├── reminders.controller.ts                # NEW: REST 'reminders' (any member; writes verified)
├── reminders.module.ts                    # NEW: wires the above; imports FamiliesModule only
├── reminders.service.spec.ts              # NEW: unit — cadence/day/time/label/limit rules
└── dto/
    ├── create-reminder.dto.ts             # NEW
    └── update-reminder.dto.ts             # NEW

apps/api/src/app.module.ts                 # EDITED: register RemindersModule

packages/contracts/src/reminder/index.ts   # NEW: Reminder request/summary + enums
packages/contracts/src/index.ts            # EDITED: export ./reminder

apps/api/test/
├── reminder-crud.e2e-spec.ts              # NEW: create (daily) / list / get
├── reminder-validation.e2e-spec.ts        # NEW: weekly/monthly happy + cadence/day coherence, time, custom label, cap (20)
├── reminder-manage.e2e-spec.ts            # NEW: edit / enable-disable / delete (US3)
├── reminder-isolation.e2e-spec.ts         # NEW: per-member + cross-family 404 (Principle I)
├── reminder-openapi-parity.e2e-spec.ts    # NEW: served Swagger == committed contract
├── reminder-log-privacy.e2e-spec.ts       # NEW: no label/content in logs
└── reminder-helpers.ts                    # NEW: suite helpers
```

**Structure Decision**: A single new `apps/api/src/reminders/` module (controller → service →
repository), mirroring the shape of the `capture`/`budgets` modules. It imports **only** `FamiliesModule`
(for `FamilyScopeGuard` + `@CurrentFamily`) and the Mongoose feature — it references **no financial
domain module**, so there is no cycle and **no `forwardRef`**. Reminders are **per-member**: every
query binds `ownerId` (the caller's `accountId` from `@CurrentUser`) and `familyId` (from
`@CurrentFamily`) for defense-in-depth; a member only ever reads/writes their own. The REST surface is
**5 endpoints** — enable/disable is expressed as `PATCH { enabled }`, not a separate route, keeping the
surface minimal (Principle V). Reads use `JwtAuthGuard` + `FamilyScopeGuard`; writes add
`EmailVerifiedGuard` (guard order `FamilyScope → Email`); **no `FamilyRoleGuard`** — reminders are a
personal resource. The per-member cap (20) is enforced in the service via a scoped `count`.

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
