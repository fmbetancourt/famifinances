import { Model } from 'mongoose';
import { MovementRepository } from '../movements/movement.repository';
import { MovementDocument } from '../movements/movement.schema';
import { TransferRepository } from '../transfers/transfer.repository';
import { TransferDocument } from '../transfers/transfer.schema';
import { BudgetAllocationRepository } from '../budgets/budget-allocation.repository';
import { BudgetAllocationDocument } from '../budgets/budget-allocation.schema';
import { CategoryRepository } from '../categories/category.repository';
import { CategoryDocument } from '../categories/category.schema';
import { FinancialAccountRepository } from '../financial-accounts/financial-account.repository';
import { FinancialAccountDocument } from '../financial-accounts/financial-account.schema';

/**
 * QLT-01 · the family-scoped repositories reject a malformed entity id BEFORE touching the
 * model — a Principle-I guard (a bad/foreign id can never widen access). These early-return
 * branches are cheap to prove: the stub model is never reached on the guard path.
 */
/** A never-touched stub model — the guard path returns before using it. */
function noModel<T>(): Model<T> {
  return undefined as unknown as Model<T>;
}
const BAD = 'not-a-valid-object-id';
const FAM = 'family-1';

describe('Repository malformed-id guards (QLT-01, Principle I)', () => {
  it('MovementRepository returns null for a malformed id', async () => {
    const repo = new MovementRepository(noModel<MovementDocument>());
    expect(await repo.findInFamily(FAM, BAD)).toBeNull();
    expect(await repo.findAnyInFamily(FAM, BAD)).toBeNull();
    expect(await repo.update(FAM, BAD, { amount: 1 })).toBeNull();
  });

  it('TransferRepository returns null for a malformed id', async () => {
    const repo = new TransferRepository(noModel<TransferDocument>());
    expect(await repo.findInFamily(FAM, BAD)).toBeNull();
    expect(await repo.findAnyInFamily(FAM, BAD)).toBeNull();
    expect(await repo.update(FAM, BAD, { amount: 1 })).toBeNull();
  });

  it('BudgetAllocationRepository returns null/false for a malformed id', async () => {
    const repo = new BudgetAllocationRepository(noModel<BudgetAllocationDocument>());
    expect(await repo.findInFamily(FAM, BAD)).toBeNull();
    expect(await repo.deleteInFamily(FAM, BAD)).toBe(false);
  });

  it('CategoryRepository returns null for a malformed id', async () => {
    const repo = new CategoryRepository(noModel<CategoryDocument>());
    expect(await repo.findVisible(FAM, BAD)).toBeNull();
    expect(await repo.renameCustom(FAM, BAD, 'x')).toBeNull();
    expect(await repo.setArchived(FAM, BAD, null)).toBeNull();
  });

  it('FinancialAccountRepository returns null for a malformed id', async () => {
    const repo = new FinancialAccountRepository(noModel<FinancialAccountDocument>());
    expect(await repo.findInFamily(FAM, BAD)).toBeNull();
    expect(await repo.updateInFamily(FAM, BAD, { name: 'x' })).toBeNull();
    expect(await repo.setArchived(FAM, BAD, null)).toBeNull();
  });
});
