import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReminderRepository } from './reminder.repository';
import { ReminderDocument } from './reminder.schema';
import { RemindersService, MAX_REMINDERS_PER_MEMBER } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';

/** Builds a fake reminder document (only the fields the service reads). */
function reminder(overrides: Partial<ReminderDocument> = {}): ReminderDocument {
  return {
    id: 'r1',
    purpose: 'capture',
    cadence: 'daily',
    timeOfDay: '20:00',
    dayOfWeek: null,
    dayOfMonth: null,
    label: null,
    enabled: true,
    ...overrides,
  } as unknown as ReminderDocument;
}

describe('RemindersService (NTF-01)', () => {
  const repo = {
    create: jest.fn(),
    listByOwner: jest.fn(),
    findForOwner: jest.fn(),
    countByOwner: jest.fn(),
    update: jest.fn(),
    deleteForOwner: jest.fn(),
  };
  const service = new RemindersService(repo as unknown as ReminderRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    repo.countByOwner.mockResolvedValue(0);
    repo.create.mockImplementation((input) => Promise.resolve(reminder(input)));
  });

  const daily: CreateReminderDto = { purpose: 'capture', cadence: 'daily', timeOfDay: '20:00' };

  describe('create · cadence ⇄ selector coherence (FR-007)', () => {
    it('creates a valid daily reminder', async () => {
      const result = await service.create('m1', 'f1', daily);
      expect(result).toMatchObject({ cadence: 'daily', dayOfWeek: null, dayOfMonth: null });
    });

    it('rejects a daily reminder carrying a day selector (400)', async () => {
      await expect(
        service.create('m1', 'f1', { ...daily, dayOfWeek: 'monday' } as CreateReminderDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a weekly reminder without dayOfWeek (400)', async () => {
      await expect(
        service.create('m1', 'f1', { purpose: 'capture', cadence: 'weekly', timeOfDay: '08:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a weekly reminder carrying dayOfMonth (400)', async () => {
      await expect(
        service.create('m1', 'f1', {
          purpose: 'capture',
          cadence: 'weekly',
          timeOfDay: '08:00',
          dayOfWeek: 'monday',
          dayOfMonth: 1,
        } as CreateReminderDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a monthly reminder without dayOfMonth (400)', async () => {
      await expect(
        service.create('m1', 'f1', { purpose: 'budget', cadence: 'monthly', timeOfDay: '09:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a monthly reminder with dayOfMonth 31', async () => {
      const result = await service.create('m1', 'f1', {
        purpose: 'budget',
        cadence: 'monthly',
        timeOfDay: '09:00',
        dayOfMonth: 31,
      });
      expect(result).toMatchObject({ cadence: 'monthly', dayOfMonth: 31, dayOfWeek: null });
    });
  });

  describe('create · time, label, cap', () => {
    it('rejects a malformed time (400)', async () => {
      await expect(
        service.create('m1', 'f1', { ...daily, timeOfDay: '24:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a custom reminder with a blank label (400)', async () => {
      await expect(
        service.create('m1', 'f1', { purpose: 'custom', cadence: 'daily', timeOfDay: '20:00', label: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects creation past the per-member cap (409)', async () => {
      repo.countByOwner.mockResolvedValue(MAX_REMINDERS_PER_MEMBER);
      await expect(service.create('m1', 'f1', daily)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects an empty patch (400)', async () => {
      repo.findForOwner.mockResolvedValue(reminder());
      await expect(service.update('m1', 'f1', 'r1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('switching to weekly without a day is rejected (400)', async () => {
      repo.findForOwner.mockResolvedValue(reminder({ cadence: 'daily' }));
      await expect(service.update('m1', 'f1', 'r1', { cadence: 'weekly' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('switching weekly→monthly with dayOfMonth clears the weekday', async () => {
      repo.findForOwner.mockResolvedValue(
        reminder({ cadence: 'weekly', dayOfWeek: 'monday', dayOfMonth: null }),
      );
      repo.update.mockImplementation((_o, _f, _id, patch) => Promise.resolve(reminder(patch)));
      const result = await service.update('m1', 'f1', 'r1', { cadence: 'monthly', dayOfMonth: 5 });
      expect(result).toMatchObject({ cadence: 'monthly', dayOfMonth: 5, dayOfWeek: null });
    });

    it('404 when the reminder is not the member\'s', async () => {
      repo.findForOwner.mockResolvedValue(null);
      await expect(service.update('m1', 'f1', 'r1', { enabled: false })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('404 when nothing was removed', async () => {
      repo.deleteForOwner.mockResolvedValue(false);
      await expect(service.delete('m1', 'f1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves when a row was removed', async () => {
      repo.deleteForOwner.mockResolvedValue(true);
      await expect(service.delete('m1', 'f1', 'r1')).resolves.toBeUndefined();
    });
  });
});
