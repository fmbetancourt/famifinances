import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupTwoAccounts } from './transfer-helpers';
import { recordMovement } from './movement-helpers';
import { getDashboard } from './dashboard-helpers';

/** Polish (T023) · FR-012 / SC-008: no monetary amount appears in logs when viewing the dashboard. */
describe('No dashboard amount in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes income/expense/balance amounts to stdout/stderr while viewing the dashboard', async () => {
    const { member, accountA } = await setupTwoAccounts(app, mail, 'dash-log@example.com', 654321, 0);
    const token = member.accessToken;
    await recordMovement(app, token, { type: 'income', amount: 987654, date: '2026-07-03', accountId: accountA });

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);
    try {
      await getDashboard(app, token, '2026-07');
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const logged = chunks.join('');
    for (const secret of ['987654', '654321']) {
      expect(logged).not.toContain(secret);
    }
  });
});
