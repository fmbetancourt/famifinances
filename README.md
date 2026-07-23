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

## Running the project locally

The API validates its environment at startup and **fails fast** if a required variable is missing.
Pick one of the two options below. Never commit a real `.env`.

### Option A — API in watch mode + a local MongoDB (recommended for development)

```bash
# 1. Create your local API env from the template and set a JWT secret.
cp apps/api/.env.example apps/api/.env
#    edit apps/api/.env → set JWT_SECRET to a long random string

# 2. Start a MongoDB (skip if you already run one on :27017).
docker run -d --name fami-mongo -p 27017:27017 mongo:7

# 3. Install deps and build the shared contracts once.
pnpm install --frozen-lockfile
pnpm --filter @famifinances/contracts build

# 4. Run the API in watch mode (reads apps/api/.env).
pnpm --filter @famifinances/api start:dev
```

Then:

- API base: `http://localhost:3000/api/v1`
- Liveness probe: `http://localhost:3000/health` → `{"status":"ok"}` (public, un-prefixed)
- OpenAPI docs: `http://localhost:3000/api/docs`

### Option B — Everything in Docker (API + MongoDB)

`docker compose` reads a `.env` file in the repo root for variable substitution, so put at least
`JWT_SECRET` there (Mongo is wired up automatically by the compose file):

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env   # repo-root .env, git-ignored
docker compose up --build                          # API on :3000 + MongoDB on :27017
```

The API container ships a Docker `HEALTHCHECK` against `/health`; `docker ps` shows it as
`healthy` once booted.

### Option C — Mobile app (Expo)

With the API running (Option A or B):

```bash
pnpm --filter @famifinances/mobile start           # expo start
```

The app calls `EXPO_PUBLIC_API_BASE` (default `http://localhost:3000/api/v1`). On a **physical
device**, `localhost` points at the phone, not your machine — set it to your computer's LAN IP:

```bash
EXPO_PUBLIC_API_BASE=http://<YOUR-LAN-IP>:3000/api/v1 pnpm --filter @famifinances/mobile start
```

## Environment variables

API variables live in **`apps/api/.env`** (copy from `apps/api/.env.example`). Only the first two
have no default and must be set; the rest are safe to leave at their defaults for local development.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | ✅ | — | MongoDB connection string. Local: `mongodb://localhost:27017/famifinances` (Docker Compose injects `mongodb://mongo:27017/famifinances`). |
| `JWT_SECRET` | ✅ | — | Secret used to sign JWT access/refresh tokens. Use a long random string; the app refuses to boot without it. |
| `ACCESS_TOKEN_TTL` | | `900` | Access-token lifetime in **seconds** (15 min). |
| `REFRESH_TOKEN_TTL` | | `2592000` | Refresh-token lifetime in **seconds** (30 days). |
| `OTP_TTL` | | `900` | Lifetime in **seconds** of one-time codes (email verification / password reset). |
| `MAIL_FROM_ADDRESS` | | `no-reply@famifinances.local` | "From" address for outbound mail. |
| `MAIL_PROVIDER_API_KEY` | | *(empty)* | Mail-provider API key. Empty in dev → console mail stub (logs metadata only, never the OTP). |
| `CORS_ALLOWED_ORIGINS` | | *(empty)* | Comma-separated allowlist of browser origins. Empty = deny all cross-origin browser access (non-browser clients are unaffected). |
| `REQUEST_BODY_LIMIT` | | `100kb` | Max JSON request body size (`kb`/`mb` suffix); larger bodies get `413`. |
| `AUTH_RATE_LIMIT` | | `5` | Max requests to credential endpoints per window, per IP. |
| `AUTH_RATE_TTL_MS` | | `60000` | Window in **milliseconds** for `AUTH_RATE_LIMIT`. |
| `IDEMPOTENCY_TTL_DAYS` | | `7` | Days idempotency records are retained before automatic TTL purge. |

Mobile has one optional variable:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_API_BASE` | | `http://localhost:3000/api/v1` | Base URL the mobile app calls. Point it at your machine's LAN IP when running on a physical device. |

> `PORT` is fixed at **3000** for the container image (`EXPOSE 3000` + the `HEALTHCHECK` target).
> See `apps/api/README.md` for the full endpoint list.

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
