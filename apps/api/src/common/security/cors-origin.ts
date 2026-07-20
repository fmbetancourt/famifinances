/** The callback shape Nest's `enableCors({ origin })` expects. */
type CorsCallback = (error: Error | null, allow?: boolean) => void;

/**
 * Builds a **deny-by-default** CORS origin check from an allowlist (SEC-01 FR-002):
 * requests with no `Origin` (native app / server-to-server) are allowed; browser
 * requests are granted cross-origin access only if their `Origin` is allowlisted;
 * everything else is denied. An empty allowlist denies all cross-origin browser access.
 */
export function buildCorsOrigin(
  allowedOrigins: string[],
): (origin: string | undefined, callback: CorsCallback) => void {
  const allowed = new Set(allowedOrigins);
  return (origin, callback) => {
    if (!origin || allowed.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}
