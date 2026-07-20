import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupMemberWithAccount, recordMovement } from './movement-helpers';
import { getHistory } from './history-helpers';

/** US3 · Case-insensitive substring note search; no-note excluded; escaped; blank = no filter (FR-006). */
describe('History note search (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('matches a case-insensitive substring, excludes note-less, escapes metacharacters, and treats blank as no filter', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'hist-search@example.com');
    const token = member.accessToken;
    const exp = (amount: number, date: string, note: string | null) =>
      recordMovement(app, token, { type: 'expense', amount, date, accountId, note });

    await exp(1000, '2026-07-01', 'Farmacia Ahumada');
    await exp(2000, '2026-07-02', 'farmacia cruz verde');
    await exp(3000, '2026-07-03', 'Supermercado');
    await exp(4000, '2026-07-04', null); // no note

    // Case-insensitive substring.
    const farmacia = await getHistory(app, token, '?search=farmacia');
    expect(farmacia.status).toBe(200);
    expect(farmacia.body.total).toBe(2);

    // A regex metacharacter term is matched literally (escaped) → no note contains ".*".
    const meta = await getHistory(app, token, '?search=.*');
    expect(meta.body.total).toBe(0);

    // A movement without a note never matches a (non-blank) search.
    const superSearch = await getHistory(app, token, '?search=super');
    expect((superSearch.body.items as Array<{ note: string | null }>).every((m) => m.note !== null)).toBe(true);

    // A blank search applies no note filter → all four movements (note-less included).
    const blank = await getHistory(app, token, '?search=');
    expect(blank.body.total).toBe(4);
  });
});
