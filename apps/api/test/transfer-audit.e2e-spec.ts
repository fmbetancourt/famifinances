import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { TransferEventRepository } from '../src/transfers/transfer-event.repository';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';

/** Polish (T029) · FR-011 / SC-006: create/edit/delete each append a TransferEvent; the trail survives deletion. */
describe('Transfer audit trail (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;
  let events: TransferEventRepository;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
    events = app.get(TransferEventRepository);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('records created/updated/deleted with actor + timestamp + snapshot, surviving deletion', async () => {
    const http = app.getHttpServer();
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-audit@example.com');
    const created = await recordTransfer(app, member.accessToken, {
      amount: 10000,
      date: '2026-07-05',
      fromAccountId: accountA,
      toAccountId: accountB,
    });
    const id = created.body.transferId as string;
    await request(http)
      .patch(`/api/v1/transfers/${id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ amount: 12000 });
    await request(http).delete(`/api/v1/transfers/${id}`).set('Authorization', `Bearer ${member.accessToken}`);

    const log = (await events.listByTransfer(id)).filter((e) => e.transferId.toString() === id);
    expect(log.map((e) => e.type)).toEqual(['created', 'updated', 'deleted']);
    for (const event of log) {
      expect(event.actorId).toBeDefined();
      expect(event.createdAt).toBeInstanceOf(Date);
      expect(event.snapshot).toMatchObject({ fromAccountId: expect.anything(), toAccountId: expect.anything() });
    }
    expect(log[1].snapshot.amount).toBe(12000);
  });
});
