import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { createAccount } from './account-helpers';
import { createCategory } from './category-helpers';
import { recordMovement } from './movement-helpers';
import { verifiedMemberWithFamily } from './account-helpers';
import { exportMovements, parseCsv } from './export-helpers';

/** Polish · RFC-4180 escaping, accents preserved, soft-deleted excluded (FR-005/006). */
describe('Export escaping & deleted rows (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('keeps a note with comma/quote/newline in one cell, preserves accents, and excludes deleted', async () => {
    const owner = await verifiedMemberWithFamily(app, mail, 'exp-esc@example.com');
    const token = owner.accessToken;
    const account = await createAccount(app, token, {
      name: 'Efectivo',
      type: 'cash',
      initialBalance: 100000,
      startDate: '2026-07-01',
    });
    const category = await createCategory(app, token, { name: 'Reparación', kind: 'expense' });

    const tricky = 'Cañería, "urgente"\nllamar';
    await recordMovement(app, token, {
      type: 'expense',
      amount: 5000,
      date: '2026-07-10',
      accountId: account.body.accountId,
      categoryId: category.body.categoryId,
      note: tricky,
    });
    const toDelete = await recordMovement(app, token, {
      type: 'expense',
      amount: 999,
      date: '2026-07-11',
      accountId: account.body.accountId,
      categoryId: category.body.categoryId,
      note: 'BORRAR',
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/movements/${toDelete.body.movementId}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await exportMovements(app, token);
    const rows = parseCsv(res.text);

    // Only the non-deleted movement remains (header + 1).
    expect(rows).toHaveLength(2);
    // The tricky note round-trips exactly through the RFC-4180 parser, accents intact.
    expect(rows[1][5]).toBe(tricky);
    // Deleted row's note never appears in the raw file.
    expect(res.text).not.toContain('BORRAR');
  });
});
