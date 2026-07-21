// Shared reminder DTO types (NTF-01), mirroring specs/014-local-reminders/contracts/reminder.openapi.yaml.

export type ReminderPurpose = 'capture' | 'budget' | 'custom';

export type ReminderCadence = 'daily' | 'weekly' | 'monthly';

export type ReminderWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface CreateReminderRequest {
  purpose: ReminderPurpose;
  cadence: ReminderCadence;
  /** 24h wall-clock HH:MM, interpreted in the device timezone. */
  timeOfDay: string;
  /** Required iff cadence=weekly; must be absent otherwise. */
  dayOfWeek?: ReminderWeekday | null;
  /** Required iff cadence=monthly (1–31); must be absent otherwise. */
  dayOfMonth?: number | null;
  /** Optional for capture/budget; required non-blank for custom. */
  label?: string | null;
}

/** Partial update; the effective reminder is re-validated as a whole. */
export interface UpdateReminderRequest {
  purpose?: ReminderPurpose;
  cadence?: ReminderCadence;
  timeOfDay?: string;
  dayOfWeek?: ReminderWeekday | null;
  dayOfMonth?: number | null;
  label?: string | null;
  enabled?: boolean;
}

export interface ReminderSummary {
  reminderId: string;
  purpose: ReminderPurpose;
  cadence: ReminderCadence;
  timeOfDay: string;
  dayOfWeek: ReminderWeekday | null;
  dayOfMonth: number | null;
  label: string | null;
  enabled: boolean;
}
