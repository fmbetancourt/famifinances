import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FamiliesModule } from '../families/families.module';
import { MovementsModule } from '../movements/movements.module';
import { CategoriesModule } from '../categories/categories.module';
import { FinancialAccountsModule } from '../financial-accounts/financial-accounts.module';
import { MovementTemplate, MovementTemplateSchema } from './movement-template.schema';
import { MovementTemplateRepository } from './movement-template.repository';
import { CaptureTemplatesService } from './capture-templates.service';
import { CaptureDefaultsService } from './capture-defaults.service';
import { CaptureTemplatesController } from './capture-templates.controller';
import { CaptureDefaultsController } from './capture-defaults.controller';

/**
 * UX-01 · capture defaults (derived on read) + family-shared movement templates.
 * Depends ONE-WAY on Movements (last-used query), Categories and FinancialAccounts
 * (reference validation) and Families (FamilyScopeGuard) — no cycle, so no forwardRef.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MovementTemplate.name, schema: MovementTemplateSchema },
    ]),
    FamiliesModule, // FamilyScopeGuard (Principle I)
    MovementsModule, // MovementRepository — the member's last-used movement
    CategoriesModule, // CategoryRepository — validate a referenced category + kind
    FinancialAccountsModule, // FinancialAccountRepository — validate a referenced account
  ],
  controllers: [CaptureTemplatesController, CaptureDefaultsController],
  providers: [MovementTemplateRepository, CaptureTemplatesService, CaptureDefaultsService],
})
export class CaptureModule {}
