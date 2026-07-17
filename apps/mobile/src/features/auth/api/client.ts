import type {
  AccountSummary,
  EmailRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  ResetConfirmRequest,
  TokenPair,
} from '@famifinances/contracts';

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function postJson<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new ApiError(payload.message ?? 'Request failed', response.status);
  }
  return payload as TResponse;
}

export function register(input: RegisterRequest): Promise<AccountSummary> {
  return postJson<RegisterRequest, AccountSummary>('/auth/register', input);
}

export function login(input: LoginRequest): Promise<TokenPair> {
  return postJson<LoginRequest, TokenPair>('/auth/login', input);
}

export function refreshSession(refreshToken: string): Promise<TokenPair> {
  return postJson<RefreshRequest, TokenPair>('/auth/token/refresh', { refreshToken });
}

export function requestPasswordReset(input: EmailRequest): Promise<void> {
  return postJson<EmailRequest, void>('/auth/password/reset/request', input);
}

export function confirmPasswordReset(input: ResetConfirmRequest): Promise<void> {
  return postJson<ResetConfirmRequest, void>('/auth/password/reset/confirm', input);
}
