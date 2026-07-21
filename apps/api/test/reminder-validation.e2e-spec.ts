import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { VerifiedUser } from './family-helpers';
import { createReminder } from './reminder-helpers';

/** US2 · Weekly/monthly happy paths + the full rejection matrix (FR-001/007/009). */
describe('Reminder validation (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;
  let owner: VerifiedUser;
  let token: string;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
    owner = await verifiedMemberWithFamily(app, mail, 'rem-valid@example.com');
    token = owner.accessToken;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('accepts a monthly reminder (dayOfMonth) and a weekly reminder (dayOfWeek)', async () => {
    const monthly = await createReminder(app, token, {
      purpose: 'budget',
      cadence: 'monthly',
      timeOfDay: '09:00',
      dayOfMonth: 1,
    });
    expect(monthly.status).toBe(201);
    expect(monthly.body).toMatchObject({ cadence: 'monthly', dayOfMonth: 1, dayOfWeek: null });

    const weekly = await createReminder(app, token, {
      purpose: 'custom',
      cadence: 'weekly',
      timeOfDay: '08:00',
      dayOfWeek: 'monday',
      label: 'Revisar la semana',
    });
    expect(weekly.status).toBe(201);
    expect(weekly.body).toMatchObject({ cadence: 'weekly', dayOfWeek: 'monday', dayOfMonth: null });
  });

  it('accepts dayOfMonth 31 (device clamps to the last day)', async () => {
    const res = await createReminder(app, token, {
      purpose: 'budget',
      cadence: 'monthly',
      timeOfDay: '10:00',
      dayOfMonth: 31,
    });
    expect(res.status).toBe(201);
    expect(res.body.dayOfMonth).toBe(31);
  });

  it('rejects invalid configurations (400)', async () => {
    const badTime = await createReminder(app, token, {
      purpose: 'capture',
      cadence: 'daily',
      timeOfDay: '24:00',
    });
    expect(badTime.status).toBe(400);

    const dailyWithSelector = await createReminder(app, token, {
      purpose: 'capture',
      cadence: 'daily',
      timeOfDay: '20:00',
      dayOfWeek: 'monday',
    });
    expect(dailyWithSelector.status).toBe(400);

    const weeklyNoDay = await createReminder(app, token, {
      purpose: 'capture',
      cadence: 'weekly',
      timeOfDay: '08:00',
    });
    expect(weeklyNoDay.status).toBe(400);

    const monthlyNoDay = await createReminder(app, token, {
      purpose: 'budget',
      cadence: 'monthly',
      timeOfDay: '09:00',
    });
    expect(monthlyNoDay.status).toBe(400);

    const customBlank = await createReminder(app, token, {
      purpose: 'custom',
      cadence: 'daily',
      timeOfDay: '20:00',
      label: '   ',
    });
    expect(customBlank.status).toBe(400);
  });

  it('rejects creating past the per-member cap of 20 (409)', async () => {
    const capped = await verifiedMemberWithFamily(app, mail, 'rem-cap@example.com');
    const capToken = capped.accessToken;
    for (let i = 0; i < 20; i += 1) {
      const res = await createReminder(app, capToken, {
        purpose: 'capture',
        cadence: 'daily',
        timeOfDay: '07:00',
      });
      expect(res.status).toBe(201);
    }
    const overflow = await createReminder(app, capToken, {
      purpose: 'capture',
      cadence: 'daily',
      timeOfDay: '07:00',
    });
    expect(overflow.status).toBe(409);
  });
});
