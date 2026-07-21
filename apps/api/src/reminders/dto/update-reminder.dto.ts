import { Transform } from 'class-transformer';
import {
  IsBoolean,
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
  ReminderCadence,
  ReminderPurpose,
  ReminderWeekday,
  UpdateReminderRequest,
} from '@famifinances/contracts';
import { REMINDER_CADENCES, REMINDER_PURPOSES, REMINDER_WEEKDAYS } from '../reminder.schema';
import { TIME_OF_DAY_PATTERN } from './create-reminder.dto';

/** Trims a string value before validation; passes through null/undefined. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Partial update — every field optional; the service re-validates the effective reminder. */
export class UpdateReminderDto implements UpdateReminderRequest {
  @IsOptional()
  @IsIn(REMINDER_PURPOSES)
  purpose?: ReminderPurpose;

  @IsOptional()
  @IsIn(REMINDER_CADENCES)
  cadence?: ReminderCadence;

  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'timeOfDay must be a 24h HH:MM value.' })
  timeOfDay?: string;

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

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
