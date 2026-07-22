# FamiFinances

Collaborative family finance app for Chile — a modular monolith in a pnpm monorepo: a **NestJS API**,
an **Expo/React Native** mobile app, and a **shared typed contracts** package consumed by both.

- `apps/api` — NestJS API (auth, sessions; MongoDB via Mongoose)
- `apps/mobile` — Expo + Expo Router app
- `packages/contracts` — shared DTO types (source of truth for client/server contracts)

See `specs/` for the spec-driven artifacts (spec, plan, tasks) and `.specify/memory/constitution.md`
for the project principles.

## Prerequisites

- Node.js v24.18.0
- pnpm 10 (`corepack enable`)
- Docker (optional, for the containerized API)

No production secrets are needed to install, type-check, lint, test, or build.

## Install

```bash
pnpm install --frozen-lockfile   # reproducible; runs approved native build scripts (argon2, mongod)
```

## Everyday commands (run from the repo root)

| Command | What it does |
|---------|--------------|
| `pnpm --filter @famifinances/contracts build` | Build the shared contracts (needed before typecheck/build) |
| `pnpm typecheck` | Type-check every package (API, mobile, contracts) — strict, no emit |
| `pnpm lint` | Lint the whole workspace (`eslint .`; enforces no-`any` + named exports) |
| `pnpm test` | Run the API unit + e2e suites (in-memory Mongo; no external service) |
| `pnpm build` | Build all buildable packages (contracts + API) |
| `pnpm --filter @famifinances/api start:dev` | Run the API locally (watch) |
| `pnpm --filter @famifinances/mobile start` | Start the Expo app (`expo start`) |

### Quick full verification (clean checkout → green)

```bash
pnpm install --frozen-lockfile
pnpm --filter @famifinances/contracts build
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Run the API in a container

```bash
JWT_SECRET=dev-only-secret docker compose up --build   # API + MongoDB
```

The API validates its environment at startup and **fails fast** if a required secret (e.g.
`JWT_SECRET`) is missing. See `apps/api/.env.example` and `apps/api/README.md` for the full variable
list and endpoints. Never commit a real `.env`.

## Continuous integration

Every pull request and every push to `main` runs `.github/workflows/ci.yml` (job **`quality-gates`**):

```text
install (frozen) → contracts build → typecheck → lint → API test + e2e → build
```

A failing gate blocks the merge. The pnpm store and the `mongodb-memory-server` binary are cached to
keep the run fast.

### One-time: require the CI check on `main` (branch protection)

Apply once, **after the workflow has run at least once** so GitHub knows the `quality-gates` check:

```bash
gh api -X PUT repos/OWNER/REPO/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=quality-gates' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews=' \
  -F 'restrictions='
```

After this, a red `quality-gates` check makes a PR unmergeable.
