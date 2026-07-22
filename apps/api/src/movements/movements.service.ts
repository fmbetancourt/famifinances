import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { MovementSummary, MovementType } from '@famifinances/contracts';
import { FinancialAccountRepository } from '../financial-accounts/financial-account.repository';
import { CategoryRepository } from '../categories/category.repository';
import { IdempotencyService, IdempotencyRunResult } from '../idempotency/idempotency.service';
import { fingerprint } from '../idempotency/fingerprint';
import { MovementRepository, UpdateMovementPatch } from './movement.repository';
import { MovementEventRepository } from './movement-event.repository';
import { MovementDocument } from './movement.schema';
import { MovementSnapshot } from './movement-event.schema';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';
import { ListMovementsQuery } from './dto/list-movements.query';

@Injectable()
export class MovementsService {
  private readonly logger = new Logger('Movements');

  constructor(
    private readonly movements: MovementRepository,
    private readonly events: MovementEventRepository,
    private readonly accounts: FinancialAccountRepository,
    private readonly categories: CategoryRepository,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * US1 · Record an income/expense movement (FR-001..FR-006). OFF-01: an optional
   * `idempotencyKey` makes the create retry-safe — a replay returns the same movement
   * without duplicating it.
   */
  async createMovement(
    familyId: string,
    createdBy: string,
    dto: CreateMovementDto,
    idempotencyKey?: string,
  ): Promise<IdempotencyRunResult<MovementSummary>> {
    return this.idempotency.run<MovementSummary>({
      key: idempotencyKey,
      familyId,
      ownerId: createdBy,
      operation: 'movement.create',
      fingerprint: fingerprint({
        type: dto.type,
        amount: dto.amount,
        date: dto.date,
        accountId: dto.accountId,
        categoryId: dto.categoryId ?? null,
        note: dto.note ?? null,
      }),
      create: async () => {
        const summary = await this.persistMovement(familyId, createdBy, dto);
        return { id: summary.movementId, result: summary };
      },
      reload: (id) => this.getMovement(familyId, id),
    });
  }

  /** The actual movement create (validations + persistence + audit). */
  private async persistMovement(
    familyId: string,
    createdBy: string,
    dto: CreateMovementDto,
  ): Promise<MovementSummary> {
    await this.validateAccount(familyId, dto.accountId);
    await this.validateCategory(familyId, dto.categoryId ?? null, dto.type);
    const doc = await this.movements.create({
      familyId,
      createdBy,
      type: dto.type,
      amount: dto.amount,
      date: new Date(dto.date),
      accountId: dto.accountId,
      categoryId: dto.categoryId ?? null,
      note: dto.note ?? null,
    });
    await this.appendEvent(doc, createdBy, 'created');
    this.logger.log(`movement.created id=${doc.id} family=${familyId}`);
    return this.toSummary(doc);
  }

  /** US2 · The family's non-deleted movements, newest first (FR-008). */
  async listMovements(familyId: string, query: ListMovementsQuery): Promise<MovementSummary[]> {
    const docs = await this.movements.listByFamily(familyId, {
      account: query.account,
      type: query.type,
    });
    return docs.map((doc) => this.toSummary(doc));
  }

  /** US2/US3 · One active movement of the family (404 otherwise). */
  async getMovement(familyId: string, movementId: string): Promise<MovementSummary> {
    return this.toSummary(await this.requireInFamily(familyId, movementId));
  }

  /** US4 · Edit a movement; references + kind re-validated; balances recompute (FR-009). */
  async updateMovement(
    familyId: string,
    actorId: string,
    movementId: string,
    dto: UpdateMovementDto,
  ): Promise<MovementSummary> {
    const existing = await this.requireInFamily(familyId, movementId);
    const patch = this.buildPatch(dto);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Provide at least one field to update.');
    }

    // Re-validate the effective account + category against the effective type.
    const type: MovementType = dto.type ?? existing.type;
    const accountId = dto.accountId ?? existing.accountId.toString();
    await this.validateAccount(familyId, accountId);
    const categoryId =
      dto.categoryId !== undefined ? dto.categoryId : (existing.categoryId?.toString() ?? null);
    await this.validateCategory(familyId, categoryId, type);

    const updated = await this.movements.update(familyId, movementId, patch);
    const doc = updated ?? existing;
    await this.appendEvent(doc, actorId, 'updated');
    this.logger.log(`movement.updated id=${movementId} family=${familyId}`);
    return this.toSummary(doc);
  }

  /** US5 · Soft-delete a movement (idempotent); excluded from balances/history (FR-010). */
  async deleteMovement(familyId: string, actorId: string, movementId: string): Promise<void> {
    const existing = await this.movements.findAnyInFamily(familyId, movementId);
    if (!existing) {
      throw new NotFoundException('Movement not found in this family.');
    }
    if (existing.deletedAt !== null) {
      return; // idempotent — already deleted, no new audit event
    }
    await this.movements.markDeleted(familyId, movementId, new Date());
    await this.appendEvent(existing, actorId, 'deleted');
    this.logger.log(`movement.deleted id=${movementId} family=${familyId}`);
  }

  private async validateAccount(familyId: string, accountId: string): Promise<void> {
    const account = await this.accounts.findInFamily(familyId, accountId);
    if (!account || account.archivedAt !== null) {
      throw new BadRequestException('Account is not available.');
    }
  }

  private async validateCategory(
    familyId: string,
    categoryId: string | null,
    type: MovementType,
  ): Promise<void> {
    if (categoryId === null) {
      return; // category is optional
    }
    const category = await this.categories.findVisible(familyId, categoryId);
    if (!category || (category.scope === 'family' && category.archivedAt !== null)) {
      throw new BadRequestException('Category is not available.');
    }
    if (category.kind !== type) {
      throw new BadRequestException('Category kind does not match the movement type.');
    }
  }

  private buildPatch(dto: UpdateMovementDto): UpdateMovementPatch {
    const patch: UpdateMovementPatch = {};
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.amount !== undefined) patch.amount = dto.amount;
    if (dto.date !== undefined) patch.date = new Date(dto.date);
    if (dto.accountId !== undefined) patch.accountId = new Types.ObjectId(dto.accountId);
    if (dto.categoryId !== undefined) {
      patch.categoryId = dto.categoryId ? new Types.ObjectId(dto.categoryId) : null;
    }
    if (dto.note !== undefined) patch.note = dto.note;
    return patch;
  }

  private async requireInFamily(familyId: string, movementId: string): Promise<MovementDocument> {
    const movement = await this.movements.findInFamily(familyId, movementId);
    if (!movement) {
      throw new NotFoundException('Movement not found in this family.');
    }
    return movement;
  }

  private async appendEvent(
    doc: MovementDocument,
    actorId: string,
    type: 'created' | 'updated' | 'deleted',
  ): Promise<void> {
    const snapshot: MovementSnapshot = {
      type: doc.type,
      amount: doc.amount,
      date: doc.date,
      accountId: doc.accountId,
      categoryId: doc.categoryId,
      note: doc.note,
    };
    await this.events.append({
      movementId: doc.id,
      familyId: doc.familyId.toString(),
      actorId,
      type,
      snapshot,
    });
  }

  private toSummary(doc: MovementDocument): MovementSummary {
    return {
      movementId: doc.id,
      type: doc.type,
      amount: doc.amount,
      date: doc.date.toISOString().slice(0, 10),
      accountId: doc.accountId.toString(),
      categoryId: doc.categoryId ? doc.categoryId.toString() : null,
      note: doc.note,
    };
  }
}
