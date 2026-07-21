// QLT-01 · absorb the residual environmental e2e flake. The full serial suite runs 80+
// files in one long-lived Jest worker; under sustained load a random suite's request
// transiently fails (all pass in isolation) — a process-level resource-pressure flake, not
// a logic bug or DB-state issue (four isolation approaches did not remove it; see
// docs/quality-gates.md). `jest.retryTimes` re-runs a transiently-failed test a bounded
// number of times so the suite is green in practice, while a genuine defect — which fails
// every attempt — still fails deterministically.
jest.retryTimes(2, { logErrorsBeforeRetry: true });
