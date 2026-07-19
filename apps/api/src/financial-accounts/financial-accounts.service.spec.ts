import { FinancialAccountRepository } from './financial-account.repository';
import { FinancialAccountsService } from './financial-accounts.service';
import { MovementBalanceService } from '../movements/movement-balance.service';
import { TransferBalanceService } from '../transfers/transfer-balance.service';

describe('FinancialAccountsService.deriveBalance (ACC-01 + TXN-01/TXN-02, Principle III)', () => {
  // deriveBalance is pure; the repositories/balance services are unused for this unit.
  const service = new FinancialAccountsService(
    undefined as unknown as FinancialAccountRepository,
    undefined as unknown as MovementBalanceService,
    undefined as unknown as TransferBalanceService,
  );

  it('equals the initial balance when there are no movements or transfers (net 0)', () => {
    expect(service.deriveBalance(150000)).toBe(150000);
    expect(service.deriveBalance(150000, 0)).toBe(150000);
  });

  it('adds the combined net movement + transfer effect', () => {
    expect(service.deriveBalance(150000, 30000)).toBe(180000); // +30000 (e.g. income / transfer in)
    expect(service.deriveBalance(150000, -50000)).toBe(100000); // −50000 (e.g. expense / transfer out)
  });

  it('handles zero and negative initial balances', () => {
    expect(service.deriveBalance(0, 0)).toBe(0);
    expect(service.deriveBalance(-80000, 0)).toBe(-80000); // credit-card debt, no movements
    expect(service.deriveBalance(-80000, 20000)).toBe(-60000);
  });
});
