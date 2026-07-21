import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { TransferSummary } from '@famifinances/contracts';
import { FinancialAccountRepository } from '../financial-accounts/financial-account.repository';
import { IdempotencyService, IdempotencyRunResult } from '../idempotency/idempotency.service';
import { fingerprint } from '../idempotency/fingerprint';
import { TransferRepository, UpdateTransferPatch } from './transfer.repository';
import { TransferEventRepository } from './transfer-event.repository';
import { TransferDocument } from './transfer.schema';
import { TransferSnapshot } from './transfer-event.schema';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';
import { ListTransfersQuery } from './dto/list-transfers.query';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger('Transfers');

  constructor(
    private readonly transfers: TransferRepository,
    private readonly events: TransferEventRepository,
    private readonly accounts: FinancialAccountRepository,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * US1 · Record a transfer between two active family accounts (FR-001..FR-006). OFF-01:
   * an optional `idempotencyKey` makes the create retry-safe — a replay returns the same
   * transfer without moving balances twice.
   */
  async createTransfer(
    familyId: string,
    createdBy: string,
    dto: CreateTransferDto,
    idempotencyKey?: string,
  ): Promise<IdempotencyRunResult<TransferSummary>> {
    return this.idempotency.run<TransferSummary>({
      key: idempotencyKey,
      familyId,
      ownerId: createdBy,
      operation: 'transfer.create',
      fingerprint: fingerprint({
        amount: dto.amount,
        date: dto.date,
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        note: dto.note ?? null,
      }),
      create: async () => {
        const summary = await this.persistTransfer(familyId, createdBy, dto);
        return { id: summary.transferId, result: summary };
      },
      reload: (id) => this.getTransfer(familyId, id),
    });
  }

  /** The actual transfer create (validations + persistence + audit). */
  private async persistTransfer(
    familyId: string,
    createdBy: string,
    dto: CreateTransferDto,
  ): Promise<TransferSummary> {
    await this.validateAccounts(familyId, dto.fromAccountId, dto.toAccountId);
    const doc = await this.transfers.create({
      familyId,
      createdBy,
      amount: dto.amount,
      date: new Date(dto.date),
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      note: dto.note ?? null,
    });
    await this.appendEvent(doc, createdBy, 'created');
    this.logger.log(`transfer.created id=${doc.id} family=${familyId}`);
    return this.toSummary(doc);
  }

  /** US2 · The family's non-deleted transfers, newest first (FR-008). */
  async listTransfers(familyId: string, query: ListTransfersQuery): Promise<TransferSummary[]> {
    const docs = await this.transfers.listByFamily(familyId, { account: query.account });
    return docs.map((doc) => this.toSummary(doc));
  }

  /** US2/US3 · One active transfer of the family (404 otherwise). */
  async getTransfer(familyId: string, transferId: string): Promise<TransferSummary> {
    return this.toSummary(await this.requireInFamily(familyId, transferId));
  }

  /** US4 · Edit a transfer; accounts re-validated; balances recompute (FR-009). */
  async updateTransfer(
    familyId: string,
    actorId: string,
    transferId: string,
    dto: UpdateTransferDto,
  ): Promise<TransferSummary> {
    const existing = await this.requireInFamily(familyId, transferId);
    const patch = this.buildPatch(dto);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Provide at least one field to update.');
    }
    const from = dto.fromAccountId ?? existing.fromAccountId.toString();
    const to = dto.toAccountId ?? existing.toAccountId.toString();
    await this.validateAccounts(familyId, from, to);

    const updated = await this.transfers.update(familyId, transferId, patch);
    const doc = updated ?? existing;
    await this.appendEvent(doc, actorId, 'updated');
    this.logger.log(`transfer.updated id=${transferId} family=${familyId}`);
    return this.toSummary(doc);
  }

  /** US5 · Soft-delete a transfer (idempotent); excluded from balances/list (FR-010). */
  async deleteTransfer(familyId: string, actorId: string, transferId: string): Promise<void> {
    const existing = await this.transfers.findAnyInFamily(familyId, transferId);
    if (!existing) {
      throw new NotFoundException('Transfer not found in this family.');
    }
    if (existing.deletedAt !== null) {
      return; // idempotent — already deleted, no new audit event
    }
    await this.transfers.markDeleted(familyId, transferId, new Date());
    await this.appendEvent(existing, actorId, 'deleted');
    this.logger.log(`transfer.deleted id=${transferId} family=${familyId}`);
  }

  /** Both accounts must be active accounts of the family, and must differ. */
  private async validateAccounts(familyId: string, from: string, to: string): Promise<void> {
    if (from === to) {
      throw new BadRequestException('The origin and destination accounts must be different.');
    }
    for (const accountId of [from, to]) {
      const account = await this.accounts.findInFamily(familyId, accountId);
      if (!account || account.archivedAt !== null) {
        throw new BadRequestException('Account is not available.');
      }
    }
  }

  private buildPatch(dto: UpdateTransferDto): UpdateTransferPatch {
    const patch: UpdateTransferPatch = {};
    if (dto.amount !== undefined) patch.amount = dto.amount;
    if (dto.date !== undefined) patch.date = new Date(dto.date);
    if (dto.fromAccountId !== undefined) patch.fromAccountId = new Types.ObjectId(dto.fromAccountId);
    if (dto.toAccountId !== undefined) patch.toAccountId = new Types.ObjectId(dto.toAccountId);
    if (dto.note !== undefined) patch.note = dto.note;
    return patch;
  }

  private async requireInFamily(familyId: string, transferId: string): Promise<TransferDocument> {
    const transfer = await this.transfers.findInFamily(familyId, transferId);
    if (!transfer) {
      throw new NotFoundException('Transfer not found in this family.');
    }
    return transfer;
  }

  private async appendEvent(
    doc: TransferDocument,
    actorId: string,
    type: 'created' | 'updated' | 'deleted',
  ): Promise<void> {
    const snapshot: TransferSnapshot = {
      amount: doc.amount,
      date: doc.date,
      fromAccountId: doc.fromAccountId,
      toAccountId: doc.toAccountId,
      note: doc.note,
    };
    await this.events.append({
      transferId: doc.id,
      familyId: doc.familyId.toString(),
      actorId,
      type,
      snapshot,
    });
  }

  private toSummary(doc: TransferDocument): TransferSummary {
    return {
      transferId: doc.id,
      amount: doc.amount,
      date: doc.date.toISOString().slice(0, 10),
      fromAccountId: doc.fromAccountId.toString(),
      toAccountId: doc.toAccountId.toString(),
      note: doc.note,
    };
  }
}
