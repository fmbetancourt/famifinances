import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AccountStatus = 'active' | 'disabled';

/**
 * Account (User Identity) — see specs/001-user-auth/data-model.md.
 * Balance derived elsewhere; this entity holds identity + credentials only.
 */
@Schema({ collection: 'accounts', timestamps: true })
export class Account {
  // Normalized (trimmed + lowercased) email. Unique index below.
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, default: false })
  emailVerified!: boolean;

  @Prop({ required: true, default: 'active', enum: ['active', 'disabled'] })
  status!: AccountStatus;

  @Prop({ required: true, default: 0 })
  failedLoginCount!: number;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;
}

export type AccountDocument = HydratedDocument<Account>;
export const AccountSchema = SchemaFactory.createForClass(Account);
