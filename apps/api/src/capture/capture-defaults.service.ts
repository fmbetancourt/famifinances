import { Injectable } from '@nestjs/common';
import type { CaptureDefaults, MovementType } from '@famifinances/contracts';
import { MovementRepository } from '../movements/movement.repository';
import { FinancialAccountRepository } from '../financial-accounts/financial-account.repository';
import { CategoryRepository } from '../categories/category.repository';

/**
 * Capture defaults (UX-01) — derived on read from the member's most recent
 * movement, never persisted (Principle V). A referenced account/category is
 * nulled out when it is no longer safely reusable so the flow falls back to an
 * explicit selection instead of a broken default (FR-003/FR-010).
 */
@Injectable()
export class CaptureDefaultsService {
  constructor(
    private readonly movements: MovementRepository,
    private readonly accounts: FinancialAccountRepository,
    private readonly categories: CategoryRepository,
  ) {}

  /** The member's last-used account/category/type (each nulled if unusable) plus today. */
  async getDefaults(familyId: string, memberId: string): Promise<CaptureDefaults> {
    const date = new Date().toISOString().slice(0, 10);
    const latest = await this.movements.findLatestByMember(familyId, memberId);
    if (!latest) {
      return { type: null, accountId: null, categoryId: null, date };
    }

    const type: MovementType = latest.type;
    const accountId = await this.usableAccountId(familyId, latest.accountId.toString());
    const categoryId = latest.categoryId
      ? await this.usableCategoryId(familyId, latest.categoryId.toString(), type)
      : null;

    return { type, accountId, categoryId, date };
  }

  /** The account id if it still resolves to an active family account; else null. */
  private async usableAccountId(familyId: string, accountId: string): Promise<string | null> {
    const account = await this.accounts.findInFamily(familyId, accountId);
    return account && account.archivedAt === null ? accountId : null;
  }

  /** The category id if it is visible, active, and its kind still matches the type; else null. */
  private async usableCategoryId(
    familyId: string,
    categoryId: string,
    type: MovementType,
  ): Promise<string | null> {
    const category = await this.categories.findVisible(familyId, categoryId);
    if (!category || category.kind !== type) {
      return null;
    }
    if (category.scope === 'family' && category.archivedAt !== null) {
      return null;
    }
    return categoryId;
  }
}
