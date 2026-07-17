# Implementation Plan: User Authentication & Access Control (AUTH-01)

**Branch**: `001-user-auth` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-user-auth/spec.md`

## Summary

AUTH-01 delivers identity and access for FamiFinances: registration, sign-in, session lifecycle
with a short-lived access credential and a rotating renewal credential, protected-resource
enforcement that derives identity solely from the session, email verification via one-time code
(soft gate on family/financial actions), and self-service password reset that revokes all sessions.
Technical approach: a single NestJS `auth` module inside the modular monolith (`apps/api`), MongoDB
via Mongoose for accounts / refresh sessions / one-time codes, JWT access tokens plus opaque rotating
refresh tokens (hashed at rest, reuse-detected), argon2id password and code hashing, a swappable
mail port for OTP delivery, and Expo/React Native auth screens (`apps/mobile`) consuming typed,
OpenAPI-backed contracts from `packages/contracts`.

## Terminology (spec ↔ implementation)

The spec is deliberately technology-agnostic. This plan and the contracts use concrete terms; the
mapping below prevents drift when reading across artifacts:

| Spec term | Implementation term |
|-----------|---------------------|
| access credential | access token (JWT, HS256) |
| renewal credential | refresh token (opaque, rotating, SHA-256 hashed) |
| one-time code | OTP (6-digit numeric) |
| authenticated session | JWT access token + a `refreshSessions` record |

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no `any`). Node.js 20 LTS (API); Expo SDK (latest
stable at implementation start) + React Native (mobile).

**Primary Dependencies**:
- API: NestJS, `@nestjs/swagger` (OpenAPI), Mongoose, `@nestjs/jwt` + Passport JWT strategy,
  `argon2` (password + code hashing), `class-validator` / `class-transformer` (input validation),
  `@nestjs/throttler` (rate limiting), `@nestjs/config` (secrets from env).
- Mobile: Expo Router, `expo-secure-store` (token storage), a typed API client generated from the
  shared contract, a form/validation helper.
- Shared: `packages/contracts` exposes DTO types and the OpenAPI document consumed by both apps.

**Storage**: MongoDB (Atlas) via Mongoose. Collections: `accounts`, `refreshSessions`, `oneTimeCodes`.

**Testing**: Jest + Supertest against the Nest app (unit + integration/e2e, in-memory or ephemeral
Mongo); React Native Testing Library + Jest (mobile). Mandatory: session-identity/authorization
tests proving identity comes from the session and foreign identifiers are ignored; no-secrets-in-logs
test.

**Target Platform**: iOS 15+ / Android (Expo managed); Node API in a Docker container deployed to a
managed container service.

**Project Type**: Mobile + API monorepo (`apps/mobile`, `apps/api`, `packages/contracts`).

**Performance Goals**: Pilot scale (3–5 families, tens of users). Sign-in and token refresh server
processing p95 < 300 ms; user-facing sign-in < 30 s (SC-002); registration-to-signed-in < 2 min
(SC-001).

**Constraints**: Access credential short-lived (~15 min); refresh rotating with reuse detection; all
inputs validated server-side; no passwords/tokens/codes/financial data in logs; identity always from
the authenticated session; all traffic over TLS.

**Scale/Scope**: Invited pilot; modest volume, strict isolation and privacy guarantees.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation | AUTH-01 builds the enforcement point: an auth guard + `@CurrentUser` extraction that derives identity from the verified session and ignores caller-supplied identifiers (FR-011). Family scoping itself lands in FAM-01; here we provide the session identity and tests that reject foreign identifiers. | PASS |
| II | Financial Privacy by Design | argon2id password hashing; hashed single-use OTPs; short-lived access + rotating refresh; `@nestjs/throttler` rate limits; secrets via env/config outside the repo; log filter guarantees no passwords/tokens/codes/amounts. | PASS |
| III | Derived Balance Integrity | No balances or movements in this feature. | N/A |
| IV | Test-First & Definition of Done | Tests authored alongside each slice; auth logic (the highest-risk area) covered including authorization/no-enumeration/no-secrets-in-logs; API documented in OpenAPI. | PASS |
| V | Modular Monolith Simplicity (YAGNI) | One `auth` module in the monolith; opaque refresh in Mongo (no extra infra like Redis for the pilot); no microservices/WebSockets. | PASS |
| VI | Shared, Documented Contracts | OpenAPI document + `packages/contracts` DTO types shared by both apps; TypeScript strict, no `any`, named exports; hexagonal ports (MailPort, hashing, token, repositories). | PASS |
| VII | Fast & Accessible Capture UX | Minimal auth screens, one primary action each; numeric OTP entry; errors conveyed with text + icon, never color alone; amounts N/A here. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/auth.openapi.yaml`. Design holds all gates: opaque revocable refresh + argon2id + hashed
single-use OTPs + uniform error responses + log redaction (II, IV); single `auth` module with
hexagonal ports and no new infrastructure (V); OpenAPI + `packages/contracts` shared types (VI);
identity strictly from the token `sub` with an authorization test (I). No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── auth.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts          # register, login, refresh, logout, verify, reset endpoints
│   │   ├── auth.service.ts             # orchestration
│   │   ├── services/
│   │   │   ├── password.service.ts     # argon2id hash/verify (HashingPort impl)
│   │   │   ├── token.service.ts        # JWT sign/verify + refresh rotation (TokenPort impl)
│   │   │   └── one-time-code.service.ts# OTP generate/verify (verification + reset)
│   │   ├── guards/jwt-auth.guard.ts     # protected-resource enforcement
│   │   ├── decorators/current-user.decorator.ts  # identity from session only
│   │   ├── strategies/jwt.strategy.ts
│   │   └── dto/                          # request/response DTOs (class-validator)
│   ├── accounts/
│   │   ├── account.schema.ts            # Mongoose schema/model
│   │   └── account.repository.ts        # AccountRepositoryPort impl
│   ├── sessions/
│   │   ├── refresh-session.schema.ts
│   │   └── refresh-session.repository.ts
│   ├── one-time-codes/
│   │   ├── one-time-code.schema.ts
│   │   └── one-time-code.repository.ts
│   ├── mail/
│   │   ├── mail.port.ts                 # MailPort interface (hexagonal)
│   │   └── providers/resend-mail.adapter.ts
│   └── common/
│       ├── filters/                     # error mapping, uniform auth responses
│       └── logging/redaction.ts         # strips secrets/amounts from logs
└── test/
    ├── auth.e2e-spec.ts
    └── authorization.e2e-spec.ts        # identity-from-session, no-enumeration, no-secrets-in-logs

apps/mobile/
├── app/
│   └── (auth)/
│       ├── sign-up.tsx
│       ├── sign-in.tsx
│       ├── verify-email.tsx
│       ├── forgot-password.tsx
│       └── reset-password.tsx
└── src/features/auth/
    ├── api/                             # typed client from packages/contracts
    ├── hooks/                           # useAuth, useSession
    └── storage/secure-token-store.ts    # expo-secure-store

packages/contracts/
├── src/auth/                            # shared request/response DTO types
└── openapi/auth.openapi.yaml            # source of truth mirrored in specs/.../contracts
```

**Structure Decision**: Mobile + API monorepo (constitution DEC-004). Authentication is a single
cohesive NestJS module using hexagonal ports (hashing, token, mail, repositories) so infrastructure
choices (mail provider, refresh store) stay swappable without touching domain logic. Shared DTO types
and the OpenAPI document live in `packages/contracts` to make client/server drift a compile-time error
(Principle VI).

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
