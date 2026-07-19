import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MovementEvent,
  MovementEventDocument,
  MovementEventType,
  MovementSnapshot,
} from './movement-event.schema';

export interface AppendMovementEventInput {
  movementId: string;
  familyId: string;
  actorId: string;
  type: MovementEventType;
  snapshot: MovementSnapshot;
}

@Injectable()
export class MovementEventRepository {
  constructor(
    @InjectModel(MovementEvent.name) private readonly model: Model<MovementEventDocument>,
  ) {}

  async append(input: AppendMovementEventInput): Promise<void> {
    await this.model.create({
      movementId: new Types.ObjectId(input.movementId),
      familyId: new Types.ObjectId(input.familyId),
      actorId: new Types.ObjectId(input.actorId),
      type: input.type,
      snapshot: input.snapshot,
    });
  }

  async listByFamily(familyId: string): Promise<MovementEventDocument[]> {
    return this.model
      .find({ familyId: new Types.ObjectId(familyId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async listByMovement(movementId: string): Promise<MovementEventDocument[]> {
    return this.model
      .find({ movementId: new Types.ObjectId(movementId) })
      .sort({ createdAt: 1 })
      .exec();
  }
}
