import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateTransferRequest } from '@famifinances/contracts';
import { IsCalendarDate } from '../../common/validators/is-calendar-date.validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTransferDto implements CreateTransferRequest {
  // Positive whole-peso CLP amount; @IsInt rejects fractional, @IsPositive rejects <= 0.
  @IsInt()
  @IsPositive()
  amount!: number;

  @IsCalendarDate()
  date!: string;

  @IsString()
  @MinLength(1)
  fromAccountId!: string;

  @IsString()
  @MinLength(1)
  toAccountId!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(280)
  note?: string | null;
}
