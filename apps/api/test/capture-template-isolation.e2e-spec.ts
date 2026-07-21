import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import {
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  ownerWithAccountAndCategories,
} from './capture-helpers';

/** US2 · Cross-family isolation — a foreign template id is a 404 (Principle I, FR-008). */
describe('Capture template isolation (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never exposes or mutates another family template', async () => {
    const f1 = await ownerWithAccountAndCategories(app, mail, 'iso-f1@example.com');
    const f2 = await ownerWithAccountAndCategories(app, mail, 'iso-f2@example.com');

    const created = await createTemplate(app, f1.owner.accessToken, {
      name: 'Feria F1',
      type: 'expense',
      accountId: f1.accountId,
      categoryId: f1.expenseCategoryId,
    });
    const templateId = created.body.templateId as string;

    // F2 cannot read, edit, or delete F1's template.
    expect((await getTemplate(app, f2.owner.accessToken, templateId)).status).toBe(404);
    expect(
      (await updateTemplate(app, f2.owner.accessToken, templateId, { name: 'Hack' })).status,
    ).toBe(404);
    expect((await deleteTemplate(app, f2.owner.accessToken, templateId)).status).toBe(404);

    // F2's list stays empty; F1 still has its template.
    expect((await listTemplates(app, f2.owner.accessToken)).body).toEqual([]);
    expect((await listTemplates(app, f1.owner.accessToken)).body).toHaveLength(1);
  });
});
