import { once } from "node:events";

import {
  RuntimeCancelContractV1Schema,
  RuntimeDomainEventV1Schema,
  RuntimeEventReadContractV1Schema,
  RuntimeEventReadErrorV1Schema,
  RuntimeEventResolveRequestV1Schema,
  RuntimeFinalResultReadContractV1Schema,
  RuntimePreemptContractV1Schema,
  RuntimeRunQueryDetailsV1Schema,
  RuntimeStartRequestV1Schema,
  RuntimeStartResponseV1Schema,
  ToolInvocationListDetailsV1Schema,
  ToolPermissionProfileCurrentReadErrorV1Schema,
  ToolPermissionProfileCurrentReadSuccessV1Schema,
  ToolPermissionProfileSelectorV1Schema,
  RuntimeUserRetractContractV1Schema,
  type RuntimeEventReadErrorV1 as RuntimeEventReadErrorContractV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  createServiceApp,
  getWorkloadAuthContext,
  ServiceError,
  type InternalRouteAuthPolicy,
  type ServiceAppOptions,
} from "@pai/service-kit";

import {
  RuntimeEventReadErrorV1,
  type RuntimeEventReadApplicationV1,
} from "./runtime-event-read.v1.js";
import {
  RuntimeFinalResultReadErrorV1,
  type RuntimeFinalResultReadApplicationV1,
  type RuntimeFinalResultReadPrincipalV1,
} from "./runtime-final-result-read.v1.js";
import {
  RUNTIME_EXECUTION_ERROR_CODES_V1,
  RuntimeExecutionErrorV1,
  type RuntimeExecutionApplicationV1,
  type RuntimePolicyReadPrincipalV1,
  type RuntimeStartPrincipalV1,
  type RuntimeToolReconciliationPrincipalV1,
} from "./runtime-execution.v1.js";
import { RuntimePolicyInputReadArtifactV1Schema } from "@pai/contracts/action-runtime/runtime-policy-input-read.v1";
import {
  RuntimeQueryErrorV1,
  type RuntimeQueryApplicationV1,
  type RuntimeQueryPrincipalV1,
} from "./runtime-query.v1.js";
import {
  RuntimeTokenStreamErrorV1,
  type RuntimeTokenStreamApplicationV1,
} from "./runtime-token-stream.v1.js";
import {
  ToolPermissionProfileCurrentReadErrorV1,
  type ToolPermissionProfileCurrentReadApplicationV1,
  type ToolPermissionProfileCurrentReadPrincipalV1,
} from "./tool-permission-profile-current-read.v1.js";

// find-my-way uses a single colon for parameters. A doubled colon registers
// the documented literal action separator and prevents a sibling action from
// being captured as an unintended parameter.
const runtimeEventResolveRegistrationRoute =
  "/internal/runtime-events::resolve" as const;
const toolPermissionProfileCurrentReadRegistrationRoute =
  "/internal/runtime/tool-permission-profiles/current" as const;
const runtimeStartRegistrationRoute = "/internal/runtime/runs" as const;
const runtimePolicyInputReadRegistrationRoute =
  "/internal/runtime/runs/:runtime_run_id/start-attempts/:start_attempt_no/policy-input" as const;
const runtimePolicyInputReferenceReadRegistrationRoute =
  "/internal/runtime/policy-inputs/:policy_input_ref" as const;
const runtimeFinalResultReadRegistrationRoute =
  "/internal/runtime/runs/:runtime_run_id/final-result" as const;
const runtimeRunQueryRegistrationRoute = "/v1/runtime-runs/:id" as const;
const runtimeToolQueryRegistrationRoute =
  "/v1/runtime-runs/:id/tool-invocations" as const;
const runtimeTokenStreamRegistrationRoute =
  "/internal/runtime-runs/:runtime_run_id/tokens" as const;
const runtimeToolReconciliationRegistrationRoute =
  "/internal/runtime/runs/:runtime_run_id/tool-invocations/:tool_invocation_id/reconcile" as const;
const runtimeControlRoutes = Object.freeze([
  {
    registration_route:
      "/internal/runtime/runs/:runtime_run_id/cancel",
    schema: RuntimeCancelContractV1Schema,
  },
  {
    registration_route:
      "/internal/runtime/runs/:runtime_run_id/preempt",
    schema: RuntimePreemptContractV1Schema,
  },
  {
    registration_route:
      "/internal/runtime/runs/:runtime_run_id/user-retract",
    schema: RuntimeUserRetractContractV1Schema,
  },
] as const);

const runtimeControlParamsSchemaV1 = Type.Object(
  {
    runtime_run_id: Type.String({ minLength: 1, maxLength: 512 }),
  },
  { additionalProperties: false },
);

export interface ActionRuntimeApplicationsV1 {
  readonly tool_permission_profile_current_read?: ToolPermissionProfileCurrentReadApplicationV1;
  readonly runtime_event_read?: RuntimeEventReadApplicationV1;
  readonly runtime_final_result_read?: RuntimeFinalResultReadApplicationV1;
  readonly runtime_execution?: RuntimeExecutionApplicationV1;
  readonly runtime_execution_readiness?: Readonly<{
    checkReadiness(signal: AbortSignal): Promise<void>;
  }>;
  readonly runtime_query?: RuntimeQueryApplicationV1;
  readonly runtime_token_stream?: RuntimeTokenStreamApplicationV1;
}

function toolPermissionProfileCurrentReadPrincipalV1(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): ToolPermissionProfileCurrentReadPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot" || claims.sub !== "trigger_processor") {
    throw new ToolPermissionProfileCurrentReadErrorV1(
      "authorization_scope_mismatch",
      request.id,
    );
  }
  return {
    sub: "trigger_processor",
    aud: "action_runtime",
    capability: claims.capability,
    scope: {
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    },
  };
}

export interface ActionRuntimeBuildOptionsV1 {
  readonly require_complete_pipeline?: boolean;
}

function inlineFastifySchemaV1(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(inlineFastifySchemaV1);
  if (typeof value !== "object" || value === null) return value;
  if (
    "$ref" in value &&
    (value as Readonly<{ $ref?: unknown }>).$ref ===
      RuntimeDomainEventV1Schema.$id
  ) {
    return inlineFastifySchemaV1(RuntimeDomainEventV1Schema);
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$id")
      .map(([key, entry]) => [key, inlineFastifySchemaV1(entry)]),
  );
}

function runtimeEventReadScopeV1(
  request: Parameters<typeof getWorkloadAuthContext>[0],
) {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new Error("Runtime event resolver requires a bot-scoped workload");
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

const runtimeEventReadPolicyV1 = Object.freeze({
  method: "POST",
  route: runtimeEventResolveRegistrationRoute,
  requiredCapabilities: ["runtime.event.resolve"],
  allowedCallers: ["trigger_processor"],
  requiredScope: runtimeEventReadScopeV1,
} satisfies InternalRouteAuthPolicy);

const toolPermissionProfileCurrentReadPolicyV1 = Object.freeze({
  method: "GET",
  route: toolPermissionProfileCurrentReadRegistrationRoute,
  requiredCapabilities: [
    "runtime.tool_permission_profile.current.read",
  ],
  allowedCallers: ["trigger_processor"],
  requiredScope: runtimeEventReadScopeV1,
} satisfies InternalRouteAuthPolicy);

function runtimePrincipalV1(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): RuntimeStartPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  const delegatedPrincipal = claims.delegated_principal;
  if (
    claims.scope_kind !== "bot" ||
    claims.sub !== "trigger_processor" ||
    (delegatedPrincipal !== undefined &&
      (delegatedPrincipal.scope_kind !== "bot" ||
        delegatedPrincipal.workspace_id !== claims.workspace_id ||
        delegatedPrincipal.bot_id !== claims.bot_id ||
        delegatedPrincipal.owner_agent_id !== claims.owner_agent_id ||
        delegatedPrincipal.deployment_environment !==
          claims.deployment_environment ||
        delegatedPrincipal.release_channel !== claims.release_channel))
  ) {
    throw new RuntimeExecutionErrorV1("authorization_scope_mismatch");
  }
  return {
    sub: "trigger_processor",
    aud: "action_runtime",
    capability: claims.capability,
    ...(delegatedPrincipal === undefined
      ? {}
      : { delegated_principal: delegatedPrincipal }),
    scope: {
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    },
  };
}

function runtimeFinalResultReadPrincipalV1(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): RuntimeFinalResultReadPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot" || claims.sub !== "trigger_processor") {
    throw new RuntimeFinalResultReadErrorV1(
      "authorization_scope_mismatch",
      false,
    );
  }
  return Object.freeze({
    sub: "trigger_processor",
    aud: "action_runtime",
    capability: claims.capability,
    scope: {
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    },
  });
}

function runtimePolicyReadPrincipalV1(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): RuntimePolicyReadPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot" || claims.sub !== "skill_registry") {
    throw new Error(
      "Runtime policy input reads require Skill Registry bot scope",
    );
  }
  return {
    sub: "skill_registry",
    aud: "action_runtime",
    capability: claims.capability,
    scope: {
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    },
  };
}

function runtimeToolReconciliationPrincipalV1(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): RuntimeToolReconciliationPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot" || claims.sub !== "action_runtime") {
    throw new Error(
      "Runtime tool reconciliation requires Action Runtime bot scope",
    );
  }
  return {
    sub: "action_runtime",
    aud: "action_runtime",
    capability: claims.capability,
    scope: {
      workspace_id: claims.workspace_id,
      bot_id: claims.bot_id,
      owner_agent_id: claims.owner_agent_id,
      deployment_environment: claims.deployment_environment,
      release_channel: claims.release_channel,
    },
  };
}

const runtimeStartPolicyV1 = Object.freeze({
  method: "POST",
  route: runtimeStartRegistrationRoute,
  requiredCapabilities: ["runtime.start"],
  allowedCallers: ["trigger_processor"],
  requiredScope: runtimeEventReadScopeV1,
} satisfies InternalRouteAuthPolicy);

const runtimePolicyInputReadPolicyV1 = Object.freeze({
  method: "GET",
  route: runtimePolicyInputReadRegistrationRoute,
  requiredCapabilities: ["runtime.policy_input.read"],
  allowedCallers: ["skill_registry"],
  requiredScope: runtimeEventReadScopeV1,
} satisfies InternalRouteAuthPolicy);

const runtimePolicyInputReferenceReadPolicyV1 = Object.freeze({
  method: "GET",
  route: runtimePolicyInputReferenceReadRegistrationRoute,
  requiredCapabilities: ["runtime.policy_input.read"],
  allowedCallers: ["skill_registry"],
  requiredScope: runtimeEventReadScopeV1,
} satisfies InternalRouteAuthPolicy);

const runtimeFinalResultReadPolicyV1 = Object.freeze({
  method: "GET",
  route: runtimeFinalResultReadRegistrationRoute,
  requiredCapabilities: ["runtime.final_result.read"],
  allowedCallers: ["trigger_processor"],
  requiredScope: runtimeEventReadScopeV1,
} satisfies InternalRouteAuthPolicy);

const runtimeToolReconciliationPolicyV1 = Object.freeze({
  method: "POST",
  route: runtimeToolReconciliationRegistrationRoute,
  requiredCapabilities: ["runtime.tool.reconcile"],
  allowedCallers: ["action_runtime"],
  requiredScope: runtimeEventReadScopeV1,
} satisfies InternalRouteAuthPolicy);

const runtimeControlPoliciesV1 = Object.freeze(
  runtimeControlRoutes.map(
    ({ registration_route }): InternalRouteAuthPolicy =>
      Object.freeze({
        method: "POST",
        route: registration_route,
        requiredCapabilities: ["runtime.control"] as const,
        allowedCallers: ["trigger_processor"] as const,
        requiredScope: runtimeEventReadScopeV1,
      }),
  ),
);

const runtimeExecutionErrorSchemaV1 = Type.Object(
  {
    code: Type.Union(
      RUNTIME_EXECUTION_ERROR_CODES_V1.map((code) =>
        Type.Literal(code),
      ),
    ),
    message: Type.String({ minLength: 1 }),
    retryable: Type.Boolean(),
    details: Type.Object({}, { additionalProperties: false }),
    trace_id: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

function runtimeExecutionErrorResponseV1(
  request: Readonly<{ id: string }>,
  error: Readonly<{
    code: RuntimeExecutionErrorV1["code"];
    message: string;
    retryable: boolean;
  }>,
) {
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    details: {},
    trace_id: request.id,
  };
}

const runtimeFinalResultReadErrorSchemaV1 = Type.Object(
  {
    code: Type.String({ minLength: 1, maxLength: 128 }),
    message: Type.String({ minLength: 1, maxLength: 128 }),
    retryable: Type.Boolean(),
  },
  { additionalProperties: false },
);

const runtimeControlAcceptedSchemaV1 = Type.Object(
  {
    accepted: Type.Literal(true),
    replayed: Type.Boolean(),
  },
  { additionalProperties: false },
);

const runtimeToolResultSchemaV1 = Type.Object(
  {
    outcome: Type.Union([
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    retryable: Type.Boolean(),
    output: Type.Optional(Type.Unknown()),
    error: Type.Optional(
      Type.Object(
        {
          code: Type.String({ minLength: 1, maxLength: 256 }),
          message: Type.String({ minLength: 1, maxLength: 1_024 }),
        },
        { additionalProperties: false },
      ),
    ),
    side_effect_status: Type.Union([
      Type.Literal("none"),
      Type.Literal("produced"),
      Type.Literal("unknown"),
    ]),
    external_response_ref: Type.Optional(
      Type.String({ minLength: 1, maxLength: 2_048 }),
    ),
    external_error_ref: Type.Optional(
      Type.String({ minLength: 1, maxLength: 2_048 }),
    ),
  },
  { additionalProperties: false },
);

const runtimeToolReconciliationRequestSchemaV1 = Type.Object(
  {
    schema_version: Type.Literal("runtime_tool_reconciliation.v1"),
    runtime_run_id: Type.String({ minLength: 1, maxLength: 512 }),
    tool_invocation_id: Type.String({ minLength: 1, maxLength: 512 }),
    expected_start_fence_generation: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    expected_invocation_lease_generation: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    expected_request_hash: Type.String({
      pattern: "^sha256:[0-9a-f]{64}$",
    }),
    expected_downstream_idempotency_key: Type.String({
      minLength: 1,
      maxLength: 2_048,
    }),
    evidence_ref: Type.String({ minLength: 1, maxLength: 2_048 }),
    result: runtimeToolResultSchemaV1,
    idempotency_key: Type.String({ minLength: 1, maxLength: 2_048 }),
    trace_id: Type.String({ minLength: 1, maxLength: 512 }),
  },
  { additionalProperties: false },
);

const runtimeToolReconciliationResultSchemaV1 = Type.Object(
  {
    runtime_run_id: Type.String({ minLength: 1, maxLength: 512 }),
    tool_invocation_id: Type.String({ minLength: 1, maxLength: 512 }),
    side_effect_status: Type.Union([
      Type.Literal("none"),
      Type.Literal("produced"),
    ]),
    outcome: Type.Union([
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    evidence_ref: Type.String({ minLength: 1, maxLength: 2_048 }),
    reconciled_at: Type.String({ format: "date-time" }),
    replayed: Type.Boolean(),
  },
  { additionalProperties: false },
);

const runtimeRunFoundSchemaV1 = Type.Object(
  {
    code: Type.Literal("runtime_run_found"),
    message: Type.Literal("runtime run found"),
    retryable: Type.Literal(false),
    trace_id: Type.String({ minLength: 1, maxLength: 512 }),
    details: RuntimeRunQueryDetailsV1Schema,
  },
  { additionalProperties: false },
);

const toolInvocationsFoundSchemaV1 = Type.Object(
  {
    code: Type.Literal("tool_invocations_found"),
    message: Type.Literal("tool invocations found"),
    retryable: Type.Literal(false),
    trace_id: Type.String({ minLength: 1, maxLength: 512 }),
    details: ToolInvocationListDetailsV1Schema,
  },
  { additionalProperties: false },
);

const runtimeQueryErrorSchemaV1 = Type.Object(
  {
    code: Type.Union([
      Type.Literal("runtime_run_not_found"),
      Type.Literal("authorization_denied"),
      Type.Literal("invalid_cursor"),
      Type.Literal("schema_validation_failed"),
      Type.Literal("owner_contract_drift"),
    ]),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Boolean(),
    trace_id: Type.String({ minLength: 1, maxLength: 512 }),
  },
  { additionalProperties: false },
);

function runtimeQueryScopeV1(
  request: Parameters<typeof getWorkloadAuthContext>[0],
) {
  const claims = getWorkloadAuthContext(request).claims;
  if (claims.scope_kind !== "bot") {
    throw new Error("Runtime query requires bot-scoped authority");
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

function runtimeQueryPrincipalV1(
  request: Parameters<typeof getWorkloadAuthContext>[0],
): RuntimeQueryPrincipalV1 {
  const claims = getWorkloadAuthContext(request).claims;
  if (
    claims.sub !== "observation_gateway" ||
    claims.scope_kind !== "bot" ||
    claims.delegated_principal === undefined
  ) {
    throw new RuntimeQueryErrorV1("authorization_denied");
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

const runtimeQueryPoliciesV1 = Object.freeze([
  {
    method: "GET",
    route: runtimeRunQueryRegistrationRoute,
    requiredCapabilities: ["runtime.run.read"],
    allowedCallers: ["observation_gateway"],
    requiredScope: runtimeQueryScopeV1,
  },
  {
    method: "GET",
    route: runtimeToolQueryRegistrationRoute,
    requiredCapabilities: ["runtime.tool_invocations.read"],
    allowedCallers: ["observation_gateway"],
    requiredScope: runtimeQueryScopeV1,
  },
] as const satisfies readonly InternalRouteAuthPolicy[]);

const runtimeTokenStreamPolicyV1 = Object.freeze({
  method: "GET",
  route: runtimeTokenStreamRegistrationRoute,
  requiredCapabilities: ["runtime.debug_tokens"],
  allowedCallers: ["observation_gateway"],
  requiredScope: runtimeQueryScopeV1,
} satisfies InternalRouteAuthPolicy);

const runtimeTokenStreamErrorSchemaV1 = Type.Object(
  {
    code: Type.Union([
      Type.Literal("schema_validation_failed"),
      Type.Literal("authorization_denied"),
      Type.Literal("runtime_run_not_found"),
      Type.Literal("runtime_token_stream_not_live"),
      Type.Literal("owner_contract_drift"),
      Type.Literal("token_source_unavailable"),
    ]),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Boolean(),
  },
  { additionalProperties: false },
);

function runtimeTokenStreamStatusV1(
  error: RuntimeTokenStreamErrorV1,
): 403 | 404 | 409 | 503 {
  if (error.code === "authorization_denied") return 403;
  if (error.code === "runtime_run_not_found") return 404;
  if (error.code === "runtime_token_stream_not_live") return 409;
  return 503;
}

export async function writeRuntimeTokenFrameV1(
  response: NodeJS.WritableStream,
  frame: unknown,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;
  const canonicalFrame = canonicalJsonV1(frame);
  if (response.write(`event: runtime_token\ndata: ${canonicalFrame}\n\n`)) {
    return;
  }
  const waitController = new AbortController();
  const abortWait = (): void => waitController.abort(signal?.reason);
  signal?.addEventListener("abort", abortWait, { once: true });
  try {
    try {
      await Promise.race([
        once(response, "drain", { signal: waitController.signal }),
        once(response, "close", { signal: waitController.signal }),
      ]);
    } catch (error) {
      if (!signal?.aborted) throw error;
    }
  } finally {
    // Promise.race does not remove the losing once() listener. Abort both
    // subscriptions after either condition wins so long-lived SSE responses
    // cannot accumulate a close/drain listener per backpressured frame.
    waitController.abort();
    signal?.removeEventListener("abort", abortWait);
  }
}

interface RuntimeTokenLifecycleEmitterV1 {
  once(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
}

export function bindRuntimeTokenStreamAbortV1(
  request: RuntimeTokenLifecycleEmitterV1,
  response: RuntimeTokenLifecycleEmitterV1,
  controller: AbortController,
): () => void {
  const abort = (): void => {
    if (!controller.signal.aborted) {
      controller.abort(new Error("runtime_token_client_disconnected"));
    }
  };
  // IncomingMessage "close" means that the request message completed on
  // current Node versions; it is not a durable signal that the SSE response
  // peer disconnected. The request "aborted" and response "close" events are
  // the two transport lifecycle signals that terminate a live stream.
  request.once("aborted", abort);
  response.once("close", abort);
  return () => {
    request.off("aborted", abort);
    response.off("close", abort);
  };
}

function runtimeExecutionErrorStatusV1(
  error: RuntimeExecutionErrorV1,
): 400 | 403 | 404 | 409 | 503 {
  switch (error.code) {
    case "authorization_scope_mismatch":
    case "tool_policy_denied":
    case "control_token_invalid":
      return 403;
    case "runtime_not_found":
      return 404;
    case "schema_validation_failed":
      return 400;
    case "idempotency_conflict":
    case "stale_start_fence":
    case "stale_lease_generation":
    case "policy_hash_mismatch":
    case "policy_expired":
    case "catalog_version_mismatch":
    case "reservation_invalid":
    case "tool_side_effect_unknown":
    case "runtime_cancelled":
    case "runtime_preempted":
    case "control_expired":
    case "runtime_terminal":
      return 409;
    default:
      return 503;
  }
}

const errorStatusByCode = Object.freeze({
  event_not_found: 404,
  event_scope_mismatch: 403,
  event_hash_mismatch: 409,
  event_schema_incompatible: 422,
  event_expired: 410,
  event_redaction_incomplete: 409,
} as const);

const errorMessageByCode = Object.freeze({
  event_not_found: "Runtime event was not found",
  event_scope_mismatch: "Runtime event scope does not match",
  event_hash_mismatch: "Runtime event hash does not match",
  event_schema_incompatible: "Runtime event schema is incompatible",
  event_expired: "Runtime event retention has expired",
  event_redaction_incomplete: "Runtime event redaction is incomplete",
} as const);

function runtimeEventReadErrorBodyV1(
  error: RuntimeEventReadErrorV1,
): RuntimeEventReadErrorContractV1 {
  const request = error.request;
  return {
    schema_version: "runtime_event_read_error.v1",
    code: error.code,
    message: errorMessageByCode[error.code],
    retryable: false,
    trace_id: request.trace_id,
    details: {
      source_event_id: request.source_event_id,
      payload_ref: request.payload_ref,
      runtime_run_id: request.runtime_run_id,
      source_sequence_no: request.source_sequence_no,
    },
  };
}

function isFastifySchemaValidationErrorV1(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "validation" in error &&
    Array.isArray(error.validation)
  );
}

export function buildActionRuntimeApp(
  options: ServiceAppOptions = {},
  applications: ActionRuntimeApplicationsV1 = {},
  buildOptions: ActionRuntimeBuildOptionsV1 = {},
): ReturnType<typeof createServiceApp> {
  const toolPermissionProfileCurrentRead =
    applications.tool_permission_profile_current_read;
  const runtimeEventRead = applications.runtime_event_read;
  const runtimeFinalResultRead = applications.runtime_final_result_read;
  const runtimeExecution = applications.runtime_execution;
  const runtimeExecutionReadiness =
    applications.runtime_execution_readiness;
  const runtimeQuery = applications.runtime_query;
  const runtimeTokenStream = applications.runtime_token_stream;
  const existingPolicies = options.auth?.policies ?? [];
  const actionRuntimePolicies: InternalRouteAuthPolicy[] = [
    ...existingPolicies,
    ...(toolPermissionProfileCurrentRead === undefined
      ? []
      : [toolPermissionProfileCurrentReadPolicyV1]),
    ...(runtimeEventRead === undefined ? [] : [runtimeEventReadPolicyV1]),
    ...(runtimeFinalResultRead === undefined
      ? []
      : [runtimeFinalResultReadPolicyV1]),
    ...(runtimeExecution === undefined
      ? []
      : [
          runtimeStartPolicyV1,
          runtimePolicyInputReadPolicyV1,
          runtimePolicyInputReferenceReadPolicyV1,
          runtimeToolReconciliationPolicyV1,
          ...runtimeControlPoliciesV1,
        ]),
    ...(runtimeQuery === undefined ? [] : runtimeQueryPoliciesV1),
    ...(runtimeTokenStream === undefined
      ? []
      : [runtimeTokenStreamPolicyV1]),
  ];
  const app = createServiceApp("action_runtime", {
    ...options,
    auth: {
      ...(options.auth?.verifier === undefined
        ? {}
        : { verifier: options.auth.verifier }),
      policies: actionRuntimePolicies,
    },
    readinessChecks: [
      ...(options.readinessChecks ?? []),
      ...(buildOptions.require_complete_pipeline === true
        ? [
            {
              name: "tool_permission_profile_reader",
              async check() {
                if (toolPermissionProfileCurrentRead === undefined) {
                  throw new Error(
                    "ToolPermissionProfile current owner reader is not composed",
                  );
                }
              },
            },
            {
              name: "runtime_event_reader",
              async check() {
                if (runtimeEventRead === undefined) {
                  throw new Error("Runtime event owner reader is not composed");
                }
              },
            },
            {
              name: "runtime_final_result_reader",
              async check() {
                if (runtimeFinalResultRead === undefined) {
                  throw new Error("Runtime final-result reader is not composed");
                }
              },
            },
            {
              name: "runtime_execution",
              async check(signal: AbortSignal) {
                if (runtimeExecution === undefined) {
                  throw new Error(
                    "Runtime execution pipeline is not composed",
                  );
                }
                if (runtimeExecutionReadiness === undefined) {
                  throw new Error(
                    "Runtime execution dependency readiness is not composed",
                  );
                }
                await runtimeExecutionReadiness.checkReadiness(signal);
              },
            },
            {
              name: "runtime_query",
              async check(signal: AbortSignal) {
                if (runtimeQuery === undefined) {
                  throw new Error("Runtime owner query pipeline is not composed");
                }
                await runtimeQuery.checkReadiness(signal);
              },
            },
            {
              name: "runtime_token_stream",
              async check(signal: AbortSignal) {
                if (runtimeTokenStream === undefined) {
                  throw new Error(
                    "Runtime live token pipeline is not composed",
                  );
                }
                await runtimeTokenStream.checkReadiness(signal);
              },
            },
          ]
        : []),
    ],
    async errorMapper(error, request) {
      if (
        (error instanceof ServiceError &&
          error.code === "invalid_canonical_json") ||
        isFastifySchemaValidationErrorV1(error)
      ) {
        return new ServiceError({
          code: "schema_validation_failed",
          message: "request violates the bounded canonical JSON contract",
          statusCode: 400,
          retryable: false,
          cause: error,
        });
      }
      return options.errorMapper?.(error, request);
    },
  });

  if (toolPermissionProfileCurrentRead !== undefined) {
    app.get(
      toolPermissionProfileCurrentReadRegistrationRoute,
      {
        schema: {
          querystring: inlineFastifySchemaV1(
            ToolPermissionProfileSelectorV1Schema,
          ),
          response: {
            200: inlineFastifySchemaV1(
              ToolPermissionProfileCurrentReadSuccessV1Schema,
            ),
            403: inlineFastifySchemaV1(
              ToolPermissionProfileCurrentReadErrorV1Schema,
            ),
            404: inlineFastifySchemaV1(
              ToolPermissionProfileCurrentReadErrorV1Schema,
            ),
            503: inlineFastifySchemaV1(
              ToolPermissionProfileCurrentReadErrorV1Schema,
            ),
          },
        },
      },
      async (request, reply) => {
        const suppliedTrace = request.headers["x-trace-id"];
        const traceId =
          typeof suppliedTrace === "string" && suppliedTrace.length > 0
            ? suppliedTrace
            : request.id;
        try {
          return reply.code(200).send(
            await toolPermissionProfileCurrentRead.readCurrent(
              toolPermissionProfileCurrentReadPrincipalV1(request),
              request.query,
              traceId,
            ),
          );
        } catch (error) {
          if (!(error instanceof ToolPermissionProfileCurrentReadErrorV1)) {
            throw error;
          }
          const status =
            error.code === "authorization_scope_mismatch"
              ? 403
              : error.code === "tool_permission_profile_not_found"
                ? 404
                : 503;
          return reply.code(status).send({
            code: error.code,
            message: error.code,
            retryable: error.retryable,
            details: {},
            trace_id: error.traceId,
          });
        }
      },
    );
  }

  if (runtimeEventRead !== undefined) {
    app.post(
      runtimeEventResolveRegistrationRoute,
      {
        schema: {
          body: inlineFastifySchemaV1(RuntimeEventResolveRequestV1Schema),
          response: {
            200: inlineFastifySchemaV1(RuntimeEventReadContractV1Schema),
            400: runtimeExecutionErrorSchemaV1,
            403: inlineFastifySchemaV1(RuntimeEventReadErrorV1Schema),
            404: inlineFastifySchemaV1(RuntimeEventReadErrorV1Schema),
            409: inlineFastifySchemaV1(RuntimeEventReadErrorV1Schema),
            410: inlineFastifySchemaV1(RuntimeEventReadErrorV1Schema),
            422: inlineFastifySchemaV1(RuntimeEventReadErrorV1Schema),
          },
        },
      },
      async (request, reply) => {
        const claims = getWorkloadAuthContext(request).claims;
        if (claims.scope_kind !== "bot") {
          throw new Error("Runtime event resolver requires bot scope");
        }
        try {
          const response = await runtimeEventRead.resolve(
            {
              sub: "trigger_processor",
              aud: "action_runtime",
              capability: claims.capability,
              scope: {
                workspace_id: claims.workspace_id,
                bot_id: claims.bot_id,
                owner_agent_id: claims.owner_agent_id,
                deployment_environment: claims.deployment_environment,
                release_channel: claims.release_channel,
              },
            },
            request.body,
          );
          return reply.code(200).send(response);
        } catch (error) {
          if (!(error instanceof RuntimeEventReadErrorV1)) throw error;
          return reply
            .code(errorStatusByCode[error.code])
            .send(runtimeEventReadErrorBodyV1(error));
        }
      },
    );
  }

  if (runtimeFinalResultRead !== undefined) {
    app.get(
      runtimeFinalResultReadRegistrationRoute,
      {
        schema: {
          params: Type.Object(
            {
              runtime_run_id: Type.String({ minLength: 1, maxLength: 512 }),
            },
            { additionalProperties: false },
          ),
          response: {
            200: inlineFastifySchemaV1(RuntimeFinalResultReadContractV1Schema),
            403: runtimeFinalResultReadErrorSchemaV1,
            404: runtimeFinalResultReadErrorSchemaV1,
            409: runtimeFinalResultReadErrorSchemaV1,
            503: runtimeFinalResultReadErrorSchemaV1,
          },
        },
      },
      async (request, reply) => {
        const params = request.params as Readonly<{ runtime_run_id: string }>;
        try {
          return reply.code(200).send(
            await runtimeFinalResultRead.read(
              runtimeFinalResultReadPrincipalV1(request),
              params.runtime_run_id,
              request.id,
            ),
          );
        } catch (error) {
          if (!(error instanceof RuntimeFinalResultReadErrorV1)) throw error;
          const status =
            error.code === "authorization_scope_mismatch"
              ? 403
              : error.code === "runtime_not_found"
                ? 404
                : error.code === "runtime_not_completed"
                  ? 409
                  : error.retryable
                    ? 503
                    : 409;
          return reply.code(status).send({
            code: error.code,
            message: error.code,
            retryable: error.retryable,
          });
        }
      },
    );
  }

  if (runtimeExecution !== undefined) {
    app.get(
      runtimePolicyInputReferenceReadRegistrationRoute,
      {
        schema: {
          params: Type.Object(
            {
              policy_input_ref: Type.String({
                minLength: 1,
                maxLength: 512,
              }),
            },
            { additionalProperties: false },
          ),
          response: {
            200: inlineFastifySchemaV1(
              RuntimePolicyInputReadArtifactV1Schema,
            ),
            403: runtimeExecutionErrorSchemaV1,
            404: runtimeExecutionErrorSchemaV1,
            503: runtimeExecutionErrorSchemaV1,
          },
        },
      },
      async (request, reply) => {
        try {
          const params = request.params as Readonly<{
            policy_input_ref: string;
          }>;
          return reply.code(200).send(
            await runtimeExecution.readPolicyInputByReference(
              runtimePolicyReadPrincipalV1(request),
              params.policy_input_ref,
            ),
          );
        } catch (error) {
          if (!(error instanceof RuntimeExecutionErrorV1)) throw error;
          const status =
            error.code === "authorization_scope_mismatch"
              ? 403
              : error.code === "runtime_not_found"
                ? 404
                : 503;
          return reply
            .code(status)
            .send(runtimeExecutionErrorResponseV1(request, error));
        }
      },
    );

    app.get(
      runtimePolicyInputReadRegistrationRoute,
      {
        schema: {
          params: Type.Object(
            {
              runtime_run_id: Type.String({
                minLength: 1,
                maxLength: 512,
              }),
              start_attempt_no: Type.Integer({
                minimum: 1,
                maximum: Number.MAX_SAFE_INTEGER,
              }),
            },
            { additionalProperties: false },
          ),
          response: {
            200: inlineFastifySchemaV1(
              RuntimePolicyInputReadArtifactV1Schema,
            ),
            403: runtimeExecutionErrorSchemaV1,
            404: runtimeExecutionErrorSchemaV1,
            503: runtimeExecutionErrorSchemaV1,
          },
        },
      },
      async (request, reply) => {
        try {
          const params = request.params as Readonly<{
            runtime_run_id: string;
            start_attempt_no: number;
          }>;
          return reply.code(200).send(
            await runtimeExecution.readPolicyInput(
              runtimePolicyReadPrincipalV1(request),
              params.runtime_run_id,
              params.start_attempt_no,
            ),
          );
        } catch (error) {
          if (!(error instanceof RuntimeExecutionErrorV1)) throw error;
          const status =
            error.code === "authorization_scope_mismatch"
              ? 403
              : error.code === "runtime_not_found"
                ? 404
                : 503;
          return reply
            .code(status)
            .send(runtimeExecutionErrorResponseV1(request, error));
        }
      },
    );

    app.post(
      runtimeStartRegistrationRoute,
      {
        schema: {
          body: inlineFastifySchemaV1(RuntimeStartRequestV1Schema),
          response: {
            200: inlineFastifySchemaV1(RuntimeStartResponseV1Schema),
            400: runtimeExecutionErrorSchemaV1,
            403: runtimeExecutionErrorSchemaV1,
            404: runtimeExecutionErrorSchemaV1,
            409: runtimeExecutionErrorSchemaV1,
            503: runtimeExecutionErrorSchemaV1,
          },
        },
      },
      async (request, reply) => {
        try {
          const response = await runtimeExecution.start(
            runtimePrincipalV1(request),
            request.body,
            new AbortController().signal,
          );
          return reply.code(200).send(response);
        } catch (error) {
          if (!(error instanceof RuntimeExecutionErrorV1)) {
            // The shared service error handler intentionally returns a
            // fail-closed generic response for unknown exceptions. Preserve
            // the request's trace and exception stack in the server log so a
            // durable Runtime Start retry can be diagnosed without logging
            // its policy, fence, or control-token payload.
            request.log.error(
              {
                event: "runtime_start_unhandled_exception",
                service_id: "action_runtime",
                trace_id: request.id,
                err: error,
              },
              "runtime start failed before a classified error was produced",
            );
            throw error;
          }
          return reply
            .code(runtimeExecutionErrorStatusV1(error))
            .send(runtimeExecutionErrorResponseV1(request, error));
        }
      },
    );

    app.post(
      runtimeToolReconciliationRegistrationRoute,
      {
        schema: {
          params: Type.Object(
            {
              runtime_run_id: Type.String({
                minLength: 1,
                maxLength: 512,
              }),
              tool_invocation_id: Type.String({
                minLength: 1,
                maxLength: 512,
              }),
            },
            { additionalProperties: false },
          ),
          body: runtimeToolReconciliationRequestSchemaV1,
          response: {
            200: runtimeToolReconciliationResultSchemaV1,
            400: runtimeExecutionErrorSchemaV1,
            403: runtimeExecutionErrorSchemaV1,
            404: runtimeExecutionErrorSchemaV1,
            409: runtimeExecutionErrorSchemaV1,
            503: runtimeExecutionErrorSchemaV1,
          },
        },
      },
      async (request, reply) => {
        try {
          const params = request.params as Readonly<{
            runtime_run_id: string;
            tool_invocation_id: string;
          }>;
          let canonicalBody: unknown;
          try {
            canonicalBody = JSON.parse(canonicalJsonV1(request.body));
          } catch {
            return reply.code(400).send(
              runtimeExecutionErrorResponseV1(request, {
                code: "schema_validation_failed",
                message: "Runtime reconciliation body is not canonical JSON",
                retryable: false,
              }),
            );
          }
          if (
            !Value.Check(
              runtimeToolReconciliationRequestSchemaV1,
              canonicalBody,
            )
          ) {
            return reply.code(400).send(
              runtimeExecutionErrorResponseV1(request, {
                code: "schema_validation_failed",
                message: "Runtime reconciliation body is invalid",
                retryable: false,
              }),
            );
          }
          const body = canonicalBody as Readonly<{
            runtime_run_id: string;
            tool_invocation_id: string;
          }>;
          if (
            params.runtime_run_id !== body.runtime_run_id ||
            params.tool_invocation_id !== body.tool_invocation_id
          ) {
            return reply.code(400).send(
              runtimeExecutionErrorResponseV1(request, {
                code: "schema_validation_failed",
                message:
                  "Runtime reconciliation path identity must match the body",
                retryable: false,
              }),
            );
          }
          return reply.code(200).send(
            await runtimeExecution.reconcileUnknownTool(
              runtimeToolReconciliationPrincipalV1(request),
              canonicalBody,
            ),
          );
        } catch (error) {
          if (!(error instanceof RuntimeExecutionErrorV1)) throw error;
          return reply
            .code(runtimeExecutionErrorStatusV1(error))
            .send(runtimeExecutionErrorResponseV1(request, error));
        }
      },
    );

    for (const controlRoute of runtimeControlRoutes) {
      app.post(
        controlRoute.registration_route,
        {
          schema: {
            params: runtimeControlParamsSchemaV1,
            response: {
              202: runtimeControlAcceptedSchemaV1,
              400: runtimeExecutionErrorSchemaV1,
              403: runtimeExecutionErrorSchemaV1,
              404: runtimeExecutionErrorSchemaV1,
              409: runtimeExecutionErrorSchemaV1,
              503: runtimeExecutionErrorSchemaV1,
            },
          },
        },
        async (request, reply) => {
          try {
            const params = request.params as Readonly<{
              runtime_run_id: string;
            }>;
            let canonicalBody: unknown;
            try {
              canonicalBody = JSON.parse(
                canonicalJsonV1(request.body),
              );
            } catch {
              return reply.code(400).send(
                runtimeExecutionErrorResponseV1(request, {
                  code: "schema_validation_failed",
                  message: "Runtime control request is not canonical JSON",
                  retryable: false,
                }),
              );
            }
            if (!Value.Check(controlRoute.schema, canonicalBody)) {
              return reply.code(400).send(
                runtimeExecutionErrorResponseV1(request, {
                  code: "schema_validation_failed",
                  message: "Runtime control request schema is invalid",
                  retryable: false,
                }),
              );
            }
            const body = canonicalBody as Readonly<{
              runtime_run_id: string;
            }>;
            if (params.runtime_run_id !== body.runtime_run_id) {
              return reply.code(400).send(
                runtimeExecutionErrorResponseV1(request, {
                  code: "schema_validation_failed",
                  message:
                    "runtime_run_id path parameter must match the control body",
                  retryable: false,
                }),
              );
            }
            const response = await runtimeExecution.receiveControl(
              runtimePrincipalV1(request),
              body,
            );
            return reply.code(202).send(response);
          } catch (error) {
            if (!(error instanceof RuntimeExecutionErrorV1)) {
              // Keep the external response fail-closed, but retain the
              // server-side cause needed to diagnose a durable control
              // command. Do not attach the control body, policy, or token:
              // those are intentionally absent from the log record.
              request.log.error(
                {
                  event: "runtime_control_unhandled_exception",
                  service_id: "action_runtime",
                  trace_id: request.id,
                  err: error,
                },
                "runtime control failed before a classified error was produced",
              );
              throw error;
            }
            return reply
              .code(runtimeExecutionErrorStatusV1(error))
              .send(runtimeExecutionErrorResponseV1(request, error));
          }
        },
      );
    }
  }

  if (runtimeQuery !== undefined) {
    const traceId = (request: {
      readonly headers: Readonly<Record<string, unknown>>;
      readonly id: string;
    }) => {
      const supplied = request.headers["x-trace-id"];
      return typeof supplied === "string" && supplied.length > 0
        ? supplied
        : request.id;
    };
    const sendQueryError = (
      reply: Readonly<{
        code(statusCode: number): {
          send(payload: unknown): unknown;
        };
      }>,
      error: RuntimeQueryErrorV1,
      trace: string,
    ) => {
      const status =
        error.code === "authorization_denied"
          ? 403
          : error.code === "runtime_run_not_found"
            ? 404
            : error.code === "owner_contract_drift"
              ? 503
              : 400;
      return reply.code(status).send({
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        trace_id: trace,
      });
    };

    app.get(
      runtimeRunQueryRegistrationRoute,
      {
        schema: {
          params: Type.Object(
            { id: Type.String({ minLength: 1, maxLength: 512 }) },
            { additionalProperties: false },
          ),
          response: {
            200: inlineFastifySchemaV1(runtimeRunFoundSchemaV1),
            400: inlineFastifySchemaV1(runtimeQueryErrorSchemaV1),
            403: inlineFastifySchemaV1(runtimeQueryErrorSchemaV1),
            404: inlineFastifySchemaV1(runtimeQueryErrorSchemaV1),
            503: inlineFastifySchemaV1(runtimeQueryErrorSchemaV1),
          },
        },
      },
      async (request, reply) => {
        const trace = traceId(request);
        try {
          const params = request.params as Readonly<{ id: string }>;
          return reply.code(200).send(
            await runtimeQuery.getRun(
              runtimeQueryPrincipalV1(request),
              params.id,
              trace,
            ),
          );
        } catch (error) {
          if (!(error instanceof RuntimeQueryErrorV1)) throw error;
          return sendQueryError(reply, error, trace);
        }
      },
    );

    app.get(
      runtimeToolQueryRegistrationRoute,
      {
        schema: {
          params: Type.Object(
            { id: Type.String({ minLength: 1, maxLength: 512 }) },
            { additionalProperties: false },
          ),
          querystring: Type.Object(
            {
              cursor: Type.Optional(
                Type.String({ minLength: 1, maxLength: 512 }),
              ),
              limit: Type.Optional(
                Type.Integer({ minimum: 1, maximum: 200, default: 50 }),
              ),
              status: Type.Optional(
                Type.Union([
                  Type.Literal("requested"),
                  Type.Literal("running"),
                  Type.Literal("completed"),
                  Type.Literal("failed"),
                  Type.Literal("cancelled"),
                ]),
              ),
            },
            { additionalProperties: false },
          ),
          response: {
            200: inlineFastifySchemaV1(toolInvocationsFoundSchemaV1),
            400: inlineFastifySchemaV1(runtimeQueryErrorSchemaV1),
            403: inlineFastifySchemaV1(runtimeQueryErrorSchemaV1),
            404: inlineFastifySchemaV1(runtimeQueryErrorSchemaV1),
            503: inlineFastifySchemaV1(runtimeQueryErrorSchemaV1),
          },
        },
      },
      async (request, reply) => {
        const trace = traceId(request);
        try {
          const params = request.params as Readonly<{ id: string }>;
          const query = request.query as Readonly<{
            cursor?: string;
            limit?: number;
            status?:
              | "requested"
              | "running"
              | "completed"
              | "failed"
              | "cancelled";
          }>;
          return reply.code(200).send(
            await runtimeQuery.listToolInvocations(
              runtimeQueryPrincipalV1(request),
              params.id,
              query,
              trace,
            ),
          );
        } catch (error) {
          if (!(error instanceof RuntimeQueryErrorV1)) throw error;
          return sendQueryError(reply, error, trace);
        }
      },
    );
  }

  if (runtimeTokenStream !== undefined) {
    app.get(
      runtimeTokenStreamRegistrationRoute,
      {
        schema: {
          params: Type.Object(
            {
              runtime_run_id: Type.String({
                minLength: 1,
                maxLength: 256,
              }),
            },
            { additionalProperties: false },
          ),
          response: {
            400: inlineFastifySchemaV1(runtimeTokenStreamErrorSchemaV1),
            403: inlineFastifySchemaV1(runtimeTokenStreamErrorSchemaV1),
            404: inlineFastifySchemaV1(runtimeTokenStreamErrorSchemaV1),
            409: inlineFastifySchemaV1(runtimeTokenStreamErrorSchemaV1),
            503: inlineFastifySchemaV1(runtimeTokenStreamErrorSchemaV1),
          },
        },
      },
      async (request, reply) => {
        if (request.headers["last-event-id"] !== undefined) {
          return reply.code(400).send({
            code: "schema_validation_failed",
            message: "Runtime token SSE does not accept Last-Event-ID",
            retryable: false,
          });
        }
        const controller = new AbortController();
        const unbindTransportAbort = bindRuntimeTokenStreamAbortV1(
          request.raw,
          reply.raw,
          controller,
        );
        const claims = getWorkloadAuthContext(request).claims;
        const expiryTimer = setTimeout(
          () => controller.abort(),
          Math.max(0, claims.exp * 1_000 - Date.now()),
        );
        expiryTimer.unref();
        try {
          const params = request.params as Readonly<{
            runtime_run_id: string;
          }>;
          let prepared;
          try {
            prepared = await runtimeTokenStream.prepare(
              runtimeQueryPrincipalV1(request),
              params.runtime_run_id,
              controller.signal,
            );
          } catch (error) {
            if (!(error instanceof RuntimeTokenStreamErrorV1)) throw error;
            return reply
              .code(runtimeTokenStreamStatusV1(error))
              .send({
                code: error.code,
                message: error.message,
                retryable: error.retryable,
              });
          }
          reply.hijack();
          reply.raw.writeHead(200, {
            "cache-control": "no-cache, no-store, no-transform",
            connection: "keep-alive",
            "content-type": "text/event-stream; charset=utf-8",
            "x-accel-buffering": "no",
          });
          try {
            for await (const frame of prepared.frames) {
              if (controller.signal.aborted || reply.raw.destroyed) break;
              await writeRuntimeTokenFrameV1(
                reply.raw,
                frame,
                controller.signal,
              );
            }
          } finally {
            if (!reply.raw.destroyed) reply.raw.end();
          }
        } finally {
          clearTimeout(expiryTimer);
          unbindTransportAbort();
          controller.abort();
        }
        return reply;
      },
    );
  }

  return app;
}
