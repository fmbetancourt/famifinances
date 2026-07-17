import { IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateFamilyRequest } from '@famifinances/contracts';

export class CreateFamilyDto implements CreateFamilyRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
