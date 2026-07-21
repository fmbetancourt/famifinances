import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { ReminderCadence, ReminderPurpose, ReminderWeekday } from '@famifinances/contracts';
import { Reminder, ReminderDocument } from './reminder.schema';

export interface CreateReminderInput {
  ownerId: string;
  familyId: string;
  purpose: ReminderPurpose;
  cadence: ReminderCadence;
  timeOfDay: string;
  dayOfWeek: ReminderWeekday | null;
  dayOfMonth: number | null;
  label: string | null;
}

export interface UpdateReminderPatch {
  purpose?: ReminderPurpose;
  cadence?: ReminderCadence;
  timeOfDay?: string;
  dayOfWeek?: ReminderWeekday | null;
  dayOfMonth?: number | null;
  label?: string | null;
  enabled?: boolean;
}

/**
 * Per-member persistence for reminders. EVERY query is bound to the caller's
 * `ownerId` AND `familyId` (both from the session), so a foreign or unknown id
 * resolves to null/false → 404 (Principle I, defense-in-depth). Neither is ever
 * taken from client input.
 */
@Injectable()
export class ReminderRepository {
  constructor(@InjectModel(Reminder.name) private readonly model: Model<ReminderDocument>) {}

  /** The session-scoped owner+family filter both fields must match on every query. */
  private scope(ownerId: string, familyId: string): Record<string, Types.ObjectId> {
    return { ownerId: new Types.ObjectId(ownerId), familyId: new Types.ObjectId(familyId) };
  }

  async create(input: CreateReminderInput): Promise<ReminderDocument> {
    return this.model.create({
      ownerId: new Types.ObjectId(input.ownerId),
      familyId: new Types.ObjectId(input.familyId),
      purpose: input.purpose,
      cadence: input.cadence,
      timeOfDay: input.timeOfDay,
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
      label: input.label,
      enabled: true,
    });
  }

  /** The member's reminders, newest first. */
  async listByOwner(ownerId: string, familyId: string): Promise<ReminderDocument[]> {
    return this.model
      .find(this.scope(ownerId, familyId))
      .sort({ createdAt: -1 })
      .exec();
  }

  /** One reminder of the member; else null (→ 404). */
  async findForOwner(
    ownerId: string,
    familyId: string,
    reminderId: string,
  ): Promise<ReminderDocument | null> {
    if (!Types.ObjectId.isValid(reminderId)) {
      return null;
    }
    return this.model
      .findOne({ _id: new Types.ObjectId(reminderId), ...this.scope(ownerId, familyId) })
      .exec();
  }

  /** How many reminders the member already has (for the per-member cap). */
  async countByOwner(ownerId: string, familyId: string): Promise<number> {
    return this.model.countDocuments(this.scope(ownerId, familyId)).exec();
  }

  async update(
    ownerId: string,
    familyId: string,
    reminderId: string,
    patch: UpdateReminderPatch,
  ): Promise<ReminderDocument | null> {
    if (!Types.ObjectId.isValid(reminderId)) {
      return null;
    }
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(reminderId), ...this.scope(ownerId, familyId) },
        { $set: patch },
        { new: true },
      )
      .exec();
  }

  /** Hard-deletes a reminder of the member; returns whether a row was removed. */
  async deleteForOwner(ownerId: string, familyId: string, reminderId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(reminderId)) {
      return false;
    }
    const result = await this.model
      .deleteOne({ _id: new Types.ObjectId(reminderId), ...this.scope(ownerId, familyId) })
      .exec();
    return result.deletedCount > 0;
  }
}
