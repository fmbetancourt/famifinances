# Implementation Plan: Fix API Docker Build and Health Check (FAM-25)

**Branch**: `019-api-docker-healthcheck` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-api-docker-healthcheck/spec.md`

## Summary

Make the API container image buildable and observable. Two coupled deliverables: (1) fix the
`apps/api/Dockerfile` `build` stage so pnpm-workspace binaries (`nest`) resolve — today the stage
copies only the root `node_modules`, so `nest build` fails with `nest: not found`; and (2) add an
unauthenticated `GET /health` liveness endpoint (`{"status":"ok"}`) plus a `HEALTHCHECK`
directive using Alpine BusyBox `wget`. The endpoint must resolve at the un-prefixed, un-versioned
path `/health` and must not be blocked by the global throttler. Verified by a green
`docker build`, a booting container, and `docker inspect` reporting `healthy`.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict, no `any`); Node.js v24.18.0

**Primary Dependencies**: NestJS (`@nestjs/common`, `@nestjs/core`, `@nestjs/throttler`);
pnpm 10.32.1 workspace; Docker multi-stage on `node:24.18.0-alpine` (BusyBox `wget`)

**Storage**: MongoDB (Mongoose) — **not** touched; `/health` is a liveness probe that MUST NOT
open or block on a DB connection (per clarification).

**Testing**: Jest e2e via the existing `createApp()` / test-app harness (`app.setup.ts` is shared
by prod bootstrap and tests, so prefix/versioning behavior is exercised identically); Docker build
+ `docker inspect` health assertion for the container-level criteria.

**Target Platform**: Linux container (`node:24.18.0-alpine`), port 3000.

**Project Type**: pnpm monorepo — change is confined to `apps/api` (Dockerfile + a new health
module + `app.setup.ts` wiring).

**Performance Goals**: `/health` responds < 200ms (SC-002); container reports `healthy` < 30s of
startup (SC-003).

**Constraints**: `/health` MUST be public (no JWT), version-neutral, un-prefixed (`/health`, not
`/api/v1/health`), and excluded from rate limiting so orchestrator probes never 429. Runtime image
MUST stay lean (FR-005) — no build-only tooling (`nest` CLI, devDependencies) in the final layer.

**Scale/Scope**: ~1 new module (2–3 files), edits to `Dockerfile`, `app.setup.ts`,
`app.module.ts`, and one new e2e spec.

### Resolved architecture facts (from codebase inspection)

- **No global JWT guard exists.** `JwtAuthGuard` is applied per-route via `@UseGuards`. A new route
  is therefore public by default — satisfying FR-003 with no `@Public()` plumbing.
- **A global `ThrottlerGuard` IS registered** (`app.module.ts`, 30 req/60s). `/health` must carry
  `@SkipThrottle()`.
- **`app.setup.ts` sets `setGlobalPrefix('api')` and URI versioning `defaultVersion: '1'`.** Left
  as-is, a health controller would resolve at `/api/v1/health`. The plan excludes `/health` from
  the prefix and marks the route `VERSION_NEUTRAL` so it resolves at `/health` (FR-004's `wget`
  target).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| I. Family Data Isolation | **Upheld** — `/health` is public but exposes **no** family/financial data; it returns a static `{"status":"ok"}` and touches no family-scoped query. |
| II. Financial Privacy by Design | **Upheld** — liveness payload carries no monetary amounts, notes, DB errors, or identifiers; no new logging of sensitive data. |
| III. Derived Balance Integrity | N/A — no movement/balance logic. |
| IV. Test-First & DoD | **Upheld** — an e2e test for `GET /health` (200 + `{"status":"ok"}`, public, un-prefixed) is written with the endpoint; container health asserted in quickstart. |
| V. Modular Monolith Simplicity (YAGNI) | **Upheld** — lightweight liveness only (no deep/readiness probe, no DB check) per clarification; smallest Dockerfile fix that resolves workspace binaries. |
| VI. Shared, Documented Contracts | **Attention** — `/health` is a new HTTP surface. It is an ops/liveness endpoint outside the versioned business API; documented in `contracts/health-endpoint.md` and kept out of the `/api/v1` OpenAPI surface deliberately (version-neutral). No `packages/contracts` type is needed (no client consumes it). |
| VII. Fast & Accessible Capture UX | N/A — no UI. |

**Result**: PASS (initial). No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/019-api-docker-healthcheck/
├── plan.md              # This file
├── research.md          # Phase 0 — node_modules strategy, route exposure, HEALTHCHECK tuning
├── data-model.md        # Phase 1 — HealthStatus (transient response shape)
├── quickstart.md        # Phase 1 — build + run + inspect validation
├── contracts/           # Phase 1
│   ├── health-endpoint.md   # GET /health contract
│   └── dockerfile.md        # multi-stage build/runtime contract
├── checklists/          # Pre-existing
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── Dockerfile                         # FIX build stage (workspace node_modules) + add HEALTHCHECK (FR-001,002,004,005)
└── src/
    ├── app.setup.ts                   # setGlobalPrefix('api', { exclude: [health] })  (FR-004 path)
    ├── app.module.ts                  # import HealthModule
    └── health/                        # NEW
        ├── health.module.ts
        └── health.controller.ts       # @Controller({ path:'health', version: VERSION_NEUTRAL }) @Get() @SkipThrottle()  (FR-003)

apps/api/test/
└── health.e2e-spec.ts                 # NEW — 200 + {"status":"ok"}, public, resolves at /health (SC-002)
```

**Structure Decision**: Confine the change to `apps/api`. Add a self-contained `health` module
rather than bolting the route onto an existing controller, so the version-neutral + prefix-exclude
+ skip-throttle configuration is isolated and testable. The Dockerfile fix is orthogonal to the
endpoint and lands in the same feature since SC-003 (container `healthy`) needs both.

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty.
