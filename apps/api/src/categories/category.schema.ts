import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { CategoryKind, CategoryScope } from '@famifinances/contracts';

export const CATEGORY_KINDS: CategoryKind[] = ['income', 'expense'];
export const CATEGORY_SCOPES: CategoryScope[] = ['system', 'family'];

/**
 * Category (CAT-01) — a label with a fixed `kind` used to classify money. Two
 * scopes share the collection: `system` (global, seeded, read-only defaults;
 * `familyId` null) and `family` (custom, owned by one family). The kind is
 * immutable — it is the anchor TXN-01 uses to enforce income-vs-expense integrity
 * (constitution III).
 */
@Schema({ collection: 'categories', timestamps: true })
export class Category {
  @Prop({ required: true, enum: CATEGORY_SCOPES })
  scope!: CategoryScope;

  @Prop({ required: true, enum: CATEGORY_KINDS })
  kind!: CategoryKind;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  // null for system defaults; the owning family (from the session) for custom. Never from client input.
  @Prop({ type: Types.ObjectId, ref: 'Family', default: null, index: true })
  familyId!: Types.ObjectId | null;

  // Custom only: null = active, a timestamp = archived. Always null for system defaults.
  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  // Custom only: the member (AUTH-01 account id) who created it (FR-014). null for system defaults.
  @Prop({ type: Types.ObjectId, ref: 'Account', default: null })
  createdBy!: Types.ObjectId | null;
}

export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);

// Idempotent-seed guard: a system default is unique by (scope, kind, name).
CategorySchema.index(
  { scope: 1, kind: 1, name: 1 },
  { unique: true, partialFilterExpression: { scope: 'system' } },
);
