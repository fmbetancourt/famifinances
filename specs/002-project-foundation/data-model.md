# Phase 1 Structural Model: FND-01 (Project Foundation)

**Feature**: Monorepo, Environments, Docker, CI & Shared Contracts
**Date**: 2026-07-17

FND-01 has no runtime data entities. This document models the **structural elements** of the
foundation and their relationships instead — the "things" the plan and tasks operate on.

## Workspace packages

| Package | Path | Role | State |
|---------|------|------|-------|
| `@famifinances/api` | `apps/api` | NestJS API (build/test target) | Exists (AUTH-01) |
| `@famifinances/mobile` | `apps/mobile` | Expo/React Native app | Source-only → complete toolchain (FND-01) |
| `@famifinances/contracts` | `packages/contracts` | Shared typed DTOs consumed by both apps | Exists; builds to `dist` |

**Relationships**: both apps depend on `@famifinances/contracts` (`workspace:*`). `pnpm -r` builds in
topological order (contracts first). A breaking contract change must fail a consumer's type check.

## CI quality gates (jobs / steps)

| Gate | Command (per package where applicable) | Blocking? |
|------|----------------------------------------|-----------|
| Install (reproducible) | `pnpm install --frozen-lockfile` | yes |
| Contracts build | `pnpm --filter @famifinances/contracts build` | yes |
| Type check | `pnpm -r typecheck` (API + mobile) | yes |
| Lint | `pnpm -r lint` (workspace, ESLint flat config) | yes |
| Tests | API `pnpm --filter @famifinances/api test` + `test:e2e` | yes |
| Build | `pnpm --filter @famifinances/api build` (+ contracts) | yes |

All gates are **blocking**: failure prevents merge (enforced by branch protection, not just reported).

## Required environment variables (fail-fast at API startup)

Documented in `apps/api/.env.example`; validated by the env schema (AUTH-01). Not needed by CI
build/test (the API suite uses an in-memory datastore).

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | yes | Datastore connection (runtime only) |
| `JWT_SECRET` | yes | Token signing (runtime only) |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` / `OTP_TTL` | no (defaults) | Session/OTP lifetimes |
| `MAIL_FROM_ADDRESS` | no (default) | OTP sender |
| `MAIL_PROVIDER_API_KEY` | no | Empty → dev mail stub |

## Foundation configuration artifacts

| Artifact | Path | State |
|----------|------|-------|
| Workspace manifest | `pnpm-workspace.yaml` | Exists |
| Root scripts (fan-out) | `package.json` | Exists → add `typecheck`/`lint`/`test`/`build` fan-out |
| Lockfile (reproducibility) | `pnpm-lock.yaml` | Exists; CI installs `--frozen-lockfile` |
| Shared TS base | `tsconfig.base.json` | Exists |
| Lint config | `eslint.config.mjs` | Exists → install ESLint deps to make runnable |
| Container (API) | `apps/api/Dockerfile`, `docker-compose.yml` | Exists |
| CI workflow | `.github/workflows/ci.yml` | **New (FND-01)** |
| Mobile Expo config | `apps/mobile/{app.json,babel.config.js,tsconfig.json}` | **New (FND-01)** |
| Onboarding docs | `README.md` (root) | **New/updated (FND-01)** |
| Branch protection | GitHub repo setting on `main` | **New (FND-01, via API)** |

## Invariants

- Installs are reproducible: the same lockfile yields identical dependency versions (SC-006);
  `--frozen-lockfile` fails on drift.
- Every gate covers both apps where applicable; no package is silently skipped (SC-007, FR-009).
- No production secret is required to run the gates (fork PRs run green on build/test).
- Contract drift is a compile-time failure in consumers, never a runtime surprise (SC-004).
