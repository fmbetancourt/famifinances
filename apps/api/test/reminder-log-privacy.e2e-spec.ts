import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { createReminder, updateReminder, listReminders, deleteReminder } from './reminder-helpers';

/** Polish · FR-010: no reminder label text appears in logs across the reminder ops. */
describe('No reminder label in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes the label to stdout/stderr across create/list/update/delete', async () => {
    const owner = await verifiedMemberWithFamily(app, mail, 'rem-log@example.com');
    const token = owner.accessToken;

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    const label = 'supersecretreminderlabel';
    try {
      const created = await createReminder(app, token, {
        purpose: 'custom',
        cadence: 'daily',
        timeOfDay: '20:00',
        label,
      });
      const id = created.body.reminderId as string;
      await listReminders(app, token);
      await updateReminder(app, token, id, { label: `${label}-edit` });
      await deleteReminder(app, token, id);
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    expect(chunks.join('')).not.toContain(label);
  });
});
