import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FamiliesModule } from '../families/families.module';
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
  ],
  controllers: [FinancialAccountsController],
  providers: [FinancialAccountsService, FinancialAccountRepository],
})
export class FinancialAccountsModule {}
