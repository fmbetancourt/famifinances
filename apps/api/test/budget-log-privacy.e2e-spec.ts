import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setBudget, getReport, deleteBudget, ownerWithExpenseCategory } from './budget-helpers';

/** Polish (T026) · FR-014 / SC-008: no monetary amount (planned or real) appears in logs. */
describe('No budget amount in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes planned amounts to stdout/stderr across set/report/remove', async () => {
    const { owner, expenseCategoryId } = await ownerWithExpenseCategory(app, mail, 'bud-log@example.com');
    const token = owner.accessToken;

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    const plannedAmount = 987654;
    try {
      const created = await setBudget(app, token, {
        period: '2026-07',
        categoryId: expenseCategoryId,
        plannedAmount,
      });
      await getReport(app, token, '2026-07');
      await deleteBudget(app, token, created.body.budgetId as string);
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    expect(chunks.join('')).not.toContain(String(plannedAmount));
  });
});
