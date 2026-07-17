import { IsEmail, IsString, MaxLength } from 'class-validator';
import type { LoginRequest } from '@famifinances/contracts';

export class LoginDto implements LoginRequest {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
