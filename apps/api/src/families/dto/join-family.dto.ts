import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { JoinFamilyRequest } from '@famifinances/contracts';

export class JoinFamilyDto implements JoinFamilyRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  code!: string;
}
