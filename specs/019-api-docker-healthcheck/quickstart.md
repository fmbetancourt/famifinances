# Quickstart: Validate the API Docker Build & Health Check

Run after implementing [`contracts/dockerfile.md`](./contracts/dockerfile.md) and
[`contracts/health-endpoint.md`](./contracts/health-endpoint.md). Maps to the spec's Independent
Tests and Success Criteria.

## Prerequisites

- Node.js v24.18.0 + pnpm 10.32.1 (`corepack enable`); Docker running.
- From repo root, on a shell with Node v24.18.0 active (`nvm use`).

## Scenario 1 — App-level health endpoint (US2/AC1 · SC-002)

Fast inner loop, no Docker:

```bash
pnpm --filter @famifinances/contracts build
pnpm --filter @famifinances/api test:e2e -- health   # new health.e2e-spec.ts
```

**Expected**: `GET /health` → `200` + `{"status":"ok"}` with no auth header; `GET /api/v1/health`
→ `404`; repeated calls are not throttled (A1–A4).

## Scenario 2 — Container image builds (US1/AC1 · SC-001)

```bash
docker build -t famifinances-api -f apps/api/Dockerfile .
```

**Expected**: all stages (`deps` → `build` → `runtime`) complete; **no** `nest: not found`; exit 0.

## Scenario 3 — Container boots and reports healthy (US1/AC2, US2/AC2 · SC-003)

```bash
docker run -d --name fami-api -p 3000:3000 -e JWT_SECRET=dev-only-secret famifinances-api
docker exec fami-api node -v                                  # v24.18.0
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health   # 200
sleep 30
docker inspect --format='{{json .State.Health.Status}}' fami-api      # "healthy"
docker rm -f fami-api
```

**Expected**: process boots on Node v24.x with no `MODULE_NOT_FOUND`; `/health` returns 200;
container health transitions `starting → healthy` within 30s.

> The API validates required env at startup (e.g. `JWT_SECRET`); pass it so the process boots.
> `/health` itself needs no secret and no DB connection.

## Scenario 4 — Runtime image stays lean (FR-005)

```bash
docker run --rm famifinances-api sh -c 'ls node_modules/.bin/nest 2>/dev/null && echo LEAK || echo lean'
```

**Expected**: prints `lean` — the `nest` CLI / devDependencies are absent from the runtime image.

## Definition of Done (Principle IV)

- [ ] `health.e2e-spec.ts` green (A1–A4).
- [ ] `docker build` exits 0 (SC-001).
- [ ] Container boots on Node v24.18.0; `/health` → 200 (< 200ms, SC-002).
- [ ] `docker inspect` → `"healthy"` within 30s (SC-003).
- [ ] Runtime image lean — no `nest`/devDeps (FR-005).
- [ ] Full API suite still green (`pnpm --filter @famifinances/api test && test:e2e`).
