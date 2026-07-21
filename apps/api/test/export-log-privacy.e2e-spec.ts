import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { exportMovements, exportTransfers, ownerWithData } from './export-helpers';

/** Polish · FR-008: no amount/note/email appears in logs across the export ops. */
describe('No export content in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes amounts, notes, or author emails to stdout/stderr', async () => {
    const data = await ownerWithData(app, mail, 'exp-log@example.com');
    const token = data.owner.accessToken;

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    try {
      await exportMovements(app, token);
      await exportTransfers(app, token);
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const output = chunks.join('');
    expect(output).not.toContain('900000'); // an amount
    expect(output).not.toContain('Feria'); // a note
    expect(output).not.toContain('exp-log@example.com'); // author email
  });
});
