# FamiFinances API (AUTH-01)

NestJS modular monolith providing identity and access for FamiFinances: registration, sign-in,
session lifecycle (short-lived access JWT + rotating refresh token with reuse detection), protected
access with session-scoped identity, email verification (soft gate), and self-service password reset.

## Requirements

- Node.js 20+ and pnpm
- MongoDB (local Docker container or Atlas). Tests use `mongodb-memory-server` — no running DB needed.

## Environment variables

Copy `.env.example` to `.env` and fill real values. **Never commit `.env`.**

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MONGODB_URI` | yes | — | Mongo connection string |
| `JWT_SECRET` | yes | — | HS256 signing secret for access tokens (use a long random value) |
| `ACCESS_TOKEN_TTL` | no | `900` | Access token lifetime (seconds) |
| `REFRESH_TOKEN_TTL` | no | `2592000` | Refresh token lifetime (seconds) |
| `OTP_TTL` | no | `900` | One-time code lifetime (seconds) |
| `MAIL_FROM_ADDRESS` | no | `no-reply@famifinances.local` | Sender address for OTP emails |
| `MAIL_PROVIDER_API_KEY` | no | — | Transactional email provider key; when empty the dev console stub is used |

The app validates the environment at boot and fails fast if required secrets are missing.

## Mail provider (OTP delivery)

Email delivery is behind a `MailPort` (hexagonal). In development, leave `MAIL_PROVIDER_API_KEY`
empty to use the console stub (it logs metadata only, never the code). For the pilot, implement a
real adapter (Resend is the documented first choice — see `specs/001-user-auth/research.md` R5) and
bind it in `src/mail/mail.module.ts`. Choosing the provider, verifying the sending domain (DKIM), and
setting a monthly cost cap are pilot-launch decisions.

## Run

```bash
pnpm install                       # from the repo root
# Local MongoDB (optional; Atlas also works)
docker run -d --name famifinances-mongo -p 27017:27017 mongo:7
pnpm --filter @famifinances/api start:dev
```

The API is served under `/api/v1`; interactive OpenAPI docs are at `/api/docs`.

Container image / compose (api + Mongo):

```bash
docker compose up --build
```

## Test & verify

```bash
pnpm --filter @famifinances/api test        # unit
pnpm --filter @famifinances/api test:e2e    # integration/e2e + latency smoke (mongodb-memory-server)
pnpm --filter @famifinances/api typecheck   # strict tsc, no emit
pnpm --filter @famifinances/api build        # nest build
```

## Endpoints (v1)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | — | Create an account (email starts unverified) |
| POST | `/auth/login` | — | Sign in; returns access + refresh tokens |
| POST | `/auth/token/refresh` | — | Rotate tokens (reuse detection) |
| POST | `/auth/logout` | bearer | Revoke the presented session |
| GET | `/auth/me` | bearer | Current session identity |
| POST | `/auth/email/verify` | bearer | Verify email with a 6-digit code |
| POST | `/auth/email/verify/resend` | bearer | Re-send the verification code |
| POST | `/auth/password/reset/request` | — | Request a reset code (uniform response) |
| POST | `/auth/password/reset/confirm` | — | Set a new password; revokes all sessions |
| POST | `/families` | bearer + verified | Create a family; caller becomes Owner |
| GET | `/families/me` | bearer + family | The caller's family and its members |
| POST | `/families/me/invites` | bearer + owner | Issue a single-use invite code |
| POST | `/families/join` | bearer + verified | Join a family by redeeming a code |
| DELETE | `/families/me/members/:accountId` | bearer + owner | Remove a member (Owner cannot be removed) |
| POST | `/families/me/leave` | bearer + family | Leave the family (Owner cannot leave) |

See `specs/001-user-auth/` and `specs/003-family-membership/` for the specs, plans, data models, and OpenAPI contracts.

## Family scoping (Principle I enforcement point)

Family-scoped features (ACC-01, TXN-01, BUD-01, …) MUST resolve the acting family
**from the session, never from client input**. FAM-01 provides the reusable enforcement point:

- **`FamilyScopeGuard`** (`src/families/guards/family-scope.guard.ts`) — resolves the caller's
  membership from `request.user.accountId` and sets `request.family = { familyId, role }`. It
  ignores any family id supplied in the body/params/query. Returns `404` when the caller belongs
  to no family. Use it together with `JwtAuthGuard`.
- **`@CurrentFamily()`** (`src/families/decorators/current-family.decorator.ts`) — injects that
  `{ familyId, role }` context into a handler. This is the **only** approved source of the acting
  family for scoped queries.
- **`FamilyRoleGuard` + `@Roles('owner')`** (`src/families/guards/family-role.guard.ts`) — owner-only
  authorization; runs **after** `FamilyScopeGuard` (it reads `request.family.role`).

Downstream feature modules should depend on `@CurrentFamily()`/`FamilyScopeGuard` for their data
boundary rather than re-deriving the family, so Principle I stays enforced in one place.
