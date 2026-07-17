import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MembershipEvent,
  MembershipEventDocument,
  MembershipEventType,
} from './membership-event.schema';

export interface AppendEventInput {
  familyId: string;
  accountId: string;
  actorId: string;
  type: MembershipEventType;
}

@Injectable()
export class MembershipEventRepository {
  constructor(
    @InjectModel(MembershipEvent.name) private readonly model: Model<MembershipEventDocument>,
  ) {}

  async append(input: AppendEventInput): Promise<void> {
    await this.model.create({
      familyId: new Types.ObjectId(input.familyId),
      accountId: new Types.ObjectId(input.accountId),
      actorId: new Types.ObjectId(input.actorId),
      type: input.type,
    });
  }

  async listByFamily(familyId: string): Promise<MembershipEventDocument[]> {
    return this.model
      .find({ familyId: new Types.ObjectId(familyId) })
      .sort({ createdAt: 1 })
      .exec();
  }
}
