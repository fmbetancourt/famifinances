import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';
import { verifiedMemberWithFamily } from './account-helpers';
import { createCategory, listCategories } from './category-helpers';

/** US2 · Create a custom family category (FR-003, FR-011, FR-013). */
describe('Create category (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('creates a custom category and lists it under its kind', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'cat-create@example.com');

    const res = await createCategory(app, member.accessToken, { name: 'Feria', kind: 'expense' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Feria', kind: 'expense', scope: 'family', archived: false });
    expect(typeof res.body.categoryId).toBe('string');

    const expense = await listCategories(app, member.accessToken, '?kind=expense');
    expect(expense.some((c) => c.name === 'Feria' && c.scope === 'family')).toBe(true);
  });

  it('rejects invalid input: missing name, invalid kind, whitespace-only name (400)', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'cat-invalid@example.com');

    for (const bad of [
      { kind: 'expense' },
      { name: 'X', kind: 'saving' },
      { name: '   ', kind: 'expense' },
    ]) {
      const res = await createCategory(app, member.accessToken, bad as { name: string; kind: string });
      expect(res.status).toBe(400);
    }
  });

  it('rejects a client-supplied scope or unknown field (400, whitelist)', async () => {
    const member = await verifiedMemberWithFamily(app, mail, 'cat-whitelist@example.com');

    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ name: 'Hack', kind: 'expense', scope: 'system' });
    expect(res.status).toBe(400);
  });

  it('rejects a member who belongs to no family (404)', async () => {
    const stranger = await registerVerifiedUser(app, mail, 'cat-create-nofamily@example.com');

    const res = await createCategory(app, stranger.accessToken, { name: 'Feria', kind: 'expense' });
    expect(res.status).toBe(404);
  });
});
