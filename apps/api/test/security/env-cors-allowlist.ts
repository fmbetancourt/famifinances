// Imported FIRST by security-cors.e2e-spec.ts, before `createTestApp`, so `security.ts`
// (re-evaluated per test file by Jest) reads a non-empty CORS allowlist. Restored to the
// suite default in the spec's afterAll.
process.env.CORS_ALLOWED_ORIGINS = 'https://app.famifinances.cl';
