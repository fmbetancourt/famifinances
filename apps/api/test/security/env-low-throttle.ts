// Imported FIRST by security-auth-throttle.e2e-spec.ts, before `createTestApp`, so
// `security.ts` (re-evaluated per test file by Jest) reads a low credential rate limit.
// Restored to the suite default (high) in the spec's afterAll.
process.env.AUTH_RATE_LIMIT = '3';
process.env.AUTH_RATE_TTL_MS = '60000';
