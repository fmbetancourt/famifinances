import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Invitation — a secure, single-use, time-limited invite code to join one family
 * (data-model.md). The code is high-entropy and stored as an indexable SHA-256
 * hash so redemption is O(1) even though the redeemer does not know the family
 * (the AUTH-01 refresh-token pattern; not the account-scoped OTP pattern).
 */
@Schema({ collection: 'invitations', timestamps: true })
export class Invitation {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  issuedBy!: Types.ObjectId;

  @Prop({ required: true, index: true })
  codeHash!: string;

  @Prop({ required: true, type: Date, index: { expires: 0 } })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  consumedAt!: Date | null;
}

export type InvitationDocument = HydratedDocument<Invitation>;
export const InvitationSchema = SchemaFactory.createForClass(Invitation);
