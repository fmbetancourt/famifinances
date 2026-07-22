# Phase 0 Research: Node.js v24.18.0 Runtime Upgrade

All spec clarifications were resolved in `spec.md` (Session 2026-07-22: fail-fast via
`engine-strict=true` + `engines.node`). No `NEEDS CLARIFICATION` markers remain in the Technical
Context. The items below capture the technical decisions required to execute the config-only
upgrade safely.

## Decision 1 — Fail-fast enforcement mechanism

- **Decision**: Add root `.npmrc` with `engine-strict=true` and set root `package.json`
  `engines.node` to `">=24.18.0"`. With `engine-strict`, pnpm aborts (`ERR_PNPM_UNSUPPORTED_ENGINE`)
  before running any lifecycle/package script when the active Node is below the range.
- **Rationale**: Directly satisfies FR-007 and SC-004 with a single, tool-native mechanism; no
  custom preinstall script to maintain (YAGNI, Principle V).
- **Alternatives considered**: A `preinstall`/`check-node` script (rejected — duplicates a
  built-in pnpm capability, adds a maintained script, and only guards `install`, not arbitrary
  script runs); `volta` pinning (rejected — introduces a new toolchain dependency not in the
  constitution's tooling constraints).

## Decision 2 — Version range vs. exact pin

- **Decision**: `engines.node` uses `">=24.18.0"` (range, per FR-001) while `.nvmrc` /
  `.node-version` pin the exact `24.18.0` for local provisioning.
- **Rationale**: FR-001 specifies `>=24.18.0`. The range allows patch/minor Node uptake without
  editing `engines` on every bump, while the version files give `nvm`/`fnm`/Volta a deterministic
  install target. This is the conventional split (loose engines gate, exact version file).
- **Alternatives considered**: Exact `24.18.0` in `engines` (rejected — would fail-fast on every
  future patch release, defeating security-patch uptake, the stated motivation).

## Decision 3 — Docker base image variant (alpine vs. slim)

- **Decision**: Keep the Alpine variant → `node:24.18.0-alpine` (replacing `node:20-alpine`) in
  `apps/api/Dockerfile`, across all four stages (`base`, and the `--from` chain inherits it).
- **Rationale**: FR-003 permits alpine "or slim equivalent". The image already builds `argon2`
  and runs on `node:20-alpine` today, so the musl toolchain path is proven; switching to slim
  would be an unrelated, larger change (Principle V). Only the `FROM node:20-alpine AS base` line
  changes — every later stage derives from `base`.
- **Alternatives considered**: `node:24.18.0-slim` (Debian/glibc) — rejected as unnecessary
  churn; `node:24.18.0` (full) — rejected, larger image with no benefit for this runtime.
- **Risk note**: `argon2@^0.41.1` must compile or resolve a musl prebuild under Node 24 / Alpine.
  Node 24 ships a newer ABI (`NODE_MODULE_VERSION` 137); verify the Docker build compiles argon2
  cleanly (FR-005) — this is the single highest-risk step and is a mandatory quickstart check.

## Decision 4 — Native module compatibility (argon2, mongodb-memory-server)

- **Decision**: No version bumps planned. Verify both build/run cleanly under Node v24.18.0 via
  a fresh `pnpm install --frozen-lockfile` and a full test run; bump only if a compatibility
  failure is observed.
- **Rationale**: `argon2@0.41` and `mongodb-memory-server@10` both target current Node LTS/stable
  lines and are already in `pnpm.onlyBuiltDependencies`. FR-005 is a verification obligation, not
  a speculative upgrade (Principle V). `mongodb-memory-server` downloads a `mongod` binary keyed
  independently of Node, so it is Node-ABI-agnostic; risk is concentrated in `argon2`'s N-API
  addon.
- **Alternatives considered**: Pre-emptively bumping argon2 (rejected — no evidence of
  incompatibility; would expand scope and the audit surface).

## Decision 5 — CI Node version declaration

- **Decision**: In `.github/workflows/ci.yml`, set `actions/setup-node` `node-version: '24.18.0'`
  (quoted, exact) and rename the step from "Set up Node 20" to reflect v24.18.0.
- **Rationale**: FR-004 mandates exact `24.18.0` in CI so the pipeline matches the pinned local
  version files and Docker base (SC-003 consistency). Quoting avoids YAML numeric coercion
  dropping the trailing zero.
- **Alternatives considered**: Reading from `.nvmrc` via `node-version-file` (attractive DRY
  option, but FR-004 explicitly requires `node-version: '24.18.0'`; keep literal to satisfy the
  requirement verbatim — can be revisited later).

## Open environment note (not a spec ambiguity)

- The current local runtime is **Node v24.14.0**, below the v24.18.0 target. After
  `engine-strict=true` lands, pnpm will fail-fast locally until the developer installs v24.18.0
  (`nvm install 24.18.0 && nvm use`, honoring the new `.nvmrc`). This is expected behavior
  (validates SC-004) and is called out in `quickstart.md` as a prerequisite, not a blocker to the
  plan. Tasks must sequence the version-file creation so local verification runs on v24.18.0.

## Consolidated outcome

No unresolved unknowns. The upgrade is a coordinated edit of version declarations across seven
config/doc surfaces plus a verification pass proving native builds and the full test suite are
green under Node v24.18.0. Proceed to Phase 1.
