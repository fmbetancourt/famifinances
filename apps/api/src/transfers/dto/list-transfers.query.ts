import { IsOptional, IsString } from 'class-validator';

/** Query for `GET /transfers`. `account` filters to transfers touching that account (origin or destination). */
export class ListTransfersQuery {
  @IsOptional()
  @IsString()
  account?: string;
}
