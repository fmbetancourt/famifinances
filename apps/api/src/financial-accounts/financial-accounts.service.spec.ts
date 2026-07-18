import { FinancialAccountRepository } from './financial-account.repository';
import { FinancialAccountsService } from './financial-accounts.service';

describe('FinancialAccountsService.deriveBalance (ACC-01, Principle III)', () => {
  // deriveBalance is pure; the repository is unused for this unit.
  const service = new FinancialAccountsService(undefined as unknown as FinancialAccountRepository);

  it('equals the initial balance when there are no movements', () => {
    expect(service.deriveBalance({ initialBalance: 150000 })).toBe(150000);
  });

  it('handles a zero initial balance', () => {
    expect(service.deriveBalance({ initialBalance: 0 })).toBe(0);
  });

  it('handles a negative initial balance (credit-card debt)', () => {
    expect(service.deriveBalance({ initialBalance: -80000 })).toBe(-80000);
  });
});
