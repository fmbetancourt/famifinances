# Feature Specification: Node.js v24.18.0 Runtime Environment Upgrade (ENV-01 / FAM-23)

**Feature Branch**: `018-upgrade-node-v24`

**Created**: 2026-07-22

**Status**: Draft (Aclarado)

**Input**: User description: "FAM-23: Actualización de Entorno de Ejecución a Node.js v24.18.0"

## Clarifications

### Session 2026-07-22

- Q: How should the system respond if pnpm commands are executed with Node.js < v24.18.0? → A: Fail-fast immediately with an explicit error by enforcing `engine-strict=true` in `.npmrc` and `engines.node` in `package.json`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Uniform Monorepo Node.js v24.18.0 Execution (Priority: P1)

Developers and CI automation run, test, lint, and build the entire monorepo (`apps/api`, `apps/mobile`, `packages/contracts`) using Node.js v24.18.0 without runtime warnings or compatibility regressions.

**Why this priority**: Core infrastructure upgrade. Ensuring Node v24.18.0 compatibility guarantees security patches, performance gains, and alignment across local and CI environments.

**Independent Test**: Execute `node -v` (verifying `v24.18.0`), run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` across the monorepo, and confirm 100% green passing status.

**Acceptance Scenarios**:

1. **Given** a developer environment running Node.js v24.18.0, **When** `pnpm install --frozen-lockfile` and workspace verification commands are executed, **Then** all native dependencies (argon2, mongodb-memory-server) compile and all tests pass cleanly.
2. **Given** an environment running Node.js < v24.18.0, **When** running any `pnpm` command, **Then** execution halts immediately with a clear engine validation error.
3. **Given** a Docker API container build, **When** building the container image, **Then** it uses the official Node.js v24.18.0 base image and passes health checks.
4. **Given** GitHub Actions CI workflow execution, **When** triggered on pull requests, **Then** it enforces Node.js v24.18.0 and completes quality gates without failures.

---

### User Story 2 - Environment Configuration & Tooling Parity (Priority: P2)

Project configuration files (`package.json`, `.nvmrc`, `.node-version`, `README.md`) explicitly enforce Node.js v24.18.0 across all developer machines.

**Why this priority**: Prevents environment drift between local development machines and CI/CD pipelines.

**Independent Test**: Check `package.json` engines field, `.nvmrc`, `.node-version`, and `README.md` for explicit `v24.18.0` declarations.

**Acceptance Scenarios**:

1. **Given** developer setup or CI runners, **When** inspecting environment configurations, **Then** all files mandate Node.js v24.18.0 consistently.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Workspace root `package.json` MUST update engines definition to require `"node": ">=24.18.0"`.
- **FR-002**: Project configuration files (`.nvmrc`, `.node-version`) MUST specify `v24.18.0`.
- **FR-003**: API Dockerfile MUST use `node:24.18.0-alpine` (or slim equivalent) as base image.
- **FR-004**: GitHub Actions CI workflow (`.github/workflows/ci.yml`) MUST set `node-version: '24.18.0'`.
- **FR-005**: All native binary dependencies (argon2, mongodb-memory-server) MUST build and execute without deprecation warnings under Node v24.18.0.
- **FR-006**: Documentation (`README.md` and `specs/002-project-foundation`) MUST be updated to state Node.js v24.18.0 as mandatory prerequisite.
- **FR-007**: Workspace `.npmrc` MUST specify `engine-strict=true` to fail-fast on incompatible Node.js versions.

### Key Entities

- **Runtime Environment Specification**: Configuration manifest defining Node.js version, pnpm version, and native dependency bindings across local and containerized environments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of monorepo unit and E2E test suites pass under Node.js v24.18.0.
- **SC-002**: 0 build failures or unhandled native module compilation errors during clean workspace setup (`pnpm install --frozen-lockfile`).
- **SC-003**: 100% consistency across local configuration, Dockerfile, CI pipeline, and documentation for Node.js v24.18.0.
- **SC-004**: 100% of attempts to run `pnpm` on Node.js < v24.18.0 fail-fast immediately before executing package scripts.

## Assumptions

- Node.js v24.18.0 is available and compatible with pnpm package manager and current project dependencies.
