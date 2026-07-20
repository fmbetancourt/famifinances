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

    // Transport-level errors (e.g. body-parser's 413 payload-too-large or a 400 on
    // malformed JSON) arrive as http-errors carrying a numeric status, not a Nest
    // HttpException. Honor the status with a generic message — no internal detail (SEC-01).
    const status = httpStatusOf(exception);
    if (status !== null) {
      const message = status === HttpStatus.PAYLOAD_TOO_LARGE ? 'Payload too large.' : 'Bad request.';
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

/** The HTTP status carried by an http-errors-style error (body-parser, etc.), or null. */
function httpStatusOf(exception: unknown): number | null {
  if (exception !== null && typeof exception === 'object') {
    const candidate = exception as { status?: unknown; statusCode?: unknown };
    const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 600) {
      return status;
    }
  }
  return null;
}
