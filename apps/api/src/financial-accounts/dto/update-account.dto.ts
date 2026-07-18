import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AccountType, UpdateAccountRequest } from '@famifinances/contracts';
import { ACCOUNT_TYPES } from '../financial-account.schema';
import { IsCalendarDate } from './is-calendar-date.validator';

/** Partial edit of an account. Every field is optional; unknown fields are rejected by the global whitelist. */
export class UpdateAccountDto implements UpdateAccountRequest {
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
