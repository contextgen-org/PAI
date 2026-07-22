import {
  AuthError,
  matchesAuthorizationScope,
  snapshotVerifiedWorkloadCredentialV1,
  type AuthorizationScopeV1,
  type VerifiedWorkloadCredential,
  type WorkloadCredentialVerifierPort,
} from "@pai/auth";
import { SERVICE_IDS, type ServiceIdV1 } from "@pai/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { ServiceError } from "./service-error.js";

export type RequiredScopeResolver = (
  request: FastifyRequest,
) => AuthorizationScopeV1 | Promise<AuthorizationScopeV1>;

export interface InternalRouteAuthPolicy {
  readonly method: string;
  /**
   * Explicitly protected HTTP route. Internal routes remain fail-closed even
   * when no policy is declared; non-internal routes are protected only when
   * they are present in this registry.
   */
  readonly route: `/${string}`;
  readonly requiredCapabilities: readonly string[];
  readonly allowedCallers: readonly ServiceIdV1[];
  readonly requiredScope: AuthorizationScopeV1 | RequiredScopeResolver;
  /** Maps shared auth failures into the route's published response contract. */
  readonly mapAuthError?: (error: AuthError) => ServiceError;
}

export interface WorkloadAuthOptions {
  readonly verifier?: WorkloadCredentialVerifierPort;
  readonly policies?: readonly InternalRouteAuthPolicy[];
}

const authContexts = new WeakMap<object, VerifiedWorkloadCredential>();

export function getWorkloadAuthContext(
  request: FastifyRequest,
): VerifiedWorkloadCredential {
  const context = authContexts.get(request);
  if (context === undefined) {
    throw new Error("workload authentication context is unavailable");
  }
  return context;
}

/** Returns the verified workload identity when authentication completed. */
export function tryGetWorkloadAuthContext(
  request: FastifyRequest,
): VerifiedWorkloadCredential | undefined {
  return authContexts.get(request);
}

function requestRoute(request: FastifyRequest): string | undefined {
  const route = request.routeOptions.url;
  return typeof route === "string" ? route : undefined;
}

function requestPathname(request: FastifyRequest): string | undefined {
  const rawUrl = request.raw.url;
  if (typeof rawUrl !== "string") return undefined;
  const queryStart = rawUrl.indexOf("?");
  return queryStart === -1 ? rawUrl : rawUrl.slice(0, queryStart);
}

function isInternalRoute(route: string): boolean {
  return route === "/internal" || route.startsWith("/internal/");
}

function ownDataRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    requiredKeys.some((key) => !Object.hasOwn(descriptors, key)) ||
    (keys as string[]).some(
      (key) => !requiredKeys.includes(key) && !optionalKeys.includes(key),
    )
  ) {
    return undefined;
  }
  const data = Object.create(null) as Record<string, unknown>;
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      return undefined;
    }
    data[key] = descriptor.value;
  }
  return Object.freeze(data);
}

function snapshotArray(
  value: unknown,
  label: string,
  maxLength: number,
): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(
    descriptors,
    "length",
  )?.value as PropertyDescriptor | undefined;
  const lengthValue = lengthDescriptor?.value as unknown;
  if (
    typeof lengthValue !== "number" ||
    !Number.isSafeInteger(lengthValue) ||
    lengthValue < 0 ||
    lengthValue > maxLength
  ) {
    throw new Error(`${label} is outside the bounded contract`);
  }
  const length = lengthValue;
  const expectedKeys = new Set([
    "length",
    ...Array.from({ length }, (_entry, index) => String(index)),
  ]);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).some((key) => !expectedKeys.has(key)) ||
    keys.length !== expectedKeys.size
  ) {
    throw new Error(`${label} must be a dense own-data array`);
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(`${label} must be a dense own-data array`);
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze(snapshot);
}

function snapshotAuthorizationScope(
  value: unknown,
): AuthorizationScopeV1 | undefined {
  const global = ownDataRecord(value, ["scope_kind"]);
  if (global?.scope_kind === "global") {
    return Object.freeze({ scope_kind: "global" });
  }
  const scope = ownDataRecord(value, [
    "bot_id",
    "deployment_environment",
    "owner_agent_id",
    "release_channel",
    "scope_kind",
    "workspace_id",
  ]);
  const workspaceId = scope?.workspace_id;
  const botId = scope?.bot_id;
  const ownerAgentId = scope?.owner_agent_id;
  const deploymentEnvironment = scope?.deployment_environment;
  const releaseChannel = scope?.release_channel;
  if (
    scope?.scope_kind !== "bot" ||
    typeof workspaceId !== "string" ||
    workspaceId.length === 0 ||
    typeof botId !== "string" ||
    botId.length === 0 ||
    typeof ownerAgentId !== "string" ||
    ownerAgentId.length === 0 ||
    (deploymentEnvironment !== "local" &&
      deploymentEnvironment !== "dev" &&
      deploymentEnvironment !== "staging" &&
      deploymentEnvironment !== "prod") ||
    (releaseChannel !== "stable" && releaseChannel !== "canary")
  ) {
    return undefined;
  }
  return Object.freeze({
    scope_kind: "bot",
    workspace_id: workspaceId,
    bot_id: botId,
    owner_agent_id: ownerAgentId,
    deployment_environment: deploymentEnvironment,
    release_channel: releaseChannel,
  });
}

function snapshotPolicy(
  value: unknown,
): InternalRouteAuthPolicy {
  const policy = ownDataRecord(
    value,
    [
      "allowedCallers",
      "method",
      "requiredCapabilities",
      "requiredScope",
      "route",
    ],
    ["mapAuthError"],
  );
  if (policy === undefined) {
    throw new Error(
      "internal auth policies require a route, capabilities, callers and scope",
    );
  }
  const requiredCapabilities = snapshotArray(
    policy.requiredCapabilities,
    "internal auth capabilities",
    64,
  );
  const allowedCallers = snapshotArray(
    policy.allowedCallers,
    "internal auth callers",
    SERVICE_IDS.length,
  );
  const method = policy.method;
  const route = policy.route;
  const requiredScopeValue = policy.requiredScope;
  const mapAuthError = policy.mapAuthError;
  const validCapabilities = requiredCapabilities.every(
    (capability) =>
      typeof capability === "string" &&
      capability.length <= 128 &&
      /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(capability),
  );
  const validCallers = allowedCallers.every(
    (caller) => typeof caller === "string" && SERVICE_IDS.includes(caller as ServiceIdV1),
  );
  const staticRequiredScope =
    typeof requiredScopeValue === "function"
      ? undefined
      : snapshotAuthorizationScope(requiredScopeValue);
  if (
    typeof method !== "string" ||
    !/^[A-Za-z]+$/.test(method) ||
    typeof route !== "string" ||
    !route.startsWith("/") ||
    requiredCapabilities.length === 0 ||
    new Set(requiredCapabilities).size !== requiredCapabilities.length ||
    !validCapabilities ||
    allowedCallers.length === 0 ||
    new Set(allowedCallers).size !== allowedCallers.length ||
    !validCallers ||
    (typeof requiredScopeValue !== "function" &&
      staticRequiredScope === undefined) ||
    (mapAuthError !== undefined && typeof mapAuthError !== "function")
  ) {
    throw new Error(
      "internal auth policies require a route, capabilities, callers and scope",
    );
  }
  const requiredScope =
    typeof requiredScopeValue === "function"
      ? requiredScopeValue.bind(value)
      : staticRequiredScope!;
  return Object.freeze({
    method,
    route: route as `/${string}`,
    requiredCapabilities: requiredCapabilities as readonly string[],
    allowedCallers: allowedCallers as readonly ServiceIdV1[],
    requiredScope,
    ...(mapAuthError === undefined
      ? {}
      : { mapAuthError: mapAuthError.bind(value) }),
  });
}

function bearerToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") {
    throw new AuthError("unauthenticated", "workload credential is required");
  }
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
    authorization,
  );
  if (match?.[1] === undefined) {
    throw new AuthError("unauthenticated", "workload credential is malformed");
  }
  return match[1];
}

function captureWorkloadVerify(
  verifier: unknown,
): WorkloadCredentialVerifierPort["verify"] | undefined {
  if (verifier === undefined) return undefined;
  if (
    (typeof verifier !== "object" && typeof verifier !== "function") ||
    verifier === null
  ) {
    throw new Error("workload credential verifier is invalid");
  }
  let cursor: object | null = verifier;
  for (let depth = 0; cursor !== null && depth < 16; depth += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(cursor, "verify");
      cursor = Object.getPrototypeOf(cursor);
    } catch {
      throw new Error("workload credential verifier is invalid");
    }
    if (descriptor === undefined) continue;
    if (!("value" in descriptor) || typeof descriptor.value !== "function") {
      throw new Error("workload credential verifier must expose an own-data method");
    }
    return descriptor.value.bind(verifier) as WorkloadCredentialVerifierPort["verify"];
  }
  throw new Error("workload credential verifier is invalid");
}

function assertVerifiedPolicyResult(
  verified: VerifiedWorkloadCredential,
  serviceId: ServiceIdV1,
  policy: InternalRouteAuthPolicy,
  staticScope: AuthorizationScopeV1 | undefined,
): void {
  if (verified.claims.aud !== serviceId) {
    throw new AuthError("unauthenticated", "credential audience was rejected");
  }
  if (!policy.allowedCallers.includes(verified.claims.sub)) {
    throw new AuthError(
      "authorization_denied",
      "caller is not allowed",
      undefined,
      verified,
    );
  }
  const capabilities = new Set(verified.claims.capability);
  if (
    policy.requiredCapabilities.some(
      (capability) => !capabilities.has(capability),
    )
  ) {
    throw new AuthError(
      "capability_denied",
      "required capability is missing",
      undefined,
      verified,
    );
  }
  if (
    staticScope !== undefined &&
    !matchesAuthorizationScope(verified.claims, staticScope)
  ) {
    throw new AuthError(
      "authorization_scope_mismatch",
      "credential scope does not match the resource",
      undefined,
      verified,
    );
  }
}

function toServiceError(
  error: unknown,
  policy?: InternalRouteAuthPolicy,
): ServiceError {
  const authError =
    error instanceof AuthError
      ? error
      : new AuthError("unauthenticated", "credential was rejected", error);
  if (policy?.mapAuthError !== undefined) return policy.mapAuthError(authError);
  const unauthenticated = authError.code === "unauthenticated";
  return new ServiceError({
    code: authError.code,
    message: unauthenticated
      ? "workload authentication failed"
      : "workload authorization failed",
    statusCode: unauthenticated ? 401 : 403,
    retryable: false,
  });
}

export function installWorkloadAuth(
  app: FastifyInstance,
  serviceId: ServiceIdV1,
  options: WorkloadAuthOptions = {},
): void {
  const authOptions = ownDataRecord(options, [], ["policies", "verifier"]);
  if (authOptions === undefined) {
    throw new Error("workload auth options must contain only own data properties");
  }
  const verifier = authOptions.verifier;
  const verifyCredential = captureWorkloadVerify(verifier);
  const policies = new Map<string, InternalRouteAuthPolicy>();
  const configuredPolicies =
    authOptions.policies === undefined
      ? []
      : snapshotArray(authOptions.policies, "internal auth policies", 256);
  for (const configuredPolicy of configuredPolicies) {
    const policy = snapshotPolicy(configuredPolicy);
    const key = `${policy.method.toUpperCase()} ${policy.route}`;
    if (policies.has(key)) throw new Error(`duplicate internal auth policy: ${key}`);
    policies.set(key, policy);
  }

  app.addHook("onRequest", async (request) => {
    const route = requestRoute(request);
    const policy =
      route === undefined
        ? undefined
        : policies.get(`${request.method.toUpperCase()} ${route}`);
    const pathname = requestPathname(request);
    const internalRequest =
      (route !== undefined && isInternalRoute(route)) ||
      (pathname !== undefined && isInternalRoute(pathname));
    if (policy === undefined && !internalRequest) return;
    try {
      const token = bearerToken(request);
      if (policy === undefined) {
        throw new AuthError(
          "authorization_denied",
          "internal route has no declared authorization policy",
        );
      }
      if (verifyCredential === undefined) {
        throw new AuthError("unauthenticated", "workload verifier is unavailable");
      }
      const staticScope =
        typeof policy.requiredScope !== "function"
          ? policy.requiredScope
          : undefined;
      const verified = snapshotVerifiedWorkloadCredentialV1(
        await verifyCredential(token, {
          audience: serviceId,
          requiredCapabilities: policy.requiredCapabilities,
          allowedCallers: policy.allowedCallers,
          ...(staticScope === undefined ? {} : { requiredScope: staticScope }),
        }),
      );
      assertVerifiedPolicyResult(verified, serviceId, policy, staticScope);
      authContexts.set(request, verified);
    } catch (error: unknown) {
      if (
        error instanceof AuthError &&
        error.code !== "unauthenticated" &&
        error.verifiedCredential !== undefined
      ) {
        try {
          authContexts.set(
            request,
            snapshotVerifiedWorkloadCredentialV1(error.verifiedCredential),
          );
        } catch {
          // Malformed caller-owned error context is never retained as authority.
        }
      }
      const serviceError = toServiceError(error, policy);
      request.log.warn(
        {
          event: "workload_auth_rejected",
          service_id: serviceId,
          trace_id: request.id,
          method: request.method,
          route,
          error_code: serviceError.code,
        },
        "workload request rejected",
      );
      throw serviceError;
    }
  });

  app.addHook("preHandler", async (request) => {
    const route = requestRoute(request);
    if (route === undefined) return;
    const policy = policies.get(`${request.method.toUpperCase()} ${route}`);
    if (policy === undefined || typeof policy.requiredScope !== "function") return;
    try {
      const context = getWorkloadAuthContext(request);
      const resolvedScope = await policy.requiredScope(request);
      const requiredScope = snapshotAuthorizationScope(resolvedScope);
      if (requiredScope === undefined) {
        throw new AuthError(
          "authorization_scope_mismatch",
          "resource scope resolver returned an invalid scope",
          undefined,
          context,
        );
      }
      if (!matchesAuthorizationScope(context.claims, requiredScope)) {
        throw new AuthError(
          "authorization_scope_mismatch",
          "credential scope does not match the resource",
          undefined,
          context,
        );
      }
    } catch (error: unknown) {
      const serviceError = toServiceError(error, policy);
      request.log.warn(
        {
          event: "workload_auth_rejected",
          service_id: serviceId,
          trace_id: request.id,
          method: request.method,
          route,
          error_code: serviceError.code,
        },
        "workload request rejected",
      );
      throw serviceError;
    }
  });
}
