import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { MovementType } from '@famifinances/contracts';

export const MOVEMENT_TYPES: MovementType[] = ['income', 'expense'];

/**
 * Movement (TXN-01) — a recorded income or expense, the family's financial source
 * of truth. Effect on the account balance: +amount (income), −amount (expense).
 * Deletion is soft (`deletedAt`), so a deleted movement is excluded from balances
 * and history but retained for audit (constitution III).
 */
@Schema({ collection: 'movements', timestamps: true })
export class Movement {
  @Prop({ required: true, enum: MOVEMENT_TYPES })
  type!: MovementType;

  // Positive whole-peso CLP amount (> 0). The type carries the direction.
  @Prop({ required: true, type: Number })
  amount!: number;

  // Occurrence calendar date (stored as a UTC-midnight Date).
  @Prop({ required: true, type: Date })
  date!: Date;

  @Prop({ required: true, type: Types.ObjectId, ref: 'FinancialAccount', index: true })
  accountId!: Types.ObjectId;

  // The owning family, from the session (denormalized for scoped queries + aggregation).
  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  categoryId!: Types.ObjectId | null;

  @Prop({ type: String, default: null, maxlength: 280 })
  note!: string | null;

  // null = active; a timestamp = soft-deleted (excluded from balances/history).
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  createdBy!: Types.ObjectId;
}

export type MovementDocument = HydratedDocument<Movement>;
export const MovementSchema = SchemaFactory.createForClass(Movement);

// Scoped history + balance aggregation.
MovementSchema.index({ familyId: 1, deletedAt: 1, date: -1 });
