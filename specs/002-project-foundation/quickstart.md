# Quickstart & Verification: FND-01 (Project Foundation)

**Feature**: Monorepo, Environments, Docker, CI & Shared Contracts
**Date**: 2026-07-17

Proves the foundation is repeatable and that the quality gates work. References
[contracts/ci-pipeline.md](./contracts/ci-pipeline.md) and [data-model.md](./data-model.md).

## Prerequisites

- Node.js 20 LTS, pnpm 10, Docker (for the container check), git.
- No production secrets are needed for install/typecheck/lint/test/build.

## 1. Reproducible clone-to-green (SC-001, SC-006 · US1)

```bash
git clone <repo> && cd famifinances
pnpm install --frozen-lockfile         # reproducible; approved native build scripts run
pnpm -r build                          # contracts first (topological), then API
pnpm -r typecheck                      # API + mobile, strict, no emit
pnpm -r lint                           # ESLint flat config (no-any, named exports)
pnpm --filter @famifinances/api test && pnpm --filter @famifinances/api test:e2e
```

Expected: every command exits 0 with no undocumented manual steps; a second clean install from the same
lockfile resolves identical versions.

## 2. Quality gates block a bad change (FR-007, FR-008, SC-003 · US2)

- Open a PR that breaks a type or a test. Expected: the `quality-gates` check runs automatically and
  **fails**, and branch protection makes the PR unmergeable.
- Push a fix. Expected: the check passes and the PR becomes mergeable.
- Confirm the gates exercise **both** packages (API + mobile typecheck/lint) — SC-007, FR-009.

## 3. Contract drift is caught before merge (SC-004 · US4)

- Make a breaking change to `packages/contracts` (e.g. rename a field) without updating a consumer.
- Expected: `pnpm -r typecheck` (locally and in CI) fails on the affected app — never a runtime error.

## 4. One-command containerized API + fail-fast env (US3, FR-005, SC-005)

```bash
JWT_SECRET=dev-only-secret docker compose up --build   # api + mongo
```

Expected: with `JWT_SECRET` set, the API and Mongo start and the API is reachable. Running without
`JWT_SECRET` fails fast with an actionable message (compose `${JWT_SECRET:?...}` + env validation).

## 5. Mobile boots from the repeatable base (US5, FR-011)

```bash
pnpm --filter @famifinances/mobile start   # expo start
```

Expected: the Expo app launches from the shared workspace and resolves `@famifinances/contracts`.

## Expected outcome

From a clean checkout, the documented commands reproduce install → typecheck → lint → tests → build
green; CI runs the same gates on every PR and blocks merge on failure; contract drift and missing
secrets are caught before they reach runtime. At that point FND-01's Success Criteria are met and the
repository is a verified, repeatable base for API and mobile feature work.

> Note: a full native mobile (EAS) build is intentionally out of CI scope; mobile is validated by
> lint + type check in CI and by `expo start` locally.
