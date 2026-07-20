export type AuthErrorCode =
  | "unauthenticated"
  | "authorization_denied"
  | "capability_denied"
  | "authorization_scope_mismatch";

export class AuthError extends Error {
  public readonly code: AuthErrorCode;

  public constructor(code: AuthErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AuthError";
    this.code = code;
  }
}

export function asUnauthenticated(error: unknown): AuthError {
  return error instanceof AuthError
    ? error
    : new AuthError("unauthenticated", "credential was rejected", error);
}
