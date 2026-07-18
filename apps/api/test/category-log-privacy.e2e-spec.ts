import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { createCategory } from './category-helpers';

/** Polish (T026) · FR-015 / SC-008: a category name never appears in logs (it can hint at spending). */
describe('No category names in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes a category name to stdout/stderr across create/rename/list/archive', async () => {
    const http = app.getHttpServer();
    const member = await verifiedMemberWithFamily(app, mail, 'cat-log@example.com');

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    const name = 'CategoriaSecretaXYZ';
    const renamed = 'OtraSecretaABC';
    try {
      const created = await createCategory(app, member.accessToken, { name, kind: 'expense' });
      const id = created.body.categoryId as string;
      await request(http)
        .patch(`/api/v1/categories/${id}`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ name: renamed });
      await request(http).get('/api/v1/categories?status=all').set('Authorization', `Bearer ${member.accessToken}`);
      await request(http)
        .post(`/api/v1/categories/${id}/archive`)
        .set('Authorization', `Bearer ${member.accessToken}`);
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const logged = chunks.join('');
    expect(logged).not.toContain(name);
    expect(logged).not.toContain(renamed);
  });
});
