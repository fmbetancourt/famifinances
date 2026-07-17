import type { AccountSummary } from '@famifinances/contracts';
import { ApiError } from './client';
import { authFetch } from './refresh-interceptor';

export async function verifyEmail(code: string): Promise<AccountSummary> {
  const response = await authFetch('/auth/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const payload = (await response.json().catch(() => ({}))) as AccountSummary & { message?: string };
  if (!response.ok) {
    throw new ApiError(payload.message ?? 'Verification failed', response.status);
  }
  return payload;
}

export async function resendVerification(): Promise<void> {
  await authFetch('/auth/email/verify/resend', { method: 'POST' });
}
