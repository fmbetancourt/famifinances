import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';
import { setupMemberWithAccount, recordMovement } from './movement-helpers';

/** US2 · The family's movement history, newest first, filterable (FR-007, FR-008). */
describe('List movements (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('lists movements newest-first and filters by type', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-list@example.com');
    await recordMovement(app, member.accessToken, { type: 'expense', amount: 1000, date: '2026-07-01', accountId });
    await recordMovement(app, member.accessToken, { type: 'income', amount: 2000, date: '2026-07-10', accountId });
    await recordMovement(app, member.accessToken, { type: 'expense', amount: 3000, date: '2026-07-05', accountId });

    const all = await request(app.getHttpServer())
      .get('/api/v1/movements')
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(all.status).toBe(200);
    expect(all.body.map((m: { date: string }) => m.date)).toEqual(['2026-07-10', '2026-07-05', '2026-07-01']);

    const expenses = await request(app.getHttpServer())
      .get('/api/v1/movements?type=expense')
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(expenses.body).toHaveLength(2);
    expect(expenses.body.every((m: { type: string }) => m.type === 'expense')).toBe(true);
  });

  it('filters by account', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-list-acct@example.com');
    const other = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ name: 'Otra', type: 'cash', initialBalance: 0, startDate: '2026-07-01' });
    const otherId = other.body.accountId as string;
    await recordMovement(app, member.accessToken, { type: 'expense', amount: 1000, date: '2026-07-01', accountId });
    await recordMovement(app, member.accessToken, { type: 'expense', amount: 2000, date: '2026-07-02', accountId: otherId });

    const byAccount = await request(app.getHttpServer())
      .get(`/api/v1/movements?account=${accountId}`)
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(byAccount.body).toHaveLength(1);
    expect(byAccount.body[0].accountId).toBe(accountId);
  });

  it('shows the same movements to every family member', async () => {
    const http = app.getHttpServer();
    const { member: owner, accountId } = await setupMemberWithAccount(app, mail, 'mv-list-owner@example.com');
    await recordMovement(app, owner.accessToken, { type: 'income', amount: 5000, date: '2026-07-01', accountId });
    const invite = await request(http)
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    const second = await registerVerifiedUser(app, mail, 'mv-list-member@example.com');
    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .send({ code: invite.body.code });

    const ownerView = await request(http).get('/api/v1/movements').set('Authorization', `Bearer ${owner.accessToken}`);
    const memberView = await request(http).get('/api/v1/movements').set('Authorization', `Bearer ${second.accessToken}`);
    expect(memberView.body).toEqual(ownerView.body);
  });

  it('returns 404 for a member who belongs to no family', async () => {
    const stranger = await registerVerifiedUser(app, mail, 'mv-list-nofamily@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/movements')
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(404);
  });
});
