import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { ReminderCadence, ReminderPurpose, ReminderWeekday } from '@famifinances/contracts';

export const REMINDER_PURPOSES: ReminderPurpose[] = ['capture', 'budget', 'custom'];
export const REMINDER_CADENCES: ReminderCadence[] = ['daily', 'weekly', 'monthly'];
export const REMINDER_WEEKDAYS: ReminderWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/**
 * Reminder (NTF-01) — a personal, per-member reminder configuration the mobile app
 * turns into an on-device local notification. The server persists the config only;
 * it never sends a push and runs no scheduler. Carries no financial data (Principle II).
 */
@Schema({ collection: 'reminders', timestamps: true })
export class Reminder {
  // The owning member (AUTH-01 account id), from the session. Never from client input (Principle I).
  @Prop({ required: true, type: Types.ObjectId, ref: 'Account', index: true })
  ownerId!: Types.ObjectId;

  // The member's family, from the session — defense-in-depth Principle-I scope.
  @Prop({ required: true, type: Types.ObjectId, ref: 'Family' })
  familyId!: Types.ObjectId;

  @Prop({ required: true, enum: REMINDER_PURPOSES })
  purpose!: ReminderPurpose;

  @Prop({ required: true, enum: REMINDER_CADENCES })
  cadence!: ReminderCadence;

  // 24h wall-clock HH:MM; the device interprets it in its timezone.
  @Prop({ required: true, type: String })
  timeOfDay!: string;

  // Weekly only; null otherwise.
  @Prop({ type: String, enum: REMINDER_WEEKDAYS, default: null })
  dayOfWeek!: ReminderWeekday | null;

  // Monthly only (1–31); null otherwise. 29–31 clamped to the month's last day by the device.
  @Prop({ type: Number, default: null })
  dayOfMonth!: number | null;

  // Optional for capture/budget; required non-blank for custom. Never logged.
  @Prop({ type: String, default: null, maxlength: 80 })
  label!: string | null;

  @Prop({ required: true, type: Boolean, default: true })
  enabled!: boolean;
}

export type ReminderDocument = HydratedDocument<Reminder>;
export const ReminderSchema = SchemaFactory.createForClass(Reminder);

// List a member's reminders, newest first.
ReminderSchema.index({ ownerId: 1, createdAt: -1 });
