import {
  createServiceApp,
  getWorkloadAuthContext,
  ServiceError,
  type InternalRouteAuthPolicy,
  type ServiceAppOptions,
} from "@pai/service-kit";
import {
  MetaFeedbackAnswerRequestV1Schema,
  MetaFeedbackAnswerResponseV1Schema,
  MetaFeedbackRequestSuggestionRequestV1Schema,
  MetaFeedbackRequestSuggestionResponseV1Schema,
  MetaFeedbackRequestListResponseV1Schema,
  MetaCommandClaimRequestV1Schema,
  MetaCommandClaimResponseV1Schema,
  MetaCommandSettlementRequestV1Schema,
  MetaCommandSettlementResponseV1Schema,
  MetaExperienceQueryResponseV1Schema,
  MetaJobCreateRequestV1Schema,
  MetaJobCreateResponseV1Schema,
  MetaJobQueryDetailsV1Schema,
  MetaResultAuditQueryResponseV1Schema,
  MetaSkillCandidateReviewRequestV1Schema,
  MetaSkillCandidateReviewResponseV1Schema,
  MetaSnapshotRepairRequestV1Schema,
  MetaSnapshotRepairResponseV1Schema,
  QualitySignalListDetailsV1Schema,
} from "@pai/contracts";

import { assertBoundedMetaJsonV1 } from "./canonical.v1.js";
import type { MetaJobApplicationV1 } from "./meta-job-application.v1.js";
import {
  MetaFeedbackSuggestionErrorV1,
  type MetaFeedbackSuggestionApplicationV1,
  type MetaFeedbackSuggestionPrincipalV1,
} from "./meta-feedback-suggestion.v1.js";
import {
  MetaOwnerOperationsErrorV1,
  type MetaOperationsPrincipalV1,
  type MetaOwnerOperationsApplicationV1,
} from "./meta-owner-operations.v1.js";
import {
  MetaQueryErrorV1,
  type MetaQueryApplicationV1,
  type MetaQueryPrincipalV1,
} from "./meta-query.v1.js";
import { MetaCognitionErrorV1 } from "./meta-types.v1.js";

export const META_JOB_CREATE_ROUTE_V1 = "/internal/meta/jobs" as const;
export const META_JOB_QUERY_ROUTE_V1 = "/v1/meta/jobs/:id" as const;
export const META_QUALITY_SIGNAL_QUERY_ROUTE_V1 =
  "/v1/trigger-processes/:id/quality-signals" as const;
export const META_EXPERIENCE_QUERY_ROUTE_V1 =
  "/v1/trigger-processes/:id/experience" as const;
export const META_RESULT_AUDIT_QUERY_ROUTE_V1 =
  "/internal/meta/results/:id/audit" as const;
export const META_SNAPSHOT_REPAIR_ROUTE_V1 =
  "/internal/meta/jobs/:id/snapshot-repair" as const;
export const META_FEEDBACK_ANSWER_ROUTE_V1 =
  "/internal/meta/feedback-requests/:id/answer" as const;
export const META_FEEDBACK_LIST_ROUTE_V1 =
  "/internal/meta/feedback-requests" as const;
export const META_FEEDBACK_SUGGESTION_ROUTE_V1 =
  "/internal/meta/feedback-request-suggestions" as const;
export const META_SKILL_CANDIDATE_REVIEW_ROUTE_V1 =
  "/internal/meta/skill-candidates/:id/review" as const;
export const META_COMMAND_CLAIM_ROUTE_V1 =
  "/internal/meta/commands/claim" as const;
export const META_COMMAND_SETTLE_ROUTE_V1 =
  "/internal/meta/commands/:id/settle" as const;

export interface MetaCognitionBuildRequirementsV1 {
  /** Require the durable job runner, but not the optional operator/query APIs. */
  readonly require_job_pipeline?: boolean;
  readonly require_complete_pipeline?: boolean;
}

function requestScope(request: { readonly body?: unknown }) {
  if (
    typeof request.body !== "object" ||
    request.body === null ||
    Array.isArray(request.body)
  ) {
    throw new ServiceError({
      code: "invalid_request",
      message: "Meta job request body is invalid",
      statusCode: 400,
      retryable: false,
      details: {},
    });
  }
  const body = request.body as Readonly<Record<string, unknown>>;
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
    throw new ServiceError({
      code: "invalid_request",
      message: "Meta job bot scope is invalid",
      statusCode: 400,
      retryable: false,
      details: {},
    });
  }
  return {
    scope_kind: "bot" as const,
    workspace_id: body.workspace_id,
    bot_id: body.bot_id,
    owner_agent_id: body.owner_agent_id,
    deployment_environment: deploymentEnvironment,
    release_channel: releaseChannel,
  } as const;
}

const createPolicy = Object.freeze({
  method: "POST",
  route: META_JOB_CREATE_ROUTE_V1,
  requiredCapabilities: ["meta.job.create"],
  allowedCallers: ["trigger_processor"],
  requiredScope: requestScope,
} satisfies InternalRouteAuthPolicy);

function queryScope(
  request: Parameters<typeof getWorkloadAuthContext>[0],
) {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new ServiceError({
      code: "authorization_scope_mismatch",
      message: "Meta owner routes require bot-scoped authority",
      statusCode: 403,
      retryable: false,
      details: {},
    });
  }
  return {
    scope_kind: "bot" as const,
    workspace_id: claims.workspace_id,
    bot_id: claims.bot_id,
    owner_agent_id: claims.owner_agent_id,
    deployment_environment: claims.deployment_environment,
    release_channel: claims.release_channel,
  };
}

function queryPrincipal(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): MetaQueryPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (
    claims.sub !== "observation_gateway" ||
    claims.scope_kind !== "bot" ||
    claims.delegated_principal === undefined ||
    claims.delegated_principal.scope_kind !== "bot" ||
    claims.delegated_principal.workspace_id !== claims.workspace_id ||
    claims.delegated_principal.bot_id !== claims.bot_id ||
    claims.delegated_principal.owner_agent_id !== claims.owner_agent_id ||
    claims.delegated_principal.deployment_environment !==
      claims.deployment_environment ||
    claims.delegated_principal.release_channel !== claims.release_channel
  ) {
    throw new MetaQueryErrorV1("authorization_denied");
  }
  return {
    workload_service: "observation_gateway",
    delegated_principal: claims.delegated_principal,
    scope: {
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    },
  };
}

function operationsPrincipal(
  request: Parameters<typeof getWorkloadAuthContext>[0],
  requireDelegatedPrincipal = false,
): MetaOperationsPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (
    claims.scope_kind !== "bot" ||
    (claims.sub !== "trigger_processor" &&
      claims.sub !== "meta_cognition" &&
      claims.sub !== "observation_gateway")
  ) {
    throw new MetaOwnerOperationsErrorV1(
      "authorization_scope_mismatch",
    );
  }
  const delegated = claims.delegated_principal;
  if (
    delegated !== undefined &&
    (delegated.scope_kind !== "bot" ||
      delegated.workspace_id !== claims.workspace_id ||
      delegated.bot_id !== claims.bot_id ||
      delegated.owner_agent_id !== claims.owner_agent_id ||
      delegated.deployment_environment !==
        claims.deployment_environment ||
      delegated.release_channel !== claims.release_channel)
  ) {
    throw new MetaOwnerOperationsErrorV1(
      "authorization_scope_mismatch",
      "delegated principal scope mismatch",
    );
  }
  if (requireDelegatedPrincipal && delegated === undefined) {
    throw new MetaOwnerOperationsErrorV1(
      "authorization_scope_mismatch",
      "a scope-bound delegated reviewer is required",
    );
  }
  return Object.freeze({
    caller: claims.sub,
    capabilities: Object.freeze([...claims.capability]),
    principal_id: requireDelegatedPrincipal
      ? delegated!.principal_id
      // JTI is a one-token replay identifier. Durable command leases must be
      // owned by the signed workload identity so a renewed credential can
      // settle work claimed by the same scoped Meta worker.
      : claims.sub,
    scope: Object.freeze({
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    }),
  });
}

function requestTraceId(request: {
  readonly headers: Readonly<Record<string, unknown>>;
  readonly id: string;
}): string {
  const supplied = request.headers["x-trace-id"];
  return typeof supplied === "string" && supplied.length > 0
    ? supplied
    : request.id;
}

const queryPolicies = Object.freeze([
  {
    method: "GET",
    route: META_JOB_QUERY_ROUTE_V1,
    requiredCapabilities: ["meta.job.read"],
    allowedCallers: ["observation_gateway"],
    requiredScope: queryScope,
  },
  {
    method: "GET",
    route: META_QUALITY_SIGNAL_QUERY_ROUTE_V1,
    requiredCapabilities: ["meta.quality_signals.read"],
    allowedCallers: ["observation_gateway"],
    requiredScope: queryScope,
  },
  {
    method: "GET",
    route: META_EXPERIENCE_QUERY_ROUTE_V1,
    requiredCapabilities: ["meta.experience.read"],
    allowedCallers: ["observation_gateway"],
    requiredScope: queryScope,
  },
  {
    method: "GET",
    route: META_RESULT_AUDIT_QUERY_ROUTE_V1,
    requiredCapabilities: ["meta.result_audit.read"],
    allowedCallers: ["observation_gateway"],
    requiredScope: queryScope,
  },
] as const satisfies readonly InternalRouteAuthPolicy[]);

const operationsPolicies = Object.freeze([
  {
    method: "POST",
    route: META_SNAPSHOT_REPAIR_ROUTE_V1,
    requiredCapabilities: ["meta.snapshot_repair"],
    allowedCallers: ["trigger_processor"],
    requiredScope: queryScope,
  },
  {
    method: "POST",
    route: META_FEEDBACK_ANSWER_ROUTE_V1,
    requiredCapabilities: ["meta.feedback.answer"],
    allowedCallers: ["trigger_processor"],
    requiredScope: queryScope,
  },
  {
    method: "GET",
    route: META_FEEDBACK_LIST_ROUTE_V1,
    requiredCapabilities: ["meta.feedback_requests.read"],
    allowedCallers: ["observation_gateway"],
    requiredScope: queryScope,
  },
  {
    method: "POST",
    route: META_SKILL_CANDIDATE_REVIEW_ROUTE_V1,
    requiredCapabilities: ["meta.skill_candidate.review"],
    allowedCallers: ["meta_cognition"],
    requiredScope: queryScope,
  },
  {
    method: "POST",
    route: META_COMMAND_CLAIM_ROUTE_V1,
    requiredCapabilities: ["meta.command.dispatch"],
    allowedCallers: ["meta_cognition"],
    requiredScope: queryScope,
  },
  {
    method: "POST",
    route: META_COMMAND_SETTLE_ROUTE_V1,
    requiredCapabilities: ["meta.command.dispatch"],
    allowedCallers: ["meta_cognition"],
    requiredScope: queryScope,
  },
] as const satisfies readonly InternalRouteAuthPolicy[]);

const feedbackSuggestionPolicy = Object.freeze({
  method: "POST",
  route: META_FEEDBACK_SUGGESTION_ROUTE_V1,
  requiredCapabilities: ["meta.feedback_request_suggestion.create"],
  allowedCallers: ["memory", "timer_trigger_app"],
  requiredScope: requestScope,
} satisfies InternalRouteAuthPolicy);

function feedbackSuggestionPrincipal(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): MetaFeedbackSuggestionPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (
    claims.scope_kind !== "bot" ||
    (claims.sub !== "memory" && claims.sub !== "timer_trigger_app")
  ) {
    throw new MetaFeedbackSuggestionErrorV1(
      "authorization_scope_mismatch",
    );
  }
  return Object.freeze({
    caller: claims.sub,
    capabilities: Object.freeze([...claims.capability]),
    scope: Object.freeze({
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    }),
  });
}

function metaHttpError(error: MetaCognitionErrorV1): ServiceError {
  const statusCode =
    error.code === "authorization_scope_mismatch"
      ? 403
      : error.code === "invalid_request"
      ? 400
      : error.code === "idempotency_conflict"
        ? 409
        : error.retryable
          ? 503
          : 422;
  return new ServiceError({
    code: error.code,
    message: error.message,
    statusCode,
    retryable: error.retryable,
    details: {},
    cause: error,
  });
}

function metaQueryHttpError(error: MetaQueryErrorV1): ServiceError {
  const statusCode =
    error.code === "authorization_denied"
      ? 403
      : error.code === "meta_job_not_found" ||
          error.code === "trigger_process_not_found" ||
          error.code === "meta_result_not_found"
        ? 404
        : error.code === "owner_contract_drift"
          ? 503
          : 400;
  return new ServiceError({
    code: error.code,
    message: error.message,
    statusCode,
    retryable: error.retryable,
    details: {},
    cause: error,
  });
}

function metaOperationsHttpError(
  error: MetaOwnerOperationsErrorV1,
): ServiceError {
  const statusCode =
    error.code === "authorization_scope_mismatch"
      ? 403
      : error.code === "not_found"
        ? 404
        : error.code === "idempotency_conflict" ||
            error.code === "stale_fence"
          ? 409
          : error.code === "dependency_unavailable"
            ? 503
            : 400;
  return new ServiceError({
    code: error.code,
    message: error.message,
    statusCode,
    retryable: error.retryable,
    details: {},
    cause: error,
  });
}

const metaJobFoundSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["code", "message", "retryable", "trace_id", "details"],
  properties: {
    code: { const: "meta_job_found" },
    message: { const: "meta job found" },
    retryable: { const: false },
    trace_id: { type: "string", minLength: 1, maxLength: 512 },
    details: MetaJobQueryDetailsV1Schema,
  },
});

const qualitySignalsFoundSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["code", "message", "retryable", "trace_id", "details"],
  properties: {
    code: { const: "quality_signals_found" },
    message: { const: "quality signals found" },
    retryable: { const: false },
    trace_id: { type: "string", minLength: 1, maxLength: 512 },
    details: QualitySignalListDetailsV1Schema,
  },
});

export function buildMetaCognitionApp(
  options: ServiceAppOptions = {},
  application?: MetaJobApplicationV1,
  requirements: MetaCognitionBuildRequirementsV1 = {},
  queryApplication?: MetaQueryApplicationV1,
  operationsApplication?: MetaOwnerOperationsApplicationV1,
  feedbackSuggestionApplication?: MetaFeedbackSuggestionApplicationV1,
): ReturnType<typeof createServiceApp> {
  const suppliedPolicies = options.auth?.policies ?? [];
  const app = createServiceApp("meta_cognition", {
    ...options,
    auth: {
      ...(options.auth?.verifier === undefined
        ? {}
        : { verifier: options.auth.verifier }),
      policies: [
        ...suppliedPolicies,
        ...(application === undefined ? [] : [createPolicy]),
        ...(queryApplication === undefined ? [] : queryPolicies),
        ...(operationsApplication === undefined
          ? []
          : operationsPolicies),
        ...(feedbackSuggestionApplication === undefined
          ? []
          : [feedbackSuggestionPolicy]),
      ],
    },
    readinessChecks: [
      ...(options.readinessChecks ?? []),
      ...(requirements.require_job_pipeline === true ||
      requirements.require_complete_pipeline === true
        ? [
            {
              name: "meta_pipeline",
              async check(signal: AbortSignal) {
                if (application === undefined) {
                  throw new Error(
                    "Meta Cognition pipeline dependencies are not composed",
                  );
                }
                await application.checkReadiness(signal);
              },
            },
            ...(requirements.require_complete_pipeline === true
              ? [{
              name: "meta_query",
              async check(signal: AbortSignal) {
                if (queryApplication === undefined) {
                  throw new Error(
                    "Meta Cognition query dependencies are not composed",
                  );
                }
                await queryApplication.checkReadiness(signal);
              },
              }, {
              name: "meta_owner_operations",
              async check(signal: AbortSignal) {
                if (operationsApplication === undefined) {
                  throw new Error(
                    "Meta Cognition owner operations are not composed",
                  );
                }
                await operationsApplication.checkReadiness(signal);
              },
              }]
              : []),
          ]
        : []),
    ],
    async errorMapper(error, request) {
      if (error instanceof MetaCognitionErrorV1) {
        return metaHttpError(error);
      }
      if (error instanceof MetaQueryErrorV1) {
        return metaQueryHttpError(error);
      }
      if (error instanceof MetaOwnerOperationsErrorV1) {
        return metaOperationsHttpError(error);
      }
      if (error instanceof MetaFeedbackSuggestionErrorV1) {
        return new ServiceError({
          code: error.code,
          message: error.message,
          statusCode:
            error.code === "authorization_scope_mismatch"
              ? 403
              : error.code === "owner_contract_drift"
                ? 503
                : 400,
          retryable: error.retryable,
          details: {},
          cause: error,
        });
      }
      return options.errorMapper?.(error, request);
    },
  });
  app.addHook("preValidation", async (request) => {
    if (request.body === undefined) return;
    try {
      assertBoundedMetaJsonV1(request.body);
    } catch (error) {
      throw new ServiceError({
        code: "invalid_request",
        message: "Meta request body violates the bounded canonical JSON contract",
        statusCode: 400,
        retryable: false,
        details: {},
        cause: error,
      });
    }
  });
  if (application !== undefined) {
    app.post(
      META_JOB_CREATE_ROUTE_V1,
      {
        schema: {
          body: MetaJobCreateRequestV1Schema,
          response: {
            200: MetaJobCreateResponseV1Schema,
            201: MetaJobCreateResponseV1Schema,
          },
        },
      },
      async (request, reply) => {
        const response = await application.createJob(request.body);
        return reply
          .code(response.duplicate_replayed ? 200 : 201)
          .send(response);
      },
    );
  }
  if (feedbackSuggestionApplication !== undefined) {
    app.post(
      META_FEEDBACK_SUGGESTION_ROUTE_V1,
      {
        schema: {
          body: MetaFeedbackRequestSuggestionRequestV1Schema,
          response: {
            200: MetaFeedbackRequestSuggestionResponseV1Schema,
          },
        },
      },
      async (request, reply) =>
        reply.code(200).send(
          await feedbackSuggestionApplication.suggest(
            feedbackSuggestionPrincipal(request),
            request.body,
          ),
        ),
    );
  }
  if (queryApplication !== undefined) {
    app.get(
      META_JOB_QUERY_ROUTE_V1,
      {
        schema: {
          params: {
            type: "object",
            additionalProperties: false,
            required: ["id"],
            properties: {
              id: { type: "string", minLength: 1, maxLength: 512 },
            },
          },
          response: { 200: metaJobFoundSchema },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id: string }>;
        return reply.code(200).send(
          await queryApplication.getJob(
            queryPrincipal(request),
            params.id,
            requestTraceId(request),
          ),
        );
      },
    );
    app.get(
      META_QUALITY_SIGNAL_QUERY_ROUTE_V1,
      {
        schema: {
          params: {
            type: "object",
            additionalProperties: false,
            required: ["id"],
            properties: {
              id: { type: "string", minLength: 1, maxLength: 512 },
            },
          },
          querystring: {
            type: "object",
            additionalProperties: false,
            properties: {
              cursor: { type: "string", minLength: 1, maxLength: 512 },
              limit: {
                type: "integer",
                minimum: 1,
                maximum: 200,
                default: 50,
              },
              severity: {
                enum: ["info", "warning", "error", "critical"],
              },
              signal_type: {
                type: "string",
                minLength: 1,
                maxLength: 512,
              },
            },
          },
          response: { 200: qualitySignalsFoundSchema },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id: string }>;
        const query = request.query as Readonly<{
          cursor?: string;
          limit?: number;
          severity?: "info" | "warning" | "error" | "critical";
          signal_type?: string;
        }>;
        return reply.code(200).send(
          await queryApplication.listQualitySignals(
            queryPrincipal(request),
            params.id,
            query,
            requestTraceId(request),
          ),
        );
      },
    );
    app.get(
      META_EXPERIENCE_QUERY_ROUTE_V1,
      {
        schema: {
          params: {
            type: "object",
            additionalProperties: false,
            required: ["id"],
            properties: {
              id: { type: "string", minLength: 1, maxLength: 512 },
            },
          },
          response: { 200: MetaExperienceQueryResponseV1Schema },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id: string }>;
        return reply.code(200).send(
          await queryApplication.getExperience(
            queryPrincipal(request),
            params.id,
            requestTraceId(request),
          ),
        );
      },
    );
    app.get(
      META_RESULT_AUDIT_QUERY_ROUTE_V1,
      {
        schema: {
          params: {
            type: "object",
            additionalProperties: false,
            required: ["id"],
            properties: {
              id: { type: "string", minLength: 1, maxLength: 512 },
            },
          },
          querystring: {
            type: "object",
            additionalProperties: false,
            properties: {
              cursor: {
                type: "string",
                minLength: 1,
                maxLength: 512,
              },
              limit: {
                type: "integer",
                minimum: 1,
                maximum: 200,
                default: 50,
              },
            },
          },
          response: { 200: MetaResultAuditQueryResponseV1Schema },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id: string }>;
        const query = request.query as Readonly<{
          cursor?: string;
          limit?: number;
        }>;
        return reply.code(200).send(
          await queryApplication.listResultAudit(
            queryPrincipal(request),
            params.id,
            query,
            requestTraceId(request),
          ),
        );
      },
    );
  }
  if (operationsApplication !== undefined) {
    const idParamsSchema = {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 512 },
      },
    } as const;
    app.post(
      META_SNAPSHOT_REPAIR_ROUTE_V1,
      {
        schema: {
          params: idParamsSchema,
          body: MetaSnapshotRepairRequestV1Schema,
          response: { 200: MetaSnapshotRepairResponseV1Schema },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id: string }>;
        return reply.code(200).send(
          await operationsApplication.repairSnapshot(
            operationsPrincipal(request),
            params.id,
            request.body,
          ),
        );
      },
    );
    app.post(
      META_FEEDBACK_ANSWER_ROUTE_V1,
      {
        schema: {
          params: idParamsSchema,
          body: MetaFeedbackAnswerRequestV1Schema,
          response: {
            200: MetaFeedbackAnswerResponseV1Schema,
            409: MetaFeedbackAnswerResponseV1Schema,
          },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id: string }>;
        const response = await operationsApplication.answerFeedback(
          operationsPrincipal(request),
          params.id,
          request.body,
        );
        return reply
          .code(
            "code" in response &&
              response.code === "idempotency_conflict"
              ? 409
              : 200,
          )
          .send(response);
      },
    );
    app.get(
      META_FEEDBACK_LIST_ROUTE_V1,
      {
        schema: {
          querystring: {
            type: "object",
            additionalProperties: false,
            required: ["status", "assignee"],
            properties: {
              status: { const: "open" },
              assignee: {
                type: "string",
                minLength: 1,
                maxLength: 512,
              },
              cursor: {
                type: "string",
                minLength: 1,
                maxLength: 512,
              },
              limit: {
                type: "integer",
                minimum: 1,
                maximum: 200,
                default: 50,
              },
            },
          },
          response: {
            200: MetaFeedbackRequestListResponseV1Schema,
          },
        },
      },
      async (request, reply) => {
        const query = request.query as Readonly<{
          status: string;
          assignee: string;
          cursor?: string;
          limit?: number;
        }>;
        return reply.code(200).send(
          await operationsApplication.listFeedback(
            operationsPrincipal(request, true),
            {
              ...query,
              trace_id: requestTraceId(request),
            },
          ),
        );
      },
    );
    app.post(
      META_SKILL_CANDIDATE_REVIEW_ROUTE_V1,
      {
        schema: {
          params: idParamsSchema,
          body: MetaSkillCandidateReviewRequestV1Schema,
          response: {
            200: MetaSkillCandidateReviewResponseV1Schema,
          },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id: string }>;
        return reply.code(200).send(
          await operationsApplication.reviewSkillCandidate(
            operationsPrincipal(request, true),
            params.id,
            request.body,
          ),
        );
      },
    );
    app.post(
      META_COMMAND_CLAIM_ROUTE_V1,
      {
        schema: {
          body: MetaCommandClaimRequestV1Schema,
          response: {
            200: MetaCommandClaimResponseV1Schema,
          },
        },
      },
      async (request, reply) =>
        reply.code(200).send(
          await operationsApplication.claimCommands(
            operationsPrincipal(request),
            request.body,
          ),
        ),
    );
    app.post(
      META_COMMAND_SETTLE_ROUTE_V1,
      {
        schema: {
          params: idParamsSchema,
          body: MetaCommandSettlementRequestV1Schema,
          response: {
            200: MetaCommandSettlementResponseV1Schema,
          },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ id: string }>;
        return reply.code(200).send(
          await operationsApplication.settleCommand(
            operationsPrincipal(request),
            params.id,
            request.body,
          ),
        );
      },
    );
  }
  return app;
}
