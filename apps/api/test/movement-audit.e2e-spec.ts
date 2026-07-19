import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { MovementEventRepository } from '../src/movements/movement-event.repository';
import { setupMemberWithAccount, recordMovement } from './movement-helpers';

/** Polish (T031) · FR-011 / SC-006: create/edit/delete each append a MovementEvent; the trail survives deletion. */
describe('Movement audit trail (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;
  let events: MovementEventRepository;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
    events = app.get(MovementEventRepository);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('records created/updated/deleted with actor + timestamp + snapshot, surviving deletion', async () => {
    const http = app.getHttpServer();
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-audit@example.com');

    const created = await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 10000,
      date: '2026-07-05',
      accountId,
    });
    const id = created.body.movementId as string;
    await request(http)
      .patch(`/api/v1/movements/${id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ amount: 12000 });
    await request(http).delete(`/api/v1/movements/${id}`).set('Authorization', `Bearer ${member.accessToken}`);

    const log = (await events.listByMovement(id)).filter((e) => e.movementId.toString() === id);
    expect(log.map((e) => e.type)).toEqual(['created', 'updated', 'deleted']);
    for (const event of log) {
      expect(event.actorId).toBeDefined();
      expect(event.createdAt).toBeInstanceOf(Date);
      expect(event.snapshot).toMatchObject({ type: 'expense', accountId: expect.anything() });
    }
    // The 'updated' snapshot captured the new amount; the trail persists after deletion.
    expect(log[1].snapshot.amount).toBe(12000);
  });
});
