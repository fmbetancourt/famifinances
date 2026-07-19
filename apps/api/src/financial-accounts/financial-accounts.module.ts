import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FamiliesModule } from '../families/families.module';
import { MovementsModule } from '../movements/movements.module';
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
    // TXN-01 · the derived balance sums movements (MovementBalanceService). forwardRef
    // breaks the accounts⇄movements cycle (movements validate accounts back).
    forwardRef(() => MovementsModule),
  ],
  controllers: [FinancialAccountsController],
  providers: [FinancialAccountsService, FinancialAccountRepository],
  // Exported so TXN-01 (movements) can validate a referenced account.
  exports: [FinancialAccountRepository],
})
export class FinancialAccountsModule {}
