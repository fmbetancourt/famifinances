import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupMemberWithAccount, recordMovement } from './movement-helpers';
import { getHistory } from './history-helpers';

/** US4 · Offset/limit pagination with total + hasMore; bounded page size (FR-010/011). */
describe('History pagination (US4)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('returns bounded, non-overlapping pages with accurate total and hasMore', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'hist-page@example.com');
    const token = member.accessToken;
    // 5 movements on distinct days.
    for (let day = 1; day <= 5; day++) {
      const date = `2026-07-0${day}`;
      await recordMovement(app, token, { type: 'expense', amount: day * 1000, date, accountId });
    }

    const first = await getHistory(app, token, '?limit=2&offset=0');
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body).toMatchObject({ total: 5, limit: 2, offset: 0, hasMore: true });

    const second = await getHistory(app, token, '?limit=2&offset=2');
    expect(second.body.items).toHaveLength(2);

    const last = await getHistory(app, token, '?limit=2&offset=4');
    expect(last.body.items).toHaveLength(1);
    expect(last.body.hasMore).toBe(false);

    // No overlap across pages.
    const ids = [...first.body.items, ...second.body.items, ...last.body.items].map((m: { movementId: string }) => m.movementId);
    expect(new Set(ids).size).toBe(5);
  });

  it('rejects a page size over the maximum or non-positive (400)', async () => {
    const { member } = await setupMemberWithAccount(app, mail, 'hist-page-bad@example.com');
    expect((await getHistory(app, member.accessToken, '?limit=101')).status).toBe(400);
    expect((await getHistory(app, member.accessToken, '?limit=0')).status).toBe(400);
    expect((await getHistory(app, member.accessToken, '?offset=-1')).status).toBe(400);
  });
});
