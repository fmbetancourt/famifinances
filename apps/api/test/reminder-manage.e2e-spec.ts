import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { VerifiedUser } from './family-helpers';
import {
  createReminder,
  listReminders,
  getReminder,
  updateReminder,
  deleteReminder,
} from './reminder-helpers';

/** US3 · Edit / silence / delete a reminder (FR-003/004/005). */
describe('Reminder management (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;
  let owner: VerifiedUser;
  let token: string;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
    owner = await verifiedMemberWithFamily(app, mail, 'rem-manage@example.com');
    token = owner.accessToken;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function makeDaily(time = '20:00'): Promise<string> {
    const res = await createReminder(app, token, {
      purpose: 'capture',
      cadence: 'daily',
      timeOfDay: time,
    });
    return res.body.reminderId as string;
  }

  it('edits the time of a reminder', async () => {
    const id = await makeDaily();
    const res = await updateReminder(app, token, id, { timeOfDay: '21:30' });
    expect(res.status).toBe(200);
    expect(res.body.timeOfDay).toBe('21:30');

    const one = await getReminder(app, token, id);
    expect(one.body.timeOfDay).toBe('21:30');
  });

  it('silences then re-enables a reminder without deleting it', async () => {
    const id = await makeDaily('07:00');
    const off = await updateReminder(app, token, id, { enabled: false });
    expect(off.status).toBe(200);
    expect(off.body.enabled).toBe(false);

    // Still present (retained), just silenced.
    const one = await getReminder(app, token, id);
    expect(one.status).toBe(200);
    expect(one.body.enabled).toBe(false);

    const on = await updateReminder(app, token, id, { enabled: true });
    expect(on.body.enabled).toBe(true);
  });

  it('deletes a reminder (204) and it disappears; deleting again is 404', async () => {
    const id = await makeDaily('06:30');
    const del = await deleteReminder(app, token, id);
    expect(del.status).toBe(204);

    const list = await listReminders(app, token);
    expect(list.body.map((r: { reminderId: string }) => r.reminderId)).not.toContain(id);

    expect((await deleteReminder(app, token, id)).status).toBe(404);
  });

  it('rejects an incoherent edit (switch to weekly without a day) with 400', async () => {
    const id = await makeDaily('05:00');
    const res = await updateReminder(app, token, id, { cadence: 'weekly' });
    expect(res.status).toBe(400);
  });
});
