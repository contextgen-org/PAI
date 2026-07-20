import {
  AuthError,
  matchesAuthorizationScope,
  type AuthorizationScopeV1,
  type VerifiedWorkloadCredential,
  type WorkloadCredentialVerifierPort,
} from "@pai/auth";
import type { ServiceIdV1 } from "@pai/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { ServiceError } from "./service-error.js";

export type RequiredScopeResolver = (
  request: FastifyRequest,
) => AuthorizationScopeV1 | Promise<AuthorizationScopeV1>;

export interface InternalRouteAuthPolicy {
  readonly method: string;
  readonly route: `/internal/${string}`;
  readonly requiredCapabilities: readonly string[];
  readonly allowedCallers: readonly ServiceIdV1[];
  readonly requiredScope: AuthorizationScopeV1 | RequiredScopeResolver;
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

function internalRoute(request: FastifyRequest): string | undefined {
  const route = request.routeOptions.url;
  return typeof route === "string" && route.startsWith("/internal/")
    ? route
    : undefined;
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

function toServiceError(error: unknown): ServiceError {
  const authError =
    error instanceof AuthError
      ? error
      : new AuthError("unauthenticated", "credential was rejected", error);
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
  const policies = new Map<string, InternalRouteAuthPolicy>();
  for (const policy of options.policies ?? []) {
    const uniqueCapabilities = new Set(policy.requiredCapabilities);
    const uniqueCallers = new Set(policy.allowedCallers);
    if (
      !policy.route.startsWith("/internal/") ||
      policy.requiredCapabilities.length === 0 ||
      policy.allowedCallers.length === 0 ||
      uniqueCapabilities.size !== policy.requiredCapabilities.length ||
      uniqueCallers.size !== policy.allowedCallers.length ||
      policy.requiredCapabilities.some(
        (capability) =>
          !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(capability),
      ) ||
      !/^[A-Za-z]+$/.test(policy.method)
    ) {
      throw new Error(
        "internal auth policies require a route, capabilities, callers and scope",
      );
    }
    const key = `${policy.method.toUpperCase()} ${policy.route}`;
    if (policies.has(key)) throw new Error(`duplicate internal auth policy: ${key}`);
    policies.set(key, policy);
  }

  app.addHook("onRequest", async (request) => {
    const route = internalRoute(request);
    if (route === undefined) return;
    try {
      const token = bearerToken(request);
      const policy = policies.get(`${request.method.toUpperCase()} ${route}`);
      if (policy === undefined) {
        throw new AuthError(
          "authorization_denied",
          "internal route has no declared authorization policy",
        );
      }
      if (options.verifier === undefined) {
        throw new AuthError("unauthenticated", "workload verifier is unavailable");
      }
      const staticScope =
        typeof policy.requiredScope !== "function"
          ? policy.requiredScope
          : undefined;
      const verified = await options.verifier.verify(token, {
        audience: serviceId,
        requiredCapabilities: policy.requiredCapabilities,
        allowedCallers: policy.allowedCallers,
        ...(staticScope === undefined ? {} : { requiredScope: staticScope }),
      });
      authContexts.set(request, verified);
    } catch (error: unknown) {
      const serviceError = toServiceError(error);
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
    const route = internalRoute(request);
    if (route === undefined) return;
    const policy = policies.get(`${request.method.toUpperCase()} ${route}`);
    if (policy === undefined || typeof policy.requiredScope !== "function") return;
    try {
      const context = getWorkloadAuthContext(request);
      const requiredScope = await policy.requiredScope(request);
      if (!matchesAuthorizationScope(context.claims, requiredScope)) {
        throw new AuthError(
          "authorization_scope_mismatch",
          "credential scope does not match the resource",
        );
      }
    } catch (error: unknown) {
      const serviceError = toServiceError(error);
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
