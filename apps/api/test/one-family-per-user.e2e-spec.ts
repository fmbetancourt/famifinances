import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';

/** US5 · One family per user; a Member may leave and join another; the Owner may not (FR-002, FR-018). */
describe('One family per user + leave (US5)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  /** Creates a family with a fresh owner and returns a fresh invite code for it. */
  async function inviteFor(ownerEmail: string, name: string): Promise<string> {
    const http = app.getHttpServer();
    const owner = await registerVerifiedUser(app, mail, ownerEmail);
    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name });
    const invite = await request(http)
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    return invite.body.code as string;
  }

  it('lets a Member leave (204) and then join another family', async () => {
    const http = app.getHttpServer();
    const codeA = await inviteFor('lead-a@example.com', 'Family A');
    const mover = await registerVerifiedUser(app, mail, 'mover@example.com');

    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${mover.accessToken}`)
      .send({ code: codeA });

    const left = await request(http)
      .post('/api/v1/families/me/leave')
      .set('Authorization', `Bearer ${mover.accessToken}`);
    expect(left.status).toBe(204);

    // Freed account can now join a different family.
    const codeB = await inviteFor('lead-b@example.com', 'Family B');
    const joinB = await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${mover.accessToken}`)
      .send({ code: codeB });
    expect(joinB.status).toBe(200);
    expect(joinB.body.name).toBe('Family B');
  });

  it('forbids the Owner from leaving their own family (403)', async () => {
    const http = app.getHttpServer();
    const owner = await registerVerifiedUser(app, mail, 'stay-owner@example.com');
    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Owner Stays' });

    const res = await request(http)
      .post('/api/v1/families/me/leave')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(403);

    // Owner still belongs to the family.
    const view = await request(http)
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(view.status).toBe(200);
  });

  it('rejects joining a second family while already a member (409)', async () => {
    const http = app.getHttpServer();
    const codeA = await inviteFor('dup-a@example.com', 'Dup A');
    const codeB = await inviteFor('dup-b@example.com', 'Dup B');
    const user = await registerVerifiedUser(app, mail, 'dup-user@example.com');

    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ code: codeA });

    const second = await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ code: codeB });
    expect(second.status).toBe(409);
  });
});
