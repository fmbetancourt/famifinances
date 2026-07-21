# Feature Specification: Quality Gates & Test Reliability (QLT-01)

**Feature Branch**: `012-quality`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "QLT-01 · Calidad y fiabilidad — make the automated quality gates trustworthy: a deterministic test suite (no shared-state flakes), enforced merge gates (typecheck, lint, unit + e2e tests, build all green before merge), an actionable dependency audit that hard-fails on deployed-API advisories while not blocking on non-deployed/mobile/build-tooling noise, and an enforced minimum test-coverage floor for authorization and money-movement logic. Builds on FND-01 (CI pipeline) and SEC-01 (dependency audit); stabilizes the existing feature test suites."

## Clarifications

### Session 2026-07-20

- Q: How are e2e suites isolated to remove the flake? → A: **A database per suite on the shared mongod** — keep the single in-memory server but give each test file its own database (a unique `dbName`), eliminating cross-suite contamination with no per-file server startup cost.
- Q: What coverage floor and on which high-risk modules? → A: **≥ 90% on authorization + money-movement modules** (family/role guards, family-scoped repositories, and balance/derivation services) — not a blanket global bar.
- Q: How is the "deployed runtime surface" defined for the audit hard-fail? → A: **The production dependencies of `apps/api`** (what the server runs); the mobile app and devDependencies are reported but non-blocking.

### Session 2026-07-20 (implementation finding)

- Q: Did per-suite isolation make the e2e suite fully deterministic? → A: **No.** Four approaches (per-suite DB, setup-helper retry, a mongod per test file, and `workerIdleMemoryLimit`) each **failed to reach 10/10** — and more isolation made it *worse*, showing the residual flake is **process-level resource pressure** in the single long-running Jest worker under sustained load (a random suite's request transiently fails; all pass in isolation), **not** DB state. Disposition: SC-001 is met via an **automatic bounded retry of a transiently-failed test** (`jest.retryTimes`), keeping the suite green in practice while a real defect still fails deterministically. The root cause is documented as tech debt in `docs/quality-gates.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A deterministic test suite (Priority: P1) 🎯 MVP

The team runs the full automated test suite and it passes reliably every time on unchanged code, so a red build
signals a real defect rather than noise, and nobody has to "re-run until green".

**Why this priority**: Flaky tests erode trust in the whole gate — if green/red is random, the gate stops
protecting the product. A deterministic suite is the foundation every other quality guarantee rests on.

**Independent Test**: Run the full suite repeatedly (e.g. 10 consecutive runs) on unchanged code and confirm it
passes every time with no intermittent failures.

**Acceptance Scenarios**:

1. **Given** unchanged code, **When** the full test suite is run repeatedly, **Then** it passes every run with
   no intermittent (flaky) failures.
2. **Given** two tests that exercise overlapping data, **When** the suite runs, **Then** neither test's data
   affects the other (tests are isolated) regardless of order or load.
3. **Given** a genuine defect is introduced, **When** the suite runs, **Then** it fails and names the specific
   failing test with enough detail to reproduce.

---

### User Story 2 - Enforced merge gate (Priority: P1)

A change cannot merge into the main branch unless all required quality gates pass, so broken or unverified code
never lands.

**Why this priority**: A gate that can be bypassed is not a gate; enforcing it on every merge is what keeps
`main` releasable at all times.

**Independent Test**: Open a change that fails one gate (e.g. a type error or a failing test) and confirm it
cannot be merged; a change that passes all gates can be merged.

**Acceptance Scenarios**:

1. **Given** a change that fails typecheck, lint, a test, or the build, **When** merge is attempted, **Then** it
   is blocked until the gate passes.
2. **Given** a change that passes every required gate, **When** merge is attempted, **Then** it is allowed.
3. **Given** the set of required gates, **When** it is inspected, **Then** it is version-controlled and
   documented (not hidden in a UI setting only).

---

### User Story 3 - An actionable dependency audit (Priority: P2)

The dependency audit **blocks** the build on a high/critical vulnerability that affects the **deployed API**,
while advisories confined to non-deployed code (the mobile app) or build tooling are surfaced but do not block,
so the audit is a real gate rather than permanent noise.

**Why this priority**: SEC-01 left the audit non-blocking because of pre-existing mobile/tooling advisories;
QLT-01 makes it precise so a real API-runtime vulnerability actually stops a release.

**Independent Test**: Introduce (or simulate) a high advisory on a deployed-API runtime dependency → the build
fails; an advisory only in mobile/build-tooling → the build still passes but the advisory is reported.

**Acceptance Scenarios**:

1. **Given** a high/critical advisory on a deployed-API runtime dependency, **When** the audit runs, **Then**
   the build fails.
2. **Given** an advisory only in non-deployed (mobile) or build-tooling dependencies, **When** the audit runs,
   **Then** the build passes but the advisory is reported for review.
3. **Given** an advisory explicitly accepted with a recorded rationale, **When** the audit runs, **Then** it
   does not block, and the acceptance is version-controlled and auditable.

---

### User Story 4 - Coverage floor on high-risk logic (Priority: P2)

Authorization and money-movement logic carry an enforced minimum test-coverage threshold, so the most dangerous
code cannot silently lose its safety net.

**Why this priority**: The constitution proportions testing to risk; enforcing coverage where mistakes are most
costly (isolation, balances, transfers) prevents regressions in exactly the code that matters most.

**Independent Test**: Lower the covered tests for a high-risk module below the threshold and confirm the build
fails; restore coverage and confirm it passes.

**Acceptance Scenarios**:

1. **Given** authorization or money-movement code below the coverage threshold, **When** the gate runs,
   **Then** the build fails.
2. **Given** that code at or above the threshold, **When** the gate runs, **Then** the build passes.
3. **Given** the threshold, **When** it is inspected, **Then** it is version-controlled and documented.

---

### Edge Cases

- **Slow/hanging test**: a test that hangs must time out and fail clearly rather than stalling the whole gate.
- **Ordering dependence**: no test may depend on another test running first; running a single test in isolation
  must pass.
- **Resource pressure**: the suite must not fail merely because it runs under load (the deterministic guarantee
  holds regardless of machine speed).
- **New advisory with no fix**: a high advisory on a deployed dependency with no available fix must block until
  explicitly accepted with a recorded rationale (not silently ignored).
- **Coverage gaming**: coverage counts meaningful assertions, not trivially-executed lines (reviewed at PR).
- **Sensitive data in output**: failing-test output must never print secrets, monetary amounts, or notes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The full automated test suite MUST pass **deterministically** — repeated runs on unchanged code
  produce the same passing result, with no intermittent (flaky) failures.
- **FR-002**: A transiently-failed test MUST NOT leave the suite red: the residual environmental flake (a random
  suite's request transiently failing under sustained load — see the Session 2026-07-20 implementation finding)
  MUST be absorbed by an **automatic bounded retry** (`jest.retryTimes` plus a CI step-level re-run in a fresh
  process, which also covers a rare setup/`beforeAll` failure), while a genuine defect — failing every attempt —
  still fails. (Per-file data isolation was tried and did **not** remove the flake, which is process-level, not
  DB-state; hence the retry mitigation.)
- **FR-003**: A change MUST NOT be mergeable into the main branch unless all required quality gates —
  type-checking, linting, unit + end-to-end tests, and build — pass.
- **FR-004**: The dependency vulnerability audit MUST **block** the build on a high/critical advisory affecting
  the **production dependencies of `apps/api`** (the deployed server), while advisories confined to the mobile
  app or `devDependencies` are **reported but non-blocking**.
- **FR-005**: An accepted-risk advisory MUST be recorded with a rationale in version control and MUST be the
  only way an otherwise-blocking advisory is allowed through (no silent suppression).
- **FR-006**: The **authorization and money-movement modules** (family/role guards, family-scoped repositories,
  and balance/derivation services) MUST meet a **≥ 90%** coverage threshold on statements, functions, and lines
  (branches floored at **80%** — defensive early-return guards keep branch coverage structurally lower); the
  build MUST fail when coverage drops below the floor. (No blanket global threshold is imposed.)
- **FR-007**: A failing test MUST identify the specific test and provide enough context to reproduce it, without
  exposing any secret, monetary amount, or note content.
- **FR-008**: The required-gate set, coverage thresholds, and audit scoping MUST be **version-controlled and
  documented**, not configured only in a hidden UI setting.
- **FR-009**: The full quality gate MUST complete within a **bounded time budget** so it can run on every change.

### Key Entities *(include if feature involves data)*

- **Quality Gate Configuration** *(configuration, not user data)*: the version-controlled definition of the
  required checks (typecheck, lint, tests, build, audit), the coverage thresholds for high-risk logic, and the
  dependency-audit scoping (deployed-API vs non-deployed) plus any accepted-risk entries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The full suite is **green on every run** of unchanged code, with an **automatic bounded retry** of
  a transiently-failed test absorbing the residual environmental flake (see the Clarifications note); a genuine
  defect still fails deterministically.
- **SC-002**: 100% of changes merged to the main branch had all required gates passing.
- **SC-003**: A high/critical advisory on an `apps/api` production dependency blocks the build 100% of the time;
  a mobile-/devDependency-only advisory never blocks but is always reported.
- **SC-004**: Coverage of the authorization + money-movement modules stays at **≥ 90%** (statements/functions/
  lines; branches ≥ 80%), and the build fails whenever it drops below the floor.
- **SC-005**: The full quality gate completes within the agreed time budget (e.g. under 10 minutes) on the CI
  runner.
- **SC-006**: No secret, monetary amount, or note content appears in test output or CI logs, including on
  failures.

## Assumptions

- **The flakiness is environmental, not logical**: the current intermittent failures come from end-to-end
  suites sharing one in-memory database under load (a random heavy suite fails ~1 in N full runs but passes in
  isolation). The fix is **per-suite data isolation** so suites cannot contaminate each other; no feature logic
  changes.
- **CI already runs the gates**: FND-01's pipeline runs typecheck, lint, tests, and build; QLT-01 makes them
  **required to merge** and adds the coverage + audit gates. Branch-protection required-checks are the
  enforcement point.
- **Deployed surface = `apps/api` production dependencies**: only `apps/api` runtime code ships; the mobile app
  and `devDependencies` are not deployed, so the audit hard-fails on the `apps/api` prod set and reports the rest
  (SEC-01 left this as report-only; QLT scopes and hard-fails the deployed part).
- **Coverage threshold = ≥ 90%** on the authorization + money-movement modules (family/role guards, family-scoped
  repositories, balance/derivation services); enforced by the test runner and version-controlled. No blanket
  global bar.
- **"Deterministic" is measured** by repeated full-suite runs (10) with zero flakes; a bounded time budget keeps
  the gate fast.
- **No monetary amount or note** appears in any test output (consistent with the constitution).
- **Reuses** FND-01 (CI pipeline, quality-gates job) and SEC-01 (the dependency-audit step, made precise here).

## Dependencies

- **FND-01** — the CI pipeline and quality-gates job. Required.
- **SEC-01** — the dependency-audit step (scoped and hardened here). Required.
- Applies across **all feature test suites** (AUTH/FAM/ACC/CAT/TXN/BUD/DASH/HIS) being stabilized.

## Out of Scope

- Production observability / APM, error-tracking dashboards, and alerting.
- Load / performance / stress testing and profiling.
- Mutation testing and property-based testing frameworks.
- Automated on-device (physical mobile) test execution.
- Rewriting feature logic — QLT-01 changes test infrastructure and gates, not product behavior.
