import { IsIn, IsOptional, IsString } from 'class-validator';
import type { MovementType } from '@famifinances/contracts';
import { MOVEMENT_TYPES } from '../movement.schema';

/** Query for `GET /movements`. Both filters optional. */
export class ListMovementsQuery {
  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  type?: MovementType;
}
