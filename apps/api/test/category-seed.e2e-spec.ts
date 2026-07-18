import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { CategoriesService } from '../src/categories/categories.service';
import { verifiedMemberWithFamily } from './account-helpers';
import { listCategories } from './category-helpers';

/** Polish (T025) · System defaults are seeded (both kinds) and the seeder is idempotent (SC-001, R2). */
describe('Category seeding (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('seeds a non-empty system-default set covering both kinds, and re-seeding does not duplicate', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'cat-seed@example.com');

    const before = (await listCategories(app, member.accessToken)).filter((c) => c.scope === 'system');
    expect(before.length).toBeGreaterThan(0);
    expect(before.some((c) => c.kind === 'income')).toBe(true);
    expect(before.some((c) => c.kind === 'expense')).toBe(true);

    // Re-run the seeder (as would happen on another boot) — the unique index makes it a no-op.
    await app.get(CategoriesService).seedSystemDefaults();

    const after = (await listCategories(app, member.accessToken)).filter((c) => c.scope === 'system');
    expect(after.length).toBe(before.length);
    expect(after.map((c) => c.categoryId).sort()).toEqual(before.map((c) => c.categoryId).sort());
  });
});
