import { Injectable } from '@nestjs/common';
import { TransferRepository } from './transfer.repository';

/**
 * The transfer contribution to an account's balance (−amount origin, +amount
 * destination, excluding deleted). Consumed by ACC-01's `FinancialAccountsService`
 * alongside the movement contribution, so the account balance stays DERIVED
 * (constitution III). Transfers never affect income/expense totals.
 */
@Injectable()
export class TransferBalanceService {
  constructor(private readonly transfers: TransferRepository) {}

  /** Net transfer effect for one account of the family (0 when it has no transfers). */
  async netForAccount(familyId: string, accountId: string): Promise<number> {
    const nets = await this.transfers.netByAccount(familyId);
    return nets.find((n) => n.accountId === accountId)?.net ?? 0;
  }

  /** Net transfer effect per account for the whole family, keyed by accountId. */
  async netByFamily(familyId: string): Promise<Record<string, number>> {
    const nets = await this.transfers.netByAccount(familyId);
    return Object.fromEntries(nets.map((n) => [n.accountId, n.net]));
  }
}
