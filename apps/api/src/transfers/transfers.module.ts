import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FamiliesModule } from '../families/families.module';
import { FinancialAccountsModule } from '../financial-accounts/financial-accounts.module';
import { Transfer, TransferSchema } from './transfer.schema';
import { TransferEvent, TransferEventSchema } from './transfer-event.schema';
import { TransferRepository } from './transfer.repository';
import { TransferEventRepository } from './transfer-event.repository';
import { TransferBalanceService } from './transfer-balance.service';
import { TransferSummaryService } from './transfer-summary.service';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transfer.name, schema: TransferSchema },
      { name: TransferEvent.name, schema: TransferEventSchema },
    ]),
    FamiliesModule, // FamilyScopeGuard (Principle I)
    // FinancialAccountRepository — validate the referenced accounts; forwardRef breaks the
    // accounts⇄transfers cycle (accounts pull transfer sums for the derived balance).
    forwardRef(() => FinancialAccountsModule),
  ],
  controllers: [TransfersController],
  providers: [
    TransfersService,
    TransferRepository,
    TransferEventRepository,
    TransferBalanceService,
    TransferSummaryService,
  ],
  // TransferBalanceService → ACC-01 derived balance; TransferSummaryService → DASH-01 last-updated;
  // TransferRepository → EXP-01 reads the family's transfers for the CSV export.
  exports: [TransferBalanceService, TransferSummaryService, TransferRepository],
})
export class TransfersModule {}
