import {
  KnowThatCandidateReviewRequestV1Schema,
  KnowThatCandidateReviewResultV1Schema,
  KnowThatLinkageRecoveryV1Schema,
  KnowThatLinkageRecoveryResponseV1Schema,
  KnowThatQueryRequestV1Schema,
  KnowThatQueryResponseV1Schema,
  KnowThatWriteBatchRequestV1Schema,
  KnowThatWriteBatchResponseV1Schema,
  assertCanonicalJsonBoundaryV1,
} from "@pai/contracts";
import {
  createServiceApp,
  getWorkloadAuthContext,
  ServiceError,
  type InternalRouteAuthPolicy,
  type ServiceAppOptions,
} from "@pai/service-kit";

import type { KnowThatApplicationV1 } from "./knowthat-application.v1.js";
import { KnowThatErrorV1, type KnowThatScopeV1 } from "./knowthat-types.v1.js";

export const KNOWTHAT_ROUTES_V1 = Object.freeze({
  writeBatch: "/internal/knowthat/write-batch",
  query: "/v1/knowthat/query",
  candidateReview: "/internal/knowthat/candidates/:id/review",
  linkageRecovery: "/internal/knowthat/linkage-jobs/:id/recover",
} as const);

export interface KnowThatBuildRequirementsV1 {
  readonly require_complete_pipeline?: boolean;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new KnowThatErrorV1(
      "schema_validation_failed",
      "KnowThat request must be an object",
      false,
    );
  }
  return value as Readonly<Record<string, unknown>>;
}

function pathId(value: unknown): string {
  const id = record(value).id;
  if (typeof id !== "string" || id.length === 0) {
    throw new KnowThatErrorV1(
      "schema_validation_failed",
      "KnowThat path id is required",
      false,
    );
  }
  return id;
}

function workloadScope(
  request: Parameters<typeof getWorkloadAuthContext>[0],
) {
  const body = record(request.body);
  const deploymentEnvironment = body.deployment_environment;
  const releaseChannel = body.release_channel;
  if (
    typeof body.workspace_id !== "string" ||
    typeof body.bot_id !== "string" ||
    typeof body.owner_agent_id !== "string" ||
    (deploymentEnvironment !== "local" &&
      deploymentEnvironment !== "dev" &&
      deploymentEnvironment !== "staging" &&
      deploymentEnvironment !== "prod") ||
    (releaseChannel !== "stable" && releaseChannel !== "canary")
  ) {
    throw new KnowThatErrorV1(
      "schema_validation_failed",
      "KnowThat bot scope is invalid",
      false,
    );
  }
  return Object.freeze({
    scope_kind: "bot" as const,
    workspace_id: body.workspace_id,
    bot_id: body.bot_id,
    owner_agent_id: body.owner_agent_id,
    deployment_environment: deploymentEnvironment,
    release_channel: releaseChannel,
  });
}

function principalFingerprint(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): string {
  const claims = getWorkloadAuthContext(request).claims;
  return [
    claims.sub,
    claims.scope_kind,
    claims.scope_kind === "bot" ? claims.workspace_id : "",
    claims.scope_kind === "bot" ? claims.bot_id : "",
    claims.scope_kind === "bot" ? claims.owner_agent_id : "",
    claims.scope_kind === "bot" ? claims.deployment_environment : "",
    claims.scope_kind === "bot" ? claims.release_channel : "",
  ].join("\u0000");
}

function policies(): readonly InternalRouteAuthPolicy[] {
  const policy = (
    route: InternalRouteAuthPolicy["route"],
    capability: string,
    caller: "meta_cognition" | "trigger_processor" | "knowthat",
  ): InternalRouteAuthPolicy =>
    Object.freeze({
      method: "POST",
      route,
      requiredCapabilities: Object.freeze([capability]),
      allowedCallers: Object.freeze([caller]),
      requiredScope: workloadScope,
    });
  return Object.freeze([
    policy(
      KNOWTHAT_ROUTES_V1.writeBatch,
      "knowthat.fact.write",
      "meta_cognition",
    ),
    policy(
      KNOWTHAT_ROUTES_V1.query,
      "knowthat.fact.query",
      "trigger_processor",
    ),
    policy(
      KNOWTHAT_ROUTES_V1.candidateReview,
      "knowthat.candidate.review",
      "meta_cognition",
    ),
    policy(
      KNOWTHAT_ROUTES_V1.linkageRecovery,
      "knowthat.linkage.recover",
      "knowthat",
    ),
  ]);
}

const safeMessageByKnowThatError = Object.freeze({
  schema_validation_failed: "KnowThat request is invalid",
  payload_too_large: "KnowThat payload is too large",
  too_many_items: "KnowThat batch contains too many items",
  item_too_large: "KnowThat item is too large",
  idempotency_conflict: "KnowThat request conflicts with a prior request",
  fact_not_found: "KnowThat fact was not found",
  candidate_not_found: "KnowThat candidate was not found",
  stale_candidate_version: "KnowThat candidate version changed",
  snapshot_expired: "KnowThat snapshot expired",
  invalid_cursor: "KnowThat cursor is invalid",
  scope_mismatch: "KnowThat request scope does not match",
  inbox_drift: "KnowThat inbox identity changed",
  lease_busy: "KnowThat lease is unavailable",
  stale_lease: "KnowThat lease is stale",
  invalid_state: "KnowThat state does not allow this operation",
  pre_promotion_check_unavailable:
    "Memory pre-promotion check is unavailable",
  promotion_reservation_unavailable:
    "Memory promotion reservation is unavailable",
  promotion_retry_required: "KnowThat promotion requires retry",
  promotion_ack_unavailable:
    "Memory promotion acknowledgement is unavailable",
  recovery_conflict: "KnowThat recovery request conflicts",
} as const);

function httpError(error: KnowThatErrorV1): ServiceError {
  const statusCode =
    error.code === "payload_too_large"
      ? 413
      : error.code === "schema_validation_failed" ||
          error.code === "too_many_items" ||
          error.code === "item_too_large"
        ? 422
        : error.code === "fact_not_found" ||
            error.code === "candidate_not_found"
          ? 404
          : error.code === "idempotency_conflict" ||
              error.code === "recovery_conflict" ||
              error.code === "stale_candidate_version" ||
              error.code === "scope_mismatch" ||
              error.code === "inbox_drift" ||
              error.code === "lease_busy" ||
              error.code === "stale_lease" ||
              error.code === "invalid_state"
            ? 409
            : error.code === "snapshot_expired"
              ? 410
              : error.code === "pre_promotion_check_unavailable" ||
                  error.code === "promotion_reservation_unavailable" ||
                  error.code === "promotion_retry_required" ||
                  error.code === "promotion_ack_unavailable"
                ? 503
                : 400;
  return new ServiceError({
    code: error.code,
    message: safeMessageByKnowThatError[error.code],
    statusCode,
    retryable: error.retryable,
    details:
      error.field_path === undefined
        ? {}
        : { field_path: error.field_path },
    cause: error,
  });
}

function inlineFastifySchemaV1(value: unknown): unknown {
  const referencedIds = new Set<string>();
  const collectReferences = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      for (const item of entry) collectReferences(item);
      return;
    }
    if (typeof entry !== "object" || entry === null) return;
    for (const [key, child] of Object.entries(entry)) {
      if (key === "$ref" && typeof child === "string") {
        referencedIds.add(child.replace(/#$/u, ""));
      }
      collectReferences(child);
    }
  };
  collectReferences(value);

  const clone = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(clone);
    if (typeof entry !== "object" || entry === null) return entry;
    return Object.fromEntries(
      Object.entries(entry)
        .filter(
          ([key, child]) =>
            key !== "default" &&
            (key !== "$id" ||
              (typeof child === "string" && referencedIds.has(child))),
        )
        .map(([key, child]) => [key, clone(child)]),
    );
  };
  return clone(value);
}

const objectSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
});

function canonicalPreValidationV1(
  includeParams = false,
): (request: Readonly<{
  body: unknown;
  params: unknown;
}>) => Promise<void> {
  return async (request): Promise<void> => {
    try {
      assertCanonicalJsonBoundaryV1(request.body);
      if (includeParams) {
        assertCanonicalJsonBoundaryV1(request.params);
      }
    } catch {
      throw new KnowThatErrorV1(
        "schema_validation_failed",
        "KnowThat request is not bounded canonical JSON",
        false,
      );
    }
  };
}

export function buildKnowThatApp(
  options: ServiceAppOptions = {},
  application?: KnowThatApplicationV1,
  requirements: KnowThatBuildRequirementsV1 = {},
): ReturnType<typeof createServiceApp> {
  const app = createServiceApp("knowthat", {
    ...options,
    auth: {
      ...(options.auth?.verifier === undefined
        ? {}
        : { verifier: options.auth.verifier }),
      policies:
        application === undefined
          ? options.auth?.policies ?? []
          : [...(options.auth?.policies ?? []), ...policies()],
    },
    readinessChecks: [
      ...(options.readinessChecks ?? []),
      ...(requirements.require_complete_pipeline === true
        ? [
            {
              name: "knowthat_pipeline",
              async check(signal: AbortSignal) {
                if (application === undefined) {
                  throw new Error(
                    "KnowThat pipeline dependencies are not composed",
                  );
                }
                await application.checkReadiness(signal);
              },
            },
          ]
        : []),
    ],
    async errorMapper(error, request) {
      if (error instanceof KnowThatErrorV1) return httpError(error);
      return options.errorMapper?.(error, request);
    },
  });
  if (application === undefined) return app;

  app.post(
    KNOWTHAT_ROUTES_V1.writeBatch,
    {
      bodyLimit: 2_097_152,
      preValidation: canonicalPreValidationV1(),
      schema: {
        body: inlineFastifySchemaV1(KnowThatWriteBatchRequestV1Schema),
        response: {
          200: inlineFastifySchemaV1(KnowThatWriteBatchResponseV1Schema),
        },
      },
    },
    async (request, reply) =>
      reply.code(200).send(await application.writeBatch(request.body)),
  );
  app.post(
    KNOWTHAT_ROUTES_V1.query,
    {
      preValidation: canonicalPreValidationV1(),
      schema: {
        body: inlineFastifySchemaV1(KnowThatQueryRequestV1Schema),
        response: {
          200: inlineFastifySchemaV1(KnowThatQueryResponseV1Schema),
        },
      },
    },
    async (request, reply) =>
      reply
        .code(200)
        .send(
          await application.query(
            request.body,
            principalFingerprint(request),
          ),
        ),
  );
  app.post(
    KNOWTHAT_ROUTES_V1.candidateReview,
    {
      preValidation: canonicalPreValidationV1(true),
      schema: {
        body: inlineFastifySchemaV1(
          KnowThatCandidateReviewRequestV1Schema,
        ),
        response: {
          200: inlineFastifySchemaV1(
            KnowThatCandidateReviewResultV1Schema,
          ),
        },
      },
    },
    async (request, reply) =>
      reply
        .code(200)
        .send(
          await application.reviewCandidate(
            pathId(request.params),
            request.body,
            new AbortController().signal,
          ),
        ),
  );
  app.post(
    KNOWTHAT_ROUTES_V1.linkageRecovery,
    {
      preValidation: canonicalPreValidationV1(true),
      schema: {
        body: inlineFastifySchemaV1(KnowThatLinkageRecoveryV1Schema),
        response: {
          200: inlineFastifySchemaV1(
            KnowThatLinkageRecoveryResponseV1Schema,
          ),
        },
      },
    },
    async (request, reply) =>
      reply
        .code(200)
        .send(
          await application.recoverLinkage(
            pathId(request.params),
            request.body,
          ),
        ),
  );
  return app;
}
