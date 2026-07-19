import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import type { MovementType, UpdateMovementRequest } from '@famifinances/contracts';
import { MOVEMENT_TYPES } from '../movement.schema';
import { IsCalendarDate } from '../../common/validators/is-calendar-date.validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Partial edit of a movement. Every field optional (at least one enforced in the service). */
export class UpdateMovementDto implements UpdateMovementRequest {
  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  type?: MovementType;

  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsCalendarDate()
  date?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  accountId?: string;

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
