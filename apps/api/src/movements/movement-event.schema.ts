import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { MovementType } from '@famifinances/contracts';

export type MovementEventType = 'created' | 'updated' | 'deleted';

/** Snapshot of a movement's key fields at the time of an audit event. */
export interface MovementSnapshot {
  type: MovementType;
  amount: number;
  date: Date;
  accountId: Types.ObjectId;
  categoryId: Types.ObjectId | null;
  note: string | null;
}

/**
 * MovementEvent (TXN-01) — an append-only audit record of a movement change
 * (created/updated/deleted), independent of the (soft-deletable) movement, so a
 * movement's history survives its deletion (FR-011). Never updated or deleted.
 */
@Schema({ collection: 'movementEvents', timestamps: { createdAt: true, updatedAt: false } })
export class MovementEvent {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Movement', index: true })
  movementId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  actorId!: Types.ObjectId;

  @Prop({ required: true, enum: ['created', 'updated', 'deleted'] })
  type!: MovementEventType;

  // The movement's state at the event time (for reconstructing history).
  @Prop({ required: true, type: Object })
  snapshot!: MovementSnapshot;

  // Populated by Mongoose `timestamps` (createdAt only); declared for typing.
  createdAt!: Date;
}

export type MovementEventDocument = HydratedDocument<MovementEvent>;
export const MovementEventSchema = SchemaFactory.createForClass(MovementEvent);
