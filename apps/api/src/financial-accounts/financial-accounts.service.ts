import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AccountStatusFilter, FinancialAccountSummary } from '@famifinances/contracts';
import { MovementBalanceService } from '../movements/movement-balance.service';
import { TransferBalanceService } from '../transfers/transfer-balance.service';
import { FinancialAccountRepository, UpdateFinancialAccountPatch } from './financial-account.repository';
import { FinancialAccountDocument } from './financial-account.schema';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class FinancialAccountsService {
  private readonly logger = new Logger('FinancialAccounts');

  constructor(
    private readonly accounts: FinancialAccountRepository,
    // TXN-01/TXN-02 · movements AND transfers contribute to the derived balance.
    // forwardRef breaks the accounts⇄movements and accounts⇄transfers cycles
    // (accounts need the sums; movements/transfers validate accounts back).
    @Inject(forwardRef(() => MovementBalanceService))
    private readonly movementBalances: MovementBalanceService,
    @Inject(forwardRef(() => TransferBalanceService))
    private readonly transferBalances: TransferBalanceService,
  ) {}

  /**
   * Constitution III · the current balance is DERIVED, never stored as an editable
   * field: `initialBalance + net` where `net` sums movements (income +, expense −)
   * and transfers (−out, +in), excluding deleted. `net` is 0 for an account with no
   * movements or transfers, so the balance equals the initial balance until they exist.
   */
  deriveBalance(initialBalance: number, net = 0): number {
    return initialBalance + net;
  }

  /** Net contribution (movements + transfers) for one account of the family. */
  private async netForAccount(familyId: string, accountId: string): Promise<number> {
    const [movementNet, transferNet] = await Promise.all([
      this.movementBalances.netForAccount(familyId, accountId),
      this.transferBalances.netForAccount(familyId, accountId),
    ]);
    return movementNet + transferNet;
  }

  /** US1 · Create a family-scoped account; the caller becomes its author (FR-001, FR-014). */
  async createAccount(
    familyId: string,
    createdBy: string,
    dto: CreateAccountDto,
  ): Promise<FinancialAccountSummary> {
    const doc = await this.accounts.create({
      familyId,
      createdBy,
      name: dto.name,
      type: dto.type,
      institution: dto.institution ?? null,
      initialBalance: dto.initialBalance,
      startDate: new Date(dto.startDate),
    });
    this.logger.log(`account.created id=${doc.id} family=${familyId}`);
    return this.toSummary(doc, 0); // a new account has no movements yet
  }

  /** US2 · The family's accounts (active by default), scoped from the session (FR-006). */
  async listAccounts(familyId: string, status: AccountStatusFilter): Promise<FinancialAccountSummary[]> {
    const docs = await this.accounts.findByFamily(familyId, status);
    // One aggregation each (movements + transfers) for the whole family.
    const [movementNets, transferNets] = await Promise.all([
      this.movementBalances.netByFamily(familyId),
      this.transferBalances.netByFamily(familyId),
    ]);
    return docs.map((doc) =>
      this.toSummary(doc, (movementNets[doc.id] ?? 0) + (transferNets[doc.id] ?? 0)),
    );
  }

  /** US2/US3 · One account, resolved within the caller's family (404 otherwise). */
  async getAccount(familyId: string, accountId: string): Promise<FinancialAccountSummary> {
    const doc = await this.requireInFamily(familyId, accountId);
    return this.toSummary(doc, await this.netForAccount(familyId, accountId));
  }

  /**
   * US4 · Edit an account. Rejects while archived (read-only, 409). Changing the
   * initial balance recomputes the derived balance (FR-008, FR-009a).
   */
  async updateAccount(
    familyId: string,
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<FinancialAccountSummary> {
    const existing = await this.requireInFamily(familyId, accountId);
    const patch: UpdateFinancialAccountPatch = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.institution !== undefined) patch.institution = dto.institution;
    if (dto.initialBalance !== undefined) patch.initialBalance = dto.initialBalance;
    if (dto.startDate !== undefined) patch.startDate = new Date(dto.startDate);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Provide at least one field to update.');
    }
    if (existing.archivedAt !== null) {
      throw new ConflictException('Account is archived; unarchive it before editing.');
    }
    const updated = await this.accounts.updateInFamily(familyId, accountId, patch);
    return this.toSummary(updated ?? existing, await this.netForAccount(familyId, accountId));
  }

  /** US5 · Archive an account (idempotent no-op if already archived). */
  async archive(familyId: string, accountId: string): Promise<FinancialAccountSummary> {
    const existing = await this.requireInFamily(familyId, accountId);
    const net = await this.netForAccount(familyId, accountId);
    if (existing.archivedAt !== null) {
      return this.toSummary(existing, net); // idempotent
    }
    const updated = await this.accounts.setArchived(familyId, accountId, new Date());
    this.logger.log(`account.archived id=${accountId} family=${familyId}`);
    return this.toSummary(updated ?? existing, net);
  }

  /** US5 · Unarchive an account (idempotent no-op if already active). */
  async unarchive(familyId: string, accountId: string): Promise<FinancialAccountSummary> {
    const existing = await this.requireInFamily(familyId, accountId);
    const net = await this.netForAccount(familyId, accountId);
    if (existing.archivedAt === null) {
      return this.toSummary(existing, net); // idempotent
    }
    const updated = await this.accounts.setArchived(familyId, accountId, null);
    this.logger.log(`account.unarchived id=${accountId} family=${familyId}`);
    return this.toSummary(updated ?? existing, net);
  }

  private async requireInFamily(
    familyId: string,
    accountId: string,
  ): Promise<FinancialAccountDocument> {
    const account = await this.accounts.findInFamily(familyId, accountId);
    if (!account) {
      throw new NotFoundException('Account not found in this family.');
    }
    return account;
  }

  private toSummary(doc: FinancialAccountDocument, net: number): FinancialAccountSummary {
    return {
      accountId: doc.id,
      name: doc.name,
      type: doc.type,
      institution: doc.institution,
      initialBalance: doc.initialBalance,
      balance: this.deriveBalance(doc.initialBalance, net),
      currency: 'CLP',
      startDate: doc.startDate.toISOString().slice(0, 10),
      archived: doc.archivedAt !== null,
    };
  }
}
