import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MembershipEventType = 'created' | 'joined' | 'removed' | 'left';

/**
 * MembershipEvent — append-only audit of a membership change (FR-013, research R8).
 * Independent of the (deletable) membership row, so remove/leave stay auditable.
 */
@Schema({ collection: 'membershipEvents', timestamps: { createdAt: true, updatedAt: false } })
export class MembershipEvent {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Family', index: true })
  familyId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  accountId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  actorId!: Types.ObjectId;

  @Prop({ required: true, enum: ['created', 'joined', 'removed', 'left'] })
  type!: MembershipEventType;
}

export type MembershipEventDocument = HydratedDocument<MembershipEvent>;
export const MembershipEventSchema = SchemaFactory.createForClass(MembershipEvent);
