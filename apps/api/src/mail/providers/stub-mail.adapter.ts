import { Injectable, Logger } from '@nestjs/common';
import type { MailMessage, MailPort } from '../mail.port';

/**
 * Development adapter: logs the message (subject only, body length) instead of
 * sending, so no secret content is printed. Used when MAIL_PROVIDER_API_KEY is
 * unset. The real Resend adapter (research R5) replaces this in the pilot.
 */
@Injectable()
export class StubMailAdapter implements MailPort {
  private readonly logger = new Logger('MailStub');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`stub mail → ${message.to} · "${message.subject}" (${message.body.length} chars)`);
  }
}
