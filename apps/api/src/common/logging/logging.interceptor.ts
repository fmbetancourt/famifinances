import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';

/**
 * Logs request method, path, and status only — never request/response bodies,
 * so passwords, tokens, and codes cannot leak into logs (Principle II; FR-015).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startedAt = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${method} ${url} ${Date.now() - startedAt}ms`);
      }),
    );
  }
}
