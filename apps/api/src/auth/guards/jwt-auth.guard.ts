import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Enforces a valid access token on protected routes (FR-010). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
