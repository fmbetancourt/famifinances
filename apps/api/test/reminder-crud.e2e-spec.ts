import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { createReminder, listReminders, getReminder } from './reminder-helpers';

/** US1 · Daily capture reminder round-trips with defaults (FR-001/002). */
describe('Reminder CRUD (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('creates a daily reminder with defaults, then lists and gets it', async () => {
    const owner = await verifiedMemberWithFamily(app, mail, 'rem-crud@example.com');
    const token = owner.accessToken;

    const created = await createReminder(app, token, {
      purpose: 'capture',
      cadence: 'daily',
      timeOfDay: '20:00',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      purpose: 'capture',
      cadence: 'daily',
      timeOfDay: '20:00',
      dayOfWeek: null,
      dayOfMonth: null,
      label: null,
      enabled: true,
    });
    const reminderId = created.body.reminderId as string;

    const list = await listReminders(app, token);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].reminderId).toBe(reminderId);

    const one = await getReminder(app, token, reminderId);
    expect(one.status).toBe(200);
    expect(one.body.reminderId).toBe(reminderId);
  });
});
