import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';

/**
 * US3 · Cross-family isolation for accounts (Constitution Principle I, FR-007, SC-003).
 * An account is only visible/modifiable by its own family; the acting family comes
 * from the session, and a foreign account id resolves to 404.
 */
describe('Account isolation (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never exposes or mutates another family account (404 on read/edit/archive)', async () => {
    const http = app.getHttpServer();
    const familyA = await verifiedMemberWithFamily(app, mail, 'iso-a@example.com', 'Family A');
    const familyB = await verifiedMemberWithFamily(app, mail, 'iso-b@example.com', 'Family B');

    const created = await createAccount(app, familyA.accessToken, {
      name: 'A Private',
      type: 'bank',
      initialBalance: 100000,
      startDate: '2026-07-01',
    });
    const aId = created.body.accountId as string;

    // Member of family B cannot read, edit, or archive family A's account.
    const read = await request(http)
      .get(`/api/v1/accounts/${aId}`)
      .set('Authorization', `Bearer ${familyB.accessToken}`);
    expect(read.status).toBe(404);

    const edit = await request(http)
      .patch(`/api/v1/accounts/${aId}`)
      .set('Authorization', `Bearer ${familyB.accessToken}`)
      .send({ name: 'Hijacked' });
    expect(edit.status).toBe(404);

    const archive = await request(http)
      .post(`/api/v1/accounts/${aId}/archive`)
      .set('Authorization', `Bearer ${familyB.accessToken}`);
    expect(archive.status).toBe(404);

    // B's account list never includes A's account.
    const bList = await request(http)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${familyB.accessToken}`);
    expect(bList.body).toEqual([]);

    // A still sees its own account intact (no mutation leaked through).
    const aRead = await request(http)
      .get(`/api/v1/accounts/${aId}`)
      .set('Authorization', `Bearer ${familyA.accessToken}`);
    expect(aRead.status).toBe(200);
    expect(aRead.body).toMatchObject({ name: 'A Private', archived: false });
  });

  it('treats a malformed or unknown account id as not found (404)', async () => {
    const http = app.getHttpServer();
    const member = await verifiedMemberWithFamily(app, mail, 'iso-unknown@example.com');

    const malformed = await request(http)
      .get('/api/v1/accounts/not-an-object-id')
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(malformed.status).toBe(404);

    const unknown = await request(http)
      .get('/api/v1/accounts/5f8d0d55b54764421b7156c1')
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(unknown.status).toBe(404);
  });
});
