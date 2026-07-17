import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Injects the authenticated identity. It reads ONLY `request.user` (populated by
 * JwtStrategy from the verified token), never the body/params/query — so a
 * client cannot act as another identity by supplying an id (FR-011, SC-004).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
