import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * BudgetAllocation (BUD-01) — the planned amount for one expense category in one
 * calendar month, owned by exactly one family. Real spend is NOT stored here: the
 * budget report derives it from TXN-01 expense movements (constitution III). A
 * budget allocation is planning configuration, so it carries no append-only audit
 * (that clause is reserved for money movements).
 */
@Schema({ collection: 'budgetAllocations', timestamps: true })
export class BudgetAllocation {
  // The owning family, from the session. Never from client input (Principle I).
  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  // Calendar month 'YYYY-MM' (e.g. '2026-07').
  @Prop({ required: true, type: String })
  period!: string;

  // An expense category visible to the family (validated in the service).
  @Prop({ required: true, type: Types.ObjectId, ref: 'Category' })
  categoryId!: Types.ObjectId;

  // Positive whole-peso CLP amount (> 0).
  @Prop({ required: true, type: Number })
  plannedAmount!: number;

  // The Owner (AUTH-01 account id) who set it (FR-001); informational.
  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  createdBy!: Types.ObjectId;
}

export type BudgetAllocationDocument = HydratedDocument<BudgetAllocation>;
export const BudgetAllocationSchema = SchemaFactory.createForClass(BudgetAllocation);

// One allocation per family+month+category (FR-005); its {familyId, period} prefix
// also serves the report query, so no separate index is needed.
BudgetAllocationSchema.index({ familyId: 1, period: 1, categoryId: 1 }, { unique: true });
