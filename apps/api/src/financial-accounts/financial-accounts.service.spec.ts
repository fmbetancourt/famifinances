import { FinancialAccountRepository } from './financial-account.repository';
import { FinancialAccountsService } from './financial-accounts.service';
import { MovementBalanceService } from '../movements/movement-balance.service';

describe('FinancialAccountsService.deriveBalance (ACC-01 + TXN-01, Principle III)', () => {
  // deriveBalance is pure; the repositories are unused for this unit.
  const service = new FinancialAccountsService(
    undefined as unknown as FinancialAccountRepository,
    undefined as unknown as MovementBalanceService,
  );

  it('equals the initial balance when there are no movements (net 0)', () => {
    expect(service.deriveBalance(150000)).toBe(150000);
    expect(service.deriveBalance(150000, 0)).toBe(150000);
  });

  it('adds the net movement effect (income + / expense −)', () => {
    expect(service.deriveBalance(150000, 30000)).toBe(180000); // +30000 income
    expect(service.deriveBalance(150000, -50000)).toBe(100000); // −50000 expense
  });

  it('handles zero and negative initial balances', () => {
    expect(service.deriveBalance(0, 0)).toBe(0);
    expect(service.deriveBalance(-80000, 0)).toBe(-80000); // credit-card debt, no movements
    expect(service.deriveBalance(-80000, 20000)).toBe(-60000);
  });
});
