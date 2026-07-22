import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  IdempotencyOperation,
  IdempotencyRecord,
  IdempotencyRecordDocument,
} from './idempotency.schema';

/** True when an error is a MongoDB duplicate-key violation (E11000). */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
  );
}

/**
 * Persistence for idempotency records. Every query binds `familyId` + `ownerId` from
 * the session (Principle I): a key is unique per member, so a foreign key never
 * collides or leaks.
 */
@Injectable()
export class IdempotencyRepository {
  constructor(
    @InjectModel(IdempotencyRecord.name)
    private readonly model: Model<IdempotencyRecordDocument>,
  ) {}

  /**
   * Reserves the key for this member by inserting a `pending` record under the unique
   * index. Returns the record when the insert wins, or `null` when the key already
   * exists (a concurrent/earlier request owns it).
   */
  async reserve(
    familyId: string,
    ownerId: string,
    key: string,
    operation: IdempotencyOperation,
    fingerprint: string,
  ): Promise<IdempotencyRecordDocument | null> {
    try {
      return await this.model.create({
        familyId: new Types.ObjectId(familyId),
        ownerId: new Types.ObjectId(ownerId),
        key,
        operation,
        fingerprint,
        status: 'pending',
        resourceId: null,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return null;
      }
      throw error;
    }
  }

  /** The existing record for this member+key, or null. */
  async findExisting(
    familyId: string,
    ownerId: string,
    key: string,
  ): Promise<IdempotencyRecordDocument | null> {
    return this.model
      .findOne({ familyId: new Types.ObjectId(familyId), ownerId: new Types.ObjectId(ownerId), key })
      .exec();
  }

  /** Marks the reservation completed with the created resource id. */
  async complete(recordId: string, resourceId: string): Promise<void> {
    await this.model
      .updateOne(
        { _id: new Types.ObjectId(recordId) },
        { $set: { status: 'completed', resourceId: new Types.ObjectId(resourceId) } },
      )
      .exec();
  }

  /** Releases (deletes) a reservation whose create failed, freeing the key for a retry. */
  async release(recordId: string): Promise<void> {
    await this.model.deleteOne({ _id: new Types.ObjectId(recordId) }).exec();
  }
}
