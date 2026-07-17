import { Injectable, Logger } from '@nestjs/common';
import type { MailMessage, MailPort } from '../mail.port';

/**
 * Development mail adapter: logs message metadata only (recipient, subject, body
 * length) — never the OTP (FR-027) — instead of sending. It is currently wired
 * unconditionally in MailModule; a production adapter selected by
 * MAIL_PROVIDER_API_KEY (Resend — research R5) is a pilot-launch task.
 */
@Injectable()
export class StubMailAdapter implements MailPort {
  private readonly logger = new Logger('MailStub');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`stub mail → ${message.to} · "${message.subject}" (${message.body.length} chars)`);
  }
}
