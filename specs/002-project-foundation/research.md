# Phase 0 Research: FND-01 (Project Foundation)

**Feature**: Monorepo, Environments, Docker, CI & Shared Contracts
**Date**: 2026-07-17

Resolves the unknowns for the remaining FND-01 work. Existing AUTH-01 infrastructure (workspace,
Docker, env validation, contracts, API test harness) is treated as given; decisions below concern CI,
the lint gate, mobile tooling, native-dependency handling in CI, and merge blocking.

## R1 · CI provider and workflow shape

- **Decision**: **GitHub Actions**, one workflow `.github/workflows/ci.yml`, triggered on
  `pull_request` (targeting `main`) and `push` to `main`. Jobs run on `ubuntu-latest` with Node 24.18.0 and
  pnpm via `pnpm/action-setup` + `actions/setup-node` (cache: `pnpm`).
- **Gate sequence** (single job to reuse one install, or a small matrix):
  1. `pnpm install --frozen-lockfile` (reproducible; runs approved build scripts)
  2. `pnpm --filter @famifinances/contracts build` (contracts dist for downstream typecheck)
  3. type check (API + mobile)
  4. lint (workspace)
  5. API unit + e2e tests
  6. build (API + contracts)
- **Rationale**: The repo is on GitHub → Actions is the zero-setup default (Principle V). A single
  workflow keeps it simple; caching the pnpm store keeps it under the 10-minute budget (SC-002).
- **Alternatives considered**: CircleCI/GitLab CI (extra account/config for no benefit); a job matrix
  per package (more parallelism but more install overhead for a small repo — start single, split later
  if the budget is threatened).

## R2 · Native dependencies & the mongod binary in CI

- **Decision**: Rely on the root `pnpm.onlyBuiltDependencies` (already lists `argon2`, `@nestjs/core`,
  `mongodb-memory-server`) so `--frozen-lockfile` builds them. Cache the pnpm store **and** the
  `mongodb-memory-server` binary cache (`~/.cache/mongodb-memory-server`) between runs.
- **Rationale**: `argon2` fetches/【builds a prebuilt native binding; `mongodb-memory-server` downloads
  a ~66 MB mongod on first install. Caching both keeps CI fast and avoids re-downloading each run.
- **Alternatives considered**: A service container for Mongo (unnecessary — tests already use the
  in-memory server, and it needs no secrets, keeping fork PRs runnable); vendoring the mongod binary
  (large repo bloat).

## R3 · Making the lint gate real

- **Decision**: Install `eslint` + `typescript-eslint` as root dev dependencies so the existing
  `eslint.config.mjs` (flat config, no-`any` + named-exports rules with the Expo-router override) is
  executable. Add a root `lint` script that runs ESLint across `apps/**` and `packages/**`.
- **Rationale**: `eslint.config.mjs` exists from AUTH-01 but its dependencies were never installed, so
  the lint gate is currently a no-op. FND-01 must make it enforce the constitution's Principle VI rules.
- **Alternatives considered**: Biome (faster, single binary) — deferred to avoid re-authoring the
  existing ESLint config mid-foundation; can be revisited later.

## R4 · Mobile package in CI (typecheck/lint without a native build)

- **Decision**: Complete `apps/mobile` to a **typecheck-able, bootable Expo base**: add `tsconfig.json`
  (extends `tsconfig.base`, with Expo/React Native types), `app.json`/`app.config`, `babel.config.js`,
  and Expo/React dev dependencies. CI runs mobile **lint + type check** only; a full native/EAS build
  is out of scope for FND-01 CI.
- **Rationale**: A full Expo build in CI is slow and needs native toolchains/credentials — disproportion
  for the pilot (Principle V). Type check + lint catch the contract-drift and typing regressions that
  matter (SC-004, SC-007), and satisfy "gates cover both packages" (FR-009). Bootability is verified
  locally (US5).
- **Alternatives considered**: `expo export`/EAS build in CI (heavy, credentialed); skipping mobile in
  CI entirely (violates FR-009 — gates must cover both packages).

## R5 · Blocking merges on failing gates

- **Decision**: Add a **branch protection rule on `main`** requiring the CI status check to pass (and
  requiring the branch to be up to date) before merge. Configured via the GitHub API (`gh api`).
- **Rationale**: FR-008/SC-003 require that a failing gate blocks the merge; the workflow alone reports
  status but does not enforce it — branch protection is what makes the gate binding.
- **Alternatives considered**: `auto-merge` only (does not prevent manual merges); a merge queue
  (overkill for a solo repo).
- **Flag**: Branch protection is a repository-settings change requiring admin; it is applied once and is
  outside the code diff. It should be part of the FND-01 setup checklist.

## R6 · Mobile bootstrap approach (Expo)

- **Decision**: Initialize the mobile package **in place** (keep the existing `app/` screens and
  `src/features/auth` code from AUTH-01) by adding the missing Expo config files and dev dependencies,
  rather than scaffolding a fresh app and porting. Verify it starts with `expo start` locally.
- **Rationale**: The screens/hooks already exist and align with the shared contracts; only the toolchain
  (config + deps) is missing. In-place completion avoids churn and preserves the AUTH-01 UI work
  (closes the deferred T003).
- **Alternatives considered**: `create-expo-app` fresh scaffold then port (unnecessary rework); leaving
  mobile source-only (fails FR-011/US5).

## R7 · Root command surface (developer ergonomics)

- **Decision**: Provide root scripts that fan out across the workspace: `install` (implicit),
  `typecheck` (`pnpm -r typecheck`), `lint` (`pnpm -r lint`), `test` (`pnpm -r test`), `build`
  (`pnpm -r build`), plus documented Docker commands. Document them in the root `README.md`.
- **Rationale**: FR-010/SC-001 require documented, single-entry commands for onboarding; `pnpm -r`
  respects the workspace dependency order (contracts before consumers).
- **Alternatives considered**: A task runner (Turborepo/Nx) — powerful caching but added complexity not
  yet justified for a two-app repo (Principle V); revisit if build times grow.

## Resolved unknowns summary

| Unknown | Resolution |
|---------|------------|
| CI provider & shape | GitHub Actions, one workflow, PR + push-to-main triggers (R1) |
| Native deps / mongod in CI | onlyBuiltDependencies + pnpm store & mongod binary caching (R2) |
| Lint gate | install eslint + typescript-eslint; root lint script (R3) |
| Mobile in CI | typecheck + lint only; no native build in CI (R4) |
| Merge blocking | branch protection on `main` requiring the CI check (R5) |
| Mobile bootstrap | complete Expo in place, keep existing screens (R6) |
| Command surface | root fan-out scripts + README (R7) |

All Technical Context unknowns are resolved. No `NEEDS CLARIFICATION` remains.
