import { IsIn, IsOptional } from 'class-validator';
import type { AccountStatusFilter } from '@famifinances/contracts';

const STATUS_FILTERS: AccountStatusFilter[] = ['active', 'archived', 'all'];

/** Query for `GET /accounts`. `status` defaults to `active` (resolved in the service). */
export class ListAccountsQuery {
  @IsOptional()
  @IsIn(STATUS_FILTERS)
  status?: AccountStatusFilter;
}
