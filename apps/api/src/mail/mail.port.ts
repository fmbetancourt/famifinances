/** Hexagonal port for transactional email (OTP delivery). Swappable adapter. */
export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface MailPort {
  send(message: MailMessage): Promise<void>;
}

/** DI token for the MailPort implementation. */
export const MAIL_PORT = Symbol('MAIL_PORT');
