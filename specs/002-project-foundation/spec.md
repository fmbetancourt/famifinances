# Feature Specification: Project Foundation — Monorepo, Environments, Docker, CI & Shared Contracts (FND-01)

**Feature Branch**: `002-project-foundation`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "FND-01 — Monorepo, entornos, Docker, CI y contratos compartidos. Base repetible para móvil y API."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reproducible clone-to-running (Priority: P1)

A contributor (a developer or an AI agent) clones the repository and, following documented commands,
installs dependencies, runs the tests, builds, and starts the API and the mobile app — getting the
same result every time, on any clean machine.

**Why this priority**: A repeatable base is the whole point of FND-01; every other feature depends on
being able to reliably install, test, and run the project.

**Independent Test**: On a clean checkout, follow the documented steps and confirm install → tests →
build complete green without manual fixes.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the contributor runs the documented install command, **Then**
   all workspace packages (API, mobile, shared contracts) install in one step from the committed
   lockfile.
2. **Given** installed dependencies, **When** the contributor runs the documented test command,
   **Then** the API test suite runs and passes without any external service to provision manually.
3. **Given** installed dependencies, **When** the contributor runs the documented build command,
   **Then** both the API and the shared contracts build successfully.
4. **Given** two clean installs from the same lockfile, **When** each completes, **Then** they resolve
   to identical dependency versions (no drift).

---

### User Story 2 - Automated quality gates on every change (Priority: P1)

Every change proposed for merge automatically runs the project's quality gates — lint, type check,
tests, and build — and a failure blocks the merge, giving contributors fast, consistent feedback.

**Why this priority**: Without automated gates, regressions reach the main branch; CI is the missing
piece that makes the "repeatable base" trustworthy over time.

**Independent Test**: Open a change that breaks a test (or types), confirm the automated gates fail and
the change is blocked; open a passing change, confirm the gates pass and it can merge.

**Acceptance Scenarios**:

1. **Given** a proposed change, **When** it is submitted for merge, **Then** lint, type check, tests,
   and build run automatically without manual triggering.
2. **Given** a change that fails any gate, **When** the gates run, **Then** the failure is reported and
   the change cannot be merged until fixed.
3. **Given** a change that passes all gates, **When** the gates complete, **Then** the change is
   eligible to merge.
4. **Given** the gates run, **When** they execute, **Then** they cover both the API and the mobile
   package.

---

### User Story 3 - One-command containerized API (Priority: P2)

A contributor starts the API together with its datastore using a single container command, with the
system refusing to start if required secrets are missing.

**Why this priority**: Containerization makes the runtime reproducible across machines and is a
prerequisite for eventual deployment, but the project is developable without it via local processes.

**Acceptance Scenarios**:

1. **Given** the required secrets are provided, **When** the contributor runs the single container
   command, **Then** the API and its datastore start and the API is reachable.
2. **Given** a required secret is missing, **When** startup is attempted, **Then** it fails fast with
   an actionable message rather than starting in an insecure state.

---

### User Story 4 - Shared, typed contracts with drift detection (Priority: P2)

The API and the mobile app consume the same shared contract definitions, so an incompatible change to
a contract surfaces as a build/type error in the consumers instead of a runtime failure.

**Why this priority**: Shared contracts prevent client/server drift — a core reliability property —
but the apps can be developed against a stable contract without additional tooling in the short term.

**Acceptance Scenarios**:

1. **Given** a shared contract, **When** the API and mobile app are built, **Then** both consume the
   same contract package.
2. **Given** a breaking change to a contract, **When** the quality gates run, **Then** the affected
   consumer fails to build/type-check, catching the drift before merge.

---

### User Story 5 - Bootable mobile base (Priority: P3)

The mobile app builds and starts from the repeatable base, so mobile feature work can begin without
re-establishing tooling.

**Why this priority**: The backlog calls for a repeatable base for "mobile and API"; a bootable mobile
app completes that promise, but the API foundation delivers value first.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the contributor runs the documented mobile start command,
   **Then** the mobile app launches from the shared workspace and resolves the shared contracts.

---

### Edge Cases

- What happens when a required secret is absent at startup? The system MUST fail fast with a clear
  message and MUST NOT start with an insecure default.
- What happens when the lockfile is out of date relative to manifests? The reproducible install MUST
  fail rather than silently resolving different versions.
- What happens when a contract changes but a consumer is not updated? The quality gates MUST fail on
  the affected consumer before merge.
- What happens when the quality gates are slow or flaky? They MUST remain deterministic and complete
  within the target time budget so contributors trust and use them.
- What happens on a change from an external contributor/fork? The gates MUST still run (secrets not
  required for build/test where the in-memory datastore is used).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST be a single workspace in which all packages (API, mobile app, shared
  contracts) install with one command.
- **FR-002**: A clean checkout MUST install dependencies reproducibly from a committed lockfile, and an
  out-of-date lockfile MUST cause the install to fail rather than drift.
- **FR-003**: The system MUST validate required environment configuration at startup and fail fast with
  an actionable message when a required secret is missing.
- **FR-004**: Secrets MUST NOT be committed to the repository; a documented example environment file
  MUST enumerate the required variables.
- **FR-005**: The API MUST start together with its datastore via a single container command.
- **FR-006**: Shared data contracts MUST live in one package consumed by both the API and the mobile
  app, such that an incompatible contract change fails a consumer's build/type check.
- **FR-007**: Every change proposed for merge MUST automatically run the quality gates — lint, type
  check, tests, and build — without manual triggering.
- **FR-008**: A failing quality gate MUST block the change from merging.
- **FR-009**: The quality gates MUST cover both the API and the mobile package.
- **FR-010**: The project MUST provide documented commands to install, build, test, run, and
  containerize the system.
- **FR-011**: The mobile app MUST build and start from the repeatable base and resolve the shared
  contracts.
- **FR-012**: The foundation MUST be verifiable by a documented sequence that reproduces
  install → type check → tests → build green from a clean checkout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a clean clone, a contributor reaches a green test run in under 10 minutes by
  following the documented commands, with no undocumented manual steps.
- **SC-002**: The automated quality-gate run completes in under 10 minutes for a typical change.
- **SC-003**: 100% of changes merged to the main branch have passed all quality gates.
- **SC-004**: 100% of contract changes that break a consumer are caught by the gates (build/type check)
  before merge, never at runtime.
- **SC-005**: A missing required secret prevents startup 100% of the time, with an actionable message.
- **SC-006**: Two clean installs from the same lockfile resolve to identical dependency versions
  (reproducible builds).
- **SC-007**: Both the API and mobile packages are exercised by the quality gates (0 packages silently
  skipped).

## Assumptions

- A large part of this foundation was already established during AUTH-01: the pnpm workspace
  (`apps/api`, `apps/mobile`, `packages/contracts`), TypeScript strict configuration, environment
  validation with fail-fast, containerization (Dockerfile + compose), the shared typed contract
  package, and the API build/test harness (in-memory datastore for tests). FND-01 **formalizes and
  completes** this base — chiefly the automated CI quality gates and a bootable mobile (Expo) setup —
  and verifies the whole base as repeatable.
- Continuous integration runs on the repository's hosted CI service (GitHub Actions, since the repo is
  hosted on GitHub).
- The mobile package is taken from source-only to a bootable state (its toolchain initialized), so the
  "repeatable base for mobile and API" is genuinely satisfied.
- The primary contributors are the solo developer and AI agents; the foundation optimizes for
  deterministic, low-friction, reproducible workflows over multi-team tooling.
- Deployment to a hosted environment is out of scope for FND-01 (a later item); FND-01 delivers the
  reproducible build/test/run foundation and CI gates, not a production deploy pipeline.
- The tests must not require provisioning external services manually (the API suite uses an in-memory
  datastore), so CI can run them without secrets.
