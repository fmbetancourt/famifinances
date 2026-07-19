import { registerDecorator, ValidationOptions } from 'class-validator';

/** True only for a real `YYYY-MM-DD` calendar date (rejects date-times and impossible dates). */
export function isCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  // Round-trip check rejects impossible dates like 2026-02-30 (which rolls over).
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Validates a date-only string (`YYYY-MM-DD`), matching the OpenAPI `format: date`
 * contract. Unlike `@IsISO8601`, it rejects date-times so `startDate` cannot carry a
 * time/zone that would shift the stored Date on `toISOString()`.
 */
export function IsCalendarDate(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isCalendarDate',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown): boolean => isCalendarDate(value),
        defaultMessage: (): string => `${propertyName} must be a calendar date (YYYY-MM-DD)`,
      },
    });
  };
}
