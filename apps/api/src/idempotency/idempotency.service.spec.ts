import { BadRequestException, ConflictException } from '@nestjs/common';
import { IdempotencyRepository } from './idempotency.repository';
import { IdempotencyRecordDocument } from './idempotency.schema';
import { IdempotencyService } from './idempotency.service';

function record(overrides: Partial<IdempotencyRecordDocument> = {}): IdempotencyRecordDocument {
  return {
    id: 'rec1',
    operation: 'movement.create',
    fingerprint: 'fp1',
    status: 'completed',
    resourceId: { toString: () => 'res1' },
    ...overrides,
  } as unknown as IdempotencyRecordDocument;
}

describe('IdempotencyService (OFF-01)', () => {
  const records = {
    reserve: jest.fn(),
    findExisting: jest.fn(),
    complete: jest.fn(),
    release: jest.fn(),
  };
  const service = new IdempotencyService(records as unknown as IdempotencyRepository);

  const base = {
    familyId: 'f1',
    ownerId: 'm1',
    operation: 'movement.create' as const,
    fingerprint: 'fp1',
    create: jest.fn(),
    reload: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('runs create without touching the store when no key is given (FR-005)', async () => {
    base.create.mockResolvedValue({ id: 'res1', result: { movementId: 'res1' } });
    const out = await service.run({ ...base, key: undefined });
    expect(out).toEqual({ result: { movementId: 'res1' }, replayed: false });
    expect(records.reserve).not.toHaveBeenCalled();
  });

  it('reserves, creates, and completes on first use', async () => {
    records.reserve.mockResolvedValue(record({ status: 'pending' }));
    base.create.mockResolvedValue({ id: 'res1', result: { movementId: 'res1' } });
    const out = await service.run({ ...base, key: 'k1' });
    expect(out.replayed).toBe(false);
    expect(records.complete).toHaveBeenCalledWith('rec1', 'res1');
  });

  it('replays the reloaded resource when the key already completed', async () => {
    records.reserve.mockResolvedValue(null);
    records.findExisting.mockResolvedValue(record());
    base.reload.mockResolvedValue({ movementId: 'res1' });
    const out = await service.run({ ...base, key: 'k1' });
    expect(out).toEqual({ result: { movementId: 'res1' }, replayed: true });
    expect(base.create).not.toHaveBeenCalled();
  });

  it('rejects a key reused with a different fingerprint (409)', async () => {
    records.reserve.mockResolvedValue(null);
    records.findExisting.mockResolvedValue(record({ fingerprint: 'other' }));
    await expect(service.run({ ...base, key: 'k1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 409 while the key is still pending', async () => {
    records.reserve.mockResolvedValue(null);
    records.findExisting.mockResolvedValue(record({ status: 'pending', resourceId: null }));
    await expect(service.run({ ...base, key: 'k1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a malformed key (400)', async () => {
    await expect(service.run({ ...base, key: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.run({ ...base, key: 'x'.repeat(201) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('releases the reservation when the create fails', async () => {
    records.reserve.mockResolvedValue(record({ status: 'pending' }));
    base.create.mockRejectedValue(new Error('boom'));
    await expect(service.run({ ...base, key: 'k1' })).rejects.toThrow('boom');
    expect(records.release).toHaveBeenCalledWith('rec1');
  });
});
