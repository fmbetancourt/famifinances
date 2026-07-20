import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FamiliesModule } from '../families/families.module';
import { CategoriesModule } from '../categories/categories.module';
import { MovementsModule } from '../movements/movements.module';
import { BudgetAllocation, BudgetAllocationSchema } from './budget-allocation.schema';
import { BudgetAllocationRepository } from './budget-allocation.repository';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BudgetAllocation.name, schema: BudgetAllocationSchema }]),
    // All one-way (budgets read; nothing reads budgets → no forwardRef):
    FamiliesModule, // FamilyScopeGuard + FamilyRoleGuard (owner-only writes)
    CategoriesModule, // CategoryRepository — validate an expense category
    MovementsModule, // MovementSpendService — derived real spend
  ],
  controllers: [BudgetsController],
  providers: [BudgetsService, BudgetAllocationRepository],
  // Exported so DASH-01 can read the budget report (planned-vs-real overview).
  exports: [BudgetsService],
})
export class BudgetsModule {}
