import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupMemberWithAccount, recordMovement, accountBalance } from './movement-helpers';
import { aSystemCategoryId } from './category-helpers';

/** US4 · Edit a movement; balances recompute; edits are re-validated (FR-009). */
describe('Edit movement (US4)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('edits the amount and the balance recomputes', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-edit@example.com', 100000);
    const created = await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 30000,
      date: '2026-07-05',
      accountId,
    });
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(70000);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/movements/${created.body.movementId}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ amount: 40000 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(40000);
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(60000);
  });

  it('moves a movement to another account and both balances recompute', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-edit-move@example.com', 100000);
    const other = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ name: 'Otra', type: 'cash', initialBalance: 50000, startDate: '2026-07-01' });
    const otherId = other.body.accountId as string;
    const created = await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 20000,
      date: '2026-07-05',
      accountId,
    });
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(80000);

    await request(app.getHttpServer())
      .patch(`/api/v1/movements/${created.body.movementId}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ accountId: otherId });

    expect(await accountBalance(app, member.accessToken, accountId)).toBe(100000); // restored
    expect(await accountBalance(app, member.accessToken, otherId)).toBe(30000); // 50000 − 20000
  });

  it('rejects an invalid edit (empty body / kind mismatch) and leaves it unchanged (400)', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-edit-invalid@example.com');
    const incomeCat = await aSystemCategoryId(app, member.accessToken, 'income');
    const created = await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 1000,
      date: '2026-07-05',
      accountId,
    });
    const id = created.body.movementId as string;

    const empty = await request(app.getHttpServer())
      .patch(`/api/v1/movements/${id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({});
    expect(empty.status).toBe(400);

    // Setting an income category on an expense movement → kind mismatch 400.
    const mismatch = await request(app.getHttpServer())
      .patch(`/api/v1/movements/${id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ categoryId: incomeCat });
    expect(mismatch.status).toBe(400);
  });
});
