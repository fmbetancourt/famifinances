import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { MovementHistoryQuery, MovementType } from '@famifinances/contracts';
import { MOVEMENT_TYPES } from '../../movements/movement.schema';
import { IsCalendarDate } from '../../common/validators/is-calendar-date.validator';

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Query for `GET /history`. All filters optional; combined with AND. */
export class HistoryQuery implements MovementHistoryQuery {
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

  // Trimmed; a blank/whitespace term is treated as no note filter (in the service/repo).
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  // Query params arrive as strings; @Type coerces to number before @IsInt. Default 20 (service).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
