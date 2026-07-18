import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';

/** US2 · Members share one view of the family's accounts and balances (FR-006, SC-002, SC-004). */
describe('List accounts (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('lists the family accounts with derived balances and fetches one by id', async () => {
    const owner = await verifiedMemberWithFamily(app, mail, 'list-owner@example.com');
    const created = await createAccount(app, owner.accessToken, {
      name: 'Efectivo',
      type: 'cash',
      initialBalance: 50000,
      startDate: '2026-07-01',
    });
    const accountId = created.body.accountId as string;

    const list = await request(app.getHttpServer())
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: 'Efectivo', balance: 50000 });

    const one = await request(app.getHttpServer())
      .get(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(one.status).toBe(200);
    expect(one.body.accountId).toBe(accountId);
  });

  it('shows the same accounts and balances to every member of the family (SC-002)', async () => {
    const http = app.getHttpServer();
    const owner = await verifiedMemberWithFamily(app, mail, 'shared-owner@example.com', 'Shared Family');
    await createAccount(app, owner.accessToken, {
      name: 'Cuenta BCI',
      type: 'bank',
      initialBalance: 300000,
      startDate: '2026-07-01',
    });
    // A second member joins the same family via an invite.
    const invite = await request(http)
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    const member = await registerVerifiedUser(app, mail, 'shared-member@example.com');
    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ code: invite.body.code });

    const ownerView = await request(http)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const memberView = await request(http)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${member.accessToken}`);

    expect(memberView.status).toBe(200);
    expect(memberView.body).toEqual(ownerView.body);
    expect(memberView.body[0]).toMatchObject({ name: 'Cuenta BCI', balance: 300000 });
  });

  it('returns 404 for a member who belongs to no family', async () => {
    const stranger = await registerVerifiedUser(app, mail, 'list-nofamily@example.com');

    const res = await request(app.getHttpServer())
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(404);
  });
});
