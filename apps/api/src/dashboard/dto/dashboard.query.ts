import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class DashboardQuery {
  // Optional; the controller defaults it to the current calendar month.
  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be a valid calendar month (YYYY-MM).' })
  period?: string;
}
