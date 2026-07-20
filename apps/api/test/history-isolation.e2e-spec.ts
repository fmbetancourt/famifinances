import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { registerVerifiedUser } from './family-helpers';
import { setupMemberWithAccount, recordMovement } from './movement-helpers';
import { getHistory } from './history-helpers';

/** US1–US3 · The history is scoped to the session family; no other family leaks in (FR-012). */
describe('History isolation (US1–US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never returns another family movements, even when filtering by their ids', async () => {
    const familyA = await setupMemberWithAccount(app, mail, 'hist-iso-a@example.com');
    await recordMovement(app, familyA.member.accessToken, { type: 'expense', amount: 5000, date: '2026-07-05', accountId: familyA.accountId });

    const familyB = await verifiedMemberWithFamily(app, mail, 'hist-iso-b@example.com');
    const own = await getHistory(app, familyB.accessToken, '?from=2026-07-01&to=2026-07-31');
    expect(own.status).toBe(200);
    expect(own.body.items).toEqual([]);
    expect(own.body.total).toBe(0);

    // Filtering by family A's account id must not surface A's movements.
    const spoof = await getHistory(app, familyB.accessToken, `?account=${familyA.accountId}`);
    expect(spoof.status).toBe(200);
    expect(spoof.body.items).toEqual([]);
  });

  it('rejects a caller who belongs to no family (404)', async () => {
    const stranger = await registerVerifiedUser(app, mail, 'hist-iso-nofamily@example.com');
    const res = await getHistory(app, stranger.accessToken, '?from=2026-07-01&to=2026-07-31');
    expect(res.status).toBe(404);
  });
});
