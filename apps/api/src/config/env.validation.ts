import { plainToInstance } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, validateSync } from 'class-validator';

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
