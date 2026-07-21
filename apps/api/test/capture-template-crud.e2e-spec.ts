import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { createAccount } from './account-helpers';
import { createCategory } from './category-helpers';
import {
  createTemplate,
  listTemplates,
  getTemplate,
  ownerWithAccountAndCategories,
  familyWithMember,
} from './capture-helpers';

/** US2 · Create → list → get; any member can create (FR-004/FR-013). */
describe('Capture template CRUD (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('creates a template and returns it via list and get', async () => {
    const { owner, accountId, expenseCategoryId } = await ownerWithAccountAndCategories(
      app,
      mail,
      'tpl-crud@example.com',
    );

    const created = await createTemplate(app, owner.accessToken, {
      name: 'Feria semanal',
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amount: 25000,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Feria semanal',
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amount: 25000,
      note: null,
      accountAvailable: true,
      categoryAvailable: true,
    });
    const templateId = created.body.templateId as string;

    const list = await listTemplates(app, owner.accessToken);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].templateId).toBe(templateId);

    const one = await getTemplate(app, owner.accessToken, templateId);
    expect(one.status).toBe(200);
    expect(one.body.templateId).toBe(templateId);
  });

  it('lets a non-owner member create a template (FR-013)', async () => {
    const { owner, member } = await familyWithMember(app, mail, 'tpl-member');
    // The owner seeds a shared account + category the member can reference.
    const account = await createAccount(app, owner.accessToken, {
      name: 'Cuenta',
      type: 'bank',
      initialBalance: 100000,
      startDate: '2026-07-01',
    });
    const category = await createCategory(app, owner.accessToken, {
      name: 'Transporte',
      kind: 'expense',
    });

    const created = await createTemplate(app, member.accessToken, {
      name: 'Bencina',
      type: 'expense',
      accountId: account.body.accountId,
      categoryId: category.body.categoryId,
    });
    expect(created.status).toBe(201);

    // Shared: the owner sees the member's template.
    const list = await listTemplates(app, owner.accessToken);
    expect(list.body.map((t: { name: string }) => t.name)).toContain('Bencina');
  });
});
