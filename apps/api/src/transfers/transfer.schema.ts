import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Transfer (TXN-02) — a move of money between two of the family's accounts.
 * Effect on balances: −amount on the origin, +amount on the destination. It is
 * neither income nor expense (no double counting, constitution III) and carries no
 * category. Deletion is soft (`deletedAt`): excluded from balances/list, retained
 * for audit.
 */
@Schema({ collection: 'transfers', timestamps: true })
export class Transfer {
  // Positive whole-peso CLP amount (> 0).
  @Prop({ required: true, type: Number })
  amount!: number;

  @Prop({ required: true, type: Date })
  date!: Date;

  @Prop({ required: true, type: Types.ObjectId, ref: 'FinancialAccount', index: true })
  fromAccountId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'FinancialAccount', index: true })
  toAccountId!: Types.ObjectId;

  // The owning family, from the session (denormalized for scoped queries + aggregation).
  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  @Prop({ type: String, default: null, maxlength: 280 })
  note!: string | null;

  // null = active; a timestamp = soft-deleted (excluded from balances/list).
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  createdBy!: Types.ObjectId;
}

export type TransferDocument = HydratedDocument<Transfer>;
export const TransferSchema = SchemaFactory.createForClass(Transfer);

// Scoped list + balance aggregation.
TransferSchema.index({ familyId: 1, deletedAt: 1, date: -1 });
