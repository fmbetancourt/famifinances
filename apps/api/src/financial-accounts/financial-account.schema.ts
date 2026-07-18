import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { AccountType } from '@famifinances/contracts';

export const ACCOUNT_TYPES: AccountType[] = ['bank', 'digital_wallet', 'cash', 'credit_card'];

/**
 * FinancialAccount (ACC-01) — a place where a family's money is held. Named
 * distinctly from the AUTH-01 `Account` (user identity) to avoid a Mongoose model
 * clash. Owned by exactly one family; its current balance is DERIVED (initial
 * balance + movements), never stored as an editable field (constitution III).
 */
@Schema({ collection: 'financialAccounts', timestamps: true })
export class FinancialAccount {
  // The owning family, set from the session (@CurrentFamily), never from client input.
  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ required: true, enum: ACCOUNT_TYPES })
  type!: AccountType;

  // Optional manual institution label; never a bank connection.
  @Prop({ type: String, default: null, maxlength: 80 })
  institution!: string | null;

  // Whole-peso CLP amount; may be negative, zero, or positive (Clarify Q1).
  @Prop({ required: true, type: Number })
  initialBalance!: number;

  // Single-currency MVP; constant, not user-settable.
  @Prop({ required: true, default: 'CLP', enum: ['CLP'] })
  currency!: 'CLP';

  // Calendar date the initial balance is effective.
  @Prop({ required: true, type: Date })
  startDate!: Date;

  // null = active; a timestamp = archived (read-only).
  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  // The member (AUTH-01 account id) who created it (FR-014).
  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  createdBy!: Types.ObjectId;
}

export type FinancialAccountDocument = HydratedDocument<FinancialAccount>;
export const FinancialAccountSchema = SchemaFactory.createForClass(FinancialAccount);
