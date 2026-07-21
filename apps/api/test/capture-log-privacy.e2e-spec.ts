import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import {
  createTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  ownerWithAccountAndCategories,
} from './capture-helpers';

/** Polish · FR-011: no suggested amount or note appears in logs across the template ops. */
describe('No template amount/note in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes the amount or note to stdout/stderr across create/list/update/delete', async () => {
    const { owner, accountId, expenseCategoryId } = await ownerWithAccountAndCategories(
      app,
      mail,
      'tpl-log@example.com',
    );
    const token = owner.accessToken;

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    const amount = 876543;
    const note = 'supersecretnote';
    try {
      const created = await createTemplate(app, token, {
        name: 'Privada',
        type: 'expense',
        accountId,
        categoryId: expenseCategoryId,
        amount,
        note,
      });
      const id = created.body.templateId as string;
      await listTemplates(app, token);
      await updateTemplate(app, token, id, { amount: amount + 1, note: `${note}-edit` });
      await deleteTemplate(app, token, id);
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const output = chunks.join('');
    expect(output).not.toContain(String(amount));
    expect(output).not.toContain(note);
  });
});
