import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OneTimeCodeType = 'email_verification' | 'password_reset';

/**
 * OneTimeCode — a pending email-verification or password-reset challenge.
 * See specs/001-user-auth/data-model.md. Codes are single-use, short-lived,
 * and stored only as an argon2id hash (FR-027).
 */
@Schema({ collection: 'oneTimeCodes', timestamps: true })
export class OneTimeCode {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Account', index: true })
  accountId!: Types.ObjectId;

  @Prop({ required: true, enum: ['email_verification', 'password_reset'] })
  type!: OneTimeCodeType;

  @Prop({ required: true })
  codeHash!: string;

  // TTL index: Mongo removes the document once it expires.
  @Prop({ required: true, type: Date, index: { expires: 0 } })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  consumedAt!: Date | null;

  @Prop({ required: true, default: 0 })
  attemptCount!: number;
}

export type OneTimeCodeDocument = HydratedDocument<OneTimeCode>;
export const OneTimeCodeSchema = SchemaFactory.createForClass(OneTimeCode);
