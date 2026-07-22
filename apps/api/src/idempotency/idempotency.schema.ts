import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IdempotencyOperation = 'movement.create' | 'transfer.create';
export const IDEMPOTENCY_OPERATIONS: IdempotencyOperation[] = ['movement.create', 'transfer.create'];

export type IdempotencyStatus = 'pending' | 'completed';

/** Retention window (days → seconds) for the TTL purge; env-configurable, default 7. */
const ttlDays = Number(process.env.IDEMPOTENCY_TTL_DAYS ?? 7) || 7;
export const IDEMPOTENCY_TTL_SECONDS = ttlDays * 24 * 60 * 60;

/**
 * IdempotencyRecord (OFF-01) — reserves and records a single capture operation for a
 * client-supplied `Idempotency-Key`, so a replayed offline write is applied at most
 * once. Stores a HASHED fingerprint + the resource id — never a cleartext amount or
 * note (Principle II). Auto-purged by a TTL index past the retention window.
 */
@Schema({ collection: 'idempotencyRecords', timestamps: true })
export class IdempotencyRecord {
  // The member (session accountId) and their family — part of the unique key (Principle I).
  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Family' })
  familyId!: Types.ObjectId;

  // The client-supplied Idempotency-Key value.
  @Prop({ required: true, type: String })
  key!: string;

  @Prop({ required: true, enum: IDEMPOTENCY_OPERATIONS })
  operation!: IdempotencyOperation;

  // SHA-256 hex of the canonical request payload — detects key reuse with different content.
  @Prop({ required: true, type: String })
  fingerprint!: string;

  @Prop({ required: true, enum: ['pending', 'completed'], default: 'pending' })
  status!: IdempotencyStatus;

  // The created movement/transfer id; set on completion. Null while pending.
  @Prop({ type: Types.ObjectId, default: null })
  resourceId!: Types.ObjectId | null;
}

export type IdempotencyRecordDocument = HydratedDocument<IdempotencyRecord>;
export const IdempotencyRecordSchema = SchemaFactory.createForClass(IdempotencyRecord);

// One record per member+key — the reserve-first insert relies on this to serialize duplicates.
IdempotencyRecordSchema.index({ familyId: 1, ownerId: 1, key: 1 }, { unique: true });
// Automatic purge past the retention window (FR-006).
IdempotencyRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: IDEMPOTENCY_TTL_SECONDS });
