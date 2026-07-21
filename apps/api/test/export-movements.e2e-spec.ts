import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';
import { createCategory } from './category-helpers';
import { recordMovement } from './movement-helpers';
import {
  exportMovements,
  ownerWithData,
  familyWithMember,
  parseCsv,
} from './export-helpers';

const MOVEMENT_HEADER = ['Fecha', 'Tipo', 'Monto', 'Cuenta', 'Categoría', 'Nota', 'Autor', 'Creado'];

/** US1/US2 · Export movements to CSV — full, empty, filtered, and any-member (FR-001/002/003/011). */
describe('Export movements (US1/US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('exports all movements as a CSV with readable columns (US1)', async () => {
    const data = await ownerWithData(app, mail, 'exp-mov@example.com');
    const res = await exportMovements(app, data.owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="movimientos-');
    expect(res.text.charCodeAt(0)).toBe(0xfeff); // BOM

    const rows = parseCsv(res.text);
    expect(rows[0]).toEqual(MOVEMENT_HEADER);
    expect(rows).toHaveLength(3); // header + 2 movements

    const byType = new Map(rows.slice(1).map((r) => [r[1], r]));
    const expense = byType.get('Gasto')!;
    expect(expense).toMatchObject({
      1: 'Gasto',
      2: '12000',
      3: 'Efectivo',
      4: 'Alimentación',
      5: 'Feria',
      6: 'exp-mov@example.com',
    });
    expect(byType.get('Ingreso')![2]).toBe('900000');
  });

  it('returns a header-only file when there are no movements (US1, FR-006/SC-006)', async () => {
    const empty = await verifiedMemberWithFamily(app, mail, 'exp-empty@example.com');
    const res = await exportMovements(app, empty.accessToken);
    expect(res.status).toBe(200);
    const rows = parseCsv(res.text);
    expect(rows).toEqual([MOVEMENT_HEADER]);
  });

  it('applies the HIS-01 filters (US2)', async () => {
    const data = await ownerWithData(app, mail, 'exp-filter@example.com');
    const token = data.owner.accessToken;

    // Only expenses.
    const expenses = parseCsv((await exportMovements(app, token, '?type=expense')).text);
    expect(expenses.slice(1).every((r) => r[1] === 'Gasto')).toBe(true);
    expect(expenses).toHaveLength(2);

    // Date range that excludes the income (2026-07-05) but keeps the expense (2026-07-10).
    const ranged = parseCsv((await exportMovements(app, token, '?from=2026-07-08&to=2026-07-31')).text);
    expect(ranged).toHaveLength(2);
    expect(ranged[1][1]).toBe('Gasto');

    // A filter matching nothing → header-only.
    const none = parseCsv((await exportMovements(app, token, '?from=2020-01-01&to=2020-01-31')).text);
    expect(none).toHaveLength(1);
  });

  it('lets a non-owner member export (FR-011)', async () => {
    const { owner, member } = await familyWithMember(app, mail, 'exp-member');
    const account = await createAccount(app, owner.accessToken, {
      name: 'Cuenta',
      type: 'bank',
      initialBalance: 100000,
      startDate: '2026-07-01',
    });
    const category = await createCategory(app, owner.accessToken, { name: 'Transporte', kind: 'expense' });
    await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 3000,
      date: '2026-07-12',
      accountId: account.body.accountId,
      categoryId: category.body.categoryId,
    });

    const res = await exportMovements(app, member.accessToken);
    expect(res.status).toBe(200);
    const rows = parseCsv(res.text);
    expect(rows).toHaveLength(2); // header + the member's movement
    expect(rows[1][6]).toBe('exp-member-member@example.com'); // author email
  });
});
