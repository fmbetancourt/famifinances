# Implementation Plan: Node.js v24.18.0 Runtime Environment Upgrade (ENV-01 / FAM-23)

**Branch**: `018-upgrade-node-v24` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-upgrade-node-v24/spec.md`

## Summary

Raise the mandated Node.js runtime for the entire monorepo (`apps/api`, `apps/mobile`,
`packages/contracts`) from the current `>=20` baseline to a pinned `v24.18.0`, and make that
version fail-fast enforceable. The change is configuration-only: update `engines`, add
`.nvmrc` / `.node-version` / `.npmrc` (`engine-strict=true`), bump the API Docker base image
and the GitHub Actions Node version, and align documentation. No application code, data model,
or API contract changes. Success is verified by a fully green `pnpm install --frozen-lockfile`
+ `typecheck && lint && test && build` under Node v24.18.0, plus a demonstrated fail-fast on
older Node.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict, no `any`); Node.js **v24.18.0** (up from `>=20`);
pnpm 10.32.1 (Corepack-pinned via `packageManager`)

**Primary Dependencies**: NestJS (API), Expo/React Native (mobile), Mongoose; native modules
`argon2@^0.41.1` and `mongodb-memory-server@^10.0.1` (both already in
`pnpm.onlyBuiltDependencies`)

**Storage**: MongoDB (Mongoose) — unaffected by this change

**Testing**: Jest (API unit + e2e via mongodb-memory-server; mobile unit via jsdom). Must remain
100% green under Node v24.18.0.

**Target Platform**: Linux CI runner (`ubuntu-latest`), Docker `node:24.18.0-alpine` runtime for
the API, and developer machines (macOS/Linux) running Node v24.18.0 locally.

**Project Type**: pnpm monorepo (modular monolith) — `apps/api`, `apps/mobile`,
`packages/contracts`

**Performance Goals**: N/A (no runtime performance target changes; upgrade inherits V8/Node v24
gains passively)

**Constraints**: Zero test regressions; zero new native-module compilation failures; fail-fast
before any package script runs on Node `< 24.18.0`; no dependency version bumps beyond what the
Node upgrade forces.

**Scale/Scope**: ~7 configuration/documentation files changed; no source files. Blast radius is
every developer and CI run, so verification is the primary risk control.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| I. Family Data Isolation | N/A — no data access paths touched. |
| II. Financial Privacy by Design | N/A — no logging/telemetry/secret surface changes. |
| III. Derived Balance Integrity | N/A — no movement/balance logic touched. |
| IV. Test-First & Definition of Done | **Upheld** — the DoD for this feature is the existing suite passing under the new runtime; the Independent Test (`typecheck && lint && test && build` green) is the acceptance gate. No new product tests required, but the full suite is a mandatory quality gate. |
| V. Modular Monolith Simplicity (YAGNI) | **Upheld** — smallest possible change: config only, no new tooling, no architecture change. Alpine base retained rather than switching to slim. |
| VI. Shared, Documented Contracts | **Upheld** — pnpm enforced, TS strict unchanged; documentation (`README.md`, `specs/002-project-foundation`) updated to keep the runtime contract accurate. |
| VII. Fast & Accessible Capture UX | N/A — no UI change. |

**Result**: PASS (initial). No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/018-upgrade-node-v24/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output — Runtime Environment Specification matrix
├── quickstart.md        # Phase 1 output — validation & rollback guide
├── contracts/           # Phase 1 output — per-file configuration contracts
│   └── runtime-config.md
├── checklists/          # Pre-existing
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

This feature edits configuration and documentation only. Affected paths:

```text
package.json                      # engines.node: ">=20" → ">=24.18.0"  (FR-001)
.nvmrc                            # NEW — "24.18.0"                      (FR-002)
.node-version                     # NEW — "24.18.0"                      (FR-002)
.npmrc                            # NEW — "engine-strict=true"           (FR-007)
apps/api/Dockerfile               # FROM node:20-alpine → node:24.18.0-alpine (FR-003)
.github/workflows/ci.yml          # setup-node node-version: 20 → '24.18.0'   (FR-004)
README.md                         # "Node.js 20 LTS" → "Node.js v24.18.0"     (FR-006)
specs/002-project-foundation/*    # quickstart/research/plan/contracts Node 20 → v24.18.0 (FR-006)
```

**Structure Decision**: No new source directories. The monorepo layout is unchanged; only the
runtime-version declarations distributed across build, CI, container, and docs surfaces are
edited to converge on `v24.18.0`. FR-005 (native builds) is a verification obligation on the
existing `apps/api` dependencies, not a code change.

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty.
