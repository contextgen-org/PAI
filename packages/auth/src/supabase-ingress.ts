import { type ServiceIdV1 } from "@pai/contracts";
import {
  decodeProtectedHeader,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
} from "jose";

import { AuthError, asUnauthenticated } from "./errors.js";

export type IngressPrincipalType = "user" | "developer" | "operator" | "bot";

export interface IngressPrincipalV1 {
  readonly principal_type: IngressPrincipalType;
  readonly principal_id: string;
  readonly roles: readonly string[];
  readonly source_issuer: string;
  readonly source_subject: string;
  readonly auth_time: number;
}

export interface VerifiedSupabaseIngress {
  readonly principal: IngressPrincipalV1;
  readonly claims: JWTPayload;
}

export type SupabasePrincipalMapper = (
  claims: JWTPayload,
) => IngressPrincipalV1;

export interface SupabaseIngressVerifierOptions {
  readonly issuer: string;
  readonly audience: string;
  readonly getKey: JWTVerifyGetKey;
  readonly algorithms?: readonly string[];
  readonly mapPrincipal?: SupabasePrincipalMapper;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function sortedStrings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return [];
  }
  return [...new Set(value)].sort();
}

export function mapDefaultSupabasePrincipal(
  claims: JWTPayload,
): IngressPrincipalV1 {
  if (
    typeof claims.iss !== "string" ||
    typeof claims.sub !== "string" ||
    typeof claims.iat !== "number"
  ) {
    throw new AuthError("unauthenticated", "Supabase identity claims are incomplete");
  }
  const metadata = asRecord(claims.app_metadata);
  const declaredType = metadata.principal_type;
  const principalType: IngressPrincipalType =
    declaredType === "developer" ||
    declaredType === "operator" ||
    declaredType === "bot"
      ? declaredType
      : "user";
  const principalId = metadata.principal_id ?? claims.sub;
  if (typeof principalId !== "string" || principalId.length === 0) {
    throw new AuthError("unauthenticated", "Supabase principal id is invalid");
  }
  const roles = sortedStrings(metadata.roles);
  if (roles.length === 0 && typeof metadata.role === "string") roles.push(metadata.role);
  return {
    principal_type: principalType,
    principal_id: principalId,
    roles: [...new Set(roles)].sort(),
    source_issuer: claims.iss,
    source_subject: claims.sub,
    auth_time: typeof claims.auth_time === "number" ? claims.auth_time : claims.iat,
  };
}

/** Verifies public Supabase ingress only; it never returns a downstream token. */
export class SupabaseIngressVerifier {
  readonly #issuer: string;
  readonly #audience: string;
  readonly #getKey: JWTVerifyGetKey;
  readonly #algorithms: readonly string[];
  readonly #mapPrincipal: SupabasePrincipalMapper;

  public constructor(options: SupabaseIngressVerifierOptions) {
    this.#issuer = options.issuer;
    this.#audience = options.audience;
    this.#getKey = options.getKey;
    this.#algorithms = options.algorithms ?? ["ES256", "RS256"];
    this.#mapPrincipal = options.mapPrincipal ?? mapDefaultSupabasePrincipal;
  }

  public async verify(token: string): Promise<VerifiedSupabaseIngress> {
    try {
      const header = decodeProtectedHeader(token);
      if (typeof header.kid !== "string" || header.kid.length === 0) {
        throw new AuthError("unauthenticated", "Supabase credential kid is required");
      }
      const result = await jwtVerify(token, this.#getKey, {
        issuer: this.#issuer,
        audience: this.#audience,
        algorithms: [...this.#algorithms],
        requiredClaims: ["sub", "iat", "nbf", "exp"],
      });
      return {
        principal: this.#mapPrincipal(result.payload),
        claims: result.payload,
      };
    } catch (error: unknown) {
      throw asUnauthenticated(error);
    }
  }
}

export interface WorkloadExchangeRequest {
  readonly audience: ServiceIdV1;
  readonly capabilities: readonly string[];
}
