import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';

/**
 * Polish (T025) · FR-015 / SC-007: no account name, institution, or monetary figure
 * appears in logs across create/edit/list/archive.
 */
describe('No financial data in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes account name, institution, or amounts to stdout/stderr', async () => {
    const http = app.getHttpServer();
    const member = await verifiedMemberWithFamily(app, mail, 'log-acc@example.com');

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    const name = 'SantanderSecretCuenta';
    const institution = 'BancoFalabellaSecreta';
    const amount = 987654;
    try {
      const created = await createAccount(app, member.accessToken, {
        name,
        type: 'bank',
        institution,
        initialBalance: amount,
        startDate: '2026-07-01',
      });
      const id = created.body.accountId as string;
      await request(http)
        .patch(`/api/v1/accounts/${id}`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ initialBalance: 111222 });
      await request(http).get('/api/v1/accounts').set('Authorization', `Bearer ${member.accessToken}`);
      await request(http)
        .post(`/api/v1/accounts/${id}/archive`)
        .set('Authorization', `Bearer ${member.accessToken}`);
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const logged = chunks.join('');
    for (const secret of [name, institution, String(amount), '111222']) {
      expect(logged).not.toContain(secret);
    }
  });
});
