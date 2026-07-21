import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  archiveAccount,
  ownerWithAccountAndCategories,
} from './capture-helpers';

/** US3 · Curate templates: edit/delete, duplicate rename, broken-reference degradation. */
describe('Capture template management (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;
  let ctx: Awaited<ReturnType<typeof ownerWithAccountAndCategories>>;
  let token: string;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
    ctx = await ownerWithAccountAndCategories(app, mail, 'tpl-manage@example.com');
    token = ctx.owner.accessToken;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function makeTemplate(name: string): Promise<string> {
    const res = await createTemplate(app, token, {
      name,
      type: 'expense',
      accountId: ctx.accountId,
      categoryId: ctx.expenseCategoryId,
    });
    return res.body.templateId as string;
  }

  it('renames a template and reflects the change', async () => {
    const id = await makeTemplate('Feria semanal');
    const res = await updateTemplate(app, token, id, { name: 'Feria quincenal' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Feria quincenal');

    const one = await getTemplate(app, token, id);
    expect(one.body.name).toBe('Feria quincenal');
  });

  it('deletes a template (204) and it disappears from the list', async () => {
    const id = await makeTemplate('Bencina');
    const del = await deleteTemplate(app, token, id);
    expect(del.status).toBe(204);

    const list = await listTemplates(app, token);
    expect(list.body.map((t: { templateId: string }) => t.templateId)).not.toContain(id);

    // Deleting again is a 404 (already gone).
    expect((await deleteTemplate(app, token, id)).status).toBe(404);
  });

  it('rejects a rename colliding with an existing template (409)', async () => {
    await makeTemplate('Arriendo');
    const other = await makeTemplate('Luz');
    const res = await updateTemplate(app, token, other, { name: 'Arriendo' });
    expect(res.status).toBe(409);
  });

  it('flags accountAvailable=false when the referenced account is archived (FR-010)', async () => {
    const setup = await ownerWithAccountAndCategories(app, mail, 'tpl-degrade@example.com');
    const created = await createTemplate(app, setup.owner.accessToken, {
      name: 'Compra',
      type: 'expense',
      accountId: setup.accountId,
      categoryId: setup.expenseCategoryId,
    });
    expect(created.body.accountAvailable).toBe(true);

    await archiveAccount(app, setup.owner.accessToken, setup.accountId);

    const list = await listTemplates(app, setup.owner.accessToken);
    expect(list.status).toBe(200);
    expect(list.body[0]).toMatchObject({ accountAvailable: false, categoryAvailable: true });
  });
});
