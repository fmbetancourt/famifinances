import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FamilyRole = 'owner' | 'member';

/**
 * Membership — links one account to one family with a role. The UNIQUE index on
 * `accountId` enforces one-family-per-user (DEC-002; data-model.md).
 */
@Schema({ collection: 'memberships', timestamps: true })
export class Membership {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Account', unique: true })
  accountId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  @Prop({ required: true, enum: ['owner', 'member'] })
  role!: FamilyRole;
}

export type MembershipDocument = HydratedDocument<Membership>;
export const MembershipSchema = SchemaFactory.createForClass(Membership);
