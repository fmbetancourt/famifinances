import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { createCategory, listCategories } from './category-helpers';

/**
 * US3 · Cross-family isolation for custom categories (Principle I, FR-009, SC-003).
 * Custom categories are scoped to the owning family; system defaults are shared.
 */
describe('Category isolation (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it("never exposes or mutates another family's custom category, but shares system defaults", async () => {
    const http = app.getHttpServer();
    const familyA = await verifiedMemberWithFamily(app, mail, 'cat-iso-a@example.com', 'Family A');
    const familyB = await verifiedMemberWithFamily(app, mail, 'cat-iso-b@example.com', 'Family B');

    const created = await createCategory(app, familyA.accessToken, { name: 'A Secret', kind: 'expense' });
    const aId = created.body.categoryId as string;

    // B never sees A's custom category.
    const bList = await listCategories(app, familyB.accessToken, '?status=all');
    expect(bList.some((c) => c.categoryId === aId)).toBe(false);

    // B cannot read, rename, or archive A's custom category → 404.
    const read = await request(http)
      .get(`/api/v1/categories/${aId}`)
      .set('Authorization', `Bearer ${familyB.accessToken}`);
    expect(read.status).toBe(404);

    const rename = await request(http)
      .patch(`/api/v1/categories/${aId}`)
      .set('Authorization', `Bearer ${familyB.accessToken}`)
      .send({ name: 'Hijacked' });
    expect(rename.status).toBe(404);

    const archive = await request(http)
      .post(`/api/v1/categories/${aId}/archive`)
      .set('Authorization', `Bearer ${familyB.accessToken}`);
    expect(archive.status).toBe(404);

    // Both families still see the shared system defaults.
    const aSystem = (await listCategories(app, familyA.accessToken)).filter((c) => c.scope === 'system');
    const bSystem = (await listCategories(app, familyB.accessToken)).filter((c) => c.scope === 'system');
    expect(aSystem.length).toBeGreaterThan(0);
    expect(bSystem.map((c) => c.categoryId).sort()).toEqual(aSystem.map((c) => c.categoryId).sort());

    // A still sees its own custom category intact.
    const aRead = await request(http)
      .get(`/api/v1/categories/${aId}`)
      .set('Authorization', `Bearer ${familyA.accessToken}`);
    expect(aRead.status).toBe(200);
    expect(aRead.body).toMatchObject({ name: 'A Secret', scope: 'family' });
  });

  it('treats a malformed or unknown category id as not found (404)', async () => {
    const http = app.getHttpServer();
    const member = await verifiedMemberWithFamily(app, mail, 'cat-iso-unknown@example.com');

    expect(
      (await request(http).get('/api/v1/categories/not-an-id').set('Authorization', `Bearer ${member.accessToken}`))
        .status,
    ).toBe(404);
    expect(
      (
        await request(http)
          .get('/api/v1/categories/5f8d0d55b54764421b7156c1')
          .set('Authorization', `Bearer ${member.accessToken}`)
      ).status,
    ).toBe(404);
  });
});
