import { Injectable } from '@nestjs/common';
import { TransferRepository } from './transfer.repository';

/**
 * Derives the last transfer change time from TXN-02. Exported so DASH-01 can fold it
 * into the "last updated" mark without transfers depending on the dashboard (one-way).
 * Transfers never contribute to income/expense — only to balances and freshness.
 */
@Injectable()
export class TransferSummaryService {
  constructor(private readonly transfers: TransferRepository) {}

  /** The latest transfer change time for the family, or null (FR-008). */
  latestChangeAt(familyId: string): Promise<Date | null> {
    return this.transfers.latestChangeAt(familyId);
  }
}
