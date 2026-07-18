import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { CategoryKind, CreateCategoryRequest } from '@famifinances/contracts';
import { CATEGORY_KINDS } from '../category.schema';

/** Trims a string value before validation so whitespace-only input fails MinLength. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCategoryDto implements CreateCategoryRequest {
  // Trim first so "   " fails @MinLength(1) instead of being persisted blank (schema `trim: true`).
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn(CATEGORY_KINDS)
  kind!: CategoryKind;
}
