import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AccountType, CreateAccountRequest } from '@famifinances/contracts';
import { ACCOUNT_TYPES } from '../financial-account.schema';
import { IsCalendarDate } from '../../common/validators/is-calendar-date.validator';

/** Trims a string value before validation so whitespace-only input fails MinLength. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAccountDto implements CreateAccountRequest {
  // Trim first so "   " fails @MinLength(1) instead of being persisted blank (schema `trim: true`).
  @Transform(trim)
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
