import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TransferEvent,
  TransferEventDocument,
  TransferEventType,
  TransferSnapshot,
} from './transfer-event.schema';

export interface AppendTransferEventInput {
  transferId: string;
  familyId: string;
  actorId: string;
  type: TransferEventType;
  snapshot: TransferSnapshot;
}

@Injectable()
export class TransferEventRepository {
  constructor(
    @InjectModel(TransferEvent.name) private readonly model: Model<TransferEventDocument>,
  ) {}

  async append(input: AppendTransferEventInput): Promise<void> {
    await this.model.create({
      transferId: new Types.ObjectId(input.transferId),
      familyId: new Types.ObjectId(input.familyId),
      actorId: new Types.ObjectId(input.actorId),
      type: input.type,
      snapshot: input.snapshot,
    });
  }

  async listByFamily(familyId: string): Promise<TransferEventDocument[]> {
    return this.model
      .find({ familyId: new Types.ObjectId(familyId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async listByTransfer(transferId: string): Promise<TransferEventDocument[]> {
    return this.model
      .find({ transferId: new Types.ObjectId(transferId) })
      .sort({ createdAt: 1 })
      .exec();
  }
}
