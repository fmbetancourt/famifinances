import type {
  AccountSummary,
  EmailRequest,
  FieldError,
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
    // Structured field errors (e.g. which password rule failed, FR-002); empty
    // for generic errors. Mirrors the API's ValidationErrorBody.errors.
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorPayload {
  message?: string;
  errors?: FieldError[];
}

async function postJson<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
  if (!response.ok) {
    throw new ApiError(payload.message ?? 'Request failed', response.status, payload.errors ?? []);
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
