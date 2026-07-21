import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  CreateReminderRequest,
  ReminderCadence,
  ReminderPurpose,
  ReminderWeekday,
} from '@famifinances/contracts';
import { REMINDER_CADENCES, REMINDER_PURPOSES, REMINDER_WEEKDAYS } from '../reminder.schema';

/** 24h HH:MM. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateReminderDto implements CreateReminderRequest {
  @IsIn(REMINDER_PURPOSES)
  purpose!: ReminderPurpose;

  @IsIn(REMINDER_CADENCES)
  cadence!: ReminderCadence;

  @Matches(TIME_OF_DAY_PATTERN, { message: 'timeOfDay must be a 24h HH:MM value.' })
  timeOfDay!: string;

  // Cross-field coherence with `cadence` is enforced in the service.
  @IsOptional()
  @IsIn(REMINDER_WEEKDAYS)
  dayOfWeek?: ReminderWeekday | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  label?: string | null;
}
