import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupMemberWithAccount, recordMovement } from './movement-helpers';
import { aSystemCategoryId } from './category-helpers';

/**
 * US3 · Family isolation & financial integrity (Principle I & III, FR-003/004/013).
 */
describe('Movement isolation & integrity (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('rejects a category whose kind does not match the movement type (400)', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-kind@example.com');
    const incomeCat = await aSystemCategoryId(app, member.accessToken, 'income');

    const res = await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 1000,
      date: '2026-07-05',
      accountId,
      categoryId: incomeCat, // income category on an expense → 400
    });
    expect(res.status).toBe(400);
  });

  it("rejects another family's account or category (400)", async () => {
    const a = await setupMemberWithAccount(app, mail, 'mv-iso-a@example.com');
    const b = await setupMemberWithAccount(app, mail, 'mv-iso-b@example.com');

    // Family B records against family A's account → 400 (not available).
    const foreignAccount = await recordMovement(app, b.member.accessToken, {
      type: 'expense',
      amount: 1000,
      date: '2026-07-05',
      accountId: a.accountId,
    });
    expect(foreignAccount.status).toBe(400);
  });

  it("never exposes or mutates another family's movement (404)", async () => {
    const http = app.getHttpServer();
    const a = await setupMemberWithAccount(app, mail, 'mv-iso-a2@example.com');
    const b = await setupMemberWithAccount(app, mail, 'mv-iso-b2@example.com');
    const created = await recordMovement(app, a.member.accessToken, {
      type: 'expense',
      amount: 1000,
      date: '2026-07-05',
      accountId: a.accountId,
    });
    const aId = created.body.movementId as string;

    expect(
      (await request(http).get(`/api/v1/movements/${aId}`).set('Authorization', `Bearer ${b.member.accessToken}`)).status,
    ).toBe(404);
    expect(
      (
        await request(http)
          .patch(`/api/v1/movements/${aId}`)
          .set('Authorization', `Bearer ${b.member.accessToken}`)
          .send({ amount: 2 })
      ).status,
    ).toBe(404);
    expect(
      (await request(http).delete(`/api/v1/movements/${aId}`).set('Authorization', `Bearer ${b.member.accessToken}`))
        .status,
    ).toBe(404);

    // B's history never includes A's movement.
    const bList = await request(http).get('/api/v1/movements').set('Authorization', `Bearer ${b.member.accessToken}`);
    expect(bList.body.some((m: { movementId: string }) => m.movementId === aId)).toBe(false);
  });

  it('treats a malformed or unknown movement id as not found (404)', async () => {
    const http = app.getHttpServer();
    const { member } = await setupMemberWithAccount(app, mail, 'mv-iso-unknown@example.com');
    expect(
      (await request(http).get('/api/v1/movements/not-an-id').set('Authorization', `Bearer ${member.accessToken}`)).status,
    ).toBe(404);
    expect(
      (
        await request(http)
          .get('/api/v1/movements/5f8d0d55b54764421b7156c1')
          .set('Authorization', `Bearer ${member.accessToken}`)
      ).status,
    ).toBe(404);
  });
});
