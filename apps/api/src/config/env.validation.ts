import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, validateSync } from 'class-validator';

/**
 * Typed environment schema. The app fails fast at boot if required secrets are
 * missing (constitution Principle II: secrets outside the repo, validated inputs).
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  MONGODB_URI!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsInt()
  @Min(60)
  ACCESS_TOKEN_TTL = 900;

  @IsInt()
  @Min(300)
  REFRESH_TOKEN_TTL = 2592000;

  @IsInt()
  @Min(60)
  OTP_TTL = 900;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM_ADDRESS = 'no-reply@famifinances.local';

  // Optional: when empty, the console mail stub is used in development.
  @IsOptional()
  @IsString()
  MAIL_PROVIDER_API_KEY?: string;

  // DEV-ONLY escape hatch. When 'true', the console mail stub additionally logs the full
  // message body (including the OTP) so a developer can complete email verification against
  // the stub locally. Intentionally overrides FR-027 for local debugging only; the adapter
  // hard-refuses to honor it when NODE_ENV=production. Defaults to 'false' (OTP never logged).
  @IsIn(['true', 'false'])
  MAIL_DEV_LOG_OTP = 'false';

  // SEC-01 · security edge configuration (secure defaults; externally tunable, FR-010).
  // Comma-separated CORS origin allowlist; empty = deny all cross-origin browser access.
  @IsOptional()
  @IsString()
  CORS_ALLOWED_ORIGINS = '';

  // Max JSON request body size (bytes / `kb` / `mb` suffix); oversized → 413.
  @IsString()
  @IsNotEmpty()
  REQUEST_BODY_LIMIT = '100kb';

  // Stricter per-IP rate limit for credential endpoints, on top of the global baseline.
  // @Type coerces the env string to a number before @IsInt (env values arrive as strings).
  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  AUTH_RATE_TTL_MS = 60000;

  // OFF-01 · retention window (days) for idempotency records before automatic TTL purge.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  IDEMPOTENCY_TTL_DAYS = 7;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return validated;
}
