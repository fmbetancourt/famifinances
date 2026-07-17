import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import type { EmailRequest, ResetConfirmRequest } from '@famifinances/contracts';

export class EmailDto implements EmailRequest {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @MaxLength(254)
  email!: string;
}

export class ResetConfirmDto implements ResetConfirmRequest {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @MaxLength(254)
  email!: string;

  @Matches(/^[0-9]{6}$/, { message: 'A 6-digit code is required.' })
  code!: string;

  @IsString()
  @MaxLength(128)
  newPassword!: string;
}
