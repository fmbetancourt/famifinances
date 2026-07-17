# Implementation Plan: Family, Owner, Memberships & Secure Join (FAM-01)

**Branch**: `003-family-membership` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-family-membership/`

## Summary

FAM-01 establishes the family as the privacy boundary and owner of all financial data, on top of the
AUTH-01 session identity. It adds three entities to the NestJS modular monolith — Family, Membership,
Invitation — and the **family-scope enforcement point** (Principle I): the acting family is resolved
from the caller's membership via the authenticated session, never from client input. Owners create a
family and issue **single-use, time-limited invite codes** (reusing the AUTH-01 OTP security pattern —
CSPRNG + argon2 hash + expiry + single-use + attempt cap); invitees redeem a code in the app to become
Members. A hard **one-family-per-user** rule is enforced by a unique membership index. Creating/joining
requires a verified email (the AUTH-01 `EmailVerifiedGuard`). Owners manage members; the reusable
`FamilyScopeGuard`/`@CurrentFamily` this feature introduces is what ACC-01, TXN-01, BUD-01 will build on.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Expo/React Native mobile.

**Primary Dependencies**: existing stack — NestJS, Mongoose (MongoDB), `@nestjs/jwt` + Passport (from
AUTH-01), argon2 (hash invite codes), `class-validator`, `@nestjs/throttler`, `@nestjs/swagger`. Reuses
AUTH-01 building blocks: `JwtAuthGuard`, `@CurrentUser`, `EmailVerifiedGuard`, and the OTP security
pattern (`OneTimeCodeService` approach) for invite codes.

**Storage**: MongoDB via Mongoose. New collections: `families`, `memberships`, `invitations`.

**Testing**: Jest + Supertest (unit + e2e, `mongodb-memory-server`). Mandatory: cross-family isolation
tests (family resolved from session, foreign family id rejected), one-family-per-user enforcement,
invite reuse/expiry, owner-cannot-leave.

**Target Platform**: iOS/Android (Expo); Node API in a container.

**Project Type**: Mobile + API monorepo (`apps/api`, `apps/mobile`, `packages/contracts`).

**Performance Goals**: pilot scale (3–5 families, tens of users). Create family < 1 min (SC-001), join
< 2 min (SC-002) end-to-end; server processing p95 < 300 ms.

**Constraints**: family scope MUST come from the authenticated session's membership, never from caller
input (Principle I); invite codes short-lived, single-use, hashed at rest, rate-limited; one active
membership per user (unique index); email verification required for create/join; no secrets in logs.

**Scale/Scope**: invited pilot; strict isolation/privacy per the constitution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | FAM-01 **is** this principle's implementation: a `FamilyScopeGuard` + `@CurrentFamily` resolves the family from the caller's membership (session `sub`), rejecting any caller-supplied family id; cross-family authorization e2e tests are mandatory. | PASS (central) |
| II | Financial Privacy by Design | Invite codes are CSPRNG, argon2-hashed at rest, single-use, expiry + attempt-capped, rate-limited; no codes/secrets in logs. | PASS |
| III | Derived Balance Integrity | No balances/movements in this feature (ACC-01/TXN-01). | N/A |
| IV | Test-First & Definition of Done | TDD; isolation + one-family-per-user + invite-reuse tests authored with implementation; OpenAPI documented. | PASS |
| V | Modular Monolith Simplicity | Three cohesive modules (families, memberships, invitations) in the monolith; reuse OTP pattern; no new infrastructure. | PASS |
| VI | Shared, Documented Contracts | OpenAPI + `packages/contracts` DTO types; TS strict, no `any`; hexagonal repositories. | PASS |
| VII | Fast & Accessible Capture UX | Minimal mobile screens (create family, enter invite code, manage members) with one primary action; status via text+icon, not color alone. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/family.openapi.yaml`. The design holds all gates: family-from-session via
`FamilyScopeGuard`/`@CurrentFamily` with mandatory cross-family tests (I); hashed single-use invite
codes + no secrets in logs (II); one `auth`-layer guard + three domain modules, no new infrastructure
(V); OpenAPI + shared contracts (VI). No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/003-family-membership/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── family.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files FAM-01 adds

```text
apps/api/src/
├── families/
│   ├── family.schema.ts              # Family (name, ownerId, timestamps)
│   ├── family.repository.ts
│   ├── families.module.ts
│   ├── families.controller.ts        # create, get-my-family, remove-member, leave
│   └── families.service.ts           # orchestration (create/join/leave/remove)
├── memberships/
│   ├── membership.schema.ts          # accountId (UNIQUE → one family/user), familyId, role, status
│   ├── membership.repository.ts
│   ├── membership-event.schema.ts    # append-only audit (create/join/remove/left, actor, timestamp)
│   └── memberships.module.ts
├── invitations/
│   ├── invitation.schema.ts          # familyId, issuedBy, codeHash, expiresAt(TTL), consumedAt, attempts
│   ├── invitation.repository.ts
│   ├── invitation.service.ts         # issue/redeem (CSPRNG + argon2 + single-use, reuses OTP pattern)
│   └── invitations.module.ts
└── auth/                             # EXTEND (reuse)
    ├── guards/family-scope.guard.ts   # NEW: resolves family from membership; rejects foreign family id
    ├── guards/family-role.guard.ts    # NEW: @Roles('owner') enforcement
    └── decorators/current-family.decorator.ts  # NEW: @CurrentFamily (from session membership)

packages/contracts/src/family/         # shared DTO types (FamilySummary, MemberSummary, invite/join)
apps/mobile/app/(family)/              # create-family, join-family (enter code), members screens
```

**Structure Decision**: Keep the AUTH-01 monorepo layout. FAM-01 adds three domain modules and extends
the existing `auth` guard layer with the **family-scope** enforcement (the reusable Principle I gate).
Invite codes reuse the OTP security pattern rather than a new mechanism (Principle V). The
`@CurrentFamily`/`FamilyScopeGuard` are the contract future financial features depend on.

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
