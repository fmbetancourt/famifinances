import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { recordMovement } from './movement-helpers';
import { verifiedMemberWithFamily } from './account-helpers';
import {
  getCaptureDefaults,
  ownerWithAccountAndCategories,
  archiveAccount,
  archiveCategory,
} from './capture-helpers';

const today = new Date().toISOString().slice(0, 10);

/** US1 · Capture defaults derived on read (FR-001/002/003/010). */
describe('Capture defaults (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('returns an all-null set with today when the member has no movements', async () => {
    const owner = await verifiedMemberWithFamily(app, mail, 'defaults-empty@example.com');
    const res = await getCaptureDefaults(app, owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: null, accountId: null, categoryId: null, date: today });
  });

  it('reflects the last movement and auto-updates on the next one', async () => {
    const { owner, accountId, expenseCategoryId, incomeCategoryId } =
      await ownerWithAccountAndCategories(app, mail, 'defaults-last@example.com');

    await recordMovement(app, owner.accessToken, {
      type: 'expense',
      amount: 12000,
      date: '2026-07-10',
      accountId,
      categoryId: expenseCategoryId,
    });

    const first = await getCaptureDefaults(app, owner.accessToken);
    expect(first.body).toEqual({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      date: today,
    });

    await recordMovement(app, owner.accessToken, {
      type: 'income',
      amount: 900000,
      date: '2026-07-11',
      accountId,
      categoryId: incomeCategoryId,
    });

    const second = await getCaptureDefaults(app, owner.accessToken);
    expect(second.body).toEqual({
      type: 'income',
      accountId,
      categoryId: incomeCategoryId,
      date: today,
    });
  });

  it('nulls out an archived account/category reference (FR-010)', async () => {
    const { owner, accountId, expenseCategoryId } = await ownerWithAccountAndCategories(
      app,
      mail,
      'defaults-broken@example.com',
    );
    await recordMovement(app, owner.accessToken, {
      type: 'expense',
      amount: 5000,
      date: '2026-07-12',
      accountId,
      categoryId: expenseCategoryId,
    });

    await archiveCategory(app, owner.accessToken, expenseCategoryId);
    const afterCat = await getCaptureDefaults(app, owner.accessToken);
    expect(afterCat.body).toEqual({ type: 'expense', accountId, categoryId: null, date: today });

    await archiveAccount(app, owner.accessToken, accountId);
    const afterAcct = await getCaptureDefaults(app, owner.accessToken);
    expect(afterAcct.body).toEqual({ type: 'expense', accountId: null, categoryId: null, date: today });
  });

  it('scopes defaults per member (another family sees its own)', async () => {
    const other = await verifiedMemberWithFamily(app, mail, 'defaults-other@example.com');
    const res = await getCaptureDefaults(app, other.accessToken);
    expect(res.body).toEqual({ type: null, accountId: null, categoryId: null, date: today });
  });
});
