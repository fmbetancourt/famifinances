import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import {
  createReminder,
  getReminder,
  updateReminder,
  deleteReminder,
  listReminders,
  familyWithMember,
} from './reminder-helpers';

/** Polish · Per-member + cross-family isolation — a foreign reminder id is a 404 (Principle I, FR-006). */
describe('Reminder isolation (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('a second member of the same family cannot access another member reminder', async () => {
    const { owner, member } = await familyWithMember(app, mail, 'rem-iso');
    const created = await createReminder(app, owner.accessToken, {
      purpose: 'capture',
      cadence: 'daily',
      timeOfDay: '20:00',
    });
    const id = created.body.reminderId as string;

    // Same family, different member → still private (per-member scope).
    expect((await getReminder(app, member.accessToken, id)).status).toBe(404);
    expect((await updateReminder(app, member.accessToken, id, { enabled: false })).status).toBe(404);
    expect((await deleteReminder(app, member.accessToken, id)).status).toBe(404);
    expect((await listReminders(app, member.accessToken)).body).toEqual([]);
  });

  it('a member of another family cannot access it either', async () => {
    const a = await verifiedMemberWithFamily(app, mail, 'rem-iso-a@example.com');
    const b = await verifiedMemberWithFamily(app, mail, 'rem-iso-b@example.com');
    const created = await createReminder(app, a.accessToken, {
      purpose: 'capture',
      cadence: 'daily',
      timeOfDay: '20:00',
    });
    const id = created.body.reminderId as string;

    expect((await getReminder(app, b.accessToken, id)).status).toBe(404);
    expect((await deleteReminder(app, b.accessToken, id)).status).toBe(404);
  });
});
