import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AccountType, CreateAccountRequest } from '@famifinances/contracts';
import { ACCOUNT_TYPES } from '../financial-account.schema';
import { IsCalendarDate } from './is-calendar-date.validator';

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

  // Calendar date (YYYY-MM-DD) — date-only, matching the OpenAPI `format: date` contract.
  @IsCalendarDate()
  startDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  institution?: string | null;
}
