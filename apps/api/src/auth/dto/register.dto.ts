import { IsEmail, IsString, MaxLength } from 'class-validator';
import type { RegisterRequest } from '@famifinances/contracts';

/** Registration payload. Password strength is enforced in the service (FR-002). */
export class RegisterDto implements RegisterRequest {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
