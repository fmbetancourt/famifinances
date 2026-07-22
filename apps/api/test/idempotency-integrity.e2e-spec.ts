import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { createAccount } from './account-helpers';
import { createCategory } from './category-helpers';
import { postMovement, countMovements, ownerWithData, familyWithMember } from './idempotency-helpers';

/** US3 · Key integrity & scope (FR-003/005/008, SC-003/004). */
describe('Idempotency key integrity & scope (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  function body(ctx: { accountId: string; categoryId: string }, amount: number): Record<string, unknown> {
    return { type: 'expense', amount, date: '2026-07-10', accountId: ctx.accountId, categoryId: ctx.categoryId };
  }

  it('rejects the same key reused with a different payload (409, FR-008)', async () => {
    const ctx = await ownerWithData(app, mail, 'idem-mismatch@example.com');
    const token = ctx.owner.accessToken;

    expect((await postMovement(app, token, body(ctx, 1000), 'k-x')).status).toBe(201);
    const mismatch = await postMovement(app, token, body(ctx, 2000), 'k-x'); // same key, different amount
    expect(mismatch.status).toBe(409);
    expect(await countMovements(app, token)).toBe(1);
  });

  it('isolates the same key value across members of the same family and across families (FR-003)', async () => {
    // Same family, two members: the owner seeds a shared account + category the member can use.
    const { owner, member } = await familyWithMember(app, mail, 'idem-iso');
    const account = await createAccount(app, owner.accessToken, {
      name: 'Cuenta', type: 'bank', initialBalance: 100000, startDate: '2026-07-01',
    });
    const category = await createCategory(app, owner.accessToken, { name: 'Transporte', kind: 'expense' });
    const shared = { type: 'expense', amount: 3000, date: '2026-07-12', accountId: account.body.accountId, categoryId: category.body.categoryId };

    const ownerRes = await postMovement(app, owner.accessToken, shared, 'shared-key');
    const memberRes = await postMovement(app, member.accessToken, shared, 'shared-key');
    expect(ownerRes.status).toBe(201);
    expect(memberRes.status).toBe(201);
    expect(ownerRes.body.movementId).not.toBe(memberRes.body.movementId); // independent per member

    // A second family reusing the same key value creates its own movement.
    const other = await ownerWithData(app, mail, 'idem-iso-f2@example.com');
    const otherRes = await postMovement(app, other.owner.accessToken, body(other, 5000), 'shared-key');
    expect(otherRes.status).toBe(201);
  });
});
