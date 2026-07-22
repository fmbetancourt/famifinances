# Implementation Plan: Project Foundation — Monorepo, Environments, Docker, CI & Shared Contracts (FND-01)

**Branch**: `002-project-foundation` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-project-foundation/`

## Summary

FND-01 makes the FamiFinances repository a reproducible, verifiable base for both the API and the
mobile app. Much of it already exists from AUTH-01 (pnpm workspace, TS strict, Docker/compose, env
validation, shared typed contracts, API test harness). This plan focuses the remaining work on the
genuine gaps: (1) an automated CI pipeline that runs lint, type check, tests, and build on every PR and
blocks merge on failure, (2) making the `lint` gate real (ESLint is configured but its dependencies are
not installed), (3) taking the mobile package from source-only to a typecheck-able, bootable Expo base
with its own gates, and (4) a documented, repeatable verification of the whole foundation.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js v24.18.0; pnpm 10; Expo SDK (latest
stable) for mobile.

**Primary Dependencies**:
- Existing: NestJS, Mongoose, argon2 (native), `mongodb-memory-server` (downloads a mongod binary),
  `@nestjs/*`, the shared `@famifinances/contracts` package.
- New for FND-01: GitHub Actions (hosted CI); `pnpm/action-setup` + `actions/setup-node` (with pnpm
  store caching); ESLint + `typescript-eslint` (to make the lint gate executable); Expo/React Native
  dev dependencies + TypeScript config for the mobile package.

**Storage**: N/A for the foundation itself. The API test suite uses `mongodb-memory-server` (in-memory
Mongo, no external service), so CI needs no database secrets.

**Testing**: Existing Jest (API unit + e2e). CI orchestrates: contracts build → type check → lint →
API unit + e2e → build. Mobile in CI runs lint + type check (a full native Expo build is out of scope
for CI; the app is validated as bootable locally).

**Target Platform**: CI runners (`ubuntu-latest`); developer machines (macOS/Linux); Docker containers.

**Project Type**: Monorepo tooling / project infrastructure (no runtime feature surface of its own).

**Performance Goals**: CI quality-gate run < 10 min (SC-002); clean-clone to green tests < 10 min
(SC-001).

**Constraints**: reproducible installs via a committed frozen lockfile; native build scripts (argon2,
`@nestjs/core`, mongodb-memory-server) must be allowed and cached in CI (already declared in root
`pnpm.onlyBuiltDependencies`); no secrets required for build/test so forks/PRs run the gates; failing
gates must block merge (branch protection on `main`).

**Scale/Scope**: Solo developer + AI agents; optimize for determinism and low friction over multi-team
CI complexity (Principle V).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation | No data access in this feature; CI runs isolation tests authored in AUTH-01 as part of the suite. | N/A |
| II | Financial Privacy by Design | CI needs no financial data or production secrets; build/test run without secrets; env fail-fast is exercised. Secrets stay outside the repo (GitHub secrets only if a later deploy needs them). | PASS |
| III | Derived Balance Integrity | No balances in this feature. | N/A |
| IV | Test-First & Definition of Done | CI enforces the DoD mechanically: every PR runs the tests and blocks merge on failure — this operationalizes Principle IV across the project. | PASS |
| V | Modular Monolith Simplicity (YAGNI) | A single lightweight CI workflow; no extra services or orchestration; minimal jobs. No microservices/infra sprawl. | PASS |
| VI | Shared, Documented Contracts | CI makes contract drift a hard failure (typecheck of `@famifinances/contracts` consumers); enforces TS strict + no-`any` via the lint/typecheck gates. | PASS |
| VII | Fast & Accessible Capture UX | No UI in this feature. | N/A |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/ci-pipeline.md`. The design holds all gates: a single lightweight CI workflow with no extra
services (V); CI enforces the tests/DoD and contract-drift/no-`any` typecheck (IV, VI); no production
secrets in CI and env fail-fast exercised (II). No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/002-project-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (foundation structural model)
├── quickstart.md        # Phase 1 output (repeatability verification guide)
├── contracts/           # Phase 1 output
│   └── ci-pipeline.md   # CI gate contract (events, jobs, blocking semantics)
└── tasks.md             # Phase 2 output (/speckit-tasks or /speckit-converge)
```

### Source Code (repository root) — files FND-01 adds or completes

```text
.github/
└── workflows/
    └── ci.yml                    # NEW: install(cache) → contracts build → typecheck → lint → test → build

eslint.config.mjs                 # EXISTS; make runnable by installing eslint + typescript-eslint
package.json                      # EXISTS; add lint/typecheck/test scripts at the root that fan out (-r)
pnpm-workspace.yaml               # EXISTS

apps/api/                         # EXISTS (bootstrapped + tested in AUTH-01)
packages/contracts/               # EXISTS (built to dist; consumed by both apps)

apps/mobile/                      # SOURCE-ONLY today → complete to a bootable, typecheck-able base
├── package.json                  # add lint/typecheck (+ jest optional) scripts + Expo/TS dev deps
├── tsconfig.json                 # NEW: extends tsconfig.base, Expo/React Native types
├── app.json / app.config.ts      # NEW: Expo app config
├── babel.config.js               # NEW: Expo preset
└── (existing app/ + src/ screens & hooks)

README.md                         # NEW/updated: onboarding — install, build, test, run, container, CI
```

**Structure Decision**: Keep the existing monorepo layout (constitution DEC-004). FND-01 adds a single
GitHub Actions workflow and completes the mobile package's tooling; it introduces no new runtime
services. The CI workflow is the primary new "interface" and is specified in `contracts/ci-pipeline.md`.

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
