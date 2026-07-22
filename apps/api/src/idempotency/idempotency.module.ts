import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdempotencyRecord, IdempotencyRecordSchema } from './idempotency.schema';
import { IdempotencyRepository } from './idempotency.repository';
import { IdempotencyService } from './idempotency.service';

/**
 * OFF-01 · the idempotency layer. Standalone — it depends on no domain module (callers
 * pass `create`/`reload` closures), so movements/transfers import it one-way with no
 * `forwardRef`. Exports `IdempotencyService`.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IdempotencyRecord.name, schema: IdempotencyRecordSchema },
    ]),
  ],
  providers: [IdempotencyRepository, IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
