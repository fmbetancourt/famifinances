import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FamiliesModule } from '../families/families.module';
import { Category, CategorySchema } from './category.schema';
import { CategoryRepository } from './category.repository';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }]),
    // Reuses FAM-01's FamilyScopeGuard (exported by FamiliesModule) for the Principle-I boundary.
    FamiliesModule,
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoryRepository],
  // Exported so TXN-01 (movements) can validate a referenced category + its kind.
  exports: [CategoryRepository],
})
export class CategoriesModule implements OnModuleInit {
  constructor(private readonly categories: CategoriesService) {}

  /** Seed the system default categories once, idempotently, on startup (R2, SC-001). */
  async onModuleInit(): Promise<void> {
    await this.categories.seedSystemDefaults();
  }
}
