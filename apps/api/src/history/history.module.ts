import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { MovementsModule } from '../movements/movements.module';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';

@Module({
  imports: [
    // One-way (history reads movements; nothing reads history → no forwardRef):
    FamiliesModule, // FamilyScopeGuard (Principle I)
    MovementsModule, // MovementRepository.searchHistory — the query source
  ],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
