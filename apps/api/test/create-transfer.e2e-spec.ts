import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';
import { accountBalance } from './movement-helpers';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';

/** US1 · Record a transfer; origin decreases, destination increases (FR-001..FR-006). */
describe('Create transfer (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('moves money: origin balance decreases and destination increases by the amount', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-create@example.com', 100000, 20000);

    const res = await recordTransfer(app, member.accessToken, {
      amount: 30000,
      date: '2026-07-05',
      fromAccountId: accountA,
      toAccountId: accountB,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ amount: 30000, fromAccountId: accountA, toAccountId: accountB });

    expect(await accountBalance(app, member.accessToken, accountA)).toBe(70000);
    expect(await accountBalance(app, member.accessToken, accountB)).toBe(50000);
  });

  it('rejects a member who belongs to no family (404)', async () => {
    const stranger = await registerVerifiedUser(app, mail, 'tr-nofamily@example.com');
    const res = await recordTransfer(app, stranger.accessToken, {
      amount: 1000,
      date: '2026-07-05',
      fromAccountId: '5f8d0d55b54764421b7156c1',
      toAccountId: '5f8d0d55b54764421b7156c2',
    });
    expect(res.status).toBe(404);
  });

  it('rejects invalid input: non-positive amount, invalid date, same account, unknown field (400)', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-invalid@example.com');
    const base = { amount: 1000, date: '2026-07-05', fromAccountId: accountA, toAccountId: accountB };

    for (const bad of [
      { ...base, amount: 0 },
      { ...base, amount: -100 },
      { ...base, amount: 100.5 },
      { ...base, date: '2026-13-40' },
      { ...base, toAccountId: accountA }, // origin == destination
      { ...base, foo: 'bar' },
    ]) {
      const res = await recordTransfer(app, member.accessToken, bad);
      expect(res.status).toBe(400);
    }
  });
});
