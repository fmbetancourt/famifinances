import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { InvitationDocument } from './invitation.schema';
import { InvitationService } from './invitation.service';

/** Deterministic SHA-256 mirror of the service's private hash, for assertions. */
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('InvitationService (US2)', () => {
  const config = {
    getOrThrow: (key: string) => ({ OTP_TTL: '600' })[key],
  } as unknown as ConfigService;

  function buildService(execResult: unknown): {
    service: InvitationService;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
  } {
    const create = jest.fn().mockResolvedValue({});
    const findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(execResult),
    });
    const model = { create, findOneAndUpdate } as unknown as Model<InvitationDocument>;
    return { service: new InvitationService(model, config), create, findOneAndUpdate };
  }

  it('issues a high-entropy code and persists only its hash (never the plaintext)', async () => {
    const { service, create } = buildService(null);

    const { code, expiresIn } = await service.issue(
      '5f8d0d55b54764421b7156c1',
      '5f8d0d55b54764421b7156c2',
    );

    expect(expiresIn).toBe(600);
    expect(code).toMatch(/^[0-9a-f]{16}$/); // 64-bit hex
    const persisted = create.mock.calls[0][0];
    expect(persisted.codeHash).toBe(sha256(code));
    expect(persisted.codeHash).not.toBe(code);
    expect(persisted.consumedAt).toBeNull();
    expect(persisted.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('redeems atomically on an unconsumed, unexpired code and returns the family', async () => {
    const { service, findOneAndUpdate } = buildService({
      familyId: { toString: () => 'family-42' },
    });

    const result = await service.redeem('abc123');

    expect(result).toEqual({ familyId: 'family-42' });
    const filter = findOneAndUpdate.mock.calls[0][0];
    const update = findOneAndUpdate.mock.calls[0][1];
    expect(filter.codeHash).toBe(sha256('abc123'));
    expect(filter.consumedAt).toBeNull(); // single-use guard
    expect(filter.expiresAt.$gt).toBeInstanceOf(Date); // expiry guard
    expect(update.$set.consumedAt).toBeInstanceOf(Date);
  });

  it('returns null for an invalid / expired / already-consumed code', async () => {
    const { service } = buildService(null);

    await expect(service.redeem('nope')).resolves.toBeNull();
  });
});
