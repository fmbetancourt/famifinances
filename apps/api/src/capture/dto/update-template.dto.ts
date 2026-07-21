import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { MovementType, UpdateTemplateRequest } from '@famifinances/contracts';
import { MOVEMENT_TYPES } from '../../movements/movement.schema';

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Partial update — every field optional; the service requires at least one. */
export class UpdateTemplateDto implements UpdateTemplateRequest {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  type?: MovementType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  accountId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(280)
  note?: string | null;
}
