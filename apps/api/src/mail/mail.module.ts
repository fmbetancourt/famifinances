import { Module } from '@nestjs/common';
import { MAIL_PORT } from './mail.port';
import { StubMailAdapter } from './providers/stub-mail.adapter';

/**
 * Binds the MailPort to an adapter. The stub is used for the MVP/dev; the Resend
 * adapter is introduced in US6 wiring (research R5) without touching consumers.
 */
@Module({
  providers: [{ provide: MAIL_PORT, useClass: StubMailAdapter }],
  exports: [MAIL_PORT],
})
export class MailModule {}
