import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AccountType, UpdateAccountRequest } from '@famifinances/contracts';
import { ACCOUNT_TYPES } from '../financial-account.schema';
import { IsCalendarDate } from './is-calendar-date.validator';

/** Trims a string value before validation so whitespace-only input fails MinLength. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Partial edit of an account. Every field is optional; unknown fields are rejected by the global whitelist. */
export class UpdateAccountDto implements UpdateAccountRequest {
  // Trim first so a whitespace-only name fails @MinLength(1) instead of blanking the account.
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  type?: AccountType;

  @IsOptional()
  @IsInt()
  initialBalance?: number;

  @IsOptional()
  @IsCalendarDate()
  startDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  institution?: string | null;
}
