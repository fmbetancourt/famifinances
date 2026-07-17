import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentFamilyContext } from '../types/current-family';

/**
 * Injects the family scope resolved by FamilyScopeGuard from the session
 * membership — never from caller input (FR-008).
 */
export const CurrentFamily = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentFamilyContext => {
    const request = ctx.switchToHttp().getRequest<{ family: CurrentFamilyContext }>();
    return request.family;
  },
);
