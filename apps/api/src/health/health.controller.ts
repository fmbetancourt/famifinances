import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Liveness probe (FAM-25 · US2). Public, un-versioned, and served at the un-prefixed
 * path `/health` (see the global-prefix exclusion in `app.setup.ts`). Rate limiting is
 * skipped so periodic orchestrator / Docker HEALTHCHECK probes are never throttled.
 * The payload is static — no DB dependency — because this is a liveness check of process
 * responsiveness, not a readiness/deep probe.
 */
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
