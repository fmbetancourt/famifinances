import { Injectable } from '@nestjs/common';
import { MovementRepository } from './movement.repository';

/**
 * The movement contribution to an account's balance (income +, expense −,
 * excluding deleted). Consumed by ACC-01's `FinancialAccountsService.deriveBalance`
 * so the account balance stays DERIVED (constitution III) — no stored editable balance.
 */
@Injectable()
export class MovementBalanceService {
  constructor(private readonly movements: MovementRepository) {}

  /** Net movement effect for one account of the family (0 when it has no movements). */
  async netForAccount(familyId: string, accountId: string): Promise<number> {
    const nets = await this.movements.netByAccount(familyId);
    return nets.find((n) => n.accountId === accountId)?.net ?? 0;
  }

  /** Net movement effect per account for the whole family, keyed by accountId. */
  async netByFamily(familyId: string): Promise<Record<string, number>> {
    const nets = await this.movements.netByAccount(familyId);
    return Object.fromEntries(nets.map((n) => [n.accountId, n.net]));
  }
}
