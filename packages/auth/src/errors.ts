import type { VerifiedWorkloadCredential } from "./workload.js";

export type AuthErrorCode =
  | "unauthenticated"
  | "authorization_denied"
  | "capability_denied"
  | "authorization_scope_mismatch";

export class AuthError extends Error {
  public readonly code: AuthErrorCode;

  public constructor(
    code: AuthErrorCode,
    message: string,
    cause?: unknown,
    /**
     * Signature-verified claims retained only for authorization failures.
     * The bearer token is never retained. Consumers must persist a bounded
     * audit projection rather than this full object.
     */
    public readonly verifiedCredential?: VerifiedWorkloadCredential,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AuthError";
    this.code = code;
  }
}

export function asUnauthenticated(error: unknown): AuthError {
  return error instanceof AuthError && error.code === "unauthenticated"
    ? error
    : new AuthError("unauthenticated", "credential was rejected", error);
}
