import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupMemberWithAccount, recordMovement } from './movement-helpers';
import { getHistory } from './history-helpers';

/** Polish (T019) · FR-013 / SC-007: no monetary amount or note content appears in logs. */
describe('No history amount/note in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes amounts or note content to stdout/stderr while querying the history', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'hist-log@example.com');
    const token = member.accessToken;
    await recordMovement(app, token, { type: 'expense', amount: 987654, date: '2026-07-05', accountId, note: 'SecretoXYZ' });

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);
    try {
      await getHistory(app, token, '?search=Secreto');
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const logged = chunks.join('');
    expect(logged).not.toContain('987654');
    expect(logged).not.toContain('SecretoXYZ');
  });
});
