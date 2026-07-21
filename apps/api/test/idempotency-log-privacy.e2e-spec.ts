import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { postMovement, ownerWithData } from './idempotency-helpers';

/** Polish · FR-009 — idempotency handling logs key/ids only, never amount/note. */
describe('No amount/note in idempotency logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes the amount or note to logs across create + replay', async () => {
    const ctx = await ownerWithData(app, mail, 'idem-log@example.com');
    const token = ctx.owner.accessToken;
    const amount = 876543;
    const note = 'supersecretnote';
    const body = {
      type: 'expense', amount, date: '2026-07-10', accountId: ctx.accountId, categoryId: ctx.categoryId, note,
    };

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    try {
      await postMovement(app, token, body, 'k-log-1'); // create
      await postMovement(app, token, body, 'k-log-1'); // replay
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const output = chunks.join('');
    expect(output).not.toContain(String(amount));
    expect(output).not.toContain(note);
  });
});
