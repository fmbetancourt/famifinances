/**
 * The identity attached to a request after successful token validation.
 * It is derived exclusively from the verified access token + account record,
 * never from client-supplied input (FR-011).
 */
export interface AuthenticatedUser {
  accountId: string;
  email: string;
  emailVerified: boolean;
}
