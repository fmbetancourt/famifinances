import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Family — the privacy boundary and owner of all financial data (data-model.md). */
@Schema({ collection: 'families', timestamps: true })
export class Family {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  ownerId!: Types.ObjectId;
}

export type FamilyDocument = HydratedDocument<Family>;
export const FamilySchema = SchemaFactory.createForClass(Family);
