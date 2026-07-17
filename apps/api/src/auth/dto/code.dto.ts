import { Matches } from 'class-validator';
import type { CodeRequest } from '@famifinances/contracts';

export class CodeDto implements CodeRequest {
  @Matches(/^[0-9]{6}$/, { message: 'A 6-digit code is required.' })
  code!: string;
}
