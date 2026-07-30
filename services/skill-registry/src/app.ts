import {
  SKILL_MANAGEMENT_SUCCESS_CODES_V1,
  SkillActivateCommandV1Schema,
  SkillCatalogQueryRequestV1Schema,
  SkillCatalogQueryResponseV1Schema,
  SkillContextCatalogRequestV1Schema,
  SkillContextCatalogResponseV1Schema,
  SkillCandidateApplicationRequestV1Schema,
  SkillCandidateApplicationResponseV1Schema,
  SkillContentRequestV1Schema,
  SkillContentResponseV1Schema,
  SkillDeprecateCommandV1Schema,
  SkillDisableCommandV1Schema,
  SkillManagementCommandEnvelopeV1Schema,
  SkillPermissionGrantCommandV1Schema,
  SkillPermissionRevokeCommandV1Schema,
  SkillPublishRequestV1Schema,
  SkillPublishResponseV1Schema,
  SkillRevokeCommandV1Schema,
  SkillRollbackCommandV1Schema,
  SkillResolveRequestV1Schema,
  SkillResolveResponseV1Schema,
  SkillValidateRequestV1Schema,
  SkillValidateResponseV1Schema,
  type SkillCandidateApplicationRequestV1,
  type SkillContextCatalogRequestV1,
} from "@pai/contracts";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  createServiceApp,
  getWorkloadAuthContext,
  ServiceError,
  type InternalRouteAuthPolicy,
  type ServiceAppOptions,
} from "@pai/service-kit";

import {
  SkillRegistryApplicationErrorV1,
  type SkillActivateRequestV1,
  type SkillCatalogQueryRequestV1,
  type SkillContentRequestV1,
  type SkillDeprecateRequestV1,
  type SkillDisableRequestV1,
  type SkillManagementRequestV1,
  type SkillPermissionGrantRequestV1,
  type SkillPermissionRevokeRequestV1,
  type SkillPublishRequestV1,
  type SkillRegistryApplicationV1,
  type SkillRegistryPrincipalV1,
  type SkillRevokeRequestV1,
  type SkillRollbackRequestV1,
  type SkillResolveRequestV1,
  type SkillRuntimeScopeV1,
  type SkillValidateRequestV1,
} from "./skill-registry-application.v1.js";
import { canonicalJsonV1 } from "./canonical.v1.js";

export const SKILL_REGISTRY_ROUTES_V1 = Object.freeze({
  validate: "/internal/skill-registry/skills/validate",
  publish: "/internal/skill-registry/skills/:name/versions",
  catalog: "/internal/skill-registry/catalog",
  context_catalog: "/internal/skill-registry/context-catalog",
  // find-my-way uses a doubled colon to register the documented literal
  // action separator after a path parameter.
  activate:
    "/internal/skill-registry/skills/:skill_key/activations::activate",
  rollback:
    "/internal/skill-registry/skills/:skill_key/activations::rollback",
  disable:
    "/internal/skill-registry/skills/:skill_key/activations::disable",
  deprecate:
    "/internal/skill-registry/skills/:skill_key/versions/:version_id(^[^:]+)::deprecate",
  revoke:
    "/internal/skill-registry/skills/:skill_key/versions/:version_id(^[^:]+)::revoke",
  permission_grant:
    "/internal/skill-registry/skills/:skill_key/permissions::grant",
  permission_revoke:
    "/internal/skill-registry/skills/:skill_key/permissions::revoke",
  resolve: "/internal/skill-registry/skills/resolve",
  content:
    "/internal/skill-registry/resolutions/:resolution_id/content",
  candidate_application:
    "/internal/skill-registry/candidate-applications",
} as const);

export interface SkillRegistryApplicationsV1 {
  readonly registry?: SkillRegistryApplicationV1;
}

export interface SkillRegistryBuildOptionsV1 {
  readonly require_complete_pipeline?: boolean;
}

const statusByRegistryError = Object.freeze({
  invalid_request: 400,
  invalid_cursor: 400,
  invalid_skill_package: 400,
  package_scan_failed: 422,
  authorization_scope_mismatch: 403,
  invalid_runtime_policy: 400,
  catalog_version_conflict: 409,
  permission_denied: 403,
  version_revoked: 409,
  required_skill_unavailable: 409,
  idempotency_conflict: 409,
  validation_not_found: 404,
  validation_expired: 410,
  validation_already_published: 409,
  content_integrity_mismatch: 409,
  version_not_publishable: 409,
  activation_conflict: 409,
  permission_conflict: 409,
  lifecycle_conflict: 409,
  invalid_state_transition: 409,
  resolution_not_found: 404,
  resolution_expired: 410,
  content_unavailable: 410,
  storage_unavailable: 503,
  registry_unavailable: 503,
} as const);

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SkillRegistryApplicationErrorV1(
      "invalid_request",
      "request body must be an object",
      { field_path: "/" },
    );
  }
  return value as Readonly<Record<string, unknown>>;
}

function pathParameter(params: unknown, name: string): string {
  const value = record(params)[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new SkillRegistryApplicationErrorV1(
      "invalid_request",
      `path parameter ${name} is required`,
      { field_path: `/path/${name}` },
    );
  }
  return value;
}

function contractBody<T>(schema: TSchema, value: unknown): T {
  try {
    canonicalJsonV1(value);
  } catch {
    throw new SkillRegistryApplicationErrorV1(
      "invalid_request",
      "request must be bounded canonical JSON data",
      { field_path: "/" },
    );
  }
  if (!Value.Check(schema, value)) {
    const first = Value.Errors(schema, value).First();
    throw new SkillRegistryApplicationErrorV1(
      "invalid_request",
      first?.message ?? "request does not match the owner contract",
      { field_path: first?.path || "/" },
    );
  }
  return value as T;
}

function contractResponse<T>(schema: TSchema, value: T): T {
  canonicalJsonV1(value);
  if (!Value.Check(schema, value)) {
    throw new Error("Skill Registry produced a response outside its owner contract");
  }
  return value;
}

function publishBody(value: unknown): SkillPublishRequestV1 {
  return contractBody<SkillPublishRequestV1>(
    SkillPublishRequestV1Schema,
    value,
  );
}

function validateBody(value: unknown): SkillValidateRequestV1 {
  return contractBody<SkillValidateRequestV1>(
    SkillValidateRequestV1Schema,
    value,
  );
}

function activateBody(value: unknown): SkillActivateRequestV1 {
  return contractBody<SkillActivateRequestV1>(
    SkillActivateCommandV1Schema,
    value,
  );
}

function rollbackBody(value: unknown): SkillRollbackRequestV1 {
  return contractBody<SkillRollbackRequestV1>(
    SkillRollbackCommandV1Schema,
    value,
  );
}

function disableBody(value: unknown): SkillDisableRequestV1 {
  return contractBody<SkillDisableRequestV1>(
    SkillDisableCommandV1Schema,
    value,
  );
}

function permissionGrantBody(
  value: unknown,
): SkillPermissionGrantRequestV1 {
  return contractBody<SkillPermissionGrantRequestV1>(
    SkillPermissionGrantCommandV1Schema,
    value,
  );
}

function permissionRevokeBody(
  value: unknown,
): SkillPermissionRevokeRequestV1 {
  return contractBody<SkillPermissionRevokeRequestV1>(
    SkillPermissionRevokeCommandV1Schema,
    value,
  );
}

function deprecateBody(value: unknown): SkillDeprecateRequestV1 {
  return contractBody<SkillDeprecateRequestV1>(
    SkillDeprecateCommandV1Schema,
    value,
  );
}

function revokeBody(value: unknown): SkillRevokeRequestV1 {
  return contractBody<SkillRevokeRequestV1>(
    SkillRevokeCommandV1Schema,
    value,
  );
}

function catalogQuery(value: unknown): SkillCatalogQueryRequestV1 {
  const query = record(value);
  const allowedKeys = new Set([
    "schema_version",
    "workspace_id",
    "bot_id",
    "deployment_environment",
    "release_channel",
    "owner_agent_id",
    "as_of",
    "filter",
    "cursor",
    "limit",
    "trace_id",
  ]);
  if (Object.keys(query).some((key) => !allowedKeys.has(key))) {
    throw new SkillRegistryApplicationErrorV1(
      "invalid_request",
      "catalog query contains an unknown field",
      { field_path: "/" },
    );
  }
  for (const [key, entry] of Object.entries(query)) {
    if (typeof entry !== "string") {
      throw new SkillRegistryApplicationErrorV1(
        "invalid_request",
        `catalog query ${key} must occur exactly once`,
        { field_path: `/${key}` },
      );
    }
  }
  const limit =
    typeof query["limit"] === "string" &&
    /^[1-9][0-9]*$/u.test(query["limit"])
      ? Number(query["limit"])
      : Number.NaN;
  const candidate = {
    schema_version:
      query["schema_version"] ?? "skill_catalog_query.v1",
    workspace_id: query["workspace_id"],
    bot_id: query["bot_id"],
    deployment_environment: query["deployment_environment"],
    release_channel: query["release_channel"],
    owner_agent_id: query["owner_agent_id"],
    ...(query["as_of"] === undefined
      ? {}
      : { as_of: query["as_of"] }),
    ...(query["filter"] === undefined
      ? {}
      : { filter: query["filter"] }),
    ...(query["cursor"] === undefined
      ? {}
      : { cursor: query["cursor"] }),
    limit,
    trace_id: query["trace_id"],
  };
  return contractBody<SkillCatalogQueryRequestV1>(
    SkillCatalogQueryRequestV1Schema,
    candidate,
  );
}

function contextCatalogBody(value: unknown): SkillContextCatalogRequestV1 {
  return contractBody<SkillContextCatalogRequestV1>(
    SkillContextCatalogRequestV1Schema,
    value,
  );
}

function resolveBody(value: unknown): SkillResolveRequestV1 {
  return contractBody<SkillResolveRequestV1>(
    SkillResolveRequestV1Schema,
    value,
  );
}

function contentBody(value: unknown): SkillContentRequestV1 {
  return contractBody<SkillContentRequestV1>(
    SkillContentRequestV1Schema,
    value,
  );
}

function candidateApplicationBody(
  value: unknown,
): SkillCandidateApplicationRequestV1 {
  return contractBody<SkillCandidateApplicationRequestV1>(
    SkillCandidateApplicationRequestV1Schema,
    value,
  );
}

function traceId(body: unknown): string {
  const candidate =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Readonly<Record<string, unknown>>)["trace_id"]
      : undefined;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : "trace_unavailable";
}

function principal(
  request: Parameters<typeof getWorkloadAuthContext>[0],
  requireDelegatedReviewer = false,
): SkillRegistryPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind === "global") {
    if (claims.sub !== "skill_registry") {
      throw new SkillRegistryApplicationErrorV1(
        "authorization_scope_mismatch",
        "global registry management requires the registry workload identity",
      );
    }
    return Object.freeze({
      caller: "skill_registry",
      scope: Object.freeze({ scope_kind: "global" }),
      capabilities: Object.freeze([...claims.capability]),
      // JTI identifies one short-lived credential, not the durable workload
      // actor. Idempotency and cursor bindings must survive signed token
      // renewal for the same service identity.
      principal_id: claims.sub,
    });
  }
  if (
    claims.sub !== "skill_registry" &&
    claims.sub !== "action_runtime" &&
    claims.sub !== "meta_cognition" &&
    claims.sub !== "trigger_processor"
  ) {
    throw new SkillRegistryApplicationErrorV1(
      "authorization_scope_mismatch",
      "unsupported Skill Registry workload identity",
    );
  }
  if (
    requireDelegatedReviewer &&
    claims.sub === "meta_cognition" &&
    (claims.delegated_principal === undefined ||
      claims.delegated_principal.scope_kind !== "bot")
  ) {
    throw new SkillRegistryApplicationErrorV1(
      "authorization_scope_mismatch",
      "candidate application requires a signed delegated reviewer",
    );
  }
  return Object.freeze({
    caller: claims.sub,
    scope: Object.freeze({
      scope_kind: "bot",
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    }),
    capabilities: Object.freeze([...claims.capability]),
    principal_id:
      requireDelegatedReviewer &&
      claims.sub === "meta_cognition"
        ? claims.delegated_principal!.principal_id
        : claims.sub,
  });
}

type SkillManagementActorRoleV1 =
  | "registry_release_admin"
  | "security_admin"
  | "workspace_skill_admin";

function managementPrincipal(
  request: Parameters<typeof getWorkloadAuthContext>[0],
  requiredRole: SkillManagementActorRoleV1,
): SkillRegistryPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  const delegated = claims.delegated_principal;
  if (
    claims.sub !== "skill_registry" ||
    delegated === undefined ||
    !delegated.roles.includes(requiredRole) ||
    delegated.scope_kind !== claims.scope_kind
  ) {
    throw new SkillRegistryApplicationErrorV1(
      "authorization_scope_mismatch",
      `management operation requires a signed ${requiredRole} principal`,
    );
  }
  if (claims.scope_kind === "global") {
    if (delegated.scope_kind !== "global") {
      throw new SkillRegistryApplicationErrorV1(
        "authorization_scope_mismatch",
        "global management principal scope does not match the workload",
      );
    }
    return Object.freeze({
      caller: "skill_registry",
      scope: Object.freeze({ scope_kind: "global" }),
      capabilities: Object.freeze([...claims.capability]),
      principal_id: delegated.principal_id,
    });
  }
  if (
    delegated.scope_kind !== "bot" ||
    delegated.workspace_id !== claims.workspace_id ||
    delegated.bot_id !== claims.bot_id ||
    delegated.owner_agent_id !== claims.owner_agent_id ||
    delegated.deployment_environment !==
      claims.deployment_environment ||
    delegated.release_channel !== claims.release_channel
  ) {
    throw new SkillRegistryApplicationErrorV1(
      "authorization_scope_mismatch",
      "scoped management principal does not match the signed workload scope",
    );
  }
  return Object.freeze({
    caller: "skill_registry",
    scope: Object.freeze({
      scope_kind: "bot",
      workspace_id: delegated.workspace_id,
      bot_id: delegated.bot_id,
      owner_agent_id: delegated.owner_agent_id,
      deployment_environment:
        delegated.deployment_environment,
      release_channel: delegated.release_channel,
    }),
    capabilities: Object.freeze([...claims.capability]),
    principal_id: delegated.principal_id,
  });
}

function requiredBotScope(
  request: Parameters<typeof getWorkloadAuthContext>[0],
) {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new SkillRegistryApplicationErrorV1(
      "authorization_scope_mismatch",
      "runtime operation requires a bot-scoped workload",
    );
  }
  const body = record(request.body);
  const value: SkillRuntimeScopeV1 = {
    workspace_id: String(body["workspace_id"] ?? ""),
    bot_id: String(body["bot_id"] ?? ""),
    owner_agent_id:
      typeof body["owner_agent_id"] === "string"
        ? body["owner_agent_id"]
        : claims.owner_agent_id,
    deployment_environment: body[
      "deployment_environment"
    ] as SkillRuntimeScopeV1["deployment_environment"],
    release_channel: body[
      "release_channel"
    ] as SkillRuntimeScopeV1["release_channel"],
  };
  return { scope_kind: "bot" as const, ...value };
}

function requiredCatalogScope(
  request: Parameters<typeof getWorkloadAuthContext>[0],
) {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new SkillRegistryApplicationErrorV1(
      "authorization_scope_mismatch",
      "catalog management requires a bot-scoped workload",
    );
  }
  const body = record(request.body);
  return {
    scope_kind: "bot" as const,
    workspace_id: String(body["workspace_id"] ?? ""),
    bot_id: String(body["bot_id"] ?? ""),
    owner_agent_id: claims.owner_agent_id,
    deployment_environment: body[
      "deployment_environment"
    ] as SkillRuntimeScopeV1["deployment_environment"],
    release_channel: body[
      "release_channel"
    ] as SkillRuntimeScopeV1["release_channel"],
  };
}

function requiredCatalogQueryScope(
  request: Parameters<typeof getWorkloadAuthContext>[0],
) {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new SkillRegistryApplicationErrorV1(
      "authorization_scope_mismatch",
      "catalog query requires a bot-scoped workload",
    );
  }
  const query = record(request.query);
  return {
    scope_kind: "bot" as const,
    workspace_id: String(query["workspace_id"] ?? ""),
    bot_id: String(query["bot_id"] ?? ""),
    owner_agent_id: String(query["owner_agent_id"] ?? ""),
    deployment_environment: query[
      "deployment_environment"
    ] as SkillRuntimeScopeV1["deployment_environment"],
    release_channel: query[
      "release_channel"
    ] as SkillRuntimeScopeV1["release_channel"],
  };
}

const routePolicies = Object.freeze([
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.validate,
    requiredCapabilities: ["skill.package.validate"],
    allowedCallers: ["skill_registry"],
    requiredScope: { scope_kind: "global" },
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.publish,
    requiredCapabilities: ["skill.version.publish"],
    allowedCallers: ["skill_registry"],
    requiredScope: { scope_kind: "global" },
  },
  {
    method: "GET",
    route: SKILL_REGISTRY_ROUTES_V1.catalog,
    requiredCapabilities: ["skill.catalog.read"],
    allowedCallers: ["trigger_processor", "meta_cognition"],
    requiredScope: requiredCatalogQueryScope,
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.context_catalog,
    requiredCapabilities: ["skill.context_catalog.read"],
    allowedCallers: ["trigger_processor"],
    requiredScope: requiredBotScope,
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.activate,
    requiredCapabilities: ["skill.version.activate"],
    allowedCallers: ["skill_registry"],
    requiredScope: requiredCatalogScope,
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.rollback,
    requiredCapabilities: ["skill.version.rollback"],
    allowedCallers: ["skill_registry"],
    requiredScope: requiredCatalogScope,
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.disable,
    requiredCapabilities: ["skill.activation.disable"],
    allowedCallers: ["skill_registry"],
    requiredScope: requiredCatalogScope,
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.permission_grant,
    requiredCapabilities: ["skill.permission.grant"],
    allowedCallers: ["skill_registry"],
    requiredScope: requiredCatalogScope,
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.permission_revoke,
    requiredCapabilities: ["skill.permission.revoke"],
    allowedCallers: ["skill_registry"],
    requiredScope: requiredCatalogScope,
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.deprecate,
    requiredCapabilities: ["skill.version.deprecate"],
    allowedCallers: ["skill_registry"],
    requiredScope: { scope_kind: "global" },
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.revoke,
    requiredCapabilities: ["skill.version.revoke"],
    allowedCallers: ["skill_registry"],
    requiredScope: { scope_kind: "global" },
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.resolve,
    requiredCapabilities: ["skill.resolve"],
    allowedCallers: ["action_runtime"],
    requiredScope: requiredBotScope,
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.content,
    requiredCapabilities: ["skill.content.read"],
    allowedCallers: ["action_runtime"],
    requiredScope: requiredBotScope,
  },
  {
    method: "POST",
    route: SKILL_REGISTRY_ROUTES_V1.candidate_application,
    requiredCapabilities: ["skill.candidate.apply"],
    allowedCallers: ["meta_cognition"],
    requiredScope: requiredBotScope,
  },
] as const satisfies readonly InternalRouteAuthPolicy[]);

function successEnvelope(
  code: string,
  message: string,
  details: unknown,
  requestBody: unknown,
) {
  return Object.freeze({
    code,
    message,
    retryable: false,
    details,
    trace_id: traceId(requestBody),
  });
}

function managementSuccessEnvelope(
  request: SkillManagementRequestV1,
  details: unknown,
) {
  const code = SKILL_MANAGEMENT_SUCCESS_CODES_V1[request.operation];
  return contractResponse(
    SkillManagementCommandEnvelopeV1Schema,
    successEnvelope(
      code,
      `skill management ${request.operation} completed`,
      details,
      request,
    ),
  );
}

export function buildSkillRegistryApp(
  options: ServiceAppOptions = {},
  applications: SkillRegistryApplicationsV1 = {},
  buildOptions: SkillRegistryBuildOptionsV1 = {},
): ReturnType<typeof createServiceApp> {
  const registry = applications.registry;
  const existingErrorMapper = options.errorMapper;
  const app = createServiceApp("skill_registry", {
    ...options,
    auth: {
      ...(options.auth?.verifier === undefined
        ? {}
        : { verifier: options.auth.verifier }),
      policies:
        registry === undefined
          ? options.auth?.policies ?? []
          : [...(options.auth?.policies ?? []), ...routePolicies],
    },
    errorMapper: async (error, request) => {
      if (
        error instanceof ServiceError &&
        error.code === "invalid_canonical_json"
      ) {
        return new ServiceError({
          code: "invalid_request",
          message:
            "request violates the bounded canonical JSON contract",
          statusCode: 400,
          retryable: false,
          details: { field_path: "/" },
          cause: error,
        });
      }
      if (error instanceof SkillRegistryApplicationErrorV1) {
        return new ServiceError({
          code: error.code,
          message: error.message,
          statusCode: statusByRegistryError[error.code],
          retryable: error.retryable,
          details: error.details,
          cause: error,
        });
      }
      return existingErrorMapper?.(error, request);
    },
    readinessChecks: [
      ...(options.readinessChecks ?? []),
      ...(buildOptions.require_complete_pipeline === true
        ? [
            {
              name: "skill_registry_application",
              async check() {
                if (registry === undefined) {
                  throw new Error(
                    "Skill Registry application and durable adapters are not composed",
                  );
                }
                await registry.checkReadiness();
              },
            },
          ]
        : []),
    ],
  });

  if (registry === undefined) return app;

  app.post(SKILL_REGISTRY_ROUTES_V1.validate, async (request, reply) => {
    const body = validateBody(request.body);
    const result = await registry.validate(principal(request), body);
    const response = contractResponse(
      SkillValidateResponseV1Schema,
      successEnvelope(
        "skill_package_validated",
        "skill package validated",
        result,
        body,
      ),
    );
    return reply.code(200).send(response);
  });

  app.get(SKILL_REGISTRY_ROUTES_V1.catalog, async (request, reply) => {
    const query = catalogQuery(request.query);
    const result = await registry.queryCatalog(
      principal(request),
      query,
    );
    const response = contractResponse(
      SkillCatalogQueryResponseV1Schema,
      successEnvelope(
        "skill_catalog_found",
        "skill catalog found",
        result,
        query,
      ),
    );
    return reply.code(200).send(response);
  });

  app.post(
    SKILL_REGISTRY_ROUTES_V1.context_catalog,
    async (request, reply) => {
      const body = contextCatalogBody(request.body);
      const result = await registry.readContextCatalog(
        principal(request),
        body,
      );
      const response = contractResponse(
        SkillContextCatalogResponseV1Schema,
        successEnvelope(
          "skill_context_catalog_found",
          "skill context catalog found",
          result,
          body,
        ),
      );
      return reply.code(200).send(response);
    },
  );

  app.post(
    SKILL_REGISTRY_ROUTES_V1.candidate_application,
    async (request, reply) => {
      const body = candidateApplicationBody(request.body);
      const result = await registry.applyCandidate(
        principal(request, true),
        body,
      );
      const response = contractResponse(
        SkillCandidateApplicationResponseV1Schema,
        successEnvelope(
          "skill_candidate_application_updated",
          "skill candidate application updated",
          result,
          body,
        ),
      );
      return reply.code(200).send(response);
    },
  );

  app.post(SKILL_REGISTRY_ROUTES_V1.publish, async (request, reply) => {
    const body = publishBody(request.body);
    const result = await registry.publish(
      principal(request),
      pathParameter(request.params, "name"),
      body,
    );
    const response = contractResponse(
      SkillPublishResponseV1Schema,
      successEnvelope(
        "skill_version_published",
        "skill version published",
        result,
        body,
      ),
    );
    return reply
      .code(201)
      .send(response);
  });

  app.post(SKILL_REGISTRY_ROUTES_V1.activate, async (request, reply) => {
    const body = activateBody(request.body);
    const result = await registry.activate(
      managementPrincipal(request, "registry_release_admin"),
      pathParameter(request.params, "skill_key"),
      body,
    );
    return reply
      .code(200)
      .send(managementSuccessEnvelope(body, result));
  });

  app.post(SKILL_REGISTRY_ROUTES_V1.rollback, async (request, reply) => {
    const body = rollbackBody(request.body);
    const result = await registry.rollback(
      managementPrincipal(request, "registry_release_admin"),
      pathParameter(request.params, "skill_key"),
      body,
    );
    return reply
      .code(200)
      .send(managementSuccessEnvelope(body, result));
  });

  app.post(SKILL_REGISTRY_ROUTES_V1.disable, async (request, reply) => {
    const body = disableBody(request.body);
    const result = await registry.disable(
      managementPrincipal(request, "registry_release_admin"),
      pathParameter(request.params, "skill_key"),
      body,
    );
    return reply
      .code(200)
      .send(managementSuccessEnvelope(body, result));
  });

  app.post(
    SKILL_REGISTRY_ROUTES_V1.permission_grant,
    async (request, reply) => {
      const body = permissionGrantBody(request.body);
      const result = await registry.grantPermission(
        managementPrincipal(request, "workspace_skill_admin"),
        pathParameter(request.params, "skill_key"),
        body,
      );
      return reply
        .code(200)
        .send(managementSuccessEnvelope(body, result));
    },
  );

  app.post(
    SKILL_REGISTRY_ROUTES_V1.permission_revoke,
    async (request, reply) => {
      const body = permissionRevokeBody(request.body);
      const result = await registry.revokePermission(
        managementPrincipal(request, "workspace_skill_admin"),
        pathParameter(request.params, "skill_key"),
        body,
      );
      return reply
        .code(200)
        .send(managementSuccessEnvelope(body, result));
    },
  );

  app.post(SKILL_REGISTRY_ROUTES_V1.deprecate, async (request, reply) => {
    const body = deprecateBody(request.body);
    const result = await registry.deprecate(
      managementPrincipal(request, "registry_release_admin"),
      pathParameter(request.params, "skill_key"),
      pathParameter(request.params, "version_id"),
      body,
    );
    return reply
      .code(200)
      .send(managementSuccessEnvelope(body, result));
  });

  app.post(SKILL_REGISTRY_ROUTES_V1.revoke, async (request, reply) => {
    const body = revokeBody(request.body);
    const result = await registry.revoke(
      managementPrincipal(request, "security_admin"),
      pathParameter(request.params, "skill_key"),
      pathParameter(request.params, "version_id"),
      body,
    );
    return reply
      .code(200)
      .send(managementSuccessEnvelope(body, result));
  });

  app.post(SKILL_REGISTRY_ROUTES_V1.resolve, async (request, reply) => {
    const body = resolveBody(request.body);
    const result = await registry.resolve(principal(request), body);
    const response = contractResponse(
      SkillResolveResponseV1Schema,
      successEnvelope(
        "skill_resolution_succeeded",
        "skills resolved",
        result,
        body,
      ),
    );
    return reply
      .code(200)
      .send(response);
  });

  app.post(SKILL_REGISTRY_ROUTES_V1.content, async (request, reply) => {
    const body = contentBody(request.body);
    const result = await registry.getContent(
      principal(request),
      pathParameter(request.params, "resolution_id"),
      body,
    );
    const response = contractResponse(
      SkillContentResponseV1Schema,
      successEnvelope(
        "skill_content_authorized",
        "skill content issued",
        result,
        body,
      ),
    );
    return reply
      .code(200)
      .send(response);
  });

  return app;
}
