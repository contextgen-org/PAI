import {
  type DelegatedPrincipalContextV1,
  type ServiceIdV1,
  type WorkloadCredentialClaimsV1,
  validateWorkloadCredentialClaimsV1,
} from "@pai/contracts";
import {
  decodeProtectedHeader,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type KeyObject,
  type JWTVerifyGetKey,
} from "jose";
import { randomUUID } from "node:crypto";

import { AuthError, asUnauthenticated } from "./errors.js";

export type WorkloadSigningKey = CryptoKey | KeyObject | Uint8Array;

export interface BotAuthorizationScopeV1 {
  readonly scope_kind: "bot";
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
}

export interface GlobalAuthorizationScopeV1 {
  readonly scope_kind: "global";
}

export type AuthorizationScopeV1 =
  | BotAuthorizationScopeV1
  | GlobalAuthorizationScopeV1;

export interface WorkloadVerificationRequirements {
  readonly audience: ServiceIdV1;
  readonly requiredCapabilities: readonly string[];
  readonly allowedCallers?: readonly ServiceIdV1[];
  readonly requiredScope?: AuthorizationScopeV1;
}

export interface VerifiedWorkloadCredential {
  readonly claims: WorkloadCredentialClaimsV1;
  readonly protectedHeader: Readonly<{ alg?: string; kid?: string; typ?: string }>;
}

export interface WorkloadCredentialVerifierPort {
  verify(
    token: string,
    requirements: WorkloadVerificationRequirements,
  ): Promise<VerifiedWorkloadCredential>;
}

export interface WorkloadJwtVerifierOptions {
  readonly getKey: JWTVerifyGetKey;
  readonly algorithms?: readonly string[];
  readonly clockToleranceSeconds?: number;
}

const DEFAULT_ALGORITHMS = ["EdDSA", "ES256", "RS256"] as const;

export function matchesAuthorizationScope(
  claims: WorkloadCredentialClaimsV1,
  required: AuthorizationScopeV1,
): boolean {
  if (claims.scope_kind !== required.scope_kind) return false;
  if (claims.scope_kind === "global" || required.scope_kind === "global") {
    return claims.scope_kind === required.scope_kind;
  }
  return (
    claims.workspace_id === required.workspace_id &&
    claims.bot_id === required.bot_id &&
    claims.owner_agent_id === required.owner_agent_id &&
    claims.deployment_environment === required.deployment_environment &&
    claims.release_channel === required.release_channel
  );
}

export class WorkloadJwtVerifier implements WorkloadCredentialVerifierPort {
  readonly #getKey: JWTVerifyGetKey;
  readonly #algorithms: readonly string[];
  readonly #clockToleranceSeconds: number;

  public constructor(options: WorkloadJwtVerifierOptions) {
    this.#getKey = options.getKey;
    this.#algorithms = options.algorithms ?? DEFAULT_ALGORITHMS;
    this.#clockToleranceSeconds = options.clockToleranceSeconds ?? 0;
  }

  public async verify(
    token: string,
    requirements: WorkloadVerificationRequirements,
  ): Promise<VerifiedWorkloadCredential> {
    try {
      const unverifiedHeader = decodeProtectedHeader(token);
      if (typeof unverifiedHeader.kid !== "string" || unverifiedHeader.kid.length === 0) {
        throw new AuthError("unauthenticated", "credential kid is required");
      }
      const result = await jwtVerify(token, this.#getKey, {
        issuer: "pai-workload",
        audience: requirements.audience,
        algorithms: [...this.#algorithms],
        clockTolerance: this.#clockToleranceSeconds,
        maxTokenAge: 300,
      });
      const validated = validateWorkloadCredentialClaimsV1(result.payload);
      if (!validated.ok) {
        throw new AuthError("unauthenticated", "credential claims were rejected");
      }
      const claims = validated.value;
      if (claims.aud !== requirements.audience) {
        throw new AuthError("unauthenticated", "credential audience was rejected");
      }
      if (
        requirements.allowedCallers !== undefined &&
        !requirements.allowedCallers.includes(claims.sub)
      ) {
        throw new AuthError("authorization_denied", "caller is not allowed");
      }
      const capabilities = new Set(claims.capability);
      if (
        requirements.requiredCapabilities.some(
          (capability) => !capabilities.has(capability),
        )
      ) {
        throw new AuthError("capability_denied", "required capability is missing");
      }
      if (
        requirements.requiredScope !== undefined &&
        !matchesAuthorizationScope(claims, requirements.requiredScope)
      ) {
        throw new AuthError(
          "authorization_scope_mismatch",
          "credential scope does not match the resource",
        );
      }
      return { claims, protectedHeader: result.protectedHeader };
    } catch (error: unknown) {
      throw asUnauthenticated(error);
    }
  }
}

export interface SignWorkloadCredentialInput {
  readonly audience: ServiceIdV1;
  readonly capabilities: readonly string[];
  readonly scope: AuthorizationScopeV1;
  readonly delegatedPrincipal?: DelegatedPrincipalContextV1;
  readonly ttlSeconds?: number;
  readonly notBeforeSeconds?: number;
  readonly jti?: string;
}

export interface WorkloadCredentialSignerPort {
  sign(input: SignWorkloadCredentialInput): Promise<string>;
}

export interface WorkloadJwtSignerOptions {
  readonly subject: ServiceIdV1;
  readonly privateKey: WorkloadSigningKey;
  readonly keyId: string;
  readonly algorithm: "EdDSA" | "ES256" | "RS256";
  readonly now?: () => number;
}

function unicodeCodePointCompare(left: string, right: string): number {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (value) => value.codePointAt(0) ?? 0);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

export class WorkloadJwtSigner implements WorkloadCredentialSignerPort {
  readonly #subject: ServiceIdV1;
  readonly #privateKey: WorkloadSigningKey;
  readonly #keyId: string;
  readonly #algorithm: "EdDSA" | "ES256" | "RS256";
  readonly #now: () => number;

  public constructor(options: WorkloadJwtSignerOptions) {
    if (options.keyId.length === 0) throw new Error("workload signing kid is required");
    this.#subject = options.subject;
    this.#privateKey = options.privateKey;
    this.#keyId = options.keyId;
    this.#algorithm = options.algorithm;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1_000));
  }

  public async sign(input: SignWorkloadCredentialInput): Promise<string> {
    const ttlSeconds = input.ttlSeconds ?? 60;
    const notBeforeSeconds = input.notBeforeSeconds ?? 0;
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) {
      throw new Error("workload credential TTL must be an integer from 1 to 300 seconds");
    }
    if (!Number.isInteger(notBeforeSeconds) || notBeforeSeconds < 0 || notBeforeSeconds >= ttlSeconds) {
      throw new Error("notBeforeSeconds must be a non-negative integer below the TTL");
    }
    const capability = [...new Set(input.capabilities)].sort(unicodeCodePointCompare);
    if (capability.length === 0) throw new Error("at least one capability is required");
    const iat = this.#now();
    const claims = {
      iss: "pai-workload",
      sub: this.#subject,
      aud: input.audience,
      jti: input.jti ?? randomUUID(),
      iat,
      nbf: iat + notBeforeSeconds,
      exp: iat + ttlSeconds,
      capability,
      ...input.scope,
      ...(input.delegatedPrincipal === undefined
        ? {}
        : { delegated_principal: input.delegatedPrincipal }),
    };
    const validated = validateWorkloadCredentialClaimsV1(claims);
    if (!validated.ok) throw new Error("workload credential claims violate the shared contract");
    return new SignJWT(validated.value)
      .setProtectedHeader({ alg: this.#algorithm, kid: this.#keyId, typ: "JWT" })
      .sign(this.#privateKey);
  }
}
