import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateMovementRequest, MovementType } from '@famifinances/contracts';
import { MOVEMENT_TYPES } from '../movement.schema';
import { IsCalendarDate } from '../../common/validators/is-calendar-date.validator';

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateMovementDto implements CreateMovementRequest {
  @IsIn(MOVEMENT_TYPES)
  type!: MovementType;

  // Positive whole-peso CLP amount; @IsInt rejects fractional, @IsPositive rejects <= 0.
  @IsInt()
  @IsPositive()
  amount!: number;

  @IsCalendarDate()
  date!: string;

  @IsString()
  @MinLength(1)
  accountId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(280)
  note?: string | null;
}
