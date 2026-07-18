import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AccountType, CreateAccountRequest } from '@famifinances/contracts';
import { ACCOUNT_TYPES } from '../financial-account.schema';

export class CreateAccountDto implements CreateAccountRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn(ACCOUNT_TYPES)
  type!: AccountType;

  // Whole-peso CLP amount; @IsInt rejects fractional values. Any sign allowed (Clarify Q1).
  @IsInt()
  initialBalance!: number;

  // ISO calendar date (YYYY-MM-DD).
  @IsISO8601({ strict: true })
  startDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  institution?: string | null;
}
