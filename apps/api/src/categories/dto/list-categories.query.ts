import { IsIn, IsOptional } from 'class-validator';
import type { CategoryKind, CategoryStatusFilter } from '@famifinances/contracts';
import { CATEGORY_KINDS } from '../category.schema';

const STATUS_FILTERS: CategoryStatusFilter[] = ['active', 'archived', 'all'];

/** Query for `GET /categories`. `status` defaults to `active` (resolved in the service). */
export class ListCategoriesQuery {
  @IsOptional()
  @IsIn(CATEGORY_KINDS)
  kind?: CategoryKind;

  @IsOptional()
  @IsIn(STATUS_FILTERS)
  status?: CategoryStatusFilter;
}
