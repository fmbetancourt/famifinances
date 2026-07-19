import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';

/** Polish (T030) · FR-015 / SC-009: no monetary amount or note appears in logs. */
describe('No financial data in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes amounts or note content to stdout/stderr across record/list/edit/delete', async () => {
    const http = app.getHttpServer();
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-log@example.com');

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    const amount = 987654;
    const note = 'NotaTransferSecretaXYZ';
    try {
      const created = await recordTransfer(app, member.accessToken, {
        amount,
        date: '2026-07-05',
        fromAccountId: accountA,
        toAccountId: accountB,
        note,
      });
      const id = created.body.transferId as string;
      await request(http)
        .patch(`/api/v1/transfers/${id}`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ amount: 111222 });
      await request(http).get('/api/v1/transfers').set('Authorization', `Bearer ${member.accessToken}`);
      await request(http).delete(`/api/v1/transfers/${id}`).set('Authorization', `Bearer ${member.accessToken}`);
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const logged = chunks.join('');
    for (const secret of [String(amount), note, '111222']) {
      expect(logged).not.toContain(secret);
    }
  });
});
