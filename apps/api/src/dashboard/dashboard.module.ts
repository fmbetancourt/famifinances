import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { FinancialAccountsModule } from '../financial-accounts/financial-accounts.module';
import { MovementsModule } from '../movements/movements.module';
import { TransfersModule } from '../transfers/transfers.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    // All one-way (the dashboard reads these; nothing reads the dashboard → no forwardRef):
    FamiliesModule, // FamilyScopeGuard (Principle I)
    FinancialAccountsModule, // FinancialAccountsService — active accounts' derived balances (net worth)
    MovementsModule, // MovementSummaryService — money summary + last-updated
    TransfersModule, // TransferSummaryService — last-updated
    BudgetsModule, // BudgetsService — budget overview
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
