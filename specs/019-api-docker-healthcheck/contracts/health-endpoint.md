# Contract: `GET /health` liveness endpoint

The API exposes one new HTTP surface. This contract is the assertion set `/speckit-tasks`,
the e2e test, and reviewers verify.

## Route

| Property | Value |
|----------|-------|
| Method | `GET` |
| Path | `/health` — **no** `/api` prefix, **no** `/v1` version segment |
| Auth | **Public** — no `@UseGuards(JwtAuthGuard)`; the API has no global auth guard |
| Rate limit | **Skipped** — handler annotated `@SkipThrottle()` (global throttler is 30/60s) |
| Success status | `200 OK` |
| Success body | `{"status":"ok"}` (Content-Type `application/json`) |
| Latency | < 200 ms (SC-002) |
| Dependencies | None — no Mongoose/DB injection; static response (liveness, not readiness) |

## NestJS wiring contract

- **Controller** (`apps/api/src/health/health.controller.ts`):

  ```ts
  @SkipThrottle()
  @Controller({ path: 'health', version: VERSION_NEUTRAL })
  export class HealthController {
    @Get()
    check(): { status: 'ok' } {
      return { status: 'ok' };
    }
  }
  ```

- **Module** (`apps/api/src/health/health.module.ts`): declares `HealthController`, no providers;
  imported by `AppModule`.
- **Prefix exclusion** (`apps/api/src/app.setup.ts`):

  ```ts
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  ```

## Acceptance assertions

- **A1 (US2/AC1, SC-002)**: `GET http://localhost:3000/health` → `200` with body exactly
  `{"status":"ok"}`.
- **A2 (FR-003)**: request succeeds with **no** `Authorization` header (public).
- **A3 (path)**: `GET /api/v1/health` → `404` (route is neutral/excluded; it lives at `/health`).
- **A4 (throttle)**: rapid repeated `GET /health` calls do **not** yield `429` (skip-throttle).
- **A5 (privacy, Principle II)**: response contains no field other than `status`; no DB detail.

## e2e test contract (`apps/api/test/health.e2e-spec.ts`)

Uses the shared `createApp()` harness so global prefix + versioning behave as in production.

- asserts A1 (200 + body), A2 (no auth), A3 (`/api/v1/health` is 404).
