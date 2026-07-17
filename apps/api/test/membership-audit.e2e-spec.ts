import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { MembershipEventRepository } from '../src/memberships/membership-event.repository';
import { registerVerifiedUser } from './family-helpers';

/**
 * Polish (T034) · FR-013: every membership change (created, joined, removed, left)
 * appends an append-only MembershipEvent carrying its actor + timestamp, and the
 * record survives the deletion of the membership it describes.
 */
describe('Membership audit trail (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;
  let events: MembershipEventRepository;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
    events = app.get(MembershipEventRepository);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  /** Issues a fresh invite code for an already-created family owned by `ownerToken`. */
  async function invite(ownerToken: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send();
    return res.body.code as string;
  }

  it('records created/joined/removed/left with actor + timestamp, surviving deletion', async () => {
    const http = app.getHttpServer();
    const owner = await registerVerifiedUser(app, mail, 'audit-owner@example.com');
    const created = await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Audited Family' });
    const familyId = created.body.familyId as string;

    // A member joins, then is removed by the Owner.
    const removed = await registerVerifiedUser(app, mail, 'audit-removed@example.com');
    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${removed.accessToken}`)
      .send({ code: await invite(owner.accessToken) });
    const view = await request(http)
      .get('/api/v1/families/me')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const removedAccountId = (view.body.members as Array<{ accountId: string; email: string }>).find(
      (m) => m.email === removed.email,
    )!.accountId;
    await request(http)
      .delete(`/api/v1/families/me/members/${removedAccountId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    // A second member joins, then leaves on their own.
    const leaver = await registerVerifiedUser(app, mail, 'audit-leaver@example.com');
    await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${leaver.accessToken}`)
      .send({ code: await invite(owner.accessToken) });
    await request(http)
      .post('/api/v1/families/me/leave')
      .set('Authorization', `Bearer ${leaver.accessToken}`);

    const log = await events.listByFamily(familyId);
    const types = log.map((e) => e.type);
    expect(types).toEqual(['created', 'joined', 'removed', 'joined', 'left']);

    // Every event carries an actor and a timestamp.
    for (const event of log) {
      expect(event.actorId).toBeDefined();
      expect(event.createdAt).toBeInstanceOf(Date);
    }

    // The removed member's audit records survive the membership deletion (FR-013).
    const removedEvents = log.filter((e) => e.accountId.toString() === removedAccountId);
    expect(removedEvents.map((e) => e.type)).toEqual(['joined', 'removed']);
  });
});
