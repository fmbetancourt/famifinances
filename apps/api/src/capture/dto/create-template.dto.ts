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
import type { CreateTemplateRequest, MovementType } from '@famifinances/contracts';
import { MOVEMENT_TYPES } from '../../movements/movement.schema';

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTemplateDto implements CreateTemplateRequest {
  // Trimmed then length-checked, so a whitespace-only name fails @MinLength(1) (FR-009).
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn(MOVEMENT_TYPES)
  type!: MovementType;

  @IsString()
  @MinLength(1)
  accountId!: string;

  @IsString()
  @MinLength(1)
  categoryId!: string;

  // Optional positive whole-peso CLP amount; @IsInt rejects fractional, @IsPositive rejects <= 0.
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
