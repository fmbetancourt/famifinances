import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { createCategory, listCategories, aSystemCategoryId } from './category-helpers';

/** US5 · Archive/unarchive a custom category; read-only when archived; defaults immutable (FR-006, FR-007, FR-012, SC-007). */
describe('Archive category (US5)', () => {
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
    const created = await createCategory(app, member.accessToken, { name: 'Temporal', kind: 'expense' });
    return { token: member.accessToken, categoryId: created.body.categoryId };
  }

  it('archives (excluded from active, retrievable via status) and unarchives', async () => {
    const http = app.getHttpServer();
    const { token, categoryId } = await aCustom('cat-arch');

    const archived = await request(http)
      .post(`/api/v1/categories/${categoryId}/archive`)
      .set('Authorization', `Bearer ${token}`);
    expect(archived.status).toBe(200);
    expect(archived.body.archived).toBe(true);

    // Excluded from the default (active) list.
    const active = await listCategories(app, token);
    expect(active.some((c) => c.categoryId === categoryId)).toBe(false);

    // Retrievable via status=archived, which returns ONLY the family's archived custom (no system defaults).
    const archivedList = await listCategories(app, token, '?status=archived');
    expect(archivedList.map((c) => c.categoryId)).toEqual([categoryId]);
    expect(archivedList.every((c) => c.scope === 'family')).toBe(true);

    // Present in status=all too.
    const all = await listCategories(app, token, '?status=all');
    expect(all.some((c) => c.categoryId === categoryId)).toBe(true);

    // Unarchive restores it to the active list.
    const unarchived = await request(http)
      .post(`/api/v1/categories/${categoryId}/unarchive`)
      .set('Authorization', `Bearer ${token}`);
    expect(unarchived.status).toBe(200);
    expect(unarchived.body.archived).toBe(false);
    expect((await listCategories(app, token)).some((c) => c.categoryId === categoryId)).toBe(true);
  });

  it('is idempotent: re-archiving an already-archived category is a 200 no-op', async () => {
    const http = app.getHttpServer();
    const { token, categoryId } = await aCustom('cat-arch-idem');

    await request(http).post(`/api/v1/categories/${categoryId}/archive`).set('Authorization', `Bearer ${token}`);
    const again = await request(http)
      .post(`/api/v1/categories/${categoryId}/archive`)
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(200);
    expect(again.body.archived).toBe(true);
  });

  it('rejects archiving a system default (403)', async () => {
    const { token } = await aCustom('cat-arch-system');
    const systemId = await aSystemCategoryId(app, token);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/categories/${systemId}/archive`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('has no delete route (categories are archived, never destroyed)', async () => {
    const { token, categoryId } = await aCustom('cat-arch-nodelete');

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
