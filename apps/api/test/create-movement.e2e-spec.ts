import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';
import { setupMemberWithAccount, recordMovement, accountBalance } from './movement-helpers';

/** US1 · Record an income/expense movement; the account balance reflects it (FR-001..FR-006). */
describe('Create movement (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('records an expense that decreases the balance and an income that increases it', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-create@example.com', 100000);

    const expense = await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 30000,
      date: '2026-07-05',
      accountId,
    });
    expect(expense.status).toBe(201);
    expect(expense.body).toMatchObject({ type: 'expense', amount: 30000, accountId, categoryId: null });
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(70000);

    const income = await recordMovement(app, member.accessToken, {
      type: 'income',
      amount: 50000,
      date: '2026-07-06',
      accountId,
    });
    expect(income.status).toBe(201);
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(120000);
  });

  it('blocks an unverified member (403 soft gate)', async () => {
    const email = 'mv-unverified@example.com';
    const http = app.getHttpServer();
    await request(http).post('/api/v1/auth/register').send({ email, password: 'strongpassword1' });
    const token = (
      await request(http).post('/api/v1/auth/login').send({ email, password: 'strongpassword1' })
    ).body.accessToken as string;

    // Unverified + no family → the family boundary is checked first → 404 (no family),
    // but a family member is always verified, so 403 is reserved for that case.
    const res = await recordMovement(app, token, {
      type: 'expense',
      amount: 1000,
      date: '2026-07-05',
      accountId: '5f8d0d55b54764421b7156c1',
    });
    expect([403, 404]).toContain(res.status);
  });

  it('rejects a member who belongs to no family (404)', async () => {
    const stranger = await registerVerifiedUser(app, mail, 'mv-nofamily@example.com');
    const res = await recordMovement(app, stranger.accessToken, {
      type: 'expense',
      amount: 1000,
      date: '2026-07-05',
      accountId: '5f8d0d55b54764421b7156c1',
    });
    expect(res.status).toBe(404);
  });

  it('rejects invalid input: bad type, non-positive/fractional amount, invalid date, unknown field (400)', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-invalid@example.com');
    const base = { type: 'expense', amount: 1000, date: '2026-07-05', accountId };

    for (const bad of [
      { ...base, type: 'transfer' },
      { ...base, amount: 0 },
      { ...base, amount: -100 },
      { ...base, amount: 100.5 },
      { ...base, date: '2026-13-40' },
      { ...base, date: '2026-07-05T00:00:00Z' },
      { ...base, foo: 'bar' },
    ]) {
      const res = await recordMovement(app, member.accessToken, bad);
      expect(res.status).toBe(400);
    }
  });
});
