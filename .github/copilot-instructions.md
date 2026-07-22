# FamiFinances — Copilot Instructions

FamiFinances is a collaborative family finance MVP for Chile. It is a **pnpm monorepo** with a NestJS API, an Expo/React Native mobile app, and shared DTO contracts. The family is the privacy boundary; data isolation and financial privacy are non-negotiable.

## Build, Test & Lint

All commands run from the repository root.

### Install
```bash
pnpm install --frozen-lockfile
```

Installs approved native packages (`argon2`, `mongod`, `@nestjs/core`) via pnpm's `onlyBuiltDependencies` security gate.

### Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm --filter @famifinances/contracts build` | Compile shared DTO types (required before API/mobile builds) |
| `pnpm typecheck` | Type-check all three packages (strict, no emit) |
| `pnpm lint` | Lint all TS sources (enforces no-`any`, named exports; exception: Expo Router files must be defaults) |
| `pnpm test` | Run API unit + e2e tests in-memory Mongo; no external service needed |
| `pnpm build` | Build contracts + API |

### API Only
```bash
pnpm --filter @famifinances/api start:dev         # Watch mode
pnpm --filter @famifinances/api test              # Unit tests (src/**/*.spec.ts)
pnpm --filter @famifinances/api test:e2e          # E2E + smoke tests (test/**/*.e2e-spec.ts, test/**/*.smoke-spec.ts)
pnpm --filter @famifinances/api test:cov          # Coverage (unit + e2e, enforced gates ≥90% / branches ≥80%)
```

#### Running Specific Tests

```bash
# Unit test for a specific module
pnpm --filter @famifinances/api test -- auth.service.spec.ts

# E2E test for a specific feature (isolation, log-privacy, balance, etc.)
pnpm --filter @famifinances/api test:e2e -- family-isolation.e2e-spec.ts

# All tests matching a pattern (e.g., all isolation tests)
pnpm --filter @famifinances/api test:e2e -- isolation

# Run with verbose output (useful for debugging)
pnpm --filter @famifinances/api test:e2e -- --verbose --no-coverage
```

#### Test Suite Patterns

The test suite follows these patterns across the API:
- **`*-isolation.e2e-spec.ts`** — Cross-family authorization tests (non-negotiable; ensures Principle I)
- **`*-log-privacy.e2e-spec.ts`** — Verify no monetary amounts or PII in logs (Principle II)
- **`*-openapi-parity.e2e-spec.ts`** — Ensure actual responses match Swagger/OpenAPI definitions
- **`*.service.spec.ts`** — Unit tests for business logic (services); use mocks, no DB
- **`*.e2e-spec.ts`** — Integration tests exercising controller → service → in-memory MongoDB
- **`.smoke-spec.ts`** — Latency baseline and critical-path smoke tests (e.g., auth flow duration)

### Full Verification (Clean Checkout → Green)
```bash
pnpm install --frozen-lockfile
pnpm --filter @famifinances/contracts build
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

### CI Pipeline (`quality-gates` job)
The GitHub workflow (`/.github/workflows/ci.yml`) runs this sequence on every PR and push to `main`:
1. Install (frozen lockfile)
2. Build contracts
3. Type-check
4. Lint
5. Test + coverage (with 3-attempt retry for e2e environmental flake)
6. Build (API)

Merge blockers: any failing gate. The retry strategy absorbs residual e2e flake while still catching real defects.

**Coverage enforcement (`QLT-01`):** The `test:cov` gate runs **both** unit and e2e tests against a focused set of high-risk modules (guards, repositories, balance/spending/summary services, budgets):
- **Threshold:** ≥90% on statements/functions/lines; ≥80% on branches
- **Why branches are lower:** Defensive early-return guards in authorization code reduce branch coverage structurally; 80% captures the critical logic without diminishing returns
- **Command:** `pnpm --filter @famifinances/api test:cov`

## Architecture

### The Three Pillars

**`packages/contracts`** — Source of truth for API ↔ mobile types
- TypeScript DTO enums and interfaces (no runtime logic)
- Built first; consumed by API and mobile
- Example: `AuthUserDto`, `MovementDto`, `BudgetDto`

**`apps/api`** — NestJS REST backend
- Modular structure: `auth`, `families`, `movements`, `accounts`, `transfers`, `budgets`, `dashboard`, etc.
- Each module typically has `.controller.ts`, `.service.ts`, `.schema.ts` (Mongoose), and tests
- Family scope MUST be derived from authenticated session, never from request params/body
- Cross-family authorization tests are mandatory for any family-scoped endpoint
- JWT-based session (short-lived access token + rotating refresh token)
- MongoDB via Mongoose for persistence

**`apps/mobile`** — Expo + Expo Router
- React Native screens-only (tests not yet configured)
- File-based routing (`app/` directory); each file MUST be a default export (Expo Router requirement)
- Consumes contracts for type safety

### Key Design Patterns

**Family Data Isolation (Principle I)**
- Every request carries the authenticated user → family scope
- All financial queries are family-scoped server-side
- No endpoint accepts a `familyId` from the client; derive it from `req.user.familyId`
- Roles (Owner/Member) enforced at service layer
- Cross-family authorization tests are part of Definition of Done

**Financial Privacy by Design (Principle II)**
- Monetary amounts, notes, and sensitive data NEVER logged to external tools
- Passwords hashed with Argon2; tokens short-lived
- `.env` secrets never committed

**Derived Balances (Principle III)**
- Account balances computed from initial balance + movements, never stored as editable truth
- Transfers simultaneously decrease source + increase destination
- Movements record author, date, and creation timestamp; edits/deletions auditable

**Contracts as the Source of Truth (Principle VI)**
- Mobile and API synchronize via `packages/contracts`
- TypeScript strict mode; `any` forbidden; named exports preferred
- API changes update OpenAPI docs (`/api/docs` in dev)

### Module Structure (API)

```
src/
  auth/              # registration, sign-in, sessions, refresh, token lifecycle
  families/          # family CRUD, scope derivation, family-scope guards
  memberships/       # family member roles and permissions
  accounts/          # deprecated; use financial-accounts (legacy compatibility)
  financial-accounts/# account CRUD (bank, cash, credit card, wallet); derived balances
  movements/         # income/expense records; soft-delete with audit trail (movementEvents)
  transfers/         # cross-account transfers; soft-delete with audit trail (transferEvents)
  categories/        # system defaults (seeded) + custom family categories; discriminated by scope
  budgets/           # estimated vs. actual by category; period-based summaries
  dashboard/         # aggregated balance, budget, net-worth, and money summaries
  history/           # queryable audit trail of movements, transfers, and account snapshots
  capture/           # movement capture form schemas and validation; reusable templates per family
  reminders/         # recurring expense/income reminders with cron scheduling
  export/            # CSV export of movements/transfers with sanitized output
  invitations/       # family invite code lifecycle and redemption
  sessions/          # session state management and token lifecycle
  one-time-codes/    # OTP delivery abstraction (mail port) for email verification, resets
  mail/              # abstract mail port; console stub for dev, configurable provider
  idempotency/       # idempotency key tracking (fingerprint + request dedup) for safe retries
  common/            # shared utilities, decorators, guards, repository base
  config/            # environment validation, constants, logging policy
  database/          # Mongoose connection, shared schema utilities
```

## Key Conventions

### TypeScript & ESLint

**Strict mode:** `"strict": true` in all `tsconfig.json` files.

**No `any`:** ESLint enforces `@typescript-eslint/no-explicit-any: error`. Use `unknown` and guard.

**Named exports only** (except Expo Router files):
```typescript
// ✅ Good
export interface UserDto { … }
export class AuthService { … }

// ❌ Bad (rejected by ESLint)
export default class AuthService { … }

// ✅ Exception: Expo Router files MUST be defaults
// apps/mobile/app/dashboard.tsx
export default function Dashboard() { … }
```

**Unused variables:** Prefix with `_` to signal intent (`_unused`, `_e`).

### NestJS API Patterns

**Module + Service + Controller:**
```typescript
// family.service.ts — business logic, no HTTP details
export class FamilyService {
  async createFamily(dto: CreateFamilyDto, userId: string): Promise<FamilyDto> { … }
}

// family.controller.ts — HTTP routing, input validation, response formatting
@Controller('families')
export class FamilyController {
  @Post()
  async create(@Body() dto: CreateFamilyDto, @CurrentUser() user: AuthUserDto) {
    return this.familyService.createFamily(dto, user.id);
  }
}
```

**Schema (Mongoose):**
```typescript
// family.schema.ts
@Schema()
export class Family {
  @Prop({ required: true })
  name: string;
}
export const FamilySchema = SchemaFactory.createForClass(Family);
```

**Guards for family scope:**
```typescript
// Use @FamilyScoped() or similar decorator (if exists) or
// extract session user, validate they belong to the family
```

### Environment Variables

API requires: `.env` (never committed). See `apps/api/.env.example`.

Critical vars:
- `MONGODB_URI` — connection string (MongoDB Atlas or local Docker)
- `JWT_SECRET` — HS256 signing key (long random value)
- `MAIL_PROVIDER_API_KEY` — email service key; empty = console stub (dev only)

Test suite uses `mongodb-memory-server` — no running DB needed.

### Testing

**Unit tests** cover service business logic and cross-family guards.
```bash
pnpm --filter @famifinances/api test
```

**E2E tests** exercise the full controller → service → database flow with in-memory Mongo.
```bash
pnpm --filter @famifinances/api test:e2e
```

Both run with `--forceExit` to clean up resources. See `jest.config.js` and `test/jest-e2e.json`.

**Log Privacy Enforcement:** Every feature module includes a `*-log-privacy.e2e-spec.ts` file that verifies monetary amounts and sensitive data **never appear in error responses or application logs**. When adding an endpoint that handles money, budgets, or PII, write a corresponding `*-log-privacy` test:

```typescript
it('should not leak monetary amount in error message', async () => {
  // Attempt invalid operation
  const res = await request.post('/movements').send(invalid);
  // Assert error message contains no CLP value, account balance, etc.
  expect(res.body).not.toMatch(/\d{3,}\s*(CLP|pesos)/);
});
```

### Commits & PRs

**Format:** Conventional commits in English (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).

**Conversation:** Spanish is okay; code, comments, commits are English.

**Constitution compliance:** Every plan and PR MUST respect the seven core principles (see `.specify/memory/constitution.md`):
1. Family Data Isolation (non-negotiable)
2. Financial Privacy by Design
3. Derived Balance Integrity
4. Test-First & Definition of Done
5. Modular Monolith Simplicity
6. Shared, Documented Contracts
7. Fast & Accessible Capture UX

**Definition of Done:**
- Meets all acceptance criteria
- Tests (unit + e2e) for high-risk logic (auth, money, family scope)
- Respects family isolation; cross-family tests included if applicable
- No financial data in logs
- OpenAPI updated if API changes
- Mobile UX validated on physical device if mobile changes
- No capability outside approved Must/Should scope

### Code Review Checklist (AI-Assisted)

When reviewing or authoring changes:
1. **Family Scope:** Is family scope derived from session, not client input?
2. **Authorization:** Are cross-family tests present and passing?
3. **Financial Privacy:** No monetary amounts, PII, or secrets in logs/errors?
4. **Balance Integrity:** Transfers affect both source and destination? Edits/deletes auditable?
5. **Type Safety:** Strict mode, no `any`, named exports (except Expo Router)?
6. **Contracts:** Are DTO changes mirrored in `packages/contracts`?
7. **Tests:** Critical paths (auth, transfers, scope checks) tested?
8. **Scope Creep:** Is this in the Must-first backlog or an approved deviation?

## Common Tasks

#### Add an API Endpoint

1. Define the DTO in `packages/contracts/src/auth|family|movement|etc.ts`
2. Build contracts: `pnpm --filter @famifinances/contracts build`
3. Add the controller method; inject service
4. Implement service method (check family scope from session)
5. Add unit tests (mock MongoDB) and e2e tests (in-memory Mongo)
6. If the endpoint modifies family-scoped data, add a cross-family isolation test (`*-isolation.e2e-spec.ts`)
7. If the endpoint handles money or PII, add a log-privacy test (`*-log-privacy.e2e-spec.ts`)
8. Update OpenAPI docs (NestJS Swagger auto-docs from decorators)
9. Lint & typecheck: `pnpm lint && pnpm typecheck`
10. Verify coverage: `pnpm --filter @famifinances/api test:cov` (high-risk modules only)
11. Full verification: `pnpm test && pnpm build`

#### E2E Test Execution & Concurrency

E2E tests run with **`maxWorkers: 1`** (fully sequential) to avoid:
- MongoDB connection pool exhaustion (in-memory-server has strict limits)
- Test flakiness from race conditions
- Unpredictable timeouts

This means e2e tests are slower (~3–5 min locally) but reliable. **Do not change `maxWorkers` to parallelize** — it breaks isolation. If e2e suite becomes a bottleneck, break into focused suites (e.g., `test:e2e:auth`, `test:e2e:budget`) but keep each at `maxWorkers: 1`.

### Fix a Type Error

- Rebuild contracts first: `pnpm --filter @famifinances/contracts build`
- Recheck: `pnpm typecheck`

### Run a Single Test

```bash
pnpm --filter @famifinances/api test -- auth.service.spec.ts
pnpm --filter @famifinances/api test:e2e -- auth.e2e-spec.ts
```

### Debug E2E Test Failure

E2E tests use `maxWorkers: 1` (sequential) and `mongodb-memory-server`; they occasionally flake due to timing or binary availability.

1. **Environmental flake:** CI retries 3 times (`.github/workflows/ci.yml`); if local, retry once:
   ```bash
   pnpm --filter @famifinances/api test:e2e -- --detectOpenHandles
   ```

2. **MongoDB binary:** Ensure `mongodb-memory-server` is cached/installed:
   ```bash
   rm -rf ~/.cache/mongodb-memory-server
   pnpm install  # re-download mongod binary
   pnpm --filter @famifinances/api test:e2e -- <spec>
   ```

3. **Isolation/authorization failures:** Check that `FamilyScopeGuard` is applied to the endpoint and cross-family tests exist:
   - Search for `*.isolation.e2e-spec.ts` files for the failing module
   - Ensure both `describe('isolation', …)` and `describe('authorization', …)` blocks pass

4. **Timeout or connection issues:** Increase Jest timeout and run a single spec:
   ```bash
   pnpm --filter @famifinances/api test:e2e -- family-isolation.e2e-spec.ts --testTimeout=10000
   ```

### Add a Mongoose Model

1. Create `src/module/module.schema.ts` with `@Schema()` class
2. Import in `src/database/database.module.ts` or the feature module
3. Inject via `@InjectModel(ModelName)` in the service

### Idempotency for Safe Retries

New endpoints that mutate state (POST, PATCH, DELETE) MUST support idempotency via the `Idempotency-Key` header to handle transient failures and retries safely:

1. Add `@UseGuards(IdempotencyGuard)` to the controller method
2. The guard computes a fingerprint from request body/params (via `IdempotencyService.fingerprint()`)
3. On first call: stores the fingerprint + response; returns 201/200
4. On retry (same key): returns cached response without re-executing logic (201/409 if earlier failed)
5. Test with `idempotency-helpers.ts`; verify `idempotency-*.e2e-spec.ts` patterns

```typescript
@Post()
@UseGuards(IdempotencyGuard)
async create(@Body() dto: CreateMovementDto, @IdempotencyKey() key: string) {
  // The guard ensures this runs once per unique `key`, even if the client retries
  return this.movementsService.create(dto);
}
```

### Update Shared Contracts

1. Edit `packages/contracts/src/subdir/file.ts`
2. Build: `pnpm --filter @famifinances/contracts build`
3. API and mobile automatically see changes on next typecheck/build

### Session & Token Lifecycle (Auth Patterns)

FamiFinances uses **short-lived access tokens + rotating refresh tokens with reuse detection** (Principle II):

- **Access Token (900s default):** Issued on login/refresh; stateless JWT containing `accountId`, `familyId`, `role`
- **Refresh Token:** Rotates on every refresh; old token is revoked; reuse of a revoked token → `401` (prevents token compromise)
- **Decorator:** Use `@CurrentUser()` to extract token claims (never derive family from client input)
- **Revocation:** `POST /auth/logout` revokes the current session; all previous tokens become invalid

When testing auth flows, use the refresh endpoint:
```bash
pnpm --filter @famifinances/api test:e2e -- refresh.e2e-spec.ts
pnpm --filter @famifinances/api test:e2e -- refresh-reuse.e2e-spec.ts  # reuse detection
```

### Test Helpers & Setup

The e2e test suite provides reusable helpers in `apps/api/test/`:

```bash
# Core helpers
family-helpers.ts       # Create families, manage members
account-helpers.ts      # Create/archive accounts
movement-helpers.ts     # Create movements with defaults
transfer-helpers.ts     # Create transfers between accounts
category-helpers.ts     # Seed/lookup categories
budget-helpers.ts       # Create and query budgets
capture-helpers.ts      # Create capture templates
dashboard-helpers.ts    # Query dashboard summaries
history-helpers.ts      # Query audit trails
reminder-helpers.ts     # Create/manage reminders
export-helpers.ts       # Export and parse CSV
idempotency-helpers.ts  # Test idempotent retries
```

These helpers accept an authenticated `request` (from `create-test-app`) and handle family scoping automatically. Use them to reduce test boilerplate:

```typescript
const { family } = await createFamily(request);
const { account } = await createAccount(request, { familyId: family.id });
const { movement } = await createMovement(request, { accountId: account.id, amount: 100 });
```

## Spec Kit & Project Memory

- **`.specify/memory/constitution.md`** — the project's seven core principles and governance
- **`.specify/`** — spec-driven development artifacts (feature specs, plans, tasks)
- **`docs/quality-gates.md`** — detailed CI gate rationale
- **`docs/security-checklist.md`** — security review checklist (includes audit baseline)

## Dependencies & Governance

- **pnpm@10:** workspace package manager (mandatory; no npm or yarn)
- **Node 20 LTS:** minimum
- **NestJS 10:** framework
- **Mongoose 8:** ODM for MongoDB
- **Expo 51:** mobile framework
- **TypeScript 5.6:** strict mode
- **ESLint 9 + typescript-eslint 8:** linting

Security: high/critical advisories in `apps/api` production dependencies are blocking. Accepted risks (with rationale) live in `package.json` → `pnpm.auditConfig` and linked in `docs/security-checklist.md`.

## Quick Links

- **README.md** — project overview and everyday commands
- **apps/api/README.md** — API-specific setup, environment, endpoints
- **apps/api/.env.example** — required and optional environment variables
- **/.github/workflows/ci.yml** — CI/CD pipeline definition
- **.specify/memory/constitution.md** — project principles and governance
