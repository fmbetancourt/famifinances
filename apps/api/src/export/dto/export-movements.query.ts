import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { MovementType } from '@famifinances/contracts';
import { MOVEMENT_TYPES } from '../../movements/movement.schema';
import { IsCalendarDate } from '../../common/validators/is-calendar-date.validator';

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Filters for `GET /export/movements` — the HIS-01 filter set, all optional and
 * combined with AND. No paging: an export is the whole matching set.
 */
export class ExportMovementsQuery {
  @IsOptional()
  @IsCalendarDate()
  from?: string;

  @IsOptional()
  @IsCalendarDate()
  to?: string;

  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  type?: MovementType;

  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}
