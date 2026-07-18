import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';
import { verifiedMemberWithFamily } from './account-helpers';
import { listCategories, CategoryLite } from './category-helpers';

/** US1 · A brand-new family sees usable seeded categories with zero setup (FR-001, FR-008, SC-001). */
describe('List categories (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('returns a non-empty set of system defaults covering both kinds, each with its kind', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'cat-list@example.com');

    const cats = await listCategories(app, member.accessToken);

    expect(cats.length).toBeGreaterThan(0);
    expect(cats.every((c: CategoryLite) => c.scope === 'system')).toBe(true);
    expect(cats.some((c) => c.kind === 'income')).toBe(true);
    expect(cats.some((c) => c.kind === 'expense')).toBe(true);
    for (const c of cats) {
      expect(['income', 'expense']).toContain(c.kind);
      expect(c.archived).toBe(false);
    }
  });

  it('filters by kind', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'cat-list-kind@example.com');

    const income = await listCategories(app, member.accessToken, '?kind=income');
    expect(income.length).toBeGreaterThan(0);
    expect(income.every((c) => c.kind === 'income')).toBe(true);
  });

  it('returns 404 for a member who belongs to no family', async () => {
    const stranger = await registerVerifiedUser(app, mail, 'cat-nofamily@example.com');

    const res = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(404);
  });
});
