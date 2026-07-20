import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FamiliesModule } from '../families/families.module';
import { MovementsModule } from '../movements/movements.module';
import { TransfersModule } from '../transfers/transfers.module';
import { FinancialAccount, FinancialAccountSchema } from './financial-account.schema';
import { FinancialAccountRepository } from './financial-account.repository';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialAccountsController } from './financial-accounts.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FinancialAccount.name, schema: FinancialAccountSchema },
    ]),
    // Reuses FAM-01's FamilyScopeGuard (exported by FamiliesModule) for the Principle-I boundary.
    FamiliesModule,
    // TXN-01/TXN-02 · the derived balance sums movements + transfers. forwardRef breaks
    // the accounts⇄movements and accounts⇄transfers cycles (they validate accounts back).
    forwardRef(() => MovementsModule),
    forwardRef(() => TransfersModule),
  ],
  controllers: [FinancialAccountsController],
  providers: [FinancialAccountsService, FinancialAccountRepository],
  // FinancialAccountRepository → TXN-01 validates a referenced account;
  // FinancialAccountsService → DASH-01 reads active accounts' derived balances (net worth).
  exports: [FinancialAccountRepository, FinancialAccountsService],
})
export class FinancialAccountsModule {}
