import {
  SERVICE_IDS,
  type DelegatedPrincipalContextV1,
  type ServiceIdV1,
  type WorkloadCredentialClaimsV1,
  validateWorkloadCredentialClaimsV1,
} from "@pai/contracts";
import {
  decodeProtectedHeader,
  jwtVerify,
  SignJWT,
  type CryptoKey as JoseCryptoKey,
  type JWTVerifyGetKey,
} from "jose";
import { KeyObject, randomUUID } from "node:crypto";
import { isProxy } from "node:util/types";

import { AuthError, asUnauthenticated } from "./errors.js";
import {
  assertBoundedCompactJwt,
  normalizeAsymmetricJwtAlgorithms,
  normalizeJwtClockToleranceSeconds,
  snapshotVerifiedJwtJsonV1,
  type AsymmetricJwtAlgorithm,
} from "./jwt-policy.js";

/**
 * Converts the portable single-line representation used by dotenv files into
 * a PEM value accepted by Node's crypto APIs. Existing PEM newlines remain
 * untouched.
 */
export function normalizePrivateKeyPemEnvironmentValueV1(value: string): string {
  return value.replaceAll("\\n", "\n");
}

export type WorkloadSigningKey = JoseCryptoKey | KeyObject;

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
  readonly algorithms?: readonly AsymmetricJwtAlgorithm[];
  readonly clockToleranceSeconds?: number;
}

const DEFAULT_ALGORITHMS = ["EdDSA", "ES256", "RS256"] as const;
const workloadSignerAlgorithms = new Set<string>(DEFAULT_ALGORITHMS);
const workloadServiceIds = new Set<string>(SERVICE_IDS);
const workloadKeyIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const workloadJtiPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const workloadCapabilityPattern =
  /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const MAX_WORKLOAD_CAPABILITIES = 64;
const MAX_WORKLOAD_CAPABILITY_LENGTH = 128;
const MAX_WORKLOAD_EPOCH_SECONDS = 253_402_300_799;

function ownDataOptionsV1(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  label: string,
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error(`${label} are invalid`);
  }
  const snapshot: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowedKeys.has(key)) {
      throw new Error(`${label} are invalid`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(`${label} are invalid`);
    }
    Object.defineProperty(snapshot, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(snapshot);
}

function snapshotWorkloadVerifierOptionsV1(
  value: unknown,
): WorkloadJwtVerifierOptions {
  const snapshot = ownDataOptionsV1(
    value,
    new Set(["algorithms", "clockToleranceSeconds", "getKey"]),
    "workload JWT verifier options",
  );
  if (
    typeof snapshot.getKey !== "function" ||
    isProxy(snapshot.getKey) ||
    (snapshot.algorithms !== undefined && !Array.isArray(snapshot.algorithms)) ||
    (snapshot.algorithms !== undefined && isProxy(snapshot.algorithms)) ||
    (snapshot.clockToleranceSeconds !== undefined &&
      typeof snapshot.clockToleranceSeconds !== "number")
  ) {
    throw new Error("workload JWT verifier options are invalid");
  }
  return Object.freeze({
    getKey: snapshot.getKey as JWTVerifyGetKey,
    ...(snapshot.algorithms === undefined
      ? {}
      : {
          algorithms:
            snapshot.algorithms as readonly AsymmetricJwtAlgorithm[],
        }),
    ...(snapshot.clockToleranceSeconds === undefined
      ? {}
      : { clockToleranceSeconds: snapshot.clockToleranceSeconds }),
  });
}

function snapshotWorkloadSignerOptionsV1(
  value: unknown,
): WorkloadJwtSignerOptions {
  const snapshot = ownDataOptionsV1(
    value,
    new Set(["algorithm", "keyId", "now", "privateKey", "subject"]),
    "workload signing options",
  );
  if (
    typeof snapshot.subject !== "string" ||
    typeof snapshot.keyId !== "string" ||
    typeof snapshot.algorithm !== "string" ||
    snapshot.privateKey === undefined ||
    (snapshot.now !== undefined &&
      (typeof snapshot.now !== "function" || isProxy(snapshot.now)))
  ) {
    throw new Error("workload signing options are invalid");
  }
  return Object.freeze({
    subject: snapshot.subject as ServiceIdV1,
    privateKey: snapshot.privateKey as WorkloadSigningKey,
    keyId: snapshot.keyId,
    algorithm: snapshot.algorithm as WorkloadJwtSignerOptions["algorithm"],
    ...(snapshot.now === undefined
      ? {}
      : { now: snapshot.now as () => number }),
  });
}

function snapshotStringArrayV1(
  value: unknown,
  label: string,
  options: Readonly<{
    maxLength: number;
    predicate: (entry: string) => boolean;
  }>,
): readonly string[] {
  if (
    typeof value !== "object" ||
    value === null ||
    isProxy(value) ||
    !Array.isArray(value)
  ) {
    throw new Error(`${label} must be an array`);
  }
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  const ownKeys = Reflect.ownKeys(value);
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > options.maxLength ||
    ownKeys.length !== (length as number) + 1 ||
    ownKeys.some((key) => {
      if (key === "length") return false;
      if (typeof key !== "string") return true;
      const index = Number(key);
      return (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= (length as number) ||
        String(index) !== key
      );
    })
  ) {
    throw new Error(`${label} is outside the bounded contract`);
  }
  const snapshot: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      !options.predicate(descriptor.value)
    ) {
      throw new Error(`${label} contains an invalid entry`);
    }
    snapshot.push(descriptor.value);
  }
  if (new Set(snapshot).size !== snapshot.length) {
    throw new Error(`${label} changed or contains duplicates`);
  }
  return Object.freeze(snapshot);
}

function snapshotWorkloadVerificationRequirementsV1(
  value: unknown,
): WorkloadVerificationRequirements {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("workload verification requirements are invalid");
  }
  const allowedKeys = new Set([
    "allowedCallers",
    "audience",
    "requiredCapabilities",
    "requiredScope",
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new Error("workload verification requirements are invalid");
  }
  const record = value as Readonly<Record<string, unknown>>;
  const ownDataValue = (key: string, required: boolean): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor === undefined) {
      if (required) {
        throw new Error(`workload verification ${key} is required`);
      }
      return undefined;
    }
    if (!("value" in descriptor) || descriptor.value === undefined) {
      throw new Error(`workload verification ${key} must be an own data value`);
    }
    return descriptor.value;
  };
  const audience = ownDataValue("audience", true);
  if (typeof audience !== "string" || !workloadServiceIds.has(audience)) {
    throw new Error("workload verification audience is invalid");
  }
  const requiredCapabilities = snapshotStringArrayV1(
    ownDataValue("requiredCapabilities", true),
    "workload required capabilities",
    {
      maxLength: MAX_WORKLOAD_CAPABILITIES,
      predicate: (entry) =>
        entry.length <= MAX_WORKLOAD_CAPABILITY_LENGTH &&
        workloadCapabilityPattern.test(entry),
    },
  );
  const allowedCallersValue = ownDataValue("allowedCallers", false);
  const allowedCallers =
    allowedCallersValue === undefined
      ? undefined
      : snapshotStringArrayV1(
          allowedCallersValue,
          "workload allowed callers",
          {
            maxLength: SERVICE_IDS.length,
            predicate: (entry) => workloadServiceIds.has(entry),
          },
        ) as readonly ServiceIdV1[];
  const requiredScopeValue = ownDataValue("requiredScope", false);
  const requiredScope =
    requiredScopeValue === undefined
      ? undefined
      : Object.freeze(exactAuthorizationScopeV1(requiredScopeValue));
  return Object.freeze({
    audience: audience as ServiceIdV1,
    requiredCapabilities,
    ...(allowedCallers === undefined ? {} : { allowedCallers }),
    ...(requiredScope === undefined ? {} : { requiredScope }),
  });
}

function isPrivateWorkloadSigningKey(value: unknown): value is WorkloadSigningKey {
  if (value instanceof KeyObject) return value.type === "private";
  return (
    value instanceof globalThis.CryptoKey &&
    value.type === "private" &&
    value.usages.includes("sign")
  );
}

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
  readonly #algorithms: readonly AsymmetricJwtAlgorithm[];
  readonly #clockToleranceSeconds: number;

  public constructor(options: WorkloadJwtVerifierOptions) {
    const stableOptions = snapshotWorkloadVerifierOptionsV1(options);
    if (
      typeof stableOptions.getKey !== "function"
    ) {
      throw new Error("workload JWT verifier options are invalid");
    }
    this.#getKey = stableOptions.getKey;
    this.#algorithms = normalizeAsymmetricJwtAlgorithms(
      stableOptions.algorithms,
      DEFAULT_ALGORITHMS,
    );
    this.#clockToleranceSeconds = normalizeJwtClockToleranceSeconds(
      stableOptions.clockToleranceSeconds,
    );
  }

  public async verify(
    token: string,
    requirements: WorkloadVerificationRequirements,
  ): Promise<VerifiedWorkloadCredential> {
    let verifiedCredential: VerifiedWorkloadCredential;
    let verifiedRequirements: WorkloadVerificationRequirements;
    try {
      // Authorization requirements are part of the cryptographic decision.
      // Capture them before key lookup so a caller cannot loosen callers,
      // capabilities, or scope while an asynchronous verifier is in flight.
      verifiedRequirements = snapshotWorkloadVerificationRequirementsV1(
        requirements,
      );
      assertBoundedCompactJwt(token);
      const unverifiedHeader = decodeProtectedHeader(token);
      if (
        typeof unverifiedHeader.kid !== "string" ||
        !workloadKeyIdPattern.test(unverifiedHeader.kid)
      ) {
        throw new AuthError("unauthenticated", "credential kid is required");
      }
      if (unverifiedHeader.typ !== "JWT") {
        throw new AuthError("unauthenticated", "credential typ must be JWT");
      }
      const result = await jwtVerify(token, this.#getKey, {
        issuer: "pai-workload",
        audience: verifiedRequirements.audience,
        algorithms: [...this.#algorithms],
        clockTolerance: this.#clockToleranceSeconds,
        maxTokenAge: 300,
      });
      const validated = validateWorkloadCredentialClaimsV1(result.payload);
      if (!validated.ok) {
        throw new AuthError("unauthenticated", "credential claims were rejected");
      }
      const claims = snapshotValidatedWorkloadClaimsV1(validated.value);
      if (claims.aud !== verifiedRequirements.audience) {
        throw new AuthError("unauthenticated", "credential audience was rejected");
      }
      verifiedCredential = Object.freeze({
        claims,
        protectedHeader: Object.freeze({
          alg: result.protectedHeader.alg,
          kid: unverifiedHeader.kid,
          typ: "JWT",
        }),
      });
    } catch (error: unknown) {
      throw asUnauthenticated(error);
    }

    const { claims } = verifiedCredential;
    if (
      verifiedRequirements.allowedCallers !== undefined &&
      !verifiedRequirements.allowedCallers.includes(claims.sub)
    ) {
      throw new AuthError(
        "authorization_denied",
        "caller is not allowed",
        undefined,
        verifiedCredential,
      );
    }
    const capabilities = new Set(claims.capability);
    if (
      verifiedRequirements.requiredCapabilities.some(
        (capability) => !capabilities.has(capability),
      )
    ) {
      throw new AuthError(
        "capability_denied",
        "required capability is missing",
        undefined,
        verifiedCredential,
      );
    }
    if (
      verifiedRequirements.requiredScope !== undefined &&
      !matchesAuthorizationScope(claims, verifiedRequirements.requiredScope)
    ) {
      throw new AuthError(
        "authorization_scope_mismatch",
        "credential scope does not match the resource",
        undefined,
        verifiedCredential,
      );
    }
    return verifiedCredential;
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

function exactAuthorizationScopeV1(value: unknown): AuthorizationScopeV1 {
  const prototype =
    typeof value === "object" && value !== null && !isProxy(value)
      ? Object.getPrototypeOf(value)
      : undefined;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (prototype !== Object.prototype && prototype !== null)
  ) {
    throw new Error("workload authorization scope is invalid");
  }
  const scope = value as Readonly<Record<string, unknown>>;
  const dataValue = (key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(scope, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new Error("workload authorization scope is invalid");
    }
    return descriptor.value;
  };
  const scopeKind = dataValue("scope_kind");
  const ownKeys = Reflect.ownKeys(scope);
  if (
    scopeKind === "global" &&
    ownKeys.length === 1 &&
    ownKeys[0] === "scope_kind"
  ) {
    return { scope_kind: "global" };
  }
  const botKeys = [
    "bot_id",
    "deployment_environment",
    "owner_agent_id",
    "release_channel",
    "scope_kind",
    "workspace_id",
  ];
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    (ownKeys as string[]).sort().join(",") !== botKeys.join(",")
  ) {
    throw new Error("workload authorization scope is invalid");
  }
  const workspaceId = dataValue("workspace_id");
  const botId = dataValue("bot_id");
  const ownerAgentId = dataValue("owner_agent_id");
  const deploymentEnvironment = dataValue("deployment_environment");
  const releaseChannel = dataValue("release_channel");
  if (
    scopeKind !== "bot" ||
    typeof workspaceId !== "string" ||
    workspaceId.length === 0 ||
    workspaceId.length > 512 ||
    typeof botId !== "string" ||
    botId.length === 0 ||
    botId.length > 512 ||
    typeof ownerAgentId !== "string" ||
    ownerAgentId.length === 0 ||
    ownerAgentId.length > 512 ||
    (deploymentEnvironment !== "local" &&
      deploymentEnvironment !== "dev" &&
      deploymentEnvironment !== "staging" &&
      deploymentEnvironment !== "prod") ||
    (releaseChannel !== "stable" && releaseChannel !== "canary")
  ) {
    throw new Error("workload authorization scope is invalid");
  }
  return {
    scope_kind: "bot",
    workspace_id: workspaceId,
    bot_id: botId,
    owner_agent_id: ownerAgentId,
    deployment_environment: deploymentEnvironment,
    release_channel: releaseChannel,
  };
}

function snapshotDelegatedPrincipalV1(
  value: unknown,
): DelegatedPrincipalContextV1 {
  const prototype =
    typeof value === "object" && value !== null && !isProxy(value)
      ? Object.getPrototypeOf(value)
      : undefined;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    isProxy(value) ||
    (prototype !== Object.prototype && prototype !== null)
  ) {
    throw new Error("delegated principal is invalid");
  }
  const record = value as Readonly<Record<string, unknown>>;
  const dataValue = (key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error("delegated principal must use own data properties");
    }
    return descriptor.value;
  };
  const scopeKind = dataValue("scope_kind");
  const globalKeys = [
    "auth_time",
    "principal_id",
    "principal_type",
    "roles",
    "scope_kind",
    "source_issuer",
    "source_subject",
  ];
  const botKeys = [
    "auth_time",
    "bot_id",
    "deployment_environment",
    "owner_agent_id",
    "principal_id",
    "principal_type",
    "release_channel",
    "roles",
    "scope_kind",
    "source_issuer",
    "source_subject",
    "workspace_id",
  ];
  const ownKeys = Reflect.ownKeys(record);
  const expectedKeys = scopeKind === "global" ? globalKeys : botKeys;
  if (
    (scopeKind !== "global" && scopeKind !== "bot") ||
    ownKeys.some((key) => typeof key !== "string") ||
    (ownKeys as string[]).sort().join(",") !== expectedKeys.join(",")
  ) {
    throw new Error("delegated principal has an invalid shape");
  }
  const principalType = dataValue("principal_type");
  const principalId = dataValue("principal_id");
  const sourceIssuer = dataValue("source_issuer");
  const sourceSubject = dataValue("source_subject");
  const authTime = dataValue("auth_time");
  const roles = snapshotStringArrayV1(
    dataValue("roles"),
    "delegated principal roles",
    {
      maxLength: 64,
      predicate: (role) => role.length > 0 && role.length <= 128,
    },
  );
  if (
    (principalType !== "user" &&
      principalType !== "developer" &&
      principalType !== "operator") ||
    typeof principalId !== "string" ||
    principalId.length === 0 ||
    principalId.length > 512 ||
    typeof sourceIssuer !== "string" ||
    sourceIssuer.length === 0 ||
    sourceIssuer.length > 2_048 ||
    typeof sourceSubject !== "string" ||
    sourceSubject.length === 0 ||
    sourceSubject.length > 512 ||
    !Number.isSafeInteger(authTime) ||
    (authTime as number) < 0 ||
    (authTime as number) > MAX_WORKLOAD_EPOCH_SECONDS ||
    roles.some(
      (role, index) =>
        index > 0 && unicodeCodePointCompare(roles[index - 1]!, role) >= 0,
    )
  ) {
    throw new Error("delegated principal is invalid");
  }
  const base = {
    principal_type: principalType,
    principal_id: principalId,
    roles,
    source_issuer: sourceIssuer,
    source_subject: sourceSubject,
    auth_time: authTime as number,
  } as const;
  if (scopeKind === "global") {
    return Object.freeze({ ...base, scope_kind: "global" }) as unknown as DelegatedPrincipalContextV1;
  }
  const scope = exactAuthorizationScopeV1({
    scope_kind: "bot",
    workspace_id: dataValue("workspace_id"),
    bot_id: dataValue("bot_id"),
    owner_agent_id: dataValue("owner_agent_id"),
    deployment_environment: dataValue("deployment_environment"),
    release_channel: dataValue("release_channel"),
  });
  if (scope.scope_kind !== "bot") {
    throw new Error("delegated principal scope is invalid");
  }
  return Object.freeze({ ...base, ...scope }) as unknown as DelegatedPrincipalContextV1;
}

function snapshotValidatedWorkloadClaimsV1(
  claims: WorkloadCredentialClaimsV1,
): WorkloadCredentialClaimsV1 {
  const capability = snapshotStringArrayV1(
    claims.capability,
    "workload credential capabilities",
    {
      maxLength: MAX_WORKLOAD_CAPABILITIES,
      predicate: (entry) =>
        entry.length <= MAX_WORKLOAD_CAPABILITY_LENGTH &&
        workloadCapabilityPattern.test(entry),
    },
  );
  if (
    !workloadJtiPattern.test(claims.jti) ||
    !Number.isSafeInteger(claims.iat) ||
    !Number.isSafeInteger(claims.nbf) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.iat > MAX_WORKLOAD_EPOCH_SECONDS ||
    claims.nbf > MAX_WORKLOAD_EPOCH_SECONDS ||
    claims.exp > MAX_WORKLOAD_EPOCH_SECONDS
  ) {
    throw new Error("workload credential claims exceed runtime bounds");
  }
  const scope = exactAuthorizationScopeV1(
    claims.scope_kind === "global"
      ? { scope_kind: "global" }
      : {
          scope_kind: "bot",
          workspace_id: claims.workspace_id,
          bot_id: claims.bot_id,
          owner_agent_id: claims.owner_agent_id,
          deployment_environment: claims.deployment_environment,
          release_channel: claims.release_channel,
        },
  );
  const delegatedPrincipal =
    claims.delegated_principal === undefined
      ? undefined
      : snapshotDelegatedPrincipalV1(claims.delegated_principal);
  return Object.freeze({
    iss: "pai-workload",
    sub: claims.sub,
    aud: claims.aud,
    jti: claims.jti,
    iat: claims.iat,
    nbf: claims.nbf,
    exp: claims.exp,
    capability,
    ...scope,
    ...(delegatedPrincipal === undefined
      ? {}
      : { delegated_principal: delegatedPrincipal }),
  }) as WorkloadCredentialClaimsV1;
}

/**
 * Re-establishes the immutable credential boundary when a verifier port is
 * supplied by composition code. Consumers must not retain caller-owned claims
 * across a later resource-scope authorization await.
 */
export function snapshotVerifiedWorkloadCredentialV1(
  value: unknown,
): VerifiedWorkloadCredential {
  const credential = ownDataOptionsV1(
    value,
    new Set(["claims", "protectedHeader"]),
    "verified workload credential",
  );
  if (
    Object.keys(credential).sort().join(",") !== "claims,protectedHeader" ||
    typeof credential.claims !== "object" ||
    credential.claims === null ||
    Array.isArray(credential.claims)
  ) {
    throw new Error("verified workload credential is invalid");
  }
  const claimsJson = snapshotVerifiedJwtJsonV1(
    credential.claims as Readonly<Record<string, unknown>>,
  );
  const validated = validateWorkloadCredentialClaimsV1(claimsJson);
  if (!validated.ok) {
    throw new Error("verified workload credential claims are invalid");
  }
  const claims = snapshotValidatedWorkloadClaimsV1(validated.value);
  const protectedHeader = ownDataOptionsV1(
    credential.protectedHeader,
    new Set(["alg", "kid", "typ"]),
    "verified workload protected header",
  );
  const alg = protectedHeader.alg;
  const kid = protectedHeader.kid;
  const typ = protectedHeader.typ;
  if (
    typeof alg !== "string" ||
    !workloadSignerAlgorithms.has(alg) ||
    typeof kid !== "string" ||
    !workloadKeyIdPattern.test(kid) ||
    (typ !== undefined && typ !== "JWT")
  ) {
    throw new Error("verified workload protected header is invalid");
  }
  return Object.freeze({
    claims,
    protectedHeader: Object.freeze({
      alg,
      kid,
      ...(typ === undefined ? {} : { typ: "JWT" }),
    }),
  });
}

export class WorkloadJwtSigner implements WorkloadCredentialSignerPort {
  readonly #subject: ServiceIdV1;
  readonly #privateKey: WorkloadSigningKey;
  readonly #keyId: string;
  readonly #algorithm: "EdDSA" | "ES256" | "RS256";
  readonly #now: () => number;

  public constructor(options: WorkloadJwtSignerOptions) {
    const stableOptions = snapshotWorkloadSignerOptionsV1(options);
    if (
      !workloadServiceIds.has(stableOptions.subject) ||
      !isPrivateWorkloadSigningKey(stableOptions.privateKey) ||
      !workloadSignerAlgorithms.has(stableOptions.algorithm) ||
      !workloadKeyIdPattern.test(stableOptions.keyId) ||
      (stableOptions.now !== undefined && typeof stableOptions.now !== "function")
    ) {
      throw new Error("workload signing options are invalid");
    }
    this.#subject = stableOptions.subject;
    this.#privateKey = stableOptions.privateKey;
    this.#keyId = stableOptions.keyId;
    this.#algorithm = stableOptions.algorithm;
    this.#now = stableOptions.now ?? (() => Math.floor(Date.now() / 1_000));
  }

  public async sign(input: SignWorkloadCredentialInput): Promise<string> {
    const stableInput = ownDataOptionsV1(
      input,
      new Set([
        "audience",
        "capabilities",
        "delegatedPrincipal",
        "jti",
        "notBeforeSeconds",
        "scope",
        "ttlSeconds",
      ]),
      "workload credential input",
    );
    const ttlSecondsValue = stableInput.ttlSeconds ?? 60;
    const notBeforeSecondsValue = stableInput.notBeforeSeconds ?? 0;
    if (
      typeof ttlSecondsValue !== "number" ||
      !Number.isInteger(ttlSecondsValue) ||
      ttlSecondsValue < 1 ||
      ttlSecondsValue > 300
    ) {
      throw new Error("workload credential TTL must be an integer from 1 to 300 seconds");
    }
    if (
      typeof notBeforeSecondsValue !== "number" ||
      !Number.isInteger(notBeforeSecondsValue) ||
      notBeforeSecondsValue < 0 ||
      notBeforeSecondsValue >= ttlSecondsValue
    ) {
      throw new Error("notBeforeSeconds must be a non-negative integer below the TTL");
    }
    const ttlSeconds = ttlSecondsValue;
    const notBeforeSeconds = notBeforeSecondsValue;
    if (
      typeof stableInput.audience !== "string" ||
      !workloadServiceIds.has(stableInput.audience)
    ) {
      throw new Error("workload credential audience is invalid");
    }
    let capabilities: readonly string[];
    try {
      capabilities = snapshotStringArrayV1(
        stableInput.capabilities,
        "workload credential capabilities",
        {
          maxLength: MAX_WORKLOAD_CAPABILITIES,
          predicate: (capability) =>
            capability.length <= MAX_WORKLOAD_CAPABILITY_LENGTH &&
            workloadCapabilityPattern.test(capability),
        },
      );
    } catch (error) {
      throw new Error(
        "workload capabilities must contain from 1 to 64 bounded capability names",
        { cause: error },
      );
    }
    if (
      capabilities.length < 1
    ) {
      throw new Error(
        "workload capabilities must contain from 1 to 64 bounded capability names",
      );
    }
    if (
      stableInput.jti !== undefined &&
      (typeof stableInput.jti !== "string" ||
        !workloadJtiPattern.test(stableInput.jti))
    ) {
      throw new Error("workload credential jti is invalid");
    }
    const scope = exactAuthorizationScopeV1(stableInput.scope);
    const capability = [...capabilities].sort(unicodeCodePointCompare);
    const delegatedPrincipal =
      stableInput.delegatedPrincipal === undefined
        ? undefined
        : snapshotDelegatedPrincipalV1(stableInput.delegatedPrincipal);
    const iat = this.#now();
    if (
      !Number.isSafeInteger(iat) ||
      iat < 0 ||
      iat > MAX_WORKLOAD_EPOCH_SECONDS
    ) {
      throw new Error("workload signing clock must return a bounded epoch second");
    }
    const claims = {
      iss: "pai-workload",
      sub: this.#subject,
      aud: stableInput.audience,
      jti: (stableInput.jti as string | undefined) ?? randomUUID(),
      iat,
      nbf: iat + notBeforeSeconds,
      exp: iat + ttlSeconds,
      capability,
      ...scope,
      ...(delegatedPrincipal === undefined
        ? {}
        : { delegated_principal: delegatedPrincipal }),
    };
    const validated = validateWorkloadCredentialClaimsV1(claims);
    if (!validated.ok) throw new Error("workload credential claims violate the shared contract");
    const immutableClaims = snapshotValidatedWorkloadClaimsV1(validated.value);
    const token = await new SignJWT(immutableClaims)
      .setProtectedHeader({ alg: this.#algorithm, kid: this.#keyId, typ: "JWT" })
      .sign(this.#privateKey);
    assertBoundedCompactJwt(token);
    return token;
  }
}
