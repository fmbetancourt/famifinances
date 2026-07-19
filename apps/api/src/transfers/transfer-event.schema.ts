import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TransferEventType = 'created' | 'updated' | 'deleted';

/** Snapshot of a transfer's key fields at the time of an audit event. */
export interface TransferSnapshot {
  amount: number;
  date: Date;
  fromAccountId: Types.ObjectId;
  toAccountId: Types.ObjectId;
  note: string | null;
}

/**
 * TransferEvent (TXN-02) — an append-only audit record of a transfer change
 * (created/updated/deleted), independent of the (soft-deletable) transfer, so a
 * transfer's history survives its deletion (FR-011). Never updated or deleted.
 */
@Schema({ collection: 'transferEvents', timestamps: { createdAt: true, updatedAt: false } })
export class TransferEvent {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Transfer', index: true })
  transferId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  actorId!: Types.ObjectId;

  @Prop({ required: true, enum: ['created', 'updated', 'deleted'] })
  type!: TransferEventType;

  @Prop({ required: true, type: Object })
  snapshot!: TransferSnapshot;

  // Populated by Mongoose `timestamps` (createdAt only); declared for typing.
  createdAt!: Date;
}

export type TransferEventDocument = HydratedDocument<TransferEvent>;
export const TransferEventSchema = SchemaFactory.createForClass(TransferEvent);
