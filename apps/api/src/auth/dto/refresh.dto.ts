import { IsString, IsNotEmpty } from 'class-validator';
import type { RefreshRequest } from '@famifinances/contracts';

export class RefreshDto implements RefreshRequest {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
