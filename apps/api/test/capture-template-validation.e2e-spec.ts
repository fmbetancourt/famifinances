import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { createTemplate, ownerWithAccountAndCategories } from './capture-helpers';

/** US2 · Template validation: kind≠type, bad refs, duplicate/blank name, amount (FR-007/009). */
describe('Capture template validation (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;
  let ctx: Awaited<ReturnType<typeof ownerWithAccountAndCategories>>;
  let token: string;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
    ctx = await ownerWithAccountAndCategories(app, mail, 'tpl-valid@example.com');
    token = ctx.owner.accessToken;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('rejects a kind≠type template (expense type + income category) with 400', async () => {
    const res = await createTemplate(app, token, {
      name: 'Mal tipo',
      type: 'expense',
      accountId: ctx.accountId,
      categoryId: ctx.incomeCategoryId,
    });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown account with 400', async () => {
    const res = await createTemplate(app, token, {
      name: 'Sin cuenta',
      type: 'expense',
      accountId: '64b7f0000000000000000000',
      categoryId: ctx.expenseCategoryId,
    });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown category with 400', async () => {
    const res = await createTemplate(app, token, {
      name: 'Sin categoria',
      type: 'expense',
      accountId: ctx.accountId,
      categoryId: '64b7f0000000000000000000',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a whitespace-only name with 400 (FR-009)', async () => {
    const res = await createTemplate(app, token, {
      name: '   ',
      type: 'expense',
      accountId: ctx.accountId,
      categoryId: ctx.expenseCategoryId,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive amount with 400', async () => {
    const res = await createTemplate(app, token, {
      name: 'Monto malo',
      type: 'expense',
      accountId: ctx.accountId,
      categoryId: ctx.expenseCategoryId,
      amount: 0,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate name (case-insensitive) with 409', async () => {
    const first = await createTemplate(app, token, {
      name: 'Feria',
      type: 'expense',
      accountId: ctx.accountId,
      categoryId: ctx.expenseCategoryId,
    });
    expect(first.status).toBe(201);

    const dup = await createTemplate(app, token, {
      name: 'feria',
      type: 'expense',
      accountId: ctx.accountId,
      categoryId: ctx.expenseCategoryId,
    });
    expect(dup.status).toBe(409);
  });
});
