import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';
import { PERIOD_PATTERN } from './set-budget.dto';

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class BudgetReportQuery {
  // Optional; the service defaults it to the current calendar month.
  @IsOptional()
  @Transform(trim)
  @Matches(PERIOD_PATTERN, { message: 'period must be a valid calendar month (YYYY-MM).' })
  period?: string;
}
