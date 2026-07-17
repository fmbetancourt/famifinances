import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';

/**
 * US3 · Family data isolation (Constitution Principle I, FR-009..FR-013). The
 * family is resolved from the session membership, never from client input.
 */
describe('Family isolation (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('scopes GET /families/me to the caller family and lists its members', async () => {
    const http = app.getHttpServer();
    const owner = await registerVerifiedUser(app, mail, 'iso-owner@example.com');
    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Isolation Family' });
    const invite = await request(http)
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    const member = await registerVerifiedUser(app, mail, 'iso-member@example.com');
    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ code: invite.body.code });

    const view = await request(http)
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${member.accessToken}`);

    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ name: 'Isolation Family', role: 'member' });
    const emails = (view.body.members as Array<{ email: string }>).map((m) => m.email).sort();
    expect(emails).toEqual(['iso-member@example.com', 'iso-owner@example.com']);
  });

  it('never leaks another family: each owner sees only their own family + members', async () => {
    const http = app.getHttpServer();
    const ownerA = await registerVerifiedUser(app, mail, 'leak-a@example.com');
    const ownerB = await registerVerifiedUser(app, mail, 'leak-b@example.com');
    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ name: 'Family A' });
    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .send({ name: 'Family B' });

    // Owner B's session resolves to Family B only — even though the request
    // carries no family id, and any foreign id would be ignored (Principle I).
    const viewB = await request(http)
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${ownerB.accessToken}`);

    expect(viewB.status).toBe(200);
    expect(viewB.body.name).toBe('Family B');
    const emailsB = (viewB.body.members as Array<{ email: string }>).map((m) => m.email);
    expect(emailsB).toEqual(['leak-b@example.com']);
    expect(emailsB).not.toContain('leak-a@example.com');
  });

  it('returns 404 for a user who belongs to no family', async () => {
    const { accessToken } = await registerVerifiedUser(app, mail, 'nofamily@example.com');

    const res = await request(app.getHttpServer())
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it('forbids a non-owner member from issuing invite codes (FR-004 role check)', async () => {
    const http = app.getHttpServer();
    const owner = await registerVerifiedUser(app, mail, 'role-owner@example.com');
    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Role Family' });
    const invite = await request(http)
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    const member = await registerVerifiedUser(app, mail, 'role-member@example.com');
    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ code: invite.body.code });

    const res = await request(http)
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send();

    expect(res.status).toBe(403);
  });
});
