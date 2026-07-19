import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';

/** US2 · The family's transfer list, newest first, filterable by account (FR-007, FR-008). */
describe('List transfers (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('lists transfers newest-first and filters by account (origin or destination)', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-list@example.com', 500000, 500000);
    await recordTransfer(app, member.accessToken, { amount: 1000, date: '2026-07-01', fromAccountId: accountA, toAccountId: accountB });
    await recordTransfer(app, member.accessToken, { amount: 2000, date: '2026-07-10', fromAccountId: accountB, toAccountId: accountA });
    await recordTransfer(app, member.accessToken, { amount: 3000, date: '2026-07-05', fromAccountId: accountA, toAccountId: accountB });

    const all = await request(app.getHttpServer())
      .get('/api/v1/transfers')
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(all.status).toBe(200);
    expect(all.body.map((t: { date: string }) => t.date)).toEqual(['2026-07-10', '2026-07-05', '2026-07-01']);

    // ?account matches transfers where the account is origin OR destination — here, all three.
    const byAccount = await request(app.getHttpServer())
      .get(`/api/v1/transfers?account=${accountA}`)
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(byAccount.body).toHaveLength(3);
  });

  it('shows the same transfers to every family member', async () => {
    const http = app.getHttpServer();
    const { member: owner, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-list-owner@example.com');
    await recordTransfer(app, owner.accessToken, { amount: 5000, date: '2026-07-01', fromAccountId: accountA, toAccountId: accountB });
    const invite = await request(http)
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    const second = await registerVerifiedUser(app, mail, 'tr-list-member@example.com');
    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .send({ code: invite.body.code });

    const ownerView = await request(http).get('/api/v1/transfers').set('Authorization', `Bearer ${owner.accessToken}`);
    const memberView = await request(http).get('/api/v1/transfers').set('Authorization', `Bearer ${second.accessToken}`);
    expect(memberView.body).toEqual(ownerView.body);
  });

  it('returns 404 for a member who belongs to no family', async () => {
    const stranger = await registerVerifiedUser(app, mail, 'tr-list-nofamily@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/transfers')
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(404);
  });
});
