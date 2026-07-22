# Quickstart: Validate the Node.js v24.18.0 Upgrade

Run this guide after applying the edits in [`contracts/runtime-config.md`](./contracts/runtime-config.md)
to prove the upgrade end-to-end. It maps directly to the spec's Independent Tests and Success
Criteria.

## Prerequisites

- A Node version manager (`nvm` or `fnm`) and Docker installed.
- pnpm 10.32.1 (provided via Corepack: `corepack enable`).
- Node.js **v24.18.0** installed. The repo currently runs on v24.14.0, so install the target:

  ```bash
  nvm install 24.18.0 && nvm use   # honors the new .nvmrc (24.18.0)
  node -v                          # expect: v24.18.0
  ```

## Scenario 1 — Uniform monorepo verification (US1 / SC-001, SC-002)

```bash
corepack enable
pnpm install --frozen-lockfile        # 0 native compile errors for argon2 & mongodb-memory-server (SC-002)
pnpm --filter @famifinances/contracts build
# Root `pnpm test` runs API unit+e2e only; append the mobile unit suite to match CI (SC-001).
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @famifinances/mobile test && pnpm build
```

**Expected**: every step exits 0; no Node deprecation/`NODE_MODULE_VERSION` warnings from native
modules (FR-005); full API unit+e2e and mobile unit suites green (SC-001).

## Scenario 2 — Fail-fast on older Node (US1 AS#2 / SC-004)

With `engine-strict=true` active, switch to an unsupported Node and confirm pnpm aborts before
running scripts:

```bash
nvm install 20 && nvm use 20         # temporarily drop below the engine range
pnpm install                         # expect: ERR_PNPM_UNSUPPORTED_ENGINE (non-zero exit, no scripts run)
nvm use                              # return to 24.18.0 (.nvmrc)
```

**Expected**: pnpm halts immediately with an unsupported-engine error citing `>=24.18.0`; no
lifecycle/package script executes (SC-004).

## Scenario 3 — Docker API image (US1 AS#3 / FR-003, FR-005)

```bash
docker build -f apps/api/Dockerfile -t famifinances-api:node24 .
docker run --rm famifinances-api:node24 node -v   # expect: v24.18.0
```

**Expected**: image builds on `node:24.18.0-alpine`; `argon2` compiles cleanly against the Node 24
ABI under musl; the runtime reports v24.18.0. (If the API exposes a health endpoint, run the
container and hit it to confirm boot.)

## Scenario 4 — CI parity (US1 AS#4 / FR-004)

Open a PR against `main`. The `quality-gates` job (`.github/workflows/ci.yml`) must provision Node
`24.18.0` and complete all gates green.

**Expected**: CI log shows `Set up Node 24.18.0` resolving `v24.18.0`; typecheck, lint, audit,
test+coverage, mobile test, and API build all pass.

## Scenario 5 — Configuration consistency (US2 / SC-003)

```bash
node -e "console.log(require('./package.json').engines.node)"   # >=24.18.0
cat .nvmrc .node-version .npmrc
grep -RIn '24.18.0' apps/api/Dockerfile .github/workflows/ci.yml README.md
# Stale-reference check — must return nothing:
grep -rInE 'node[ .:_-]*(20|>=20)( |$|-lts| lts)' \
  package.json .nvmrc .node-version .npmrc apps/api/Dockerfile \
  .github/workflows/ci.yml README.md specs/002-project-foundation/
```

**Expected**: all surfaces resolve to `24.18.0`; the stale-reference grep returns no matches
(SC-003).

## Rollback

The change is config-only and fully reversible via git:

```bash
git checkout -- package.json apps/api/Dockerfile .github/workflows/ci.yml README.md specs/002-project-foundation/
git rm .nvmrc .node-version .npmrc
```

Reverting restores the `>=20` baseline with no data or schema impact.

## Definition of Done (Principle IV)

- [ ] Scenarios 1–5 pass on a machine running Node v24.18.0.
- [ ] `argon2` and `mongodb-memory-server` build with no warnings (FR-005).
- [ ] Docker image runs on `node:24.18.0-alpine` (FR-003).
- [ ] CI green on the PR with Node `24.18.0` (FR-004).
- [ ] Stale-reference grep is empty (SC-003).
