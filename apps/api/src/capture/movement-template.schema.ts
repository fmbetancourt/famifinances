import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { MovementType } from '@famifinances/contracts';
import { MOVEMENT_TYPES } from '../movements/movement.schema';

/**
 * MovementTemplate (UX-01) — a family-shared named preset for a frequent
 * income/expense movement. It fixes the classification (type + category +
 * account) and an optional suggested amount/note; applying it pre-fills the
 * add-movement flow (TXN-01) client-side. Templates are convenience data, so
 * deletion is a real delete (no append-only audit — that is for money movements).
 */
@Schema({ collection: 'movementTemplates', timestamps: true })
export class MovementTemplate {
  // The owning family, from the session. Never from client input (Principle I).
  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  // Trimmed, non-blank, unique within the family (case-insensitive; enforced in the service).
  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ required: true, enum: MOVEMENT_TYPES })
  type!: MovementType;

  // An active account of the family (validated in the service at write time).
  @Prop({ required: true, type: Types.ObjectId, ref: 'FinancialAccount' })
  accountId!: Types.ObjectId;

  // A visible active category whose kind equals `type` (validated in the service).
  @Prop({ required: true, type: Types.ObjectId, ref: 'Category' })
  categoryId!: Types.ObjectId;

  // Optional suggested amount; a positive whole-peso CLP integer when present.
  @Prop({ type: Number, default: null })
  amount!: number | null;

  // Optional suggested note. Never logged.
  @Prop({ type: String, default: null, maxlength: 280 })
  note!: string | null;

  // The member (AUTH-01 account id) who created it; informational.
  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  createdBy!: Types.ObjectId;
}

export type MovementTemplateDocument = HydratedDocument<MovementTemplate>;
export const MovementTemplateSchema = SchemaFactory.createForClass(MovementTemplate);

// Family-scoped name uniqueness (backstop to the service's case-insensitive pre-check).
MovementTemplateSchema.index({ familyId: 1, name: 1 }, { unique: true });
