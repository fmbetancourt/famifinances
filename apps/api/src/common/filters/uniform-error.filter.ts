import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { redact } from '../logging/redaction';

/**
 * Centralizes error responses. Validation errors keep field-level detail;
 * everything else returns a generic message so failures do not leak internals
 * or enable account enumeration (FR-014, FR-022, SC-008/SC-011).
 */
@Catch()
export class UniformErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // class-validator failures arrive as { message: string[] , ... } on 400.
      if (status === HttpStatus.BAD_REQUEST && typeof body === 'object' && body !== null) {
        const messages = (body as { message?: unknown }).message;
        if (Array.isArray(messages)) {
          response.status(status).json({
            message: 'Validation failed',
            errors: messages.map((m) => ({ field: '', rule: String(m) })),
          });
          return;
        }
      }

      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? String((body as { message: unknown }).message)
          : exception.message;
      response.status(status).json({ message });
      return;
    }

    // Unknown/unexpected error: log redacted, return opaque 500.
    this.logger.error(redact({ error: String(exception) }));
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: 'An unexpected error occurred.' });
  }
}
