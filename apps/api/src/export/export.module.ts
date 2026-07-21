import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { MovementsModule } from '../movements/movements.module';
import { TransfersModule } from '../transfers/transfers.module';
import { FinancialAccountsModule } from '../financial-accounts/financial-accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

/**
 * EXP-01 · CSV export of the family's movements and transfers. Reads existing data
 * one-way through the exported repositories (Movements/Transfers/FinancialAccounts/
 * Categories/Accounts) plus FamiliesModule (FamilyScopeGuard). No cycle → no
 * `forwardRef`; no collection, no scheduler, no external dependency.
 */
@Module({
  imports: [
    FamiliesModule,
    MovementsModule, // MovementRepository.findForExport
    TransfersModule, // TransferRepository (transfers export)
    FinancialAccountsModule, // FinancialAccountRepository — account names
    CategoriesModule, // CategoryRepository — category names
    AccountsModule, // AccountRepository — author emails
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
