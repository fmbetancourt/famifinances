import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser, VerifiedUser } from './family-helpers';

/** US4 · Owner manages the family's members; removal is immediate (FR-015..FR-017). */
describe('Manage members (US4)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  /** Owner + one joined member; returns both users and the member's accountId. */
  async function familyWithMember(prefix: string): Promise<{
    owner: VerifiedUser;
    member: VerifiedUser;
    memberAccountId: string;
  }> {
    const http = app.getHttpServer();
    const owner = await registerVerifiedUser(app, mail, `${prefix}-owner@example.com`);
    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Managed Family' });
    const invite = await request(http)
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send();
    const member = await registerVerifiedUser(app, mail, `${prefix}-member@example.com`);
    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ code: invite.body.code });

    const view = await request(http)
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const memberAccountId = (view.body.members as Array<{ accountId: string; email: string }>).find(
      (m) => m.email === member.email,
    )!.accountId;

    return { owner, member, memberAccountId };
  }

  it('lets the Owner remove a Member (204) and revokes access immediately', async () => {
    const http = app.getHttpServer();
    const { owner, member, memberAccountId } = await familyWithMember('rm');

    const removed = await request(http)
      .delete(`/api/v1/families/me/members/${memberAccountId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(removed.status).toBe(204);

    // The removed member no longer belongs to any family.
    const afterView = await request(http)
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(afterView.status).toBe(404);
  });

  it('refuses to remove the Owner (403)', async () => {
    const http = app.getHttpServer();
    const owner = await registerVerifiedUser(app, mail, 'self-owner@example.com');
    const created = await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Solo Family' });
    // Discover the owner's own accountId from the member list.
    const view = await request(http)
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const ownerAccountId = (view.body.members as Array<{ accountId: string; role: string }>).find(
      (m) => m.role === 'owner',
    )!.accountId;
    expect(created.status).toBe(201);

    const res = await request(http)
      .delete(`/api/v1/families/me/members/${ownerAccountId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('forbids a non-owner Member from removing anyone (403)', async () => {
    const http = app.getHttpServer();
    const { owner, member, memberAccountId } = await familyWithMember('nonowner');

    // A member tries to remove the owner (or anyone) → blocked by the role guard.
    const view = await request(http)
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const ownerAccountId = (view.body.members as Array<{ accountId: string; role: string }>).find(
      (m) => m.role === 'owner',
    )!.accountId;

    const res = await request(http)
      .delete(`/api/v1/families/me/members/${ownerAccountId}`)
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(res.status).toBe(403);
    // And the member is still in the family (removal did not happen).
    expect(memberAccountId).toBeDefined();
    const stillThere = await request(http)
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(stillThere.status).toBe(200);
  });
});
