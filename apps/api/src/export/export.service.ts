import { Injectable, Logger } from '@nestjs/common';
import type { MovementType } from '@famifinances/contracts';
import { MovementRepository } from '../movements/movement.repository';
import { MovementDocument } from '../movements/movement.schema';
import { TransferRepository } from '../transfers/transfer.repository';
import { TransferDocument } from '../transfers/transfer.schema';
import { FinancialAccountRepository } from '../financial-accounts/financial-account.repository';
import { CategoryRepository } from '../categories/category.repository';
import { AccountRepository } from '../accounts/account.repository';
import { buildCsv } from './csv-writer';
import { ExportMovementsQuery } from './dto/export-movements.query';

const MOVEMENT_HEADERS = ['Fecha', 'Tipo', 'Monto', 'Cuenta', 'Categoría', 'Nota', 'Autor', 'Creado'];
const TRANSFER_HEADERS = ['Fecha', 'Cuenta origen', 'Cuenta destino', 'Monto', 'Autor', 'Creado'];
const TYPE_LABEL: Record<MovementType, string> = { income: 'Ingreso', expense: 'Gasto' };

/** Mongoose `timestamps` adds `createdAt` at runtime; the schema class does not declare it. */
type Timestamped = { createdAt: Date };

/** Calendar day (YYYY-MM-DD) of a stored Date. */
const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

const uniqueIds = (ids: string[]): string[] => [...new Set(ids)];

/**
 * EXP-01 · builds the family's movements/transfers CSV on demand. Reads are
 * family-scoped; ids are resolved to readable names/emails with set-based maps.
 * Only a row count is logged — never an amount, note, or email (FR-008).
 */
@Injectable()
export class ExportService {
  private readonly logger = new Logger('Export');

  constructor(
    private readonly movements: MovementRepository,
    private readonly transfers: TransferRepository,
    private readonly accounts: FinancialAccountRepository,
    private readonly categories: CategoryRepository,
    private readonly authAccounts: AccountRepository,
  ) {}

  /** The family's non-deleted movements matching the HIS-01 filters, as a CSV string. */
  async exportMovements(familyId: string, filters: ExportMovementsQuery): Promise<string> {
    const docs = await this.movements.findForExport(familyId, filters);
    const [accountNames, categoryNames, emails] = await Promise.all([
      this.accountNameMap(familyId),
      this.categoryNameMap(familyId),
      this.authAccounts.findEmailsByIds(uniqueIds(docs.map((d) => d.createdBy.toString()))),
    ]);

    const rows = docs.map((doc) => this.movementRow(doc, accountNames, categoryNames, emails));
    this.logger.log(`export.movements rows=${rows.length} family=${familyId}`);
    return buildCsv(MOVEMENT_HEADERS, rows);
  }

  /** The family's non-deleted transfers, as a CSV string. */
  async exportTransfers(familyId: string): Promise<string> {
    const docs = await this.transfers.listByFamily(familyId, {});
    const [accountNames, emails] = await Promise.all([
      this.accountNameMap(familyId),
      this.authAccounts.findEmailsByIds(uniqueIds(docs.map((d) => d.createdBy.toString()))),
    ]);

    const rows = docs.map((doc) => this.transferRow(doc, accountNames, emails));
    this.logger.log(`export.transfers rows=${rows.length} family=${familyId}`);
    return buildCsv(TRANSFER_HEADERS, rows);
  }

  private movementRow(
    doc: MovementDocument,
    accountNames: Map<string, string>,
    categoryNames: Map<string, string>,
    emails: Map<string, string>,
  ): string[] {
    return [
      isoDay(doc.date),
      TYPE_LABEL[doc.type],
      String(doc.amount),
      accountNames.get(doc.accountId.toString()) ?? '',
      doc.categoryId ? (categoryNames.get(doc.categoryId.toString()) ?? '') : '',
      doc.note ?? '',
      emails.get(doc.createdBy.toString()) ?? '',
      isoDay((doc as MovementDocument & Timestamped).createdAt),
    ];
  }

  private transferRow(
    doc: TransferDocument,
    accountNames: Map<string, string>,
    emails: Map<string, string>,
  ): string[] {
    return [
      isoDay(doc.date),
      accountNames.get(doc.fromAccountId.toString()) ?? '',
      accountNames.get(doc.toAccountId.toString()) ?? '',
      String(doc.amount),
      emails.get(doc.createdBy.toString()) ?? '',
      isoDay((doc as TransferDocument & Timestamped).createdAt),
    ];
  }

  /** `id → name` for every account of the family (incl. archived, so history stays readable). */
  private async accountNameMap(familyId: string): Promise<Map<string, string>> {
    const accounts = await this.accounts.findByFamily(familyId, 'all');
    return new Map(accounts.map((a) => [a.id, a.name]));
  }

  /** `id → name` for every category visible to the family (system + custom, any status). */
  private async categoryNameMap(familyId: string): Promise<Map<string, string>> {
    const categories = await this.categories.listVisible(familyId, { status: 'all' });
    return new Map(categories.map((c) => [c.id, c.name]));
  }
}
