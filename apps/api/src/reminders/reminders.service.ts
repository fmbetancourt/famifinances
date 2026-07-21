import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  ReminderCadence,
  ReminderSummary,
  ReminderWeekday,
} from '@famifinances/contracts';
import { ReminderRepository, UpdateReminderPatch } from './reminder.repository';
import { ReminderDocument } from './reminder.schema';
import { CreateReminderDto, TIME_OF_DAY_PATTERN } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

/** Per-member cap on reminders (FR-009). */
export const MAX_REMINDERS_PER_MEMBER = 20;

interface NormalizedSelectors {
  dayOfWeek: ReminderWeekday | null;
  dayOfMonth: number | null;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger('Reminders');

  constructor(private readonly reminders: ReminderRepository) {}

  /** Create a personal reminder; config validated; per-member cap enforced (FR-001/007/009). */
  async create(
    ownerId: string,
    familyId: string,
    dto: CreateReminderDto,
  ): Promise<ReminderSummary> {
    this.assertTime(dto.timeOfDay);
    this.assertLabel(dto.purpose, dto.label ?? null);
    const selectors = this.normalizeSelectors(dto.cadence, dto.dayOfWeek ?? null, dto.dayOfMonth ?? null);

    if ((await this.reminders.countByOwner(ownerId, familyId)) >= MAX_REMINDERS_PER_MEMBER) {
      throw new ConflictException(`A member may have at most ${MAX_REMINDERS_PER_MEMBER} reminders.`);
    }

    const doc = await this.reminders.create({
      ownerId,
      familyId,
      purpose: dto.purpose,
      cadence: dto.cadence,
      timeOfDay: dto.timeOfDay,
      dayOfWeek: selectors.dayOfWeek,
      dayOfMonth: selectors.dayOfMonth,
      label: dto.label ?? null,
    });
    this.logger.log(`reminder.created id=${doc.id} owner=${ownerId}`);
    return this.toSummary(doc);
  }

  /** The member's reminders, newest first (FR-002). */
  async list(ownerId: string, familyId: string): Promise<ReminderSummary[]> {
    const docs = await this.reminders.listByOwner(ownerId, familyId);
    return docs.map((doc) => this.toSummary(doc));
  }

  /** One reminder of the member (404 otherwise). */
  async get(ownerId: string, familyId: string, reminderId: string): Promise<ReminderSummary> {
    return this.toSummary(await this.requireForOwner(ownerId, familyId, reminderId));
  }

  /** Edit a reminder; the effective config is re-validated as a whole (FR-003/004). */
  async update(
    ownerId: string,
    familyId: string,
    reminderId: string,
    dto: UpdateReminderDto,
  ): Promise<ReminderSummary> {
    const existing = await this.requireForOwner(ownerId, familyId, reminderId);
    if (this.isEmptyPatch(dto)) {
      throw new BadRequestException('Provide at least one field to update.');
    }

    const purpose = dto.purpose ?? existing.purpose;
    const cadence = dto.cadence ?? existing.cadence;
    const timeOfDay = dto.timeOfDay ?? existing.timeOfDay;
    const label = dto.label !== undefined ? dto.label : existing.label;

    this.assertTime(timeOfDay);
    this.assertLabel(purpose, label);

    // The relevant selector falls back to the existing value only when its cadence is unchanged;
    // an explicitly-provided irrelevant selector still triggers a rejection.
    const weekday =
      cadence === 'weekly'
        ? dto.dayOfWeek !== undefined
          ? dto.dayOfWeek
          : existing.cadence === 'weekly'
            ? existing.dayOfWeek
            : null
        : (dto.dayOfWeek ?? null);
    const monthday =
      cadence === 'monthly'
        ? dto.dayOfMonth !== undefined
          ? dto.dayOfMonth
          : existing.cadence === 'monthly'
            ? existing.dayOfMonth
            : null
        : (dto.dayOfMonth ?? null);
    const selectors = this.normalizeSelectors(cadence, weekday, monthday);

    const patch: UpdateReminderPatch = {
      purpose,
      cadence,
      timeOfDay,
      dayOfWeek: selectors.dayOfWeek,
      dayOfMonth: selectors.dayOfMonth,
      label,
    };
    if (dto.enabled !== undefined) {
      patch.enabled = dto.enabled;
    }

    const updated = (await this.reminders.update(ownerId, familyId, reminderId, patch)) ?? existing;
    this.logger.log(`reminder.updated id=${reminderId} owner=${ownerId}`);
    return this.toSummary(updated);
  }

  /** Delete a reminder of the member (404 when absent) (FR-005). */
  async delete(ownerId: string, familyId: string, reminderId: string): Promise<void> {
    const removed = await this.reminders.deleteForOwner(ownerId, familyId, reminderId);
    if (!removed) {
      throw new NotFoundException('Reminder not found for this member.');
    }
    this.logger.log(`reminder.deleted id=${reminderId} owner=${ownerId}`);
  }

  private assertTime(timeOfDay: string): void {
    if (!TIME_OF_DAY_PATTERN.test(timeOfDay)) {
      throw new BadRequestException('timeOfDay must be a 24h HH:MM value.');
    }
  }

  private assertLabel(purpose: string, label: string | null): void {
    if (purpose === 'custom' && (label === null || label.trim() === '')) {
      throw new BadRequestException('A custom reminder requires a non-blank label.');
    }
  }

  /** Enforces cadence ⇄ day-selector coherence and normalizes the irrelevant selector to null. */
  private normalizeSelectors(
    cadence: ReminderCadence,
    dayOfWeek: ReminderWeekday | null,
    dayOfMonth: number | null,
  ): NormalizedSelectors {
    if (cadence === 'daily') {
      if (dayOfWeek !== null || dayOfMonth !== null) {
        throw new BadRequestException('A daily reminder takes no day selector.');
      }
      return { dayOfWeek: null, dayOfMonth: null };
    }
    if (cadence === 'weekly') {
      if (dayOfMonth !== null) {
        throw new BadRequestException('A weekly reminder takes dayOfWeek, not dayOfMonth.');
      }
      if (dayOfWeek === null) {
        throw new BadRequestException('A weekly reminder requires dayOfWeek.');
      }
      return { dayOfWeek, dayOfMonth: null };
    }
    // monthly
    if (dayOfWeek !== null) {
      throw new BadRequestException('A monthly reminder takes dayOfMonth, not dayOfWeek.');
    }
    if (dayOfMonth === null) {
      throw new BadRequestException('A monthly reminder requires dayOfMonth.');
    }
    return { dayOfWeek: null, dayOfMonth };
  }

  private isEmptyPatch(dto: UpdateReminderDto): boolean {
    return (
      dto.purpose === undefined &&
      dto.cadence === undefined &&
      dto.timeOfDay === undefined &&
      dto.dayOfWeek === undefined &&
      dto.dayOfMonth === undefined &&
      dto.label === undefined &&
      dto.enabled === undefined
    );
  }

  private async requireForOwner(
    ownerId: string,
    familyId: string,
    reminderId: string,
  ): Promise<ReminderDocument> {
    const reminder = await this.reminders.findForOwner(ownerId, familyId, reminderId);
    if (!reminder) {
      throw new NotFoundException('Reminder not found for this member.');
    }
    return reminder;
  }

  private toSummary(doc: ReminderDocument): ReminderSummary {
    return {
      reminderId: doc.id,
      purpose: doc.purpose,
      cadence: doc.cadence,
      timeOfDay: doc.timeOfDay,
      dayOfWeek: doc.dayOfWeek,
      dayOfMonth: doc.dayOfMonth,
      label: doc.label,
      enabled: doc.enabled,
    };
  }
}
