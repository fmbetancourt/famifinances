import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AccountStatusFilter, FinancialAccountSummary } from '@famifinances/contracts';
import { FinancialAccountRepository, UpdateFinancialAccountPatch } from './financial-account.repository';
import { FinancialAccountDocument } from './financial-account.schema';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class FinancialAccountsService {
  private readonly logger = new Logger('FinancialAccounts');

  constructor(private readonly accounts: FinancialAccountRepository) {}

  /**
   * Constitution III · the current balance is DERIVED, never stored as an editable
   * field. In ACC-01 there are no movements, so it equals the initial balance;
   * TXN-01 extends this to `initialBalance + Σ(movements)`.
   */
  deriveBalance(account: { initialBalance: number }): number {
    return account.initialBalance;
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
    return this.toSummary(doc);
  }

  /** US2 · The family's accounts (active by default), scoped from the session (FR-006). */
  async listAccounts(familyId: string, status: AccountStatusFilter): Promise<FinancialAccountSummary[]> {
    const docs = await this.accounts.findByFamily(familyId, status);
    return docs.map((doc) => this.toSummary(doc));
  }

  /** US2/US3 · One account, resolved within the caller's family (404 otherwise). */
  async getAccount(familyId: string, accountId: string): Promise<FinancialAccountSummary> {
    return this.toSummary(await this.requireInFamily(familyId, accountId));
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
    return this.toSummary(updated ?? existing);
  }

  /** US5 · Archive an account (idempotent no-op if already archived). */
  async archive(familyId: string, accountId: string): Promise<FinancialAccountSummary> {
    const existing = await this.requireInFamily(familyId, accountId);
    if (existing.archivedAt !== null) {
      return this.toSummary(existing); // idempotent
    }
    const updated = await this.accounts.setArchived(familyId, accountId, new Date());
    this.logger.log(`account.archived id=${accountId} family=${familyId}`);
    return this.toSummary(updated ?? existing);
  }

  /** US5 · Unarchive an account (idempotent no-op if already active). */
  async unarchive(familyId: string, accountId: string): Promise<FinancialAccountSummary> {
    const existing = await this.requireInFamily(familyId, accountId);
    if (existing.archivedAt === null) {
      return this.toSummary(existing); // idempotent
    }
    const updated = await this.accounts.setArchived(familyId, accountId, null);
    this.logger.log(`account.unarchived id=${accountId} family=${familyId}`);
    return this.toSummary(updated ?? existing);
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

  private toSummary(doc: FinancialAccountDocument): FinancialAccountSummary {
    return {
      accountId: doc.id,
      name: doc.name,
      type: doc.type,
      institution: doc.institution,
      initialBalance: doc.initialBalance,
      balance: this.deriveBalance(doc),
      currency: 'CLP',
      startDate: doc.startDate.toISOString().slice(0, 10),
      archived: doc.archivedAt !== null,
    };
  }
}
