import { Transform } from 'class-transformer';
import { IsInt, IsPositive, IsString, Matches, MinLength } from 'class-validator';
import type { SetBudgetRequest } from '@famifinances/contracts';

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Calendar month 'YYYY-MM' (real month 01–12). */
export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class SetBudgetDto implements SetBudgetRequest {
  @Transform(trim)
  @Matches(PERIOD_PATTERN, { message: 'period must be a valid calendar month (YYYY-MM).' })
  period!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  categoryId!: string;

  // Positive whole-peso CLP amount; @IsInt rejects fractional, @IsPositive rejects <= 0.
  @IsInt()
  @IsPositive()
  plannedAmount!: number;
}
