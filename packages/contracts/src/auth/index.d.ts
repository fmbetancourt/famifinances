export interface RegisterRequest {
    email: string;
    password: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RefreshRequest {
    refreshToken: string;
}
export interface EmailRequest {
    email: string;
}
export interface CodeRequest {
    code: string;
}
export interface ResetConfirmRequest {
    email: string;
    code: string;
    newPassword: string;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
}
export interface AccountSummary {
    accountId: string;
    email: string;
    emailVerified: boolean;
}
export interface GenericError {
    message: string;
}
export interface FieldError {
    field: string;
    rule: string;
}
export interface ValidationErrorBody {
    message: string;
    errors: FieldError[];
}
