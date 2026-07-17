import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * RefreshSession — one authenticated session's rotating refresh credential.
 * See specs/001-user-auth/data-model.md. `rotationChainId` is named to avoid
 * collision with the Family domain concept.
 */
@Schema({ collection: 'refreshSessions', timestamps: true })
export class RefreshSession {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Account', index: true })
  accountId!: Types.ObjectId;

  // SHA-256 hash of the opaque refresh token (never store plaintext).
  @Prop({ required: true, index: true })
  tokenHash!: string;

  @Prop({ required: true })
  rotationChainId!: string;

  // TTL index: Mongo removes the document once it expires.
  @Prop({ required: true, type: Date, index: { expires: 0 } })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ required: true, type: Date, default: () => new Date() })
  lastUsedAt!: Date;
}

export type RefreshSessionDocument = HydratedDocument<RefreshSession>;
export const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);
