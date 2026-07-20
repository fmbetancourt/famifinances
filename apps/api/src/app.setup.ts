import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { UniformErrorFilter } from './common/filters/uniform-error.filter';
import { LoggingInterceptor } from './common/logging/logging.interceptor';
import { buildCorsOrigin } from './common/security/cors-origin';
import { CORS_ALLOWED_ORIGINS, SECURITY_HEADERS } from './config/security';

/**
 * Shared app configuration applied identically by production bootstrap (`main.ts`)
 * and the e2e harness (`create-test-app.ts`), so the SEC-01 edge hardening — security
 * headers, deny-by-default CORS — is exercised under test exactly as in production.
 * (The JSON body-size limit is set at bootstrap in `main.ts`; tests rely on the
 * equivalent default.)
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // SEC-01 · global security headers + no server-identifying banner (FR-001/FR-009).
  app.use(helmet(SECURITY_HEADERS));
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // SEC-01 · deny-by-default CORS allowlist; no-Origin clients unaffected (FR-002).
  app.enableCors({ origin: buildCorsOrigin(CORS_ALLOWED_ORIGINS), credentials: false });

  // Server-side validation for every request: reject unknown fields.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new UniformErrorFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
}
