import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupMemberWithAccount, recordMovement } from './movement-helpers';
import { getHistory } from './history-helpers';

/** US1 · Filter the history by date range and type; deleted excluded; newest first (FR-002/003/008/009). */
describe('History date range + type (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('returns only in-range, non-deleted movements of the given type, newest first', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'hist-dt@example.com');
    const token = member.accessToken;
    const exp = (amount: number, date: string) =>
      recordMovement(app, token, { type: 'expense', amount, date, accountId });

    await exp(1000, '2026-06-30'); // out of range
    const deletable = await exp(2000, '2026-07-05'); // will be deleted
    const july20 = await exp(3000, '2026-07-20');
    const july25 = await exp(4000, '2026-07-25');
    await recordMovement(app, token, { type: 'income', amount: 9000, date: '2026-07-10', accountId }); // filtered by type
    await request(app.getHttpServer())
      .delete(`/api/v1/movements/${deletable.body.movementId}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await getHistory(app, token, '?from=2026-07-01&to=2026-07-31&type=expense');
    expect(res.status).toBe(200);
    // Newest first: 07-25 then 07-20 (June out of range, income filtered, deleted excluded).
    const ids = (res.body.items as Array<{ movementId: string }>).map((m) => m.movementId);
    expect(ids).toEqual([july25.body.movementId, july20.body.movementId]);
    expect(res.body.total).toBe(2);
  });

  it('returns an empty page for a range with no matches (not an error)', async () => {
    const { member } = await setupMemberWithAccount(app, mail, 'hist-dt-empty@example.com');
    const res = await getHistory(app, member.accessToken, '?from=2030-01-01&to=2030-01-31');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body).toMatchObject({ total: 0, hasMore: false });
  });
});
