import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import type { UpdateTransferRequest } from '@famifinances/contracts';
import { IsCalendarDate } from '../../common/validators/is-calendar-date.validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Partial edit of a transfer. Every field optional (at least one enforced in the service). */
export class UpdateTransferDto implements UpdateTransferRequest {
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
  fromAccountId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  toAccountId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(280)
  note?: string | null;
}
