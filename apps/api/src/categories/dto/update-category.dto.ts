import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { UpdateCategoryRequest } from '@famifinances/contracts';

/** Trims a string value before validation so whitespace-only input fails MinLength. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Rename only — kind and scope are immutable and not part of the contract. */
export class UpdateCategoryDto implements UpdateCategoryRequest {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
