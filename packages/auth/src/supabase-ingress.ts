import { type ServiceIdV1 } from "@pai/contracts";
import {
  decodeProtectedHeader,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
} from "jose";
import { isProxy } from "node:util/types";

import { AuthError, asUnauthenticated } from "./errors.js";
import {
  assertBoundedCompactJwt,
  normalizeAsymmetricJwtAlgorithms,
  snapshotVerifiedJwtJsonV1,
  type AsymmetricJwtAlgorithm,
} from "./jwt-policy.js";

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
  readonly algorithms?: readonly AsymmetricJwtAlgorithm[];
  readonly mapPrincipal?: SupabasePrincipalMapper;
}

const DEFAULT_SUPABASE_ALGORITHMS = ["ES256", "RS256"] as const;
const supabaseIngressOptionKeys = new Set([
  "algorithms",
  "audience",
  "getKey",
  "issuer",
  "mapPrincipal",
]);

function snapshotSupabaseIngressOptionsV1(
  value: unknown,
): SupabaseIngressVerifierOptions {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("Supabase ingress verifier options are invalid");
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some(
      (key) => typeof key !== "string" || !supabaseIngressOptionKeys.has(key),
    )
  ) {
    throw new Error("Supabase ingress verifier options are invalid");
  }
  const dataValue = (key: string, required: boolean): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      if (required) {
        throw new Error("Supabase ingress verifier options are invalid");
      }
      return undefined;
    }
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      throw new Error("Supabase ingress verifier options are invalid");
    }
    return descriptor.value;
  };
  const issuer = dataValue("issuer", true);
  const audience = dataValue("audience", true);
  const getKey = dataValue("getKey", true);
  const algorithms = dataValue("algorithms", false);
  const mapPrincipal = dataValue("mapPrincipal", false);
  if (
    typeof issuer !== "string" ||
    typeof audience !== "string" ||
    typeof getKey !== "function" ||
    isProxy(getKey) ||
    (algorithms !== undefined && !Array.isArray(algorithms)) ||
    (algorithms !== undefined && isProxy(algorithms)) ||
    (mapPrincipal !== undefined &&
      (typeof mapPrincipal !== "function" || isProxy(mapPrincipal)))
  ) {
    throw new Error("Supabase ingress verifier options are invalid");
  }
  return Object.freeze({
    issuer,
    audience,
    getKey: getKey as JWTVerifyGetKey,
    ...(algorithms === undefined
      ? {}
      : { algorithms: algorithms as readonly AsymmetricJwtAlgorithm[] }),
    ...(mapPrincipal === undefined
      ? {}
      : { mapPrincipal: mapPrincipal as SupabasePrincipalMapper }),
  });
}

function snapshotIngressPrincipalV1(
  value: unknown,
  claims: JWTPayload,
): IngressPrincipalV1 {
  const expectedKeys = [
    "auth_time",
    "principal_id",
    "principal_type",
    "roles",
    "source_issuer",
    "source_subject",
  ];
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("Supabase principal mapper returned an invalid principal");
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    (ownKeys as string[]).sort().join(",") !== expectedKeys.join(",")
  ) {
    throw new Error("Supabase principal mapper returned an invalid principal");
  }
  const dataValue = (key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error("Supabase principal mapper returned an invalid principal");
    }
    return descriptor.value;
  };
  const principalType = dataValue("principal_type");
  const principalId = dataValue("principal_id");
  const rolesValue = dataValue("roles");
  const sourceIssuer = dataValue("source_issuer");
  const sourceSubject = dataValue("source_subject");
  const authTime = dataValue("auth_time");
  if (!Array.isArray(rolesValue)) {
    throw new Error("Supabase principal mapper returned an invalid principal");
  }
  if (isProxy(rolesValue)) {
    throw new Error("Supabase principal mapper returned invalid roles");
  }
  const rolesLength = Object.getOwnPropertyDescriptor(rolesValue, "length")?.value;
  if (
    !Number.isSafeInteger(rolesLength) ||
    (rolesLength as number) < 0 ||
    (rolesLength as number) > 64 ||
    Reflect.ownKeys(rolesValue).length !== (rolesLength as number) + 1
  ) {
    throw new Error("Supabase principal mapper returned invalid roles");
  }
  const roles: string[] = [];
  for (let index = 0; index < (rolesLength as number); index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(rolesValue, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true ||
      typeof descriptor.value !== "string" ||
      descriptor.value.length === 0 ||
      descriptor.value.length > 128
    ) {
      throw new Error("Supabase principal mapper returned invalid roles");
    }
    roles.push(descriptor.value);
  }
  const expectedAuthTime =
    typeof claims.auth_time === "number" ? claims.auth_time : claims.iat;
  if (
    (principalType !== "user" &&
      principalType !== "developer" &&
      principalType !== "operator" &&
      principalType !== "bot") ||
    typeof principalId !== "string" ||
    principalId.length === 0 ||
    principalId.length > 512 ||
    typeof sourceIssuer !== "string" ||
    sourceIssuer !== claims.iss ||
    typeof sourceSubject !== "string" ||
    sourceSubject !== claims.sub ||
    !Number.isSafeInteger(authTime) ||
    authTime !== expectedAuthTime ||
    new Set(roles).size !== roles.length
  ) {
    throw new Error("Supabase principal mapper returned an invalid principal");
  }
  return Object.freeze({
    principal_type: principalType,
    principal_id: principalId,
    roles: Object.freeze([...roles].sort()),
    source_issuer: sourceIssuer,
    source_subject: sourceSubject,
    auth_time: authTime as number,
  });
}

/**
 * Re-establishes immutable authority when a Supabase verifier is supplied via
 * a port rather than constructed by this package.
 */
export function snapshotVerifiedSupabaseIngressV1(
  value: unknown,
): VerifiedSupabaseIngress {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("verified Supabase ingress is invalid");
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).sort().join(",") !== "claims,principal"
  ) {
    throw new Error("verified Supabase ingress is invalid");
  }
  const ownDataValue = (key: "claims" | "principal"): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error("verified Supabase ingress is invalid");
    }
    return descriptor.value;
  };
  const claimsValue = ownDataValue("claims");
  if (
    typeof claimsValue !== "object" ||
    claimsValue === null ||
    Array.isArray(claimsValue)
  ) {
    throw new Error("verified Supabase ingress claims are invalid");
  }
  const claims = snapshotVerifiedJwtJsonV1(
    claimsValue as Readonly<Record<string, unknown>>,
  ) as JWTPayload;
  const principal = snapshotIngressPrincipalV1(
    ownDataValue("principal"),
    claims,
  );
  return Object.freeze({ principal, claims });
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !isProxy(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function sortedStrings(value: unknown): string[] {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string")
  ) {
    return [];
  }
  return [...new Set(value)].sort();
}

export function mapDefaultSupabasePrincipal(
  claims: JWTPayload,
): IngressPrincipalV1 {
  if (
    typeof claims.iss !== "string" ||
    claims.iss.length === 0 ||
    claims.iss.length > 2_048 ||
    typeof claims.sub !== "string" ||
    claims.sub.length === 0 ||
    claims.sub.length > 512 ||
    !Number.isSafeInteger(claims.iat) ||
    (claims.iat as number) < 0
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
  if (
    typeof principalId !== "string" ||
    principalId.length === 0 ||
    principalId.length > 512
  ) {
    throw new AuthError("unauthenticated", "Supabase principal id is invalid");
  }
  const roles = sortedStrings(metadata.roles);
  if (roles.length === 0 && typeof metadata.role === "string") roles.push(metadata.role);
  if (
    roles.length > 64 ||
    roles.some((role) => role.length === 0 || role.length > 128)
  ) {
    throw new AuthError("unauthenticated", "Supabase roles are invalid");
  }
  const authTime =
    typeof claims.auth_time === "number" ? claims.auth_time : claims.iat;
  if (
    typeof authTime !== "number" ||
    !Number.isSafeInteger(authTime) ||
    authTime < 0
  ) {
    throw new AuthError("unauthenticated", "Supabase auth time is invalid");
  }
  return {
    principal_type: principalType,
    principal_id: principalId,
    roles: [...new Set(roles)].sort(),
    source_issuer: claims.iss,
    source_subject: claims.sub,
    auth_time: authTime,
  };
}

/** Verifies public Supabase ingress only; it never returns a downstream token. */
export class SupabaseIngressVerifier {
  readonly #issuer: string;
  readonly #audience: string;
  readonly #getKey: JWTVerifyGetKey;
  readonly #algorithms: readonly AsymmetricJwtAlgorithm[];
  readonly #mapPrincipal: SupabasePrincipalMapper;

  public constructor(options: SupabaseIngressVerifierOptions) {
    const stableOptions = snapshotSupabaseIngressOptionsV1(options);
    let issuer: URL;
    try {
      issuer = new URL(stableOptions.issuer);
    } catch (error) {
      throw new Error("Supabase issuer must be an absolute URL", { cause: error });
    }
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      issuer.hostname,
    );
    if (
      stableOptions.issuer.length > 2_048 ||
      (issuer.protocol !== "https:" &&
        !(issuer.protocol === "http:" && isLoopback)) ||
      issuer.username.length > 0 ||
      issuer.password.length > 0 ||
      issuer.search.length > 0 ||
      issuer.hash.length > 0
    ) {
      throw new Error(
        "Supabase issuer must use HTTPS except for loopback and cannot contain credentials, a query, or a fragment",
      );
    }
    if (
      stableOptions.audience.length === 0 ||
      stableOptions.audience.length > 512 ||
      /\s/.test(stableOptions.audience)
    ) {
      throw new Error("Supabase audience must be a non-empty bounded token");
    }
    this.#issuer = stableOptions.issuer;
    this.#audience = stableOptions.audience;
    this.#getKey = stableOptions.getKey;
    this.#algorithms = normalizeAsymmetricJwtAlgorithms(
      stableOptions.algorithms,
      DEFAULT_SUPABASE_ALGORITHMS,
    );
    this.#mapPrincipal =
      stableOptions.mapPrincipal ?? mapDefaultSupabasePrincipal;
  }

  public async verify(token: string): Promise<VerifiedSupabaseIngress> {
    try {
      assertBoundedCompactJwt(token);
      const header = decodeProtectedHeader(token);
      if (typeof header.kid !== "string" || header.kid.length === 0) {
        throw new AuthError("unauthenticated", "Supabase credential kid is required");
      }
      if (header.typ !== "JWT") {
        throw new AuthError(
          "unauthenticated",
          "Supabase credential typ must be JWT",
        );
      }
      const result = await jwtVerify(token, this.#getKey, {
        issuer: this.#issuer,
        audience: this.#audience,
        algorithms: [...this.#algorithms],
        // Supabase access tokens guarantee issued-at and expiry, but do not
        // include a not-before claim. Requiring nbf here would reject every
        // normal Supabase user credential despite a valid asymmetric signature
        // and matching issuer/audience.
        requiredClaims: ["sub", "iat", "exp"],
      });
      const claims = snapshotVerifiedJwtJsonV1(result.payload);
      const principal = snapshotIngressPrincipalV1(
        this.#mapPrincipal(claims),
        claims,
      );
      return snapshotVerifiedSupabaseIngressV1({ principal, claims });
    } catch (error: unknown) {
      throw asUnauthenticated(error);
    }
  }
}

export interface WorkloadExchangeRequest {
  readonly audience: ServiceIdV1;
  readonly capabilities: readonly string[];
}
