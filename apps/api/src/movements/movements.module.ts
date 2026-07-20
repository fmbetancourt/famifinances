import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FamiliesModule } from '../families/families.module';
import { CategoriesModule } from '../categories/categories.module';
import { FinancialAccountsModule } from '../financial-accounts/financial-accounts.module';
import { Movement, MovementSchema } from './movement.schema';
import { MovementEvent, MovementEventSchema } from './movement-event.schema';
import { MovementRepository } from './movement.repository';
import { MovementEventRepository } from './movement-event.repository';
import { MovementBalanceService } from './movement-balance.service';
import { MovementSpendService } from './movement-spend.service';
import { MovementSummaryService } from './movement-summary.service';
import { MovementsService } from './movements.service';
import { MovementsController } from './movements.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Movement.name, schema: MovementSchema },
      { name: MovementEvent.name, schema: MovementEventSchema },
    ]),
    FamiliesModule, // FamilyScopeGuard (Principle I)
    CategoriesModule, // CategoryRepository — validate a referenced category + kind
    // FinancialAccountRepository — validate a referenced account; forwardRef breaks the
    // accounts⇄movements cycle (accounts pull movement sums for the derived balance).
    forwardRef(() => FinancialAccountsModule),
  ],
  controllers: [MovementsController],
  providers: [
    MovementsService,
    MovementRepository,
    MovementEventRepository,
    MovementBalanceService,
    MovementSpendService,
    MovementSummaryService,
  ],
  // MovementBalanceService → ACC-01 balance; MovementSpendService → BUD-01 real spend;
  // MovementSummaryService → DASH-01 money summary + last-updated.
  exports: [MovementBalanceService, MovementSpendService, MovementSummaryService],
})
export class MovementsModule {}
