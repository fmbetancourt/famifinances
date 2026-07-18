import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { createCategory, aSystemCategoryId } from './category-helpers';

/** US4 · Rename a custom category; kind unchanged; system defaults read-only (FR-005, FR-007). */
describe('Rename category (US4)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function aCustom(prefix: string): Promise<{ token: string; categoryId: string }> {
    const member = await verifiedMemberWithFamily(app, mail, `${prefix}@example.com`);
    const created = await createCategory(app, member.accessToken, { name: 'Original', kind: 'expense' });
    return { token: member.accessToken, categoryId: created.body.categoryId };
  }

  it('renames a custom category (200) and keeps the kind', async () => {
    const { token, categoryId } = await aCustom('cat-rename-ok');

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Renamed', kind: 'expense', scope: 'family' });
  });

  it('rejects renaming a system default (403 read-only)', async () => {
    const { token } = await aCustom('cat-rename-system');
    const systemId = await aSystemCategoryId(app, token);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${systemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('rejects an empty or whitespace-only name (400)', async () => {
    const { token, categoryId } = await aCustom('cat-rename-blank');

    for (const name of ['', '   ']) {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name });
      expect(res.status).toBe(400);
    }
  });

  it('rejects renaming an archived custom category (409 read-only)', async () => {
    const { token, categoryId } = await aCustom('cat-rename-archived');
    await request(app.getHttpServer())
      .post(`/api/v1/categories/${categoryId}/archive`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nope' });
    expect(res.status).toBe(409);
  });
});
