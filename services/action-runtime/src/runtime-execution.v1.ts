import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";

import {
  RuntimeCancelContractV1Schema,
  DelegatedPrincipalContextV1Schema,
  DeploymentEnvironmentV1Schema,
  ReleaseChannelV1Schema,
  RuntimeDomainEventV1Schema,
  RuntimePreemptContractV1Schema,
  RuntimeStartRequestV1Schema,
  RuntimeStartReservationValidateErrorV1Schema,
  RuntimeStartReservationValidateResponseV1Schema,
  SkillResolveResponseV1Schema,
  SKILL_ENTRYPOINT_MAX_BYTES_V1,
  SKILL_PACKAGE_MAX_BYTES_V1,
  SKILL_PACKAGE_MAX_FILES_V1,
  RuntimeToolInvocationRequestV1Schema,
  RuntimeUserRetractContractV1Schema,
  SkillPackageManifestV1Schema,
  assertSkillPackageManifestSemanticBindingsV1,
  assertRuntimeDomainEventSemanticBindingsV1,
  assertRuntimeStartSemanticBindingsV1,
  assertSkillResolveRequestSemanticBindingsV1,
  assertSkillResolveResponseSemanticBindingsV1,
  type ContextSnapshotReadContractV1,
  type ContextSnapshotResolveRequestV1,
  type ContextSnapshotV1,
  type DelegatedPrincipalContextV1,
  type RuntimeDomainEventV1,
  type RuntimeStartRequestV1,
  type RuntimeStartReservationValidateRequestV1,
  type RuntimeStartReservationValidateErrorV1,
  type RuntimeStartReservationValidateResponseV1,
  type RuntimeStartResponseV1,
  type RuntimeToolInvocationRequestV1,
  type ResolvedSkillV1,
  type SkillPackageManifestV1,
  type SkillResolveRequestV1,
  type SkillResolveResponseV1,
} from "@pai/contracts";
import type { RuntimePolicyInputReadArtifactV1 } from "@pai/contracts/action-runtime/runtime-policy-input-read.v1";
import {
  canonicalJsonV1,
  canonicalPayloadHashV1,
  immutableBoundedJsonSnapshotV1,
  materializeContextSnapshotReadV1,
} from "@pai/eventing";
import {
  ObjectStoreErrorV1,
  type BotObjectScopeV1,
  type ObjectRefV1,
  type ObjectStorePortV1,
} from "@pai/object-store";
import { InternalClientError } from "@pai/service-kit";
import { Value } from "@sinclair/typebox/value";

export type RuntimeControlTypeV1 = "cancel" | "preempt" | "user_retract";
export type RuntimeRunStatusV1 =
  | "queued"
  | "running"
  | "preempt_requested"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

function isRuntimeLeaseActiveStatusV1(
  status: RuntimeRunStatusV1,
): status is "running" | "preempt_requested" | "cancelling" {
  return (
    status === "running" ||
    status === "preempt_requested" ||
    status === "cancelling"
  );
}

export const RUNTIME_EXECUTION_ERROR_CODES_V1 = Object.freeze([
  "schema_validation_failed",
  "authorization_scope_mismatch",
  "idempotency_conflict",
  "stale_start_fence",
  "start_cancelled",
  "reservation_terminal",
  "reservation_invalid",
  "reservation_unavailable",
  "context_snapshot_unavailable",
  "context_snapshot_mismatch",
  "policy_hash_mismatch",
  "policy_expired",
  "policy_checkpoint_unavailable",
  "catalog_version_mismatch",
  "tool_policy_denied",
  "stale_lease_generation",
  "runtime_deadline_exceeded",
  "runtime_cancelled",
  "runtime_preempted",
  "control_token_invalid",
  "control_expired",
  "runtime_terminal",
  "runtime_adapter_failed",
  "tool_side_effect_unknown",
  "skill_content_mismatch",
  "artifact_integrity_mismatch",
  "artifact_reconciliation_required",
  "numeric_boundary_exhausted",
  "runtime_not_found",
] as const);

export type RuntimeExecutionErrorCodeV1 =
  (typeof RUNTIME_EXECUTION_ERROR_CODES_V1)[number];

export class RuntimeExecutionErrorV1 extends Error {
  public constructor(
    public readonly code: RuntimeExecutionErrorCodeV1,
    message: string = code,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "RuntimeExecutionErrorV1";
  }
}

function canonicalJsonSnapshotV1<T>(
  value: unknown,
  code: RuntimeExecutionErrorCodeV1,
  message: string,
): T {
  try {
    return immutableBoundedJsonSnapshotV1(value) as T;
  } catch {
    throw new RuntimeExecutionErrorV1(code, message);
  }
}

const MAX_RUNTIME_ADAPTER_ARTIFACT_BYTES_V1 = 64 * 1024 * 1024;

function exactOwnDataRecordV1(
  value: unknown,
  expectedKeys: readonly string[],
  subject = "Runtime adapter turn",
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    nodeUtilTypes.isProxy(value)
  ) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      `${subject} is not a plain inspectable object`,
    );
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      `${subject} cannot be snapshotted`,
    );
  }
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(descriptors, key))
  ) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      `${subject} has an unknown shape`,
    );
  }
  const snapshot: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        `${subject} must contain only enumerable own data properties`,
      );
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotRuntimeAdapterTurnV1(
  value: unknown,
): RuntimeAdapterTurnV1 {
  const top = exactOwnDataRecordV1(
    value,
    (() => {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, "kind");
      } catch {
        descriptor = undefined;
      }
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        return [];
      }
      switch (descriptor.value) {
        case "checkpoint":
          return ["kind"];
        case "tool_call":
          return ["kind", "call"];
        case "skill_load":
          return ["kind", "skill_key"];
        case "artifact":
          return ["kind", "artifact"];
        case "complete":
          return ["kind", "terminal_artifact_ref"];
        case "failed":
          return [
            "kind",
            "retryable",
            "reason_code",
            "error_summary",
          ];
        default:
          return [];
      }
    })(),
  );
  if (top.kind === "artifact") {
    const artifact = exactOwnDataRecordV1(top.artifact, [
      "artifact_id",
      "artifact_kind",
      "media_type",
      "body",
      "expected_sha256",
      "retention_until",
    ]);
    const body = artifact.body;
    if (
      !(body instanceof Uint8Array) ||
      Object.getPrototypeOf(body) !== Uint8Array.prototype ||
      body.byteLength < 1 ||
      body.byteLength > MAX_RUNTIME_ADAPTER_ARTIFACT_BYTES_V1 ||
      (typeof SharedArrayBuffer !== "undefined" &&
        body.buffer instanceof SharedArrayBuffer)
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime adapter artifact bytes are not an isolated bounded Uint8Array",
      );
    }
    const bodySnapshot = Uint8Array.prototype.slice.call(body);
    const metadata = immutableBoundedJsonSnapshotV1({
      artifact_id: artifact.artifact_id,
      artifact_kind: artifact.artifact_kind,
      media_type: artifact.media_type,
      expected_sha256: artifact.expected_sha256,
      retention_until: artifact.retention_until,
    }) as Readonly<{
      artifact_id: unknown;
      artifact_kind: unknown;
      media_type: unknown;
      expected_sha256: unknown;
      retention_until: unknown;
    }>;
    const artifactId = metadata.artifact_id;
    const artifactKind = metadata.artifact_kind;
    const mediaType = metadata.media_type;
    const expectedSha256 = metadata.expected_sha256;
    const retentionUntil = metadata.retention_until;
    if (
      typeof artifactId !== "string" ||
      typeof artifactKind !== "string" ||
      typeof mediaType !== "string" ||
      typeof expectedSha256 !== "string" ||
      typeof retentionUntil !== "string"
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime adapter artifact metadata is invalid",
      );
    }
    return Object.freeze({
      kind: "artifact" as const,
      artifact: Object.freeze({
        artifact_id: artifactId,
        artifact_kind: artifactKind,
        media_type: mediaType,
        expected_sha256: expectedSha256,
        retention_until: retentionUntil,
        body: bodySnapshot,
      }),
    });
  }
  let snapshot: unknown;
  try {
    snapshot = immutableBoundedJsonSnapshotV1(top);
  } catch {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      "Runtime adapter turn is not bounded canonical JSON",
    );
  }
  if (typeof snapshot !== "object" || snapshot === null) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      "Runtime adapter turn snapshot is invalid",
    );
  }
  const turn = snapshot as Readonly<Record<string, unknown>>;
  if (
    (turn.kind === "checkpoint" && Object.keys(turn).length === 1) ||
    (turn.kind === "skill_load" &&
      typeof turn.skill_key === "string" &&
      turn.skill_key.length >= 1 &&
      turn.skill_key.length <= 512) ||
    (turn.kind === "complete" &&
      (turn.terminal_artifact_ref === null ||
        (typeof turn.terminal_artifact_ref === "string" &&
          turn.terminal_artifact_ref.length >= 1 &&
          turn.terminal_artifact_ref.length <= 2_048))) ||
    (turn.kind === "failed" &&
      typeof turn.retryable === "boolean" &&
      typeof turn.reason_code === "string" &&
      turn.reason_code.length >= 1 &&
      turn.reason_code.length <= 512 &&
      typeof turn.error_summary === "string" &&
      turn.error_summary.length >= 1 &&
      turn.error_summary.length <= 4_096)
  ) {
    return snapshot as RuntimeAdapterTurnV1;
  }
  if (turn.kind === "tool_call") {
    const call = turn.call;
    const expectedCallKeys = [
      "tool_call_id",
      "tool_name",
      "capability",
      "arguments",
    ] as const;
    if (
      typeof call === "object" &&
      call !== null &&
      !Array.isArray(call)
    ) {
      const callRecord = call as Readonly<Record<string, unknown>>;
      const toolCallId = callRecord.tool_call_id;
      const toolName = callRecord.tool_name;
      const capability = callRecord.capability;
      if (
        Object.keys(callRecord).length === expectedCallKeys.length &&
        expectedCallKeys.every((key) =>
          Object.hasOwn(callRecord, key)
        ) &&
        typeof toolCallId === "string" &&
        toolCallId.length >= 1 &&
        toolCallId.length <= 512 &&
        typeof toolName === "string" &&
        toolName.length >= 1 &&
        toolName.length <= 512 &&
        typeof capability === "string" &&
        capability.length >= 1 &&
        capability.length <= 512
      ) {
        return snapshot as RuntimeAdapterTurnV1;
      }
    }
  }
  throw new RuntimeExecutionErrorV1(
    "runtime_adapter_failed",
    "Runtime adapter returned an invalid closed-union turn",
  );
}

const SAFE_ADAPTER_FAILURE_CODES_V1 = new Set([
  "sdk_session_closed",
  "sdk_interrupted",
  "sdk_cleanup_failed",
  "sdk_turn_queue_exhausted",
  "sdk_start_failed",
  "sdk_shape_drift",
  "sdk_session_drift",
  "sdk_result_too_large",
  "sdk_stream_ended",
  "sdk_transport_failed",
  "sdk_max_turns",
  "sdk_budget_exhausted",
  "sdk_structured_output_invalid",
  "sdk_execution_failed",
]);

function safeAdapterFailureV1(reasonCode: string): Readonly<{
  reason_code: string;
  error_summary: string;
}> {
  return SAFE_ADAPTER_FAILURE_CODES_V1.has(reasonCode)
    ? Object.freeze({
        reason_code: reasonCode,
        error_summary:
          "The pinned Runtime provider ended without a successful result",
      })
    : Object.freeze({
        reason_code: "runtime_adapter_failed",
        error_summary:
          "The Runtime provider returned an invalid failure result",
      });
}

function safeRuntimeFailureSummaryV1(
  _code: RuntimeExecutionErrorCodeV1 | "runtime_adapter_failed",
): string {
  return "Runtime execution failed at a protected boundary";
}

function protectedAdapterSnapshotDiagnosticV1(
  stage: string,
  error: unknown,
): string | undefined {
  // These labels deliberately describe only Runtime-owned validation paths.
  // Do not surface provider messages, tool output, or request content through
  // worker logs when diagnosing a fail-closed adapter boundary.
  if (
    stage !== "adapter_next_snapshot" ||
    !(error instanceof RuntimeExecutionErrorV1)
  ) {
    return undefined;
  }
  if (error.code === "tool_policy_denied") {
    switch (error.message) {
      case "Runtime tool profile changed before dispatch":
        return "tool_profile_changed";
      case "Adapter emitted a tool outside the frozen request":
        return "tool_not_requested";
      case "Adapter emitted a tool outside the frozen profile":
        return "tool_not_profiled";
      case "Adapter emitted arguments outside the frozen profile":
        return "tool_arguments_rejected";
      case "No durable runtime permission projection authorizes the tool call":
        return "tool_permission_missing";
      default:
        return "tool_policy_rejected";
    }
  }
  if (error.code !== "runtime_adapter_failed") return undefined;
  switch (error.message) {
    case "Runtime adapter turn is not a plain inspectable object":
      return "adapter_turn_not_plain";
    case "Runtime adapter turn cannot be snapshotted":
      return "adapter_turn_unsnapshotable";
    case "Runtime adapter turn has an unknown shape":
      return "adapter_turn_unknown_shape";
    case "Runtime adapter turn must contain only enumerable own data properties":
      return "adapter_turn_non_data_property";
    case "Runtime adapter artifact bytes are not an isolated bounded Uint8Array":
      return "adapter_artifact_bytes_invalid";
    case "Runtime adapter artifact metadata is invalid":
      return "adapter_artifact_metadata_invalid";
    case "Runtime adapter turn is not bounded canonical JSON":
      return "adapter_turn_noncanonical";
    case "Runtime adapter turn snapshot is invalid":
      return "adapter_turn_snapshot_invalid";
    case "Runtime adapter returned an invalid closed-union turn":
      return "adapter_turn_invalid_union";
    default:
      return "adapter_turn_snapshot_rejected";
  }
}

function protectedAdapterSnapshotFingerprintV1(
  stage: string,
  error: unknown,
): string | undefined {
  if (
    stage !== "adapter_next_snapshot" ||
    !(error instanceof RuntimeExecutionErrorV1) ||
    error.code !== "runtime_adapter_failed"
  ) {
    return undefined;
  }
  // This short digest lets an operator match a Runtime-owned message against
  // source without logging the message itself. It is never derived from a
  // provider response, user input, credential, or tool output.
  return createHash("sha256")
    .update(error.message, "utf8")
    .digest("hex")
    .slice(0, 16);
}

export type RuntimeDelegatedPrincipalV1 = Extract<
  DelegatedPrincipalContextV1,
  { readonly scope_kind: "bot" }
>;

export interface RuntimeStartPrincipalV1 {
  readonly sub: "trigger_processor";
  readonly aud: "action_runtime";
  readonly capability: readonly string[];
  readonly delegated_principal?: RuntimeDelegatedPrincipalV1;
  readonly scope: Readonly<{
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
  }>;
}

export interface RuntimeActorBindingV1 {
  readonly workload_service: "trigger_processor";
  readonly scope: RuntimeStartPrincipalV1["scope"];
  readonly delegated_principal: RuntimeDelegatedPrincipalV1 | null;
  readonly delegated_principal_hash: string | null;
}

export interface RuntimePolicyReadPrincipalV1 {
  readonly sub: "skill_registry";
  readonly aud: "action_runtime";
  readonly capability: readonly string[];
  readonly scope: RuntimeStartPrincipalV1["scope"];
}

export interface RuntimeToolReconciliationPrincipalV1 {
  readonly sub: "action_runtime";
  readonly aud: "action_runtime";
  readonly capability: readonly string[];
  readonly scope: RuntimeStartPrincipalV1["scope"];
}

export interface RuntimeStartReservationValidationPortV1 {
  validate(
    principal: Readonly<{
      sub: "action_runtime";
      aud: "trigger_processor";
      capability: readonly ["trigger.runtime_start.reservation.validate"];
      scope_kind: "bot";
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: "local" | "dev" | "staging" | "prod";
      release_channel: "stable" | "canary";
    }>,
    path: Readonly<{
      trigger_process_id: string;
      start_attempt_no: number;
    }>,
    request: RuntimeStartReservationValidateRequestV1,
    signal?: AbortSignal,
  ): Promise<RuntimeStartReservationValidateResponseV1>;
}

export interface RuntimeCatalogSnapshotV1 {
  readonly version: string;
  readonly as_of: string;
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

export interface RuntimeToolPermissionProfileV1 {
  readonly profile_ref: string;
  readonly revision: number;
  readonly profile_hash: string;
  readonly policy_epoch: number;
  readonly allowed_tools: readonly string[];
  readonly tool_arg_constraints: Readonly<Record<string, unknown>>;
  validateArguments(toolName: string, argumentsValue: unknown): boolean;
}

export interface RuntimeToolPermissionProfilePortV1 {
  resolveExact(
    request: Readonly<{
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: "local" | "dev" | "staging" | "prod";
      release_channel: "stable" | "canary";
      profile_ref: string;
      revision: number;
      profile_hash: string;
      policy_epoch: number;
    }>,
    signal?: AbortSignal,
  ): Promise<RuntimeToolPermissionProfileV1>;
}

export interface RuntimeToolCallV1 {
  readonly tool_call_id: string;
  readonly tool_name: string;
  readonly capability: string;
  readonly arguments: unknown;
}

export interface RuntimeToolResultV1 {
  readonly outcome: "completed" | "failed";
  readonly retryable: boolean;
  readonly output?: unknown;
  readonly error?: Readonly<{ code: string; message: string }>;
  /**
   * Unknown means that the remote side may have committed but the caller did
   * not observe a response. Retrying is forbidden until reconciliation.
   */
  readonly side_effect_status: "none" | "produced" | "unknown";
  readonly external_response_ref?: string;
  readonly external_error_ref?: string;
}

export interface RuntimeToolPortV1 {
  capabilityFor(toolName: string): string;
  invoke(
    call: RuntimeToolCallV1,
    context: Readonly<{
      runtime_run_id: string;
      trigger_process_id: string;
      trace_id: string;
      lease_generation: number;
      idempotency_key: string;
      policy_snapshot_id: string;
      policy_snapshot_hash: string;
      permission_id: string;
      permission_expires_at: string;
      actor_binding: RuntimeActorBindingV1;
      actor_binding_hash: string;
      signal: AbortSignal;
    }>,
  ): Promise<RuntimeToolResultV1>;
}

export interface RuntimeSkillResolutionV1 extends ResolvedSkillV1 {
  readonly security_revocation_epoch: number;
}

export interface RuntimeSkillPortV1 {
  resolve(
    request: SkillResolveRequestV1,
    signal?: AbortSignal,
  ): Promise<SkillResolveResponseV1>;
  load(
    resolution: RuntimeSkillResolutionV1,
    context: Readonly<{
      runtime_run_id: string;
      trace_id: string;
      scope: RuntimeStartPrincipalV1["scope"];
    }>,
    signal?: AbortSignal,
  ): Promise<Readonly<RuntimeSkillMaterializationV1>>;
}

export interface RuntimeSkillMaterializationV1 {
  readonly bytes: Uint8Array;
  readonly manifest_bytes: Uint8Array;
  readonly media_type: string;
  readonly package_digest: string;
  readonly manifest_digest: string;
  readonly runtime_target: "filesystem_bundle.v1";
  readonly source: "skill_registry" | "registry_cache";
  readonly entry_paths: readonly string[];
  /**
   * Resource-bounded, link-free files extracted from the exact package by the
   * Skill content adapter. The runtime recomputes every file hash before the
   * provider can observe it; opaque archive bytes are never treated as loaded
   * instructions.
   */
  readonly entries: readonly Readonly<{
    path: string;
    mode: string;
    bytes: Uint8Array;
    sha256: string;
  }>[];
}

export interface RuntimeContextSnapshotPortV1 {
  resolve(
    request: ContextSnapshotResolveRequestV1,
    signal?: AbortSignal,
  ): Promise<ContextSnapshotReadContractV1>;
}

export type RuntimePolicyCheckpointKindV1 =
  | "worker_claim"
  | "tool_dispatch"
  | "skill_load"
  | "skill_content_fetch";

export interface RuntimePolicyCheckpointPortV1 {
  check(
    request: Readonly<{
      schema_version: "runtime_policy_checkpoint.v1";
      checkpoint: RuntimePolicyCheckpointKindV1;
      runtime_run_id: string;
      policy_snapshot_id: string;
      workspace_id: string;
      bot_id: string;
      owner_agent_id: string;
      deployment_environment: "local" | "dev" | "staging" | "prod";
      release_channel: "stable" | "canary";
      expected_security_revocation_epoch: number;
      policy_expires_at: string;
      checked_at: string;
    }>,
    signal?: AbortSignal,
  ): Promise<
    Readonly<{
      schema_version: "runtime_policy_checkpoint_result.v1";
      checkpoint: RuntimePolicyCheckpointKindV1;
      runtime_run_id: string;
      policy_snapshot_id: string;
      status:
        | "valid"
        | "runtime_policy_expired"
        | "security_revocation_epoch_advanced";
      expected_security_revocation_epoch: number;
      current_security_revocation_epoch: number;
      checked_at: string;
    }>
  >;
}

export interface RuntimeArtifactRequestV1 {
  readonly artifact_id: string;
  readonly artifact_kind: string;
  readonly media_type: string;
  readonly body: Uint8Array;
  readonly expected_sha256: string;
  readonly retention_until: string;
}

interface RuntimeArtifactMetadataV1 {
  readonly artifact_id: string;
  readonly artifact_kind: string;
  readonly media_type: string;
  readonly content_hash: string;
  readonly size_bytes: number;
  readonly retention_until: string;
}

/**
 * Owner-side durable metadata handoff for an immutable Runtime artifact.
 * Artifact bytes never enter the owner row; ObjectStore is the only byte
 * authority and restart recovery may accept only its idempotent replay.
 */
export interface RuntimeArtifactRecordV1 {
  readonly artifact_id: string;
  readonly runtime_run_id: string;
  readonly start_fence_generation: number;
  readonly originating_lease_generation: number;
  readonly artifact_kind: string;
  readonly media_type: string;
  readonly content_hash: string;
  readonly size_bytes: number;
  readonly retention_until: string;
  readonly object_store_idempotency_key: string;
  readonly request_hash: string;
  readonly status: "creating" | "available" | "failed";
  readonly artifact_ref?: string;
  readonly failure_code?: string;
  readonly reconciliation_generation: number;
  readonly reconciliation_owner?: string;
  readonly reconciliation_expires_at?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export type RuntimeAdapterTurnV1 =
  | Readonly<{ kind: "checkpoint" }>
  | Readonly<{ kind: "tool_call"; call: RuntimeToolCallV1 }>
  | Readonly<{ kind: "skill_load"; skill_key: string }>
  | Readonly<{ kind: "artifact"; artifact: RuntimeArtifactRequestV1 }>
  | Readonly<{
      kind: "complete";
      terminal_artifact_ref: string | null;
    }>
  | Readonly<{
      kind: "failed";
      retryable: boolean;
      reason_code: string;
      error_summary: string;
    }>;

export interface RuntimeAdapterSessionV1 {
  readonly session_id: string;
}

export interface RuntimeAdapterContextV1 {
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly lease_generation: number;
  readonly deadline_at: string;
  readonly signal: AbortSignal;
  readonly context_snapshot: ContextSnapshotV1;
  readonly last_tool_call_id?: string;
  readonly last_tool_result?: RuntimeToolResultV1;
  readonly last_skill?: RuntimeSkillResolutionV1;
  readonly last_skill_materialization?: RuntimeSkillMaterializationV1;
  readonly last_skill_audit_event_id?: string;
  readonly last_artifact_id?: string;
  readonly last_artifact_ref?: string;
}

export interface RuntimeAdapterPortV1 {
  readonly adapter_id: "ClaudeAgentSdkRuntimeAdapter";
  readonly sdk_package: "@anthropic-ai/claude-agent-sdk";
  readonly sdk_version: "0.3.212";
  readonly model: string;
  start(
    request: RuntimeAdapterStartRequestV1,
    context: RuntimeAdapterContextV1,
  ): Promise<RuntimeAdapterSessionV1>;
  next(
    session: RuntimeAdapterSessionV1,
    context: RuntimeAdapterContextV1,
  ): Promise<RuntimeAdapterTurnV1>;
  cancel(
    session: RuntimeAdapterSessionV1,
    reason: string,
    signal?: AbortSignal,
  ): Promise<void>;
}

export interface RuntimeControlRequestV1 {
  readonly schema_version:
    | "runtime_cancel.v1"
    | "runtime_preempt.v1"
    | "runtime_user_retract.v1";
  readonly runtime_signal_id: string;
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly start_attempt_no: number;
  readonly preempt_token: string;
  readonly reason_code: string;
  readonly requested_at: string;
  readonly idempotency_key: string;
  readonly trace_id: string;
}

export type RuntimeStoredControlRequestV1 = Readonly<
  Omit<RuntimeControlRequestV1, "preempt_token"> & {
    readonly preempt_token_hash: string;
  }
>;

export type RuntimeStoredStartRequestV1 = Readonly<
  Omit<RuntimeStartRequestV1, "start_fence_token" | "preempt_token"> & {
    readonly start_fence_token_hash: string;
    readonly preempt_token_hash: string;
  }
>;

export interface RuntimeStartValidationFactV1 {
  readonly validation_call_id: string;
  readonly validation_sequence_no: number;
  readonly validation_stage:
    | "request_received"
    | "preflight_completed"
    | "before_running";
  readonly validation_result: "valid" | "error";
  readonly response_source: "trigger_processor";
  readonly response_schema_version:
    | "runtime_start_reservation_validate_response.v1"
    | "runtime_start_reservation_validate_error.v1";
  readonly request_hash: string;
  readonly start_fence_token_hash: string;
  readonly response_hash: string;
  readonly response:
    | RuntimeStartReservationValidateResponseV1
    | RuntimeStartReservationValidateErrorV1;
  readonly validated_at: string;
}

export type RuntimeStartValidationFactInputV1 = Readonly<
  Omit<RuntimeStartValidationFactV1, "validation_sequence_no">
>;

export interface RuntimeStartValidationCallV1 {
  readonly validation_call_id: string;
  readonly validation_stage:
    | "request_received"
    | "preflight_completed"
    | "before_running";
  readonly request_hash: string;
  readonly trace_id: string;
  readonly requested_at: string;
}

export type BeginRuntimeStartValidationCallResultV1 = Readonly<{
  outcome: "prepared" | "replayed";
  attempt: RuntimeStartAttemptV1;
}>;

export interface RuntimeStartAttemptV1 {
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly start_attempt_no: number;
  readonly idempotency_key: string;
  readonly request_hash: string;
  readonly start_fence_token_hash: string;
  readonly actor_binding: RuntimeActorBindingV1;
  readonly actor_binding_hash: string;
  readonly status: "validating" | "accepted" | "terminal";
  readonly validation_calls: readonly RuntimeStartValidationCallV1[];
  readonly validation_facts: readonly RuntimeStartValidationFactV1[];
  readonly failure_code?: RuntimeExecutionErrorCodeV1;
  readonly created_at: string;
  readonly updated_at: string;
}

export type RuntimeAdapterStartRequestV1 = Readonly<
  Omit<RuntimeStartRequestV1, "start_fence_token" | "preempt_token"> & {
    readonly tool_authorizations: Readonly<Record<string, string>>;
  }
>;

export interface RuntimeControlTokenClaimsV1 {
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly start_attempt_no: number;
  readonly start_fence_generation: number;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
  readonly control_valid_until: string;
}

export interface RuntimeControlTokenVerifierPortV1 {
  verify(
    token: string,
    expected: Readonly<{
      runtime_run_id: string;
      trigger_process_id: string;
      start_attempt_no: number;
      scope: RuntimeStartPrincipalV1["scope"];
      /**
       * A completed, failed, or cancelled run may acknowledge the exact
       * original control after its JWT expiry. This never authorizes a
       * control against a non-terminal run.
       */
      allow_expired_terminal_replay?: boolean;
    }>,
  ): Promise<RuntimeControlTokenClaimsV1>;
}

export interface RuntimeLeaseV1 {
  readonly runtime_run_id: string;
  readonly owner_id: string;
  readonly generation: number;
  readonly expires_at: string;
  readonly heartbeat_at: string;
  readonly recovery_state: "active" | "takeover_pending";
}

export interface RuntimeOutboxRecordV1 {
  readonly id: string;
  readonly event: RuntimeDomainEventV1;
  readonly status: "pending" | "sent" | "failed";
  readonly attempt_count: number;
}

export interface RuntimeOutboxClaimRequestV1 {
  readonly worker_id: string;
  readonly limit: number;
  readonly lease_seconds: number;
  /** Compatibility/audit timestamp; PostgreSQL clock_timestamp() owns leases. */
  readonly now: string;
  readonly current_transport_epoch: string;
  readonly current_transport_generation: number;
}

export interface RuntimeOutboxClaimRecordV1
  extends RuntimeOutboxRecordV1 {
  readonly status: "pending";
  readonly worker_id: string;
  readonly claim_token: string;
  readonly lease_expires_at: string;
  /** Transport authority observed and locked by the claim writer. */
  readonly transport_epoch: string;
  readonly transport_generation: number;
}

export interface RuntimeOutboxAckRequestV1 {
  readonly outbox_id: string;
  readonly claim_token: string;
  readonly outcome: "sent" | "retry_wait" | "failed";
  readonly next_retry_at: string | null;
  readonly error: Readonly<Record<string, unknown>> | null;
  readonly transport_ref: string | null;
  readonly transport_epoch: string | null;
  readonly transport_generation: number | null;
  readonly current_transport_epoch: string;
  readonly current_transport_generation: number;
  /** Compatibility/audit timestamp; PostgreSQL clock_timestamp() owns ACKs. */
  readonly now: string;
  /** Application semantic fence in addition to the standard ACK ABI. */
  readonly runtime_run_id: string;
  readonly event_id: string;
  readonly event_hash: string;
  readonly expected_attempt_count: number;
}

export interface RuntimeOutboxAckConfirmationV1 {
  readonly acknowledged: true;
}

export interface RuntimeOutboxAuthoritativeAckV1 {
  readonly record: RuntimeOutboxRecordV1;
  readonly claim_token: string;
  readonly transport_ref: string;
  readonly transport_epoch: string;
  readonly transport_generation: number;
  readonly acknowledged_at: string;
}

function runtimeRunIdForOutboxRecordV1(
  record: RuntimeOutboxRecordV1,
): string {
  const payload = record.event.payload as Readonly<
    Record<string, unknown>
  >;
  if (
    typeof payload.runtime_run_id !== "string" ||
    payload.runtime_run_id.length < 1
  ) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      "Runtime outbox event has no owner identity",
    );
  }
  return payload.runtime_run_id;
}

export interface RuntimeToolAuditV1 {
  readonly tool_invocation_id: string;
  readonly tool_name: string;
  readonly capability_token_id: string;
  readonly input_ref: string;
  readonly output_ref?: string;
  readonly lease_generation: number;
  readonly request_hash: string;
  readonly normalized_args_hash: string;
  readonly actor_binding_hash: string;
  readonly status:
    | "requested"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";
  readonly side_effect_status: "none" | "produced" | "unknown";
  readonly downstream_idempotency_key: string;
  readonly result?: RuntimeToolResultV1;
  readonly reconciled_at?: string;
  readonly reconciliation_evidence_ref?: string;
  readonly reconciliation_idempotency_key?: string;
  readonly reconciliation_request_hash?: string;
}

export interface RuntimePermissionProjectionV1 {
  readonly id: string;
  readonly runtime_run_id: string;
  readonly policy_snapshot_id: string;
  readonly capability: string;
  readonly actor_binding_hash: string;
  readonly scope: Readonly<{ tool_name: string }>;
  readonly expires_at: string;
  readonly created_at: string;
}

export interface RuntimeToolReconciliationRequestV1 {
  readonly schema_version: "runtime_tool_reconciliation.v1";
  readonly runtime_run_id: string;
  readonly tool_invocation_id: string;
  readonly expected_start_fence_generation: number;
  readonly expected_invocation_lease_generation: number;
  readonly expected_request_hash: string;
  readonly expected_downstream_idempotency_key: string;
  readonly evidence_ref: string;
  readonly result: RuntimeToolResultV1;
  readonly idempotency_key: string;
  readonly trace_id: string;
}

export interface RuntimeToolReconciliationResultV1 {
  readonly runtime_run_id: string;
  readonly tool_invocation_id: string;
  readonly side_effect_status: "none" | "produced";
  readonly outcome: "completed" | "failed";
  readonly evidence_ref: string;
  readonly reconciled_at: string;
  readonly replayed: boolean;
}

export interface RuntimeControlRecordV1 {
  readonly request: RuntimeStoredControlRequestV1;
  readonly control_type: RuntimeControlTypeV1;
  readonly requested_by: "trigger_processor" | "action_runtime";
  readonly control_valid_until: string;
  readonly target_lease_generation: number | null;
  readonly request_hash: string;
  readonly status: "received" | "handled";
  readonly handled_status?:
    | "handled_safe_point"
    | "already_terminal"
    | "isolation_unproven"
    | "cancelled_isolated_after_timeout"
    | "no_run_tombstoned";
  readonly handled_lease_generation?: number | null;
  readonly final_fencing_generation?: number;
}

export interface RuntimeControlTombstoneV1 {
  readonly request: RuntimeStoredControlRequestV1;
  readonly control_type: RuntimeControlTypeV1;
  readonly request_hash: string;
  readonly scope: RuntimeStartPrincipalV1["scope"];
  readonly start_fence_generation: number;
  readonly control_valid_until: string;
  readonly events: readonly RuntimeDomainEventV1[];
  readonly outbox: readonly RuntimeOutboxRecordV1[];
}

export interface RuntimeRunRecordV1 {
  readonly request: RuntimeStoredStartRequestV1;
  readonly request_hash: string;
  readonly actor_binding: RuntimeActorBindingV1;
  readonly actor_binding_hash: string;
  readonly response: RuntimeStartResponseV1;
  readonly status: RuntimeRunStatusV1;
  readonly start_fence_generation: number;
  readonly policy_snapshot_hash: string;
  readonly model: string;
  readonly lease?: RuntimeLeaseV1;
  readonly next_sequence_no: number;
  readonly events: readonly RuntimeDomainEventV1[];
  readonly outbox: readonly RuntimeOutboxRecordV1[];
  readonly tools: readonly RuntimeToolAuditV1[];
  readonly permissions: readonly RuntimePermissionProjectionV1[];
  readonly skill_resolutions: readonly RuntimeSkillResolutionV1[];
  readonly controls: readonly RuntimeControlRecordV1[];
  readonly terminal_reason?: string;
  readonly frozen_side_effect?: boolean;
}

export type AcceptRuntimeStartResultV1 =
  | Readonly<{ outcome: "accepted"; run: RuntimeRunRecordV1 }>
  | Readonly<{ outcome: "replayed"; run: RuntimeRunRecordV1 }>
  | Readonly<{
      outcome: "fenced";
      tombstone: RuntimeControlTombstoneV1;
    }>
  | Readonly<{ outcome: "conflict" }>;

export type BeginRuntimeStartAttemptResultV1 =
  | Readonly<{
      outcome: "begun" | "replayed";
      attempt: RuntimeStartAttemptV1;
    }>
  | Readonly<{ outcome: "conflict" }>;

type RuntimeQueuedRunClaimBaseV1 = Readonly<{
  runtime_run_id: string;
  worker_id: string;
  expected_start_fence_generation: number;
  lease_seconds: number;
  now: Date;
}>;

export type RuntimeQueuedRunClaimV1 =
  | Readonly<
      RuntimeQueuedRunClaimBaseV1 & {
        before_running_validation: RuntimeStartValidationFactInputV1;
        internal_safety?: never;
      }
    >
  | Readonly<
      RuntimeQueuedRunClaimBaseV1 & {
        before_running_validation?: never;
        internal_safety: Readonly<{
          reason_code:
            | "runtime_policy_expired"
            | "security_revocation_epoch_advanced";
          current_security_revocation_epoch: number;
          checked_at: string;
        }>;
      }
    >;

export interface RuntimeExecutionStoreV1 {
  beginStartAttempt(
    request: RuntimeStoredStartRequestV1,
    requestHash: string,
    actorBinding: RuntimeActorBindingV1,
    actorBindingHash: string,
    createdAt: string,
  ): Promise<BeginRuntimeStartAttemptResultV1>;
  readStartAttempt(
    runtimeRunId: string,
  ): Promise<RuntimeStartAttemptV1 | undefined>;
  beginStartValidationCall(request: Readonly<{
    runtime_run_id: string;
    request_hash: string;
    start_fence_token_hash: string;
    actor_binding_hash: string;
    call: RuntimeStartValidationCallV1;
  }>): Promise<BeginRuntimeStartValidationCallResultV1>;
  appendStartValidation(request: Readonly<{
    runtime_run_id: string;
    request_hash: string;
    start_fence_token_hash: string;
    actor_binding_hash: string;
    fact: RuntimeStartValidationFactInputV1;
  }>): Promise<RuntimeStartAttemptV1>;
  terminalizeStartAttempt(request: Readonly<{
    runtime_run_id: string;
    request_hash: string;
    actor_binding_hash: string;
    failure_code: RuntimeExecutionErrorCodeV1;
    terminalized_at: string;
  }>): Promise<RuntimeStartAttemptV1>;
  acceptStart(
    request: RuntimeStoredStartRequestV1,
    requestHash: string,
    actorBinding: RuntimeActorBindingV1,
    actorBindingHash: string,
    response: RuntimeStartResponseV1,
    skillResolutions: readonly RuntimeSkillResolutionV1[],
    toolArgConstraints: Readonly<Record<string, unknown>>,
    permissions: readonly RuntimePermissionProjectionV1[],
    model: string,
    preflightValidation: RuntimeStartValidationFactInputV1,
  ): Promise<AcceptRuntimeStartResultV1>;
  readRun(runtimeRunId: string): Promise<RuntimeRunRecordV1 | undefined>;
  readPolicyInputArtifact(
    runtimeRunId: string,
    startAttemptNo: number,
  ): Promise<RuntimePolicyInputReadArtifactV1 | undefined>;
  /**
   * Resolves the opaque policy reference. The application must still bind the
   * returned artifact to the caller's signed workload scope before returning
   * it over the internal owner API.
   */
  readPolicyInputArtifactByReference(
    policyInputRef: string,
  ): Promise<RuntimePolicyInputReadArtifactV1 | undefined>;
  claimQueuedRun(request: RuntimeQueuedRunClaimV1): Promise<RuntimeRunRecordV1>;
  heartbeat(request: Readonly<{
    runtime_run_id: string;
    worker_id: string;
    lease_generation: number;
    lease_seconds: number;
    now: Date;
  }>): Promise<RuntimeLeaseV1>;
  appendEvent(request: Readonly<{
    runtime_run_id: string;
    lease_generation: number;
    event: RuntimeDomainEventV1;
    next_status?: RuntimeRunStatusV1;
    terminal_reason?: string;
  }>): Promise<RuntimeRunRecordV1>;
  reserveArtifact(request: Readonly<{
    runtime_run_id: string;
    expected_start_fence_generation: number;
    lease_generation: number;
    artifact: RuntimeArtifactRequestV1;
    object_store_idempotency_key: string;
    request_hash: string;
    created_at: string;
  }>): Promise<
    Readonly<{ artifact: RuntimeArtifactRecordV1; replayed: boolean }>
  >;
  finalizeArtifact(request: Readonly<{
    runtime_run_id: string;
    artifact_id: string;
    expected_start_fence_generation: number;
    expected_status: "creating";
    lease_generation?: number;
    reconciliation_owner?: string;
    reconciliation_generation?: number;
    terminal_status: "available" | "failed";
    artifact_ref?: string;
    failure_code?: string;
    event: RuntimeDomainEventV1;
    request_hash: string;
    finalized_at: string;
  }>): Promise<RuntimeRunRecordV1>;
  claimPendingArtifacts(request: Readonly<{
    worker_id: string;
    limit: number;
    lease_seconds: number;
    /** Compatibility/audit timestamp; PostgreSQL clock_timestamp() owns leases. */
    now: string;
  }>): Promise<readonly RuntimeArtifactRecordV1[]>;
  readArtifact(
    runtimeRunId: string,
    artifactId: string,
  ): Promise<RuntimeArtifactRecordV1 | undefined>;
  /** Resolves an opaque artifact reference only inside its owning run. */
  readArtifactByReference(
    runtimeRunId: string,
    artifactRef: string,
  ): Promise<RuntimeArtifactRecordV1 | undefined>;
  recordToolRequested(request: Readonly<{
    runtime_run_id: string;
    lease_generation: number;
    audit: RuntimeToolAuditV1;
    event: RuntimeDomainEventV1;
  }>): Promise<RuntimeRunRecordV1>;
  markToolRunning(request: Readonly<{
    runtime_run_id: string;
    lease_generation: number;
    tool_invocation_id: string;
  }>): Promise<void>;
  recordToolResult(request: Readonly<{
    runtime_run_id: string;
    lease_generation: number;
    tool_invocation_id: string;
    output_ref: string;
    result: RuntimeToolResultV1;
    event: RuntimeDomainEventV1;
  }>): Promise<RuntimeRunRecordV1>;
  freezeUnknownSideEffect(request: Readonly<{
    runtime_run_id: string;
    lease_generation: number;
    tool_invocation_id: string;
    output_ref: string;
    result: RuntimeToolResultV1;
    event: RuntimeDomainEventV1;
    terminal_event: RuntimeDomainEventV1;
  }>): Promise<RuntimeRunRecordV1>;
  cancelUndispatchedTool(request: Readonly<{
    runtime_run_id: string;
    lease_generation: number;
    tool_invocation_id: string;
    event: RuntimeDomainEventV1;
  }>): Promise<RuntimeRunRecordV1>;
  reconcileUnknownTool(request: Readonly<{
    reconciliation: RuntimeToolReconciliationRequestV1;
    reconciliation_request_hash: string;
    reconciled_at: string;
  }>): Promise<
    Readonly<{
      audit: RuntimeToolAuditV1;
      replayed: boolean;
    }>
  >;
  receiveControl(
    request: RuntimeStoredControlRequestV1,
    requestHash: string,
    controlType: RuntimeControlTypeV1,
    verification: RuntimeControlTokenClaimsV1,
  ): Promise<
    Readonly<{
      control: RuntimeControlRecordV1;
      run: RuntimeRunRecordV1;
      replayed: boolean;
    }>
  >;
  receiveInternalControl(request: Readonly<{
    runtime_run_id: string;
    expected_start_fence_generation: number;
    expected_lease_generation: number;
    reason_code:
      | "runtime_policy_expired"
      | "security_revocation_epoch_advanced";
    current_security_revocation_epoch: number;
    requested_at: string;
    trace_id: string;
  }>): Promise<
    Readonly<{
      control: RuntimeControlRecordV1;
      run: RuntimeRunRecordV1;
      replayed: boolean;
    }>
  >;
  receiveControlTombstone(
    principal: RuntimeStartPrincipalV1,
    request: RuntimeStoredControlRequestV1,
    requestHash: string,
    controlType: RuntimeControlTypeV1,
    verification: RuntimeControlTokenClaimsV1,
  ): Promise<
    | Readonly<{
        outcome: "tombstoned";
        tombstone: RuntimeControlTombstoneV1;
        replayed: boolean;
      }>
    | Readonly<{
        outcome: "attached";
        control: RuntimeControlRecordV1;
        run: RuntimeRunRecordV1;
        replayed: boolean;
      }>
  >;
  findControlTombstone(
    request: RuntimeStoredStartRequestV1,
  ): Promise<RuntimeControlTombstoneV1 | undefined>;
  pendingControl(
    runtimeRunId: string,
    leaseGeneration: number,
  ): Promise<RuntimeControlRecordV1 | undefined>;
  handleControl(request: Readonly<{
    runtime_run_id: string;
    runtime_signal_id: string;
    lease_generation: number;
    handled_status:
      | "handled_safe_point"
      | "already_terminal"
      | "isolation_unproven"
      | "cancelled_isolated_after_timeout";
    handled_event: RuntimeDomainEventV1;
    terminal_event: RuntimeDomainEventV1;
    terminal_reason: string;
  }>): Promise<RuntimeRunRecordV1>;
  finalizeAlreadyTerminalControl(request: Readonly<{
    request: RuntimeStoredControlRequestV1;
    request_hash: string;
    control_type: RuntimeControlTypeV1;
    verification: RuntimeControlTokenClaimsV1;
    /**
     * The caller set this only after it has established that the target Run is
     * terminal and the original control token was otherwise verified. It
     * allows the owner writer to reconcile a terminal control after its normal
     * control-validity window without authorizing a live Run.
     */
    terminal_replay_compatibility: boolean;
    runtime_run_id: string;
    runtime_signal_id: string;
    received_event: RuntimeDomainEventV1;
    handled_event: RuntimeDomainEventV1;
  }>): Promise<
    Readonly<{
      control: RuntimeControlRecordV1;
      run: RuntimeRunRecordV1;
      replayed: boolean;
    }>
  >;
  claimOutbox(
    request: RuntimeOutboxClaimRequestV1,
  ): Promise<readonly RuntimeOutboxClaimRecordV1[]>;
  readOutboxAcknowledgeState(
    request: RuntimeOutboxAckRequestV1,
  ): Promise<RuntimeOutboxAuthoritativeAckV1 | undefined>;
  acknowledgeOutbox(
    request: RuntimeOutboxAckRequestV1,
  ): Promise<RuntimeOutboxAckConfirmationV1>;
}

function addMilliseconds(date: Date, milliseconds: number): string {
  return new Date(date.getTime() + milliseconds).toISOString();
}

function sha256BytesV1(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256TextV1(value: string): `sha256:${string}` {
  return sha256BytesV1(Buffer.from(value, "utf8"));
}

function secureDigestEqualsV1(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return (
    leftBytes.byteLength === rightBytes.byteLength &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function storedStartRequestV1(
  request: RuntimeStartRequestV1,
): RuntimeStoredStartRequestV1 {
  const {
    start_fence_token: startFenceToken,
    preempt_token: preemptToken,
    ...persisted
  } = request;
  return Object.freeze({
    ...structuredClone(persisted),
    start_fence_token_hash: sha256TextV1(startFenceToken),
    preempt_token_hash: sha256TextV1(preemptToken),
  });
}

function adapterStartRequestV1(
  request: RuntimeStoredStartRequestV1,
  permissions: readonly RuntimePermissionProjectionV1[],
  skillResolutions: readonly RuntimeSkillResolutionV1[],
): RuntimeAdapterStartRequestV1 {
  const {
    start_fence_token_hash: _startFenceTokenHash,
    preempt_token_hash: _preemptTokenHash,
    ...safe
  } = request;
  return Object.freeze(structuredClone({
    ...safe,
    allowed_tools: permissions.map(({ scope }) => scope.tool_name),
    tool_authorizations: Object.fromEntries(
      permissions.map(({ scope, capability }) => [scope.tool_name, capability]),
    ),
    // Skill Registry is the authority for the executable subset. Optional
    // planned skills may be degraded, and allowed_skills is only an upper
    // bound; the provider must never see unresolved entries as loadable.
    allowed_skills: skillResolutions.map(({ skill_key }) => skill_key),
  }));
}

function storedControlRequestV1(
  request: RuntimeControlRequestV1,
): RuntimeStoredControlRequestV1 {
  const { preempt_token: preemptToken, ...persisted } = request;
  return Object.freeze({
    ...structuredClone(persisted),
    preempt_token_hash: sha256TextV1(preemptToken),
  });
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RuntimeExecutionErrorV1(
      "schema_validation_failed",
      `${label} must be a positive safe integer`,
    );
  }
}

function incrementSafeIntegerV1(
  value: number,
  label: string,
  increment = 1,
): number {
  if (
    !Number.isSafeInteger(value) ||
    !Number.isSafeInteger(increment) ||
    increment < 1 ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER - increment
  ) {
    throw new RuntimeExecutionErrorV1(
      "numeric_boundary_exhausted",
      `${label} cannot be incremented within the safe-integer contract`,
    );
  }
  return value + increment;
}

async function awaitAbortable<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) throw signal.reason;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function sleepAbortableV1(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (milliseconds <= 0) return;
  if (signal?.aborted === true) throw signal.reason;
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function assertToolResult(result: RuntimeToolResultV1): void {
  const safeRef = (value: string) =>
    // ObjectStore returns opaque `objv1_` references. They are as durable as
    // the legacy namespaced proof references, but contain no transport URL or
    // provider data and therefore are safe to retain in the Runtime ledger.
    /^(?:artifact|evidence|object|runtime_event|runtime_tool_audit):[A-Za-z0-9._:/-]{1,2000}$/u.test(
      value,
    ) || /^objv1_[a-f0-9]{32,128}$/u.test(value);
  if (
    (result.outcome !== "completed" && result.outcome !== "failed") ||
    typeof result.retryable !== "boolean" ||
    !["none", "produced", "unknown"].includes(result.side_effect_status) ||
    (result.outcome === "completed" &&
      (result.side_effect_status === "unknown" || result.retryable)) ||
    (result.side_effect_status !== "none" && result.retryable) ||
    (result.external_response_ref !== undefined &&
      (result.outcome !== "completed" ||
        // A completed read-only operation has no external side effect, but
        // still needs an immutable response/evidence reference.  `produced`
        // distinguishes a committed write from that read-only case; it is not
        // a prerequisite for preserving proof of a successful response.
        result.side_effect_status === "unknown" ||
        !safeRef(result.external_response_ref))) ||
    (result.external_error_ref !== undefined &&
      (result.outcome !== "failed" ||
        !safeRef(result.external_error_ref))) ||
    (result.outcome === "completed" &&
      (result.external_response_ref === undefined ||
        result.external_response_ref.length === 0 ||
        result.external_response_ref.length > 2_048)) ||
    (result.outcome === "failed" &&
      (result.external_error_ref === undefined ||
        result.external_error_ref.length === 0 ||
        result.external_error_ref.length > 2_048)) ||
    ((result.outcome === "failed") !==
      (result.error !== undefined)) ||
    (result.error !== undefined &&
      (typeof result.error.code !== "string" ||
        result.error.code.length === 0 ||
        typeof result.error.message !== "string" ||
        result.error.message.length === 0))
  ) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      "Tool adapter returned an invalid result",
    );
  }
}

function sanitizeToolResultV1(
  result: RuntimeToolResultV1,
): RuntimeToolResultV1 {
  if (result.outcome === "completed") {
    return Object.freeze(structuredClone(result));
  }
  return Object.freeze({
    outcome: "failed" as const,
    retryable: result.retryable,
    side_effect_status: result.side_effect_status,
    error: {
      code:
        result.side_effect_status === "unknown"
          ? "external_outcome_unknown"
          : "tool_execution_failed",
      message:
        "Tool execution failed; inspect provider-side redacted diagnostics",
    },
    ...(result.external_error_ref === undefined
      ? {}
      : { external_error_ref: result.external_error_ref }),
  });
}

function toolAuditResultV1(
  result: RuntimeToolResultV1,
): RuntimeToolResultV1 {
  const { output: _output, ...facts } = result;
  return Object.freeze(structuredClone(facts));
}

function bindToolEvidenceRefV1(
  runtimeRunId: string,
  toolInvocationId: string,
  result: RuntimeToolResultV1,
  durableEvidenceRef?: string,
): RuntimeToolResultV1 {
  const auditEvidenceRef =
    durableEvidenceRef ??
    `runtime_tool_audit:${runtimeRunId}:${toolInvocationId}:${result.outcome}`;
  if (result.outcome === "completed") {
    return Object.freeze({
      ...structuredClone(result),
      external_response_ref:
        result.external_response_ref === undefined ||
        result.external_response_ref.startsWith("runtime_tool_audit:")
          ? auditEvidenceRef
          : result.external_response_ref,
    });
  }
  return Object.freeze({
    ...structuredClone(result),
    external_error_ref:
      result.external_error_ref === undefined ||
      result.external_error_ref.startsWith("runtime_tool_audit:")
        ? auditEvidenceRef
        : result.external_error_ref,
  });
}

function exactObjectKeysV1(
  value: unknown,
  allowed: readonly string[],
): value is Readonly<Record<string, unknown>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key)) &&
    allowed
      .filter(
        (key) =>
          ![
            "output",
            "error",
            "external_response_ref",
            "external_error_ref",
          ].includes(key),
      )
      .every((key) => Object.hasOwn(value, key))
  );
}

function assertToolReconciliationRequestV1(
  request: RuntimeToolReconciliationRequestV1,
): void {
  if (
    !exactObjectKeysV1(request, [
      "schema_version",
      "runtime_run_id",
      "tool_invocation_id",
      "expected_start_fence_generation",
      "expected_invocation_lease_generation",
      "expected_request_hash",
      "expected_downstream_idempotency_key",
      "evidence_ref",
      "result",
      "idempotency_key",
      "trace_id",
    ]) ||
    request.schema_version !== "runtime_tool_reconciliation.v1" ||
    request.runtime_run_id.length === 0 ||
    request.runtime_run_id.length > 512 ||
    request.tool_invocation_id.length === 0 ||
    request.tool_invocation_id.length > 512 ||
    !Number.isSafeInteger(request.expected_start_fence_generation) ||
    request.expected_start_fence_generation < 1 ||
    !Number.isSafeInteger(
      request.expected_invocation_lease_generation,
    ) ||
    request.expected_invocation_lease_generation < 1 ||
    !/^sha256:[0-9a-f]{64}$/u.test(request.expected_request_hash) ||
    request.expected_downstream_idempotency_key.length === 0 ||
    request.expected_downstream_idempotency_key.length > 2_048 ||
    request.evidence_ref.length === 0 ||
    request.evidence_ref.length > 2_048 ||
    request.idempotency_key.length === 0 ||
    request.idempotency_key.length > 2_048 ||
    request.trace_id.length === 0 ||
    request.trace_id.length > 512 ||
    !exactObjectKeysV1(request.result, [
      "outcome",
      "retryable",
      "output",
      "error",
      "side_effect_status",
      "external_response_ref",
      "external_error_ref",
    ]) ||
    (request.result.error !== undefined &&
      !exactObjectKeysV1(request.result.error, ["code", "message"]))
  ) {
    throw new RuntimeExecutionErrorV1(
      "schema_validation_failed",
      "Tool reconciliation request is invalid",
    );
  }
}

function assertLease(
  run: RuntimeRunRecordV1,
  generation: number,
  now = new Date(),
): RuntimeLeaseV1 {
  const lease = run.lease;
  if (
    lease === undefined ||
    lease.generation !== generation ||
    lease.recovery_state !== "active" ||
    Date.parse(lease.expires_at) <= now.getTime()
  ) {
    throw new RuntimeExecutionErrorV1("stale_lease_generation");
  }
  return lease;
}

function startScopeMatches(
  principal: RuntimeStartPrincipalV1,
  request: RuntimeStartRequestV1,
): boolean {
  return (
    principal.sub === "trigger_processor" &&
    principal.aud === "action_runtime" &&
    principal.capability.includes("runtime.start") &&
    runtimeScopeMatches(principal.scope, request)
  );
}

function delegatedPrincipalScopeMatchesV1(
  principal: RuntimeDelegatedPrincipalV1,
  request: Pick<
    RuntimeStoredStartRequestV1,
    | "workspace_id"
    | "bot_id"
    | "owner_agent_id"
    | "deployment_environment"
    | "release_channel"
  >,
): boolean {
  return (
    principal.scope_kind === "bot" &&
    principal.workspace_id === request.workspace_id &&
    principal.bot_id === request.bot_id &&
    principal.owner_agent_id === request.owner_agent_id &&
    principal.deployment_environment ===
      request.deployment_environment &&
    principal.release_channel === request.release_channel
  );
}

function snapshotOptionalRuntimeDelegatedPrincipalV1(
  value: unknown,
  request: Pick<
    RuntimeStoredStartRequestV1,
    | "workspace_id"
    | "bot_id"
    | "owner_agent_id"
    | "deployment_environment"
    | "release_channel"
  >,
): Readonly<{
  delegated_principal: RuntimeDelegatedPrincipalV1 | null;
  delegated_principal_hash: string | null;
}> {
  if (value === undefined || value === null) {
    return Object.freeze({
      delegated_principal: null,
      delegated_principal_hash: null,
    });
  }
  let snapshot: unknown;
  try {
    snapshot = immutableBoundedJsonSnapshotV1(value);
  } catch {
    throw new RuntimeExecutionErrorV1(
      "authorization_scope_mismatch",
      "Runtime execution requires a canonical signed delegated principal",
    );
  }
  if (
    !Value.Check(
      DelegatedPrincipalContextV1Schema,
      [DeploymentEnvironmentV1Schema, ReleaseChannelV1Schema],
      snapshot,
    ) ||
    (snapshot as DelegatedPrincipalContextV1).scope_kind !== "bot" ||
    !delegatedPrincipalScopeMatchesV1(
      snapshot as RuntimeDelegatedPrincipalV1,
      request,
    )
  ) {
    throw new RuntimeExecutionErrorV1(
      "authorization_scope_mismatch",
      "Delegated principal scope does not match the Runtime Start workload scope",
    );
  }
  const delegatedPrincipal =
    snapshot as RuntimeDelegatedPrincipalV1;
  return Object.freeze({
    delegated_principal: delegatedPrincipal,
    delegated_principal_hash:
      canonicalPayloadHashV1(delegatedPrincipal),
  });
}

function snapshotRuntimeActorBindingV1(
  principal: RuntimeStartPrincipalV1,
  request: Pick<
    RuntimeStoredStartRequestV1,
    | "workspace_id"
    | "bot_id"
    | "owner_agent_id"
    | "deployment_environment"
    | "release_channel"
  >,
): Readonly<{
  actor_binding: RuntimeActorBindingV1;
  actor_binding_hash: string;
}> {
  let scope: RuntimeStartPrincipalV1["scope"];
  try {
    scope = immutableBoundedJsonSnapshotV1(
      principal.scope,
    ) as RuntimeStartPrincipalV1["scope"];
  } catch {
    throw new RuntimeExecutionErrorV1(
      "authorization_scope_mismatch",
      "Runtime workload scope is not canonical",
    );
  }
  if (
    principal.sub !== "trigger_processor" ||
    !runtimeScopeMatches(scope, request)
  ) {
    throw new RuntimeExecutionErrorV1(
      "authorization_scope_mismatch",
      "Runtime workload actor does not match the Runtime Start scope",
    );
  }
  const delegated = snapshotOptionalRuntimeDelegatedPrincipalV1(
    principal.delegated_principal,
    request,
  );
  const actorBinding = immutableBoundedJsonSnapshotV1({
    workload_service: "trigger_processor",
    scope,
    delegated_principal: delegated.delegated_principal,
    delegated_principal_hash:
      delegated.delegated_principal_hash,
  }) as RuntimeActorBindingV1;
  return Object.freeze({
    actor_binding: actorBinding,
    actor_binding_hash: canonicalPayloadHashV1(actorBinding),
  });
}

function runtimeActorBindingForRunV1(
  run: RuntimeRunRecordV1,
): ReturnType<typeof snapshotRuntimeActorBindingV1> {
  let actor: RuntimeActorBindingV1;
  try {
    actor = immutableBoundedJsonSnapshotV1(
      run.actor_binding,
    ) as RuntimeActorBindingV1;
  } catch {
    throw new RuntimeExecutionErrorV1(
      "authorization_scope_mismatch",
      "Stored Runtime actor binding is not canonical",
    );
  }
  if (
    typeof actor !== "object" ||
    actor === null ||
    actor.workload_service !== "trigger_processor" ||
    typeof actor.scope !== "object" ||
    actor.scope === null ||
    Object.keys(actor.scope).sort().join(",") !==
      "bot_id,deployment_environment,owner_agent_id,release_channel,workspace_id" ||
    Object.keys(actor).sort().join(",") !==
      "delegated_principal,delegated_principal_hash,scope,workload_service"
  ) {
    throw new RuntimeExecutionErrorV1(
      "authorization_scope_mismatch",
      "Stored Runtime actor binding has an invalid shape",
    );
  }
  const delegated = snapshotOptionalRuntimeDelegatedPrincipalV1(
    actor.delegated_principal,
    run.request,
  );
  if (
    actor.delegated_principal_hash !==
      delegated.delegated_principal_hash
  ) {
    throw new RuntimeExecutionErrorV1(
      "authorization_scope_mismatch",
      "Stored Runtime delegated principal hash is invalid",
    );
  }
  const expected = snapshotRuntimeActorBindingV1(
    {
      sub: "trigger_processor",
      aud: "action_runtime",
      capability: [],
      ...(delegated.delegated_principal === null
        ? {}
        : {
            delegated_principal:
              delegated.delegated_principal,
          }),
      scope: actor.scope,
    },
    run.request,
  );
  if (
    typeof run.actor_binding_hash !== "string" ||
    !secureDigestEqualsV1(
      expected.actor_binding_hash,
      run.actor_binding_hash,
    ) ||
    canonicalJsonV1(expected.actor_binding) !==
      canonicalJsonV1(actor)
  ) {
    throw new RuntimeExecutionErrorV1(
      "authorization_scope_mismatch",
      "Stored Runtime actor binding is invalid",
    );
  }
  return expected;
}

function controlTombstoneMatchesStartV1(
  tombstone: RuntimeControlTombstoneV1,
  request: RuntimeStoredStartRequestV1,
  currentTime = new Date(),
): boolean {
  const expectedValidUntil = addMilliseconds(
    new Date(request.policy.expires_at),
    15 * 60 * 1_000,
  );
  return (
    tombstone.request.runtime_run_id === request.runtime_run_id &&
    tombstone.request.trigger_process_id === request.trigger_process_id &&
    tombstone.request.start_attempt_no === request.start_attempt_no &&
    secureDigestEqualsV1(
      tombstone.request.preempt_token_hash,
      request.preempt_token_hash,
    ) &&
    tombstone.control_valid_until === expectedValidUntil &&
    Date.parse(tombstone.control_valid_until) >= currentTime.getTime() &&
    tombstone.scope.workspace_id === request.workspace_id &&
    tombstone.scope.bot_id === request.bot_id &&
    tombstone.scope.owner_agent_id === request.owner_agent_id &&
    tombstone.scope.deployment_environment ===
      request.deployment_environment &&
    tombstone.scope.release_channel === request.release_channel
  );
}

function runtimeScopeMatches(
  principalScope: RuntimeStartPrincipalV1["scope"],
  request: Readonly<{
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
  }>,
): boolean {
  return (
    principalScope.workspace_id === request.workspace_id &&
    principalScope.bot_id === request.bot_id &&
    principalScope.owner_agent_id === request.owner_agent_id &&
    principalScope.deployment_environment ===
      request.deployment_environment &&
    principalScope.release_channel === request.release_channel
  );
}

const legacyTerminalPreemptTokenPatternV1 = /^[a-f0-9]{64}$/u;

function legacyTerminalControlClaimsV1(
  observed: RuntimeRunRecordV1,
  principal: RuntimeStartPrincipalV1,
  request: RuntimeControlRequestV1,
): RuntimeControlTokenClaimsV1 | undefined {
  if (
    !legacyTerminalPreemptTokenPatternV1.test(request.preempt_token) ||
    observed.request.runtime_run_id !== request.runtime_run_id ||
    observed.request.trigger_process_id !== request.trigger_process_id ||
    observed.request.start_attempt_no !== request.start_attempt_no ||
    !secureDigestEqualsV1(
      observed.request.preempt_token_hash,
      sha256TextV1(request.preempt_token),
    ) ||
    !runtimeScopeMatches(principal.scope, observed.request)
  ) {
    return undefined;
  }
  const controlValidUntil = addMilliseconds(
    new Date(observed.request.policy.expires_at),
    15 * 60 * 1_000,
  );
  if (!Number.isFinite(Date.parse(controlValidUntil))) return undefined;
  return Object.freeze({
    runtime_run_id: observed.request.runtime_run_id,
    trigger_process_id: observed.request.trigger_process_id,
    start_attempt_no: observed.request.start_attempt_no,
    start_fence_generation: observed.start_fence_generation,
    ...principal.scope,
    control_valid_until: controlValidUntil,
  });
}

async function verifyControlTokenV1(
  verifier: RuntimeControlTokenVerifierPortV1,
  principal: RuntimeStartPrincipalV1,
  request: RuntimeControlRequestV1,
  currentTime: Date,
  allowExpiredTerminalReplay: boolean,
): Promise<RuntimeControlTokenClaimsV1> {
  let claims: RuntimeControlTokenClaimsV1;
  try {
    claims = await verifier.verify(request.preempt_token, {
      runtime_run_id: request.runtime_run_id,
      trigger_process_id: request.trigger_process_id,
      start_attempt_no: request.start_attempt_no,
      scope: principal.scope,
      allow_expired_terminal_replay: allowExpiredTerminalReplay,
    });
  } catch {
    throw new RuntimeExecutionErrorV1("control_token_invalid");
  }
  claims =
    canonicalJsonSnapshotV1<RuntimeControlTokenClaimsV1>(
      claims,
      "control_token_invalid",
      "Runtime control token claims are not canonical JSON",
    );
  if (
    claims.runtime_run_id !== request.runtime_run_id ||
    claims.trigger_process_id !== request.trigger_process_id ||
    claims.start_attempt_no !== request.start_attempt_no ||
    !Number.isSafeInteger(claims.start_fence_generation) ||
    claims.start_fence_generation < 1 ||
    !runtimeScopeMatches(principal.scope, claims) ||
    !Number.isFinite(Date.parse(claims.control_valid_until))
  ) {
    throw new RuntimeExecutionErrorV1("control_token_invalid");
  }
  if (
    !allowExpiredTerminalReplay &&
    currentTime.getTime() > Date.parse(claims.control_valid_until)
  ) {
    throw new RuntimeExecutionErrorV1("control_expired");
  }
  return Object.freeze(structuredClone(claims));
}

function hashWithout<T extends object>(
  value: T,
  key: keyof T,
): string {
  return canonicalPayloadHashV1(
    Object.fromEntries(
      Object.entries(value).filter(([entryKey]) => entryKey !== key),
    ),
  );
}

function reservationPrincipal(
  request: Pick<
    RuntimeStoredStartRequestV1,
    | "workspace_id"
    | "bot_id"
    | "owner_agent_id"
    | "deployment_environment"
    | "release_channel"
  >,
): Parameters<RuntimeStartReservationValidationPortV1["validate"]>[0] {
  return {
    sub: "action_runtime",
    aud: "trigger_processor",
    capability: ["trigger.runtime_start.reservation.validate"],
    scope_kind: "bot",
    workspace_id: request.workspace_id,
    bot_id: request.bot_id,
    owner_agent_id: request.owner_agent_id,
    deployment_environment: request.deployment_environment,
    release_channel: request.release_channel,
  };
}

function reservationRequest(
  request: RuntimeStartRequestV1,
  requestHash: string,
  validationStage:
    | "request_received"
    | "preflight_completed"
    | "before_running",
): RuntimeStartReservationValidateRequestV1 {
  if (validationStage === "before_running") {
    return {
      schema_version: "runtime_start_reservation_validate_request.v1",
      runtime_run_id: request.runtime_run_id,
      start_fence_token_hash: sha256TextV1(request.start_fence_token),
      request_hash: requestHash as `sha256:${string}`,
      validation_stage: "before_running",
      trace_id: request.trace_id,
    };
  }
  return {
    schema_version: "runtime_start_reservation_validate_request.v1",
    runtime_run_id: request.runtime_run_id,
    start_fence_token: request.start_fence_token,
    request_hash: requestHash as `sha256:${string}`,
    validation_stage: validationStage,
    trace_id: request.trace_id,
  };
}

function runtimeStartValidationFactV1(
  validationCall: RuntimeStartValidationCallV1,
  startFenceTokenHash: string,
  response: RuntimeStartReservationValidateResponseV1,
  validatedAt: string,
): RuntimeStartValidationFactInputV1 {
  if (
    !Number.isFinite(Date.parse(validatedAt)) ||
    !validationCall.request_hash.startsWith("sha256:") ||
    !startFenceTokenHash.startsWith("sha256:")
  ) {
    throw new RuntimeExecutionErrorV1("schema_validation_failed");
  }
  return Object.freeze({
    validation_call_id: validationCall.validation_call_id,
    validation_stage: response.validation_stage,
    validation_result: "valid" as const,
    response_source: "trigger_processor" as const,
    response_schema_version: response.schema_version,
    request_hash: validationCall.request_hash,
    start_fence_token_hash: startFenceTokenHash,
    response_hash: canonicalPayloadHashV1(response),
    response: Object.freeze(structuredClone(response)),
    validated_at: validatedAt,
  });
}

function runtimeStartValidationErrorFactV1(
  validationCall: RuntimeStartValidationCallV1,
  startFenceTokenHash: string,
  response: RuntimeStartReservationValidateErrorV1,
  validatedAt: string,
): RuntimeStartValidationFactInputV1 {
  if (
    !Number.isFinite(Date.parse(validatedAt)) ||
    !validationCall.request_hash.startsWith("sha256:") ||
    !startFenceTokenHash.startsWith("sha256:")
  ) {
    throw new RuntimeExecutionErrorV1("schema_validation_failed");
  }
  return Object.freeze({
    validation_call_id: validationCall.validation_call_id,
    validation_stage: validationCall.validation_stage,
    validation_result: "error" as const,
    response_source: "trigger_processor" as const,
    response_schema_version: response.schema_version,
    request_hash: validationCall.request_hash,
    start_fence_token_hash: startFenceTokenHash,
    response_hash: canonicalPayloadHashV1(response),
    response: Object.freeze(structuredClone(response)),
    validated_at: validatedAt,
  });
}

type RuntimeReservationValidationStageV1 =
  | "request_received"
  | "preflight_completed"
  | "before_running";

const RUNTIME_RESERVATION_STATUS_RANK_V1 = Object.freeze({
  reserved: 0,
  dispatching: 1,
  queued: 2,
  started: 3,
} as const);

const RUNTIME_RESERVATION_ALLOWED_STATUS_BY_STAGE_V1 = Object.freeze({
  request_received: new Set(["reserved", "dispatching", "queued"]),
  preflight_completed: new Set(["dispatching", "queued"]),
  // A replacement worker validates an already-published Start immediately
  // before taking an expired Runtime lease.  Trigger returns `started` only
  // for that exact same current run/fence; see its validator for the paired
  // process-state and tombstone checks.
  before_running: new Set(["dispatching", "queued", "started"]),
} satisfies Readonly<
  Record<RuntimeReservationValidationStageV1, ReadonlySet<string>>
>);

class RuntimeReservationOwnerErrorV1 extends RuntimeExecutionErrorV1 {
  public constructor(
    code: RuntimeExecutionErrorCodeV1,
    message: string,
    retryable: boolean,
    public readonly owner_response: RuntimeStartReservationValidateErrorV1,
  ) {
    super(code, message, retryable);
    this.name = "RuntimeReservationOwnerErrorV1";
  }
}

function throwMappedReservationPortErrorV1(
  error: unknown,
  request: Pick<
    RuntimeStoredStartRequestV1,
    "trigger_process_id" | "start_attempt_no" | "trace_id"
  >,
  stage: RuntimeReservationValidationStageV1,
): never {
  let snapshot: unknown;
  try {
    snapshot = immutableBoundedJsonSnapshotV1(error);
  } catch {
    throw new RuntimeExecutionErrorV1(
      "reservation_unavailable",
      `Runtime Start reservation owner was unavailable at ${stage}`,
      true,
    );
  }
  if (
    typeof snapshot === "object" &&
    snapshot !== null &&
    !Array.isArray(snapshot) &&
    (snapshot as Readonly<Record<string, unknown>>).schema_version ===
      "runtime_start_reservation_validate_error.v1"
  ) {
    if (
      !Value.Check(
        RuntimeStartReservationValidateErrorV1Schema,
        snapshot,
      )
    ) {
      throw new RuntimeExecutionErrorV1(
        "reservation_invalid",
        `Runtime Start reservation owner returned an invalid error envelope at ${stage}`,
      );
    }
    const ownerError =
      snapshot as RuntimeStartReservationValidateErrorV1;
    if (
      ownerError.trace_id !== request.trace_id ||
      (ownerError.details.trigger_process_id !== null &&
        ownerError.details.trigger_process_id !==
          request.trigger_process_id) ||
      (ownerError.details.start_attempt_no !== null &&
        ownerError.details.start_attempt_no !==
          request.start_attempt_no) ||
      (ownerError.details.validation_stage !== null &&
        ownerError.details.validation_stage !== stage)
    ) {
      throw new RuntimeReservationOwnerErrorV1(
        "reservation_invalid",
        `Runtime Start reservation error binding drifted at ${stage}`,
        false,
        ownerError,
      );
    }
    if (ownerError.code === "storage_unavailable") {
      throw new RuntimeReservationOwnerErrorV1(
        "reservation_unavailable",
        `Runtime Start reservation owner was unavailable at ${stage}`,
        true,
        ownerError,
      );
    }
    if (ownerError.code === "internal_error") {
      throw new RuntimeReservationOwnerErrorV1(
        "reservation_unavailable",
        `Runtime Start reservation owner failed at ${stage}`,
        false,
        ownerError,
      );
    }
    throw new RuntimeReservationOwnerErrorV1(
      ownerError.code as RuntimeExecutionErrorCodeV1,
      `Runtime Start reservation owner rejected ${stage}`,
      false,
      ownerError,
    );
  }
  throw new RuntimeExecutionErrorV1(
    "reservation_unavailable",
    `Runtime Start reservation owner was unavailable at ${stage}`,
    true,
  );
}

function assertReservationSuccessV1(
  value: unknown,
  request: Pick<RuntimeStoredStartRequestV1, "trace_id">,
  stage: RuntimeReservationValidationStageV1,
): RuntimeStartReservationValidateResponseV1 {
  const response =
    canonicalJsonSnapshotV1<RuntimeStartReservationValidateResponseV1>(
      value,
      "reservation_invalid",
      `Runtime Start reservation response is not canonical JSON at ${stage}`,
    );
  if (
    !Value.Check(RuntimeStartReservationValidateResponseV1Schema, response) ||
    response.validation_result !== "valid" ||
    response.validation_stage !== stage ||
    response.duplicate_replayed !== false ||
    response.trace_id !== request.trace_id ||
    !Number.isSafeInteger(response.validated_fence_generation) ||
    response.validated_fence_generation < 1 ||
    !RUNTIME_RESERVATION_ALLOWED_STATUS_BY_STAGE_V1[
      stage
    ].has(response.reservation_status)
  ) {
    throw new RuntimeExecutionErrorV1("reservation_invalid");
  }
  return response;
}

async function validateReservation(
  port: RuntimeStartReservationValidationPortV1,
  request: RuntimeStartRequestV1,
  ownerRequest: RuntimeStartReservationValidateRequestV1,
  stage: RuntimeReservationValidationStageV1,
  signal?: AbortSignal,
): Promise<RuntimeStartReservationValidateResponseV1> {
  let response: RuntimeStartReservationValidateResponseV1;
  try {
    response = await port.validate(
      reservationPrincipal(request),
      {
        trigger_process_id: request.trigger_process_id,
        start_attempt_no: request.start_attempt_no,
      },
      ownerRequest,
      signal,
    );
  } catch (error) {
    if (signal?.aborted === true) throw signal.reason;
    throwMappedReservationPortErrorV1(error, request, stage);
  }
  return assertReservationSuccessV1(response, request, stage);
}

async function validateBeforeRunningReservation(
  port: RuntimeStartReservationValidationPortV1,
  request: RuntimeStoredStartRequestV1,
  ownerRequest: RuntimeStartReservationValidateRequestV1,
  signal?: AbortSignal,
): Promise<RuntimeStartReservationValidateResponseV1> {
  let response: RuntimeStartReservationValidateResponseV1;
  try {
    response = await port.validate(
      reservationPrincipal(request),
      {
        trigger_process_id: request.trigger_process_id,
        start_attempt_no: request.start_attempt_no,
      },
      ownerRequest,
      signal,
    );
  } catch (error) {
    if (signal?.aborted === true) throw signal.reason;
    throwMappedReservationPortErrorV1(
      error,
      request,
      "before_running",
    );
  }
  return assertReservationSuccessV1(
    response,
    request,
    "before_running",
  );
}

function assertStartHashes(request: RuntimeStartRequestV1, nowMs: number): void {
  try {
    assertRuntimeStartSemanticBindingsV1(request, nowMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid policy";
    throw new RuntimeExecutionErrorV1(
      message.includes("lifetime") ? "policy_expired" : "schema_validation_failed",
      message,
    );
  }
  if (
    canonicalPayloadHashV1(request.structured_intent) !==
      request.structured_intent_hash ||
    canonicalPayloadHashV1(request.policy) !== request.policy_input_hash ||
    hashWithout(request.intent_policy_snapshot, "snapshot_hash") !==
      request.intent_policy_snapshot_hash
  ) {
    throw new RuntimeExecutionErrorV1("policy_hash_mismatch");
  }
}

function snapshotSkillResolveResponseV1(
  value: unknown,
  request: SkillResolveRequestV1,
  policyExpiresAt: string,
): SkillResolveResponseV1 {
  const response = canonicalJsonSnapshotV1<SkillResolveResponseV1>(
    value,
    "catalog_version_mismatch",
    "Skill Registry returned a non-canonical resolution response",
  );
  if (!Value.Check(SkillResolveResponseV1Schema, response)) {
    throw new RuntimeExecutionErrorV1(
      "catalog_version_mismatch",
      "Skill Registry returned an invalid resolution response",
    );
  }
  try {
    assertSkillResolveResponseSemanticBindingsV1(
      request,
      response,
      policyExpiresAt,
    );
  } catch {
    throw new RuntimeExecutionErrorV1(
      "catalog_version_mismatch",
      "Skill Registry response does not match the frozen Runtime Start policy",
    );
  }
  return response;
}

function snapshotRuntimeToolProfileV1(
  value: unknown,
): RuntimeToolPermissionProfileV1 {
  let record: Readonly<Record<string, unknown>>;
  try {
    record = exactOwnDataRecordV1(value, [
      "profile_ref",
      "revision",
      "profile_hash",
      "policy_epoch",
      "allowed_tools",
      "tool_arg_constraints",
      "validateArguments",
    ]);
  } catch {
    throw new RuntimeExecutionErrorV1(
      "tool_policy_denied",
      "Tool profile resolver returned an unsafe object",
    );
  }
  const validator = record.validateArguments;
  if (typeof validator !== "function") {
    throw new RuntimeExecutionErrorV1(
      "tool_policy_denied",
      "Tool profile resolver did not provide an own validation function",
    );
  }
  let data: unknown;
  try {
    data = immutableBoundedJsonSnapshotV1({
      profile_ref: record.profile_ref,
      revision: record.revision,
      profile_hash: record.profile_hash,
      policy_epoch: record.policy_epoch,
      allowed_tools: record.allowed_tools,
      tool_arg_constraints: record.tool_arg_constraints,
    });
  } catch {
    throw new RuntimeExecutionErrorV1(
      "tool_policy_denied",
      "Tool profile resolver returned non-canonical data",
    );
  }
  const profile = data as Readonly<Record<string, unknown>>;
  if (
    typeof profile.profile_ref !== "string" ||
    !Number.isSafeInteger(profile.revision) ||
    typeof profile.profile_hash !== "string" ||
    !Number.isSafeInteger(profile.policy_epoch) ||
    !Array.isArray(profile.allowed_tools) ||
    profile.allowed_tools.some((tool) => typeof tool !== "string") ||
    typeof profile.tool_arg_constraints !== "object" ||
    profile.tool_arg_constraints === null ||
    Array.isArray(profile.tool_arg_constraints)
  ) {
    throw new RuntimeExecutionErrorV1(
      "tool_policy_denied",
      "Tool profile resolver returned invalid data",
    );
  }
  return Object.freeze({
    ...(data as Omit<
      RuntimeToolPermissionProfileV1,
      "validateArguments"
    >),
    validateArguments(toolName: string, argumentsValue: unknown) {
      try {
        return validator(toolName, argumentsValue) === true;
      } catch {
        return false;
      }
    },
  });
}

function snapshotRuntimeBytesV1(
  value: unknown,
  maximumBytes: number,
  label: string,
): Uint8Array {
  if (
    !(value instanceof Uint8Array) ||
    Object.getPrototypeOf(value) !== Uint8Array.prototype ||
    value.byteLength < 1 ||
    value.byteLength > maximumBytes ||
    (typeof SharedArrayBuffer !== "undefined" &&
      value.buffer instanceof SharedArrayBuffer)
  ) {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      `${label} is not an isolated bounded Uint8Array`,
    );
  }
  return Uint8Array.prototype.slice.call(value);
}

function snapshotRuntimeSkillMaterializationV1(
  value: unknown,
): RuntimeSkillMaterializationV1 {
  let record: Readonly<Record<string, unknown>>;
  try {
    record = exactOwnDataRecordV1(value, [
      "bytes",
      "manifest_bytes",
      "media_type",
      "package_digest",
      "manifest_digest",
      "runtime_target",
      "source",
      "entry_paths",
      "entries",
    ]);
  } catch {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill materialization returned an unsafe object",
    );
  }
  let metadata: unknown;
  try {
    metadata = immutableBoundedJsonSnapshotV1({
      media_type: record.media_type,
      package_digest: record.package_digest,
      manifest_digest: record.manifest_digest,
      runtime_target: record.runtime_target,
      source: record.source,
      entry_paths: record.entry_paths,
    });
  } catch {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill materialization metadata is not canonical JSON",
    );
  }
  const metadataRecord = metadata as Readonly<Record<string, unknown>>;
  if (
    typeof metadataRecord.media_type !== "string" ||
    typeof metadataRecord.package_digest !== "string" ||
    typeof metadataRecord.manifest_digest !== "string" ||
    metadataRecord.runtime_target !== "filesystem_bundle.v1" ||
    (metadataRecord.source !== "skill_registry" &&
      metadataRecord.source !== "registry_cache") ||
    !Array.isArray(metadataRecord.entry_paths) ||
    metadataRecord.entry_paths.some((path) => typeof path !== "string") ||
    !Array.isArray(record.entries)
  ) {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill materialization metadata is invalid",
    );
  }
  let rawEntryDescriptors: Record<PropertyKey, PropertyDescriptor>;
  try {
    rawEntryDescriptors = Object.getOwnPropertyDescriptors(
      record.entries,
    ) as unknown as Record<PropertyKey, PropertyDescriptor>;
  } catch {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill materialization entries cannot be snapshotted",
    );
  }
  const entryCount = rawEntryDescriptors.length?.value;
  const rawEntryKeys = Reflect.ownKeys(rawEntryDescriptors);
  if (
    !Number.isSafeInteger(entryCount) ||
    (entryCount as number) < 1 ||
    (entryCount as number) > 1_000 ||
    rawEntryKeys.some((key) => typeof key !== "string") ||
    rawEntryKeys.length !== (entryCount as number) + 1
  ) {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill materialization entries are not a dense own-data array",
    );
  }
  const entries = Array.from(
    { length: entryCount as number },
    (_, index) => {
      const descriptor = rawEntryDescriptors[String(index)];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Skill materialization entry is not an own data property",
        );
      }
      let entry: Readonly<Record<string, unknown>>;
      try {
        entry = exactOwnDataRecordV1(descriptor.value, [
          "path",
          "mode",
          "bytes",
          "sha256",
        ]);
      } catch {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Skill materialization entry is unsafe",
        );
      }
      if (
        typeof entry.path !== "string" ||
        typeof entry.mode !== "string" ||
        typeof entry.sha256 !== "string"
      ) {
        throw new RuntimeExecutionErrorV1(
          "skill_content_mismatch",
          "Skill materialization entry metadata is invalid",
        );
      }
      return Object.freeze({
        path: entry.path,
        mode: entry.mode,
        bytes: snapshotRuntimeBytesV1(
          entry.bytes,
          16 * 1024 * 1024,
          "Skill entry bytes",
        ),
        sha256: entry.sha256,
      });
    },
  );
  return Object.freeze({
    bytes: snapshotRuntimeBytesV1(
      record.bytes,
      64 * 1024 * 1024,
      "Skill package bytes",
    ),
    manifest_bytes: snapshotRuntimeBytesV1(
      record.manifest_bytes,
      16 * 1024 * 1024,
      "Skill manifest bytes",
    ),
    media_type: metadataRecord.media_type,
    package_digest: metadataRecord.package_digest,
    manifest_digest: metadataRecord.manifest_digest,
    runtime_target: "filesystem_bundle.v1",
    source: metadataRecord.source,
    entry_paths: metadataRecord.entry_paths as readonly string[],
    entries: Object.freeze(entries),
  });
}

function contextSnapshotResolveRequestV1(
  request: Pick<
    RuntimeStoredStartRequestV1,
    | "trigger_process_id"
    | "workspace_id"
    | "bot_id"
    | "owner_agent_id"
    | "deployment_environment"
    | "release_channel"
    | "context_snapshot_ref"
    | "context_snapshot_version"
    | "context_snapshot_hash"
    | "trace_id"
  >,
): ContextSnapshotResolveRequestV1 {
  return Object.freeze({
    schema_version: "context_snapshot_resolve_request.v1",
    consumer_service: "action_runtime",
    trigger_process_id: request.trigger_process_id,
    workspace_id: request.workspace_id,
    bot_id: request.bot_id,
    owner_agent_id: request.owner_agent_id,
    deployment_environment: request.deployment_environment,
    release_channel: request.release_channel,
    context_snapshot_ref: request.context_snapshot_ref,
    context_snapshot_version: request.context_snapshot_version,
    context_snapshot_hash: request.context_snapshot_hash,
    purpose: "runtime_start",
    trace_id: request.trace_id,
  });
}

async function resolveRuntimeContextSnapshotV1(
  port: RuntimeContextSnapshotPortV1,
  request: RuntimeStartRequestV1 | RuntimeStoredStartRequestV1,
  now: () => Date,
  signal?: AbortSignal,
): Promise<ContextSnapshotV1> {
  const resolveRequest = contextSnapshotResolveRequestV1(request);
  let read: ContextSnapshotReadContractV1;
  try {
    read = await port.resolve(resolveRequest, signal);
  } catch (error) {
    if (error instanceof RuntimeExecutionErrorV1) throw error;
    throw new RuntimeExecutionErrorV1(
      "context_snapshot_unavailable",
      "The canonical Context Snapshot could not be resolved",
      true,
    );
  }
  read = canonicalJsonSnapshotV1<ContextSnapshotReadContractV1>(
    read,
    "context_snapshot_mismatch",
    "The Context Snapshot read result is not canonical JSON",
  );
  let snapshot: ContextSnapshotV1;
  try {
    snapshot = materializeContextSnapshotReadV1(resolveRequest, read, { now });
  } catch {
    throw new RuntimeExecutionErrorV1(
      "context_snapshot_mismatch",
      "The canonical Context Snapshot failed identity, provenance, or integrity validation",
    );
  }
  const catalog = snapshot.skill_catalog;
  if (
    catalog === null ||
    catalog.catalog_version !== request.expected_catalog_version ||
    catalog.catalog_as_of !== request.catalog_as_of
  ) {
    throw new RuntimeExecutionErrorV1(
      "catalog_version_mismatch",
      "Context Snapshot does not bind the exact Runtime Start catalog revision",
    );
  }
  const itemBySkill = new Map<string, (typeof catalog.items)[number]>();
  for (const item of catalog.items) {
    if (itemBySkill.has(item.skill_key)) {
      throw new RuntimeExecutionErrorV1(
        "catalog_version_mismatch",
        "Context Snapshot contains duplicate skill catalog identities",
      );
    }
    itemBySkill.set(item.skill_key, item);
  }
  if (request.planned_skills.some((skill) => !itemBySkill.has(skill))) {
    throw new RuntimeExecutionErrorV1(
      "catalog_version_mismatch",
      "A planned skill is absent from the frozen Context Snapshot catalog",
    );
  }
  return snapshot;
}

async function validatePolicyAndCatalog(
  request: RuntimeStartRequestV1,
  actorBindingHash: string,
  contextSnapshot: ContextSnapshotV1,
  profilePort: RuntimeToolPermissionProfilePortV1,
  skillPort: RuntimeSkillPortV1,
  nowMs: number,
  signal?: AbortSignal,
): Promise<Readonly<{
  catalog: RuntimeCatalogSnapshotV1;
  profile: RuntimeToolPermissionProfileV1;
  skill_resolutions: readonly RuntimeSkillResolutionV1[];
  policy_snapshot_hash: string;
}>> {
  assertStartHashes(request, nowMs);
  const catalogSnapshot = contextSnapshot.skill_catalog;
  if (catalogSnapshot === null) {
    throw new RuntimeExecutionErrorV1("catalog_version_mismatch");
  }
  const resolveRequest: SkillResolveRequestV1 | undefined =
    request.planned_skills.length === 0
      ? undefined
      : {
          schema_version: "skill_resolution_request.v1",
          runtime_run_id: request.runtime_run_id,
          start_attempt_no: request.start_attempt_no,
          workspace_id: request.workspace_id,
          bot_id: request.bot_id,
          owner_agent_id: request.owner_agent_id,
          deployment_environment: request.deployment_environment,
          release_channel: request.release_channel,
          expected_catalog_version: request.expected_catalog_version,
          catalog_as_of: request.catalog_as_of,
          policy_input_ref: request.policy_input_ref,
          policy_input_hash: request.policy_input_hash,
          skills: request.planned_skills.map((name) =>
              ({
                name,
                version_constraint: "catalog_revision" as const,
                required:
                  request.structured_intent.required_skills.includes(name),
              }),
            ),
          idempotency_key:
            `${request.runtime_run_id}:skill-resolution:attempt:${request.start_attempt_no}`,
          trace_id: request.trace_id,
        };
  if (resolveRequest !== undefined) {
    try {
      assertSkillResolveRequestSemanticBindingsV1(resolveRequest);
    } catch {
      throw new RuntimeExecutionErrorV1(
        "catalog_version_mismatch",
        "Runtime Start could not derive a canonical planned-skill request",
      );
    }
  }
  const [rawProfile, rawSkillResponse] = await Promise.all([
    profilePort.resolveExact(
      {
        workspace_id: request.workspace_id,
        bot_id: request.bot_id,
        owner_agent_id: request.owner_agent_id,
        deployment_environment: request.deployment_environment,
        release_channel: request.release_channel,
        profile_ref:
          request.intent_policy_snapshot.tool_permission_profile_ref,
        revision:
          request.intent_policy_snapshot.tool_permission_profile_revision,
        profile_hash:
          request.intent_policy_snapshot.tool_permission_profile_hash,
        policy_epoch: request.intent_policy_snapshot.tool_policy_epoch,
      },
      signal,
    ),
    resolveRequest === undefined
      ? Promise.resolve(undefined)
      : skillPort.resolve(resolveRequest, signal),
  ]);
  const catalog: RuntimeCatalogSnapshotV1 = Object.freeze({
    version: catalogSnapshot.catalog_version,
    as_of: catalogSnapshot.catalog_as_of,
    tools: Object.freeze([...request.allowed_tools]),
    skills: Object.freeze(catalogSnapshot.items.map(({ skill_key }) => skill_key)),
  });
  const profile = snapshotRuntimeToolProfileV1(rawProfile);
  if (
    catalog.version !== request.expected_catalog_version ||
    catalog.as_of !== request.catalog_as_of ||
    request.planned_skills.some((skill) => !catalog.skills.includes(skill))
  ) {
    throw new RuntimeExecutionErrorV1("catalog_version_mismatch");
  }
  if (
    profile.profile_ref !==
      request.intent_policy_snapshot.tool_permission_profile_ref ||
    profile.revision !==
      request.intent_policy_snapshot.tool_permission_profile_revision ||
    profile.profile_hash !==
      request.intent_policy_snapshot.tool_permission_profile_hash ||
    profile.policy_epoch !== request.intent_policy_snapshot.tool_policy_epoch ||
    request.allowed_tools.some((tool) => !profile.allowed_tools.includes(tool))
  ) {
    throw new RuntimeExecutionErrorV1("tool_policy_denied");
  }
  const skillResponse =
    resolveRequest === undefined
      ? undefined
      : snapshotSkillResolveResponseV1(
          rawSkillResponse,
          resolveRequest,
          request.policy.expires_at,
        );
  if (
    skillResponse !== undefined &&
    skillResponse.details.security_revocation_epoch !==
      request.intent_policy_snapshot.security_revocation_epoch
  ) {
    throw new RuntimeExecutionErrorV1(
      "catalog_version_mismatch",
      "Skill Registry authoritative security epoch does not match the frozen policy input",
    );
  }
  const securityRevocationEpoch =
    skillResponse?.details.security_revocation_epoch ??
    request.intent_policy_snapshot.security_revocation_epoch;
  const skillResolutions: readonly RuntimeSkillResolutionV1[] = Object.freeze(
    (skillResponse?.details.resolved_skills ?? []).map((resolution) =>
      Object.freeze({
        ...resolution,
        security_revocation_epoch: securityRevocationEpoch,
      }),
    ),
  );
  const resolutionBySkill = new Map<string, RuntimeSkillResolutionV1>();
  const catalogBySkill = new Map(
    catalogSnapshot.items.map((item) => [item.skill_key, item] as const),
  );
  for (const resolution of skillResolutions) {
    const catalogItem = catalogBySkill.get(resolution.skill_key);
    if (
      !request.planned_skills.includes(resolution.skill_key) ||
      resolutionBySkill.has(resolution.skill_key) ||
      resolution.resolution_id.length === 0 ||
      resolution.skill_id.length === 0 ||
      resolution.version.length === 0 ||
      resolution.version_id.length === 0 ||
      !/^sha256:[0-9a-f]{64}$/u.test(resolution.package_digest) ||
      !/^sha256:[0-9a-f]{64}$/u.test(resolution.manifest_digest) ||
      resolution.runtime_target !== "filesystem_bundle.v1" ||
      resolution.security_revocation_epoch !==
        request.intent_policy_snapshot.security_revocation_epoch ||
      !Number.isFinite(Date.parse(resolution.valid_until)) ||
      Date.parse(resolution.valid_until) <= nowMs ||
      resolution.required !==
        request.structured_intent.required_skills.includes(
          resolution.skill_key,
        ) ||
      catalogItem === undefined ||
      resolution.version !== catalogItem.active_version ||
      resolution.package_digest !== catalogItem.package_digest ||
      resolution.manifest_digest !== catalogItem.manifest_digest ||
      resolution.runtime_target !== catalogItem.runtime_target
    ) {
      throw new RuntimeExecutionErrorV1(
        "catalog_version_mismatch",
        "Skill resolution does not match the frozen catalog and policy epoch",
      );
    }
    resolutionBySkill.set(
      resolution.skill_key,
      resolution,
    );
  }
  const degradedSkills = new Set(
    skillResponse?.details.degradation_notes.map(({ skill_key }) => skill_key) ??
      [],
  );
  if (
    request.planned_skills.some(
      (skill) =>
        resolutionBySkill.has(skill) === degradedSkills.has(skill) ||
        (request.structured_intent.required_skills.includes(skill) &&
          !resolutionBySkill.has(skill)),
    ) ||
    [...degradedSkills].some((skill) => !request.planned_skills.includes(skill))
  ) {
    throw new RuntimeExecutionErrorV1(
      "catalog_version_mismatch",
      "Skill Registry did not return one exact resolution or permitted degradation for every planned skill",
    );
  }
  const frozenSkillResolutions = Object.freeze(
    [...resolutionBySkill.values()].sort((left, right) =>
      left.skill_key.localeCompare(right.skill_key),
    ),
  );
  return {
    catalog,
    profile,
    skill_resolutions: frozenSkillResolutions,
    policy_snapshot_hash: canonicalPayloadHashV1({
      runtime_actor_binding_hash: actorBindingHash,
      policy_input_hash: request.policy_input_hash,
      catalog_version: catalog.version,
      catalog_as_of: catalog.as_of,
      profile_ref: profile.profile_ref,
      profile_revision: profile.revision,
      profile_hash: profile.profile_hash,
      policy_epoch: profile.policy_epoch,
      security_revocation_epoch:
        request.intent_policy_snapshot.security_revocation_epoch,
      allowed_tools: request.allowed_tools,
      allowed_skills: request.allowed_skills,
      planned_skills: request.planned_skills,
      skill_resolutions: frozenSkillResolutions.map((resolution) => ({
        resolution_id: resolution.resolution_id,
        skill_id: resolution.skill_id,
        skill_key: resolution.skill_key,
        version: resolution.version,
        version_id: resolution.version_id,
        package_digest: resolution.package_digest,
        manifest_digest: resolution.manifest_digest,
        granted_capability_refs: resolution.granted_capability_refs,
        runtime_target: resolution.runtime_target,
        required: resolution.required,
        security_revocation_epoch:
          resolution.security_revocation_epoch,
        valid_until: resolution.valid_until,
      })),
    }),
  };
}

function toolRequiresDelegatedPrincipalV1(
  toolName: string,
  capability: string,
): boolean {
  return (
    toolName === "memory.deepRecall" ||
    capability === "memory.deep_recall"
  );
}

function runtimePermissionsForV1(
  request: RuntimeStartRequestV1,
  profile: RuntimeToolPermissionProfileV1,
  capabilityFor: RuntimeToolPortV1["capabilityFor"],
  policySnapshotId: string,
  actorBinding: RuntimeActorBindingV1,
  actorBindingHash: string,
  createdAt: string,
): readonly RuntimePermissionProjectionV1[] {
  const toolNames =
    request.structured_intent.execution_mode === "deferred_timer_parent"
      ? request.allowed_tools.filter((toolName) => toolName === "timer.remind_after")
      : request.allowed_tools;
  const permissions = toolNames.flatMap((toolName) => {
    if (!profile.allowed_tools.includes(toolName)) {
      throw new RuntimeExecutionErrorV1("tool_policy_denied");
    }
    let capability: string;
    try {
      capability = capabilityFor(toolName);
    } catch {
      throw new RuntimeExecutionErrorV1(
        "tool_policy_denied",
        "The trusted tool route has no authorization mapping",
      );
    }
    if (
      typeof capability !== "string" ||
      capability.length === 0 ||
      capability.length > 512 ||
      /[\r\n]/u.test(capability)
    ) {
      throw new RuntimeExecutionErrorV1(
        "tool_policy_denied",
        "The trusted tool route contains an invalid capability",
      );
    }
    if (
      toolRequiresDelegatedPrincipalV1(toolName, capability) &&
      actorBinding.delegated_principal === null
    ) {
      return [];
    }
    return [
      Object.freeze({
        id:
          `runtime_permission:${request.runtime_run_id}:` +
          sha256TextV1(
            `${toolName}\u0000${capability}\u0000${actorBindingHash}`,
          ).slice("sha256:".length),
        runtime_run_id: request.runtime_run_id,
        policy_snapshot_id: policySnapshotId,
        capability,
        actor_binding_hash: actorBindingHash,
        scope: Object.freeze({ tool_name: toolName }),
        expires_at: request.policy.expires_at,
        created_at: createdAt,
      }),
    ];
  });
  const identities = new Set(permissions.map(({ id }) => id));
  if (identities.size !== permissions.length) {
    throw new RuntimeExecutionErrorV1(
      "tool_policy_denied",
      "Tool profile produced duplicate runtime permission projections",
    );
  }
  return Object.freeze(
    [...permissions].sort((left, right) => left.id.localeCompare(right.id)),
  );
}

function controlType(request: RuntimeControlRequestV1): RuntimeControlTypeV1 {
  if (request.schema_version === "runtime_cancel.v1") return "cancel";
  if (request.schema_version === "runtime_preempt.v1") return "preempt";
  return "user_retract";
}

export function assertRuntimeSkillMaterializationManifestV1(
  materialized: RuntimeSkillMaterializationV1,
): SkillPackageManifestV1 {
  let decoded: string;
  let parsed: unknown;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      materialized.manifest_bytes,
    );
    parsed = JSON.parse(decoded);
  } catch {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill package manifest is not canonical UTF-8 JSON",
    );
  }
  if (
    canonicalJsonV1(parsed) !== decoded ||
    !Value.Check(SkillPackageManifestV1Schema, parsed)
  ) {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill package manifest is not the canonical owner schema",
    );
  }
  const manifest = parsed as SkillPackageManifestV1;
  try {
    assertSkillPackageManifestSemanticBindingsV1(manifest);
  } catch {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill package manifest semantic bindings are invalid",
    );
  }
  if (
    manifest.runtime_target !== materialized.runtime_target ||
    manifest.files.length !== materialized.entry_paths.length ||
    manifest.files.length !== materialized.entries.length
  ) {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill package manifest file set differs from the materialization",
    );
  }
  for (let index = 0; index < manifest.files.length; index += 1) {
    const declared = manifest.files[index]!;
    const path = materialized.entry_paths[index];
    const entry = materialized.entries[index];
    if (
      entry === undefined ||
      path !== declared.path ||
      entry.path !== declared.path ||
      entry.mode !== declared.mode ||
      entry.bytes.byteLength !== declared.size_bytes ||
      entry.sha256 !== declared.sha256 ||
      sha256BytesV1(entry.bytes) !== declared.sha256
    ) {
      throw new RuntimeExecutionErrorV1(
        "skill_content_mismatch",
        "Skill package manifest path, mode, size, or hash differs from the extracted entry",
      );
    }
  }
  return Object.freeze(structuredClone(manifest));
}

function assertSdkCompatibleSkillMaterializationV1(
  resolution: RuntimeSkillResolutionV1,
  materialized: Awaited<ReturnType<RuntimeSkillPortV1["load"]>>,
  nowMs: number,
): void {
  assertRuntimeSkillMaterializationManifestV1(materialized);
  const entryPaths = materialized.entry_paths;
  const uniquePaths = new Set(entryPaths);
  const entries = materialized.entries;
  const entryFilePaths = new Set(entries.map(({ path }) => path));
  const totalExtractedBytes = entries.reduce(
    (total, entry) => total + entry.bytes.byteLength,
    0,
  );
  const invalidPath = (path: string) =>
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((segment) => segment === "..");
  if (
    !(materialized.bytes instanceof Uint8Array) ||
    materialized.bytes.byteLength === 0 ||
    materialized.bytes.byteLength > SKILL_PACKAGE_MAX_BYTES_V1 ||
    !(materialized.manifest_bytes instanceof Uint8Array) ||
    materialized.manifest_bytes.byteLength === 0 ||
    materialized.media_type.length === 0 ||
    materialized.media_type.length > 256 ||
    materialized.runtime_target !== "filesystem_bundle.v1" ||
    materialized.package_digest !== resolution.package_digest ||
    materialized.manifest_digest !== resolution.manifest_digest ||
    sha256BytesV1(materialized.bytes) !== resolution.package_digest ||
    sha256BytesV1(materialized.manifest_bytes) !==
      resolution.manifest_digest ||
    Date.parse(resolution.valid_until) <= nowMs ||
    entryPaths.length === 0 ||
    entryPaths.length > SKILL_PACKAGE_MAX_FILES_V1 ||
    uniquePaths.size !== entryPaths.length ||
    !uniquePaths.has("SKILL.md") ||
    entryPaths.some(invalidPath) ||
    entries.length !== entryPaths.length ||
    entryFilePaths.size !== entries.length ||
    entryPaths.some((path) => !entryFilePaths.has(path)) ||
    totalExtractedBytes < 1 ||
    totalExtractedBytes > SKILL_PACKAGE_MAX_BYTES_V1 ||
    entries.some(
      (entry) =>
        invalidPath(entry.path) ||
        !(entry.bytes instanceof Uint8Array) ||
        entry.bytes.byteLength === 0 ||
        !/^sha256:[0-9a-f]{64}$/u.test(entry.sha256) ||
        sha256BytesV1(entry.bytes) !== entry.sha256 ||
        (entry.path === "SKILL.md" &&
          entry.bytes.byteLength > SKILL_ENTRYPOINT_MAX_BYTES_V1),
    )
  ) {
    throw new RuntimeExecutionErrorV1(
      "skill_content_mismatch",
      "Skill materialization does not match the frozen SDK-compatible bundle",
    );
  }
}

function isControlRequest(value: unknown): value is RuntimeControlRequestV1 {
  return (
    Value.Check(RuntimeCancelContractV1Schema, value) ||
    Value.Check(RuntimePreemptContractV1Schema, value) ||
    Value.Check(RuntimeUserRetractContractV1Schema, value)
  );
}

function eventFor(
  run: RuntimeRunRecordV1,
  eventType:
    | "runtime.run.started"
    | "runtime.run.completed"
    | "runtime.run.failed"
    | "runtime.run.cancelled"
    | "runtime.run.preempted",
  status: "running" | "completed" | "failed" | "cancelled",
  occurredAt: string,
  reasonCode: string | null,
  errorSummary: string | null,
  terminalArtifactRef: string | null,
): RuntimeDomainEventV1 {
  const safeErrorSummary =
    status === "failed" && errorSummary !== null
      ? "Runtime execution failed; inspect the durable error artifact"
      : errorSummary;
  return {
    event_id: `${run.request.runtime_run_id}:${run.next_sequence_no}:${eventType}`,
    event_type: eventType,
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: occurredAt,
    idempotency_key:
      `${run.request.runtime_run_id}:${eventType}:${run.next_sequence_no}`,
    trace_id: run.request.trace_id,
    payload: {
      trigger_process_id: run.request.trigger_process_id,
      runtime_run_id: run.request.runtime_run_id,
      workspace_id: run.request.workspace_id,
      bot_id: run.request.bot_id,
      owner_agent_id: run.request.owner_agent_id,
      deployment_environment: run.request.deployment_environment,
      release_channel: run.request.release_channel,
      sequence_no: run.next_sequence_no,
      start_attempt_no: run.request.start_attempt_no,
      start_fence_generation: run.start_fence_generation,
      status,
      previous_status:
        eventType === "runtime.run.started" ? "queued" : run.status,
      next_status: status,
      model: run.model,
      reason: reasonCode,
      duration_ms: null,
      reason_code: reasonCode,
      error_summary: safeErrorSummary,
      terminal_artifact_ref: terminalArtifactRef,
    },
  } as RuntimeDomainEventV1;
}

function toolEventFor(
  run: RuntimeRunRecordV1,
  call: RuntimeToolCallV1,
  eventType:
    | "runtime.tool.requested"
    | "runtime.tool.completed"
    | "runtime.tool.failed"
    | "runtime.tool.cancelled",
  status: "requested" | "completed" | "failed" | "cancelled",
  occurredAt: string,
  audit: RuntimeToolAuditV1,
  result?: RuntimeToolResultV1,
  duplicateReplayed = false,
): RuntimeDomainEventV1 {
  const error =
    status === "failed" && result?.error !== undefined
      ? {
          failure_class:
            result.side_effect_status === "unknown"
              ? "external_outcome_unknown"
              : "tool_execution_failed",
          code:
            result.side_effect_status === "unknown"
              ? "external_outcome_unknown"
              : "tool_execution_failed",
          message:
            "Tool execution failed; inspect the durable tool-result artifact",
          retryable: result.retryable,
        }
      : null;
  const outputRef = audit.output_ref ?? null;
  return {
    event_id: `${run.request.runtime_run_id}:${run.next_sequence_no}:${eventType}:${call.tool_call_id}`,
    event_type: eventType,
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: occurredAt,
    idempotency_key: `${run.request.runtime_run_id}:tool:${call.tool_call_id}:${status}`,
    trace_id: run.request.trace_id,
    payload: {
      trigger_process_id: run.request.trigger_process_id,
      runtime_run_id: run.request.runtime_run_id,
      workspace_id: run.request.workspace_id,
      bot_id: run.request.bot_id,
      owner_agent_id: run.request.owner_agent_id,
      deployment_environment: run.request.deployment_environment,
      release_channel: run.request.release_channel,
      sequence_no: run.next_sequence_no,
      start_attempt_no: run.request.start_attempt_no,
      start_fence_generation: run.start_fence_generation,
      tool_invocation_id: call.tool_call_id,
      tool_name: call.tool_name,
      status,
      policy_snapshot_id: run.response.details.policy_snapshot_id,
      capability_token_id: audit.capability_token_id,
      input_ref: audit.input_ref,
      output_ref: outputRef,
      side_effect_status:
        status === "cancelled"
          ? "none"
          : (result?.side_effect_status ?? audit.side_effect_status),
      downstream_idempotency_key: audit.downstream_idempotency_key,
      external_response_ref:
        status === "completed"
          ? (result?.external_response_ref ?? null)
          : null,
      external_error_ref:
        status === "failed" ? (result?.external_error_ref ?? null) : null,
      duplicate_replayed: duplicateReplayed,
      error,
      duration_ms: null,
      reason_code:
        result?.error === undefined
          ? null
          : result.side_effect_status === "unknown"
            ? "external_outcome_unknown"
            : "tool_execution_failed",
      error_summary:
        result?.error === undefined
          ? null
          : "Tool execution failed; inspect the durable tool-result artifact",
      artifact_ref: outputRef,
    },
  } as RuntimeDomainEventV1;
}

function skillEventFor(
  run: RuntimeRunRecordV1,
  skillKey: string,
  eventType:
    | "runtime.skill.load.requested"
    | "runtime.skill.load.resolved"
    | "runtime.skill.load.materialized"
    | "runtime.skill.load.failed",
  status: "requested" | "resolved" | "materialized" | "failed",
  occurredAt: string,
  resolution?: RuntimeSkillResolutionV1,
  error?: unknown,
): RuntimeDomainEventV1 {
  return {
    event_id: `${run.request.runtime_run_id}:${run.next_sequence_no}:${eventType}:${skillKey}`,
    event_type: eventType,
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: occurredAt,
    idempotency_key: `${run.request.runtime_run_id}:skill:${skillKey}:${status}`,
    trace_id: run.request.trace_id,
    payload: {
      trigger_process_id: run.request.trigger_process_id,
      runtime_run_id: run.request.runtime_run_id,
      workspace_id: run.request.workspace_id,
      bot_id: run.request.bot_id,
      owner_agent_id: run.request.owner_agent_id,
      deployment_environment: run.request.deployment_environment,
      release_channel: run.request.release_channel,
      sequence_no: run.next_sequence_no,
      start_attempt_no: run.request.start_attempt_no,
      start_fence_generation: run.start_fence_generation,
      skill_key: skillKey,
      skill_version: resolution?.version ?? null,
      status,
      reason_code: error === undefined ? null : "skill_load_failed",
      error_summary:
        error === undefined
          ? null
          : "The exact frozen skill package could not be loaded",
      materialized_artifact_ref:
        status === "materialized"
          ? (resolution?.resolution_id ?? null)
          : null,
    },
  } as RuntimeDomainEventV1;
}

function artifactEventFor(
  run: RuntimeRunRecordV1,
  artifact: RuntimeArtifactMetadataV1,
  eventType: "runtime.artifact.created" | "runtime.artifact.failed",
  status: "available" | "failed",
  artifactRef: string | null,
  occurredAt: string,
  error?: unknown,
): RuntimeDomainEventV1 {
  return {
    event_id: `${run.request.runtime_run_id}:${run.next_sequence_no}:${eventType}:${artifact.artifact_id}`,
    event_type: eventType,
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: occurredAt,
    idempotency_key: `${run.request.runtime_run_id}:artifact:${artifact.artifact_id}:${status}`,
    trace_id: run.request.trace_id,
    payload: {
      trigger_process_id: run.request.trigger_process_id,
      runtime_run_id: run.request.runtime_run_id,
      workspace_id: run.request.workspace_id,
      bot_id: run.request.bot_id,
      owner_agent_id: run.request.owner_agent_id,
      deployment_environment: run.request.deployment_environment,
      release_channel: run.request.release_channel,
      sequence_no: run.next_sequence_no,
      start_attempt_no: run.request.start_attempt_no,
      start_fence_generation: run.start_fence_generation,
      artifact_id: artifact.artifact_id,
      artifact_ref: artifactRef,
      artifact_kind: artifact.artifact_kind,
      content_hash: artifact.content_hash,
      size_bytes: artifact.size_bytes,
      media_type: artifact.media_type,
      retention_until: artifact.retention_until,
      status,
      artifact_status: status,
      redaction_status: "complete",
      error:
        error === undefined
          ? null
          : {
              failure_class: "artifact_write_failed",
              code:
                error instanceof ObjectStoreErrorV1
                  ? error.code
                  : "artifact_write_failed",
              message: "Runtime artifact persistence failed",
              retryable: false,
            },
      reason_code: error === undefined ? null : "artifact_write_failed",
      error_summary:
        error === undefined ? null : "Runtime artifact persistence failed",
    },
  } as RuntimeDomainEventV1;
}

function runtimeArtifactRequestHashV1(
  run: RuntimeRunRecordV1,
  artifact: RuntimeArtifactMetadataV1,
  objectStoreIdempotencyKey: string,
): string {
  return canonicalPayloadHashV1({
    runtime_run_id: run.request.runtime_run_id,
    start_attempt_no: run.request.start_attempt_no,
    start_fence_generation: run.start_fence_generation,
    artifact_id: artifact.artifact_id,
    artifact_kind: artifact.artifact_kind,
    media_type: artifact.media_type,
    content_hash: artifact.content_hash,
    size_bytes: artifact.size_bytes,
    retention_until: artifact.retention_until,
    object_store_idempotency_key: objectStoreIdempotencyKey,
  });
}

function artifactMetadataFromRequestV1(
  request: RuntimeArtifactRequestV1,
): RuntimeArtifactMetadataV1 {
  return Object.freeze({
    artifact_id: request.artifact_id,
    artifact_kind: request.artifact_kind,
    media_type: request.media_type,
    content_hash: request.expected_sha256,
    size_bytes: request.body.byteLength,
    retention_until: request.retention_until,
  });
}

function artifactMetadataFromRecordV1(
  record: RuntimeArtifactRecordV1,
): RuntimeArtifactMetadataV1 {
  return Object.freeze({
    artifact_id: record.artifact_id,
    artifact_kind: record.artifact_kind,
    media_type: record.media_type,
    content_hash: record.content_hash,
    size_bytes: record.size_bytes,
    retention_until: record.retention_until,
  });
}

function runtimeArtifactFromJsonV1(
  run: RuntimeRunRecordV1,
  artifactId: string,
  artifactKind: string,
  value: unknown,
): RuntimeArtifactRequestV1 {
  let body: Uint8Array;
  try {
    body = Buffer.from(canonicalJsonV1(value), "utf8");
  } catch {
    throw new RuntimeExecutionErrorV1(
      "schema_validation_failed",
      `Runtime artifact ${artifactId} is not canonical JSON`,
    );
  }
  if (body.byteLength === 0) {
    throw new RuntimeExecutionErrorV1(
      "schema_validation_failed",
      `Runtime artifact ${artifactId} is empty`,
    );
  }
  return Object.freeze({
    artifact_id: artifactId,
    artifact_kind: artifactKind,
    media_type: "application/json",
    body,
    expected_sha256: sha256BytesV1(body),
    retention_until: run.request.policy.expires_at,
  });
}

function runtimeEventIdentityMatchesRunV1(
  event: RuntimeDomainEventV1,
  run: RuntimeRunRecordV1,
): boolean {
  const payload = event.payload;
  return (
    event.producer === "action_runtime" &&
    event.schema_version === "runtime_event.v1" &&
    event.trace_id === run.request.trace_id &&
    payload.trigger_process_id === run.request.trigger_process_id &&
    payload.runtime_run_id === run.request.runtime_run_id &&
    payload.workspace_id === run.request.workspace_id &&
    payload.bot_id === run.request.bot_id &&
    payload.owner_agent_id === run.request.owner_agent_id &&
    payload.deployment_environment ===
      run.request.deployment_environment &&
    payload.release_channel === run.request.release_channel &&
    payload.start_attempt_no === run.request.start_attempt_no &&
    payload.start_fence_generation === run.start_fence_generation
  );
}

function availableArtifactEventMatchesRequestV1(
  event: RuntimeDomainEventV1 | undefined,
  run: RuntimeRunRecordV1,
  artifact: RuntimeArtifactMetadataV1,
  expectedIdempotencyKey: string,
): boolean {
  if (
    event === undefined ||
    event.event_type !== "runtime.artifact.created" ||
    !Value.Check(RuntimeDomainEventV1Schema, event) ||
    !runtimeEventIdentityMatchesRunV1(event, run)
  ) {
    return false;
  }
  const payload = event.payload;
  return (
    event.idempotency_key === expectedIdempotencyKey &&
    payload.status === "available" &&
    payload.artifact_status === "available" &&
    payload.redaction_status === "complete" &&
    payload.error === null &&
    payload.reason_code === null &&
    payload.error_summary === null &&
    payload.artifact_id === artifact.artifact_id &&
    payload.artifact_ref !== null &&
    payload.artifact_ref.length > 0 &&
    payload.artifact_kind === artifact.artifact_kind &&
    payload.content_hash === artifact.content_hash &&
    payload.size_bytes === artifact.size_bytes &&
    payload.media_type === artifact.media_type &&
    payload.retention_until === artifact.retention_until
  );
}

function isCommittedAvailableArtifactRefV1(
  run: RuntimeRunRecordV1,
  artifactRef: string,
): boolean {
  return run.events.some(
    (event) =>
      event.event_type === "runtime.artifact.created" &&
      Value.Check(RuntimeDomainEventV1Schema, event) &&
      runtimeEventIdentityMatchesRunV1(event, run) &&
      event.payload.status === "available" &&
      event.payload.artifact_status === "available" &&
      event.payload.redaction_status === "complete" &&
      event.payload.error === null &&
      event.payload.reason_code === null &&
      event.payload.error_summary === null &&
      event.payload.artifact_ref === artifactRef,
  );
}

export function controlReceivedEventFor(
  run: RuntimeRunRecordV1,
  control: RuntimeControlRecordV1,
  occurredAt: string,
): RuntimeDomainEventV1 {
  return {
    event_id: `${run.request.runtime_run_id}:${run.next_sequence_no}:control:${control.request.runtime_signal_id}:received`,
    event_type: "runtime.control_signal.received",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: occurredAt,
    idempotency_key: `${control.request.idempotency_key}:received`,
    trace_id: control.request.trace_id,
    payload: {
      trigger_process_id: run.request.trigger_process_id,
      runtime_run_id: run.request.runtime_run_id,
      workspace_id: run.request.workspace_id,
      bot_id: run.request.bot_id,
      owner_agent_id: run.request.owner_agent_id,
      deployment_environment: run.request.deployment_environment,
      release_channel: run.request.release_channel,
      sequence_no: run.next_sequence_no,
      start_attempt_no: run.request.start_attempt_no,
      start_fence_generation: run.start_fence_generation,
      runtime_signal_id: control.request.runtime_signal_id,
      signal_type: control.control_type,
      requested_by: control.requested_by,
      control_valid_until: control.control_valid_until,
      status: "received",
      handled_status: null,
      target_lease_generation: control.target_lease_generation,
      handled_lease_generation: null,
      final_fencing_generation: null,
      safe_point_reached: null,
      late_events_isolated: null,
      last_runtime_sequence_no: null,
      safe_point_ref: null,
      isolation_proof_ref: null,
      reason_code: control.request.reason_code,
    },
  } as RuntimeDomainEventV1;
}

function controlHandledEventFor(
  run: RuntimeRunRecordV1,
  control: RuntimeControlRecordV1,
  occurredAt: string,
  handledStatus:
    | "handled_safe_point"
    | "already_terminal"
    | "isolation_unproven"
    | "cancelled_isolated_after_timeout",
  leaseGeneration: number | null,
): RuntimeDomainEventV1 {
  const safe = handledStatus === "handled_safe_point";
  return {
    event_id: `${run.request.runtime_run_id}:${run.next_sequence_no}:control:${control.request.runtime_signal_id}:handled`,
    event_type: "runtime.control_signal.handled",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: occurredAt,
    idempotency_key: `${control.request.idempotency_key}:handled`,
    trace_id: control.request.trace_id,
    payload: {
      trigger_process_id: run.request.trigger_process_id,
      runtime_run_id: run.request.runtime_run_id,
      workspace_id: run.request.workspace_id,
      bot_id: run.request.bot_id,
      owner_agent_id: run.request.owner_agent_id,
      deployment_environment: run.request.deployment_environment,
      release_channel: run.request.release_channel,
      sequence_no: run.next_sequence_no,
      start_attempt_no: run.request.start_attempt_no,
      start_fence_generation: run.start_fence_generation,
      runtime_signal_id: control.request.runtime_signal_id,
      signal_type: control.control_type,
      requested_by: control.requested_by,
      control_valid_until: control.control_valid_until,
      status: "handled",
      handled_status: handledStatus,
      target_lease_generation:
        control.target_lease_generation,
      handled_lease_generation: leaseGeneration,
      final_fencing_generation:
        control.final_fencing_generation ??
        Math.max(
          incrementSafeIntegerV1(
            run.start_fence_generation,
            "start_fence_generation",
          ),
          incrementSafeIntegerV1(
            leaseGeneration ?? 0,
            "lease_generation",
          ),
        ),
      safe_point_reached: safe,
      late_events_isolated:
        safe ||
        handledStatus === "already_terminal" ||
        handledStatus === "cancelled_isolated_after_timeout",
      last_runtime_sequence_no: run.next_sequence_no - 1,
      safe_point_ref: safe
        ? `runtime_safe_point:${run.request.runtime_run_id}:${run.next_sequence_no}`
        : null,
      isolation_proof_ref:
        handledStatus === "isolation_unproven"
          ? null
          : `runtime_isolation:${run.request.runtime_run_id}:${run.next_sequence_no}`,
      reason_code: control.request.reason_code,
    },
  } as RuntimeDomainEventV1;
}

function controlTombstoneEventsV1(
  principal: RuntimeStartPrincipalV1,
  request: RuntimeStoredControlRequestV1,
  controlTypeValue: RuntimeControlTypeV1,
  verification: RuntimeControlTokenClaimsV1,
  occurredAt: string,
): readonly [RuntimeDomainEventV1, RuntimeDomainEventV1] {
  const identity = {
    trigger_process_id: request.trigger_process_id,
    runtime_run_id: request.runtime_run_id,
    ...principal.scope,
    start_attempt_no: request.start_attempt_no,
    start_fence_generation: verification.start_fence_generation,
  };
  const received: RuntimeDomainEventV1 = {
    event_id: `${request.runtime_run_id}:1:control:${request.runtime_signal_id}:received`,
    event_type: "runtime.control_signal.received",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: occurredAt,
    idempotency_key: `${request.idempotency_key}:received`,
    trace_id: request.trace_id,
    payload: {
      ...identity,
      sequence_no: 1,
      runtime_signal_id: request.runtime_signal_id,
      signal_type: controlTypeValue,
      requested_by: "trigger_processor",
      control_valid_until: verification.control_valid_until,
      status: "received",
      handled_status: null,
      target_lease_generation: null,
      handled_lease_generation: null,
      final_fencing_generation: null,
      safe_point_reached: null,
      late_events_isolated: null,
      last_runtime_sequence_no: null,
      safe_point_ref: null,
      isolation_proof_ref: null,
      reason_code: request.reason_code,
    },
  } as RuntimeDomainEventV1;
  const handled: RuntimeDomainEventV1 = {
    event_id: `${request.runtime_run_id}:2:control:${request.runtime_signal_id}:handled`,
    event_type: "runtime.control_signal.handled",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: occurredAt,
    idempotency_key: `${request.idempotency_key}:handled`,
    trace_id: request.trace_id,
    payload: {
      ...identity,
      sequence_no: 2,
      runtime_signal_id: request.runtime_signal_id,
      signal_type: controlTypeValue,
      requested_by: "trigger_processor",
      control_valid_until: verification.control_valid_until,
      status: "handled",
      handled_status: "no_run_tombstoned",
      target_lease_generation: null,
      handled_lease_generation: null,
      final_fencing_generation:
        incrementSafeIntegerV1(
          verification.start_fence_generation,
          "start_fence_generation",
        ),
      safe_point_reached: false,
      late_events_isolated: true,
      last_runtime_sequence_no: null,
      safe_point_ref: null,
      isolation_proof_ref:
        `runtime_tombstone:${request.runtime_run_id}:${request.runtime_signal_id}`,
      reason_code: request.reason_code,
    },
  } as RuntimeDomainEventV1;
  return Object.freeze([received, handled]);
}

export interface RuntimeEventCallbackPortV1 {
  readonly worker_id: string;
  readonly lease_seconds: number;
  readonly transport_epoch: string;
  readonly transport_generation: number;
  deliver(
    event: RuntimeDomainEventV1,
    claim: Readonly<{
      outbox_id: string;
      claim_token: string;
      attempt_count: number;
      transport_epoch: string;
      transport_generation: number;
    }>,
    signal?: AbortSignal,
  ): Promise<Readonly<{ transport_ref: string }>>;
}

export interface RuntimeExecutionApplicationV1 {
  start(
    principal: RuntimeStartPrincipalV1,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<RuntimeStartResponseV1>;
  receiveControl(
    principal: RuntimeStartPrincipalV1,
    request: unknown,
  ): Promise<Readonly<{ accepted: true; replayed: boolean }>>;
  readPolicyInput(
    principal: RuntimePolicyReadPrincipalV1,
    runtimeRunId: string,
    startAttemptNo: number,
  ): Promise<RuntimePolicyInputReadArtifactV1>;
  readPolicyInputByReference(
    principal: RuntimePolicyReadPrincipalV1,
    policyInputRef: string,
  ): Promise<RuntimePolicyInputReadArtifactV1>;
  executeQueued(
    request: Readonly<{
      runtime_run_id: string;
      worker_id: string;
      expected_start_fence_generation: number;
      lease_seconds: number;
      deadline_at: string;
    }>,
    signal?: AbortSignal,
  ): Promise<RuntimeRunRecordV1>;
  heartbeat(
    request: Readonly<{
      runtime_run_id: string;
      worker_id: string;
      lease_generation: number;
      lease_seconds: number;
    }>,
  ): Promise<RuntimeLeaseV1>;
  recoverPendingCallbacks(
    limit?: number,
    signal?: AbortSignal,
  ): Promise<Readonly<{ attempted: number; sent: number }>>;
  recoverPendingArtifacts(
    request: Readonly<{
      worker_id: string;
      limit?: number;
      lease_seconds?: number;
    }>,
    signal?: AbortSignal,
  ): Promise<
    Readonly<{
      attempted: number;
      available: number;
      failed: number;
      pending: number;
    }>
  >;
  reconcileUnknownTool(
    principal: RuntimeToolReconciliationPrincipalV1,
    request: unknown,
  ): Promise<RuntimeToolReconciliationResultV1>;
}

export interface RuntimeExecutionDependenciesV1 {
  readonly store: RuntimeExecutionStoreV1;
  readonly reservation: RuntimeStartReservationValidationPortV1;
  readonly control_tokens: RuntimeControlTokenVerifierPortV1;
  readonly context_snapshots: RuntimeContextSnapshotPortV1;
  readonly policy_checkpoints: RuntimePolicyCheckpointPortV1;
  readonly profiles: RuntimeToolPermissionProfilePortV1;
  readonly adapter: RuntimeAdapterPortV1;
  readonly tools: RuntimeToolPortV1;
  readonly skills: RuntimeSkillPortV1;
  readonly object_store: ObjectStorePortV1;
  readonly callback: RuntimeEventCallbackPortV1;
}

function captureRuntimePortV1<T extends object>(
  sourceValue: unknown,
  methodSet: Readonly<Record<keyof T, true>>,
  label: string,
): T {
  if (
    typeof sourceValue !== "object" ||
    sourceValue === null ||
    nodeUtilTypes.isProxy(sourceValue)
  ) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      `${label} must be a non-Proxy object`,
    );
  }
  const source = sourceValue as object;
  const captured: Record<PropertyKey, unknown> = {};
  for (const methodName of Reflect.ownKeys(methodSet)) {
    if (typeof methodName !== "string") {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        `${label} declares a non-string method`,
      );
    }
    let current: object | null = source;
    let descriptor: PropertyDescriptor | undefined;
    for (let depth = 0; current !== null && depth < 16; depth += 1) {
      if (nodeUtilTypes.isProxy(current)) {
        throw new RuntimeExecutionErrorV1(
          "runtime_adapter_failed",
          `${label}.${methodName} has a Proxy prototype boundary`,
        );
      }
      descriptor = Object.getOwnPropertyDescriptor(current, methodName);
      if (descriptor !== undefined) break;
      current = Object.getPrototypeOf(current);
    }
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "function" ||
      nodeUtilTypes.isProxy(descriptor.value)
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        `${label}.${methodName} must resolve to a data-method`,
      );
    }
    const method = descriptor.value as (
      ...args: readonly unknown[]
    ) => unknown;
    Object.defineProperty(captured, methodName, {
      enumerable: true,
      configurable: false,
      writable: false,
      value: (...args: readonly unknown[]) =>
        Reflect.apply(method, source, args),
    });
  }
  return Object.freeze(captured) as T;
}

function captureRuntimeOwnDataV1(
  sourceValue: unknown,
  key: string,
  label: string,
): unknown {
  if (
    typeof sourceValue !== "object" ||
    sourceValue === null ||
    nodeUtilTypes.isProxy(sourceValue)
  ) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      `${label} must be a non-Proxy object`,
    );
  }
  const descriptor = Object.getOwnPropertyDescriptor(sourceValue, key);
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.enumerable !== true
  ) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      `${label}.${key} must be enumerable own data`,
    );
  }
  return descriptor.value;
}

const RUNTIME_STORE_METHODS_V1 = {
  beginStartAttempt: true,
  readStartAttempt: true,
  beginStartValidationCall: true,
  appendStartValidation: true,
  terminalizeStartAttempt: true,
  acceptStart: true,
  readRun: true,
  readPolicyInputArtifact: true,
  readPolicyInputArtifactByReference: true,
  claimQueuedRun: true,
  heartbeat: true,
  appendEvent: true,
  reserveArtifact: true,
  finalizeArtifact: true,
  claimPendingArtifacts: true,
  readArtifact: true,
  readArtifactByReference: true,
  recordToolRequested: true,
  markToolRunning: true,
  recordToolResult: true,
  freezeUnknownSideEffect: true,
  cancelUndispatchedTool: true,
  reconcileUnknownTool: true,
  receiveControl: true,
  receiveInternalControl: true,
  receiveControlTombstone: true,
  findControlTombstone: true,
  pendingControl: true,
  handleControl: true,
  finalizeAlreadyTerminalControl: true,
  claimOutbox: true,
  readOutboxAcknowledgeState: true,
  acknowledgeOutbox: true,
} as const satisfies Readonly<Record<keyof RuntimeExecutionStoreV1, true>>;

const RUNTIME_RESERVATION_METHODS_V1 = {
  validate: true,
} as const satisfies Readonly<
  Record<keyof RuntimeStartReservationValidationPortV1, true>
>;

const RUNTIME_CONTROL_TOKEN_METHODS_V1 = {
  verify: true,
} as const satisfies Readonly<
  Record<keyof RuntimeControlTokenVerifierPortV1, true>
>;

const RUNTIME_CONTEXT_SNAPSHOT_METHODS_V1 = {
  resolve: true,
} as const satisfies Readonly<
  Record<keyof RuntimeContextSnapshotPortV1, true>
>;

const RUNTIME_POLICY_CHECKPOINT_METHODS_V1 = {
  check: true,
} as const satisfies Readonly<
  Record<keyof RuntimePolicyCheckpointPortV1, true>
>;

const RUNTIME_PROFILE_METHODS_V1 = {
  resolveExact: true,
} as const satisfies Readonly<
  Record<keyof RuntimeToolPermissionProfilePortV1, true>
>;

type RuntimeAdapterMethodsV1 = Pick<
  RuntimeAdapterPortV1,
  "start" | "next" | "cancel"
>;

const RUNTIME_ADAPTER_METHODS_V1 = {
  start: true,
  next: true,
  cancel: true,
} as const satisfies Readonly<Record<keyof RuntimeAdapterMethodsV1, true>>;

const RUNTIME_TOOL_METHODS_V1 = {
  capabilityFor: true,
  invoke: true,
} as const satisfies Readonly<Record<keyof RuntimeToolPortV1, true>>;

const RUNTIME_SKILL_METHODS_V1 = {
  resolve: true,
  load: true,
} as const satisfies Readonly<Record<keyof RuntimeSkillPortV1, true>>;

const RUNTIME_OBJECT_STORE_METHODS_V1 = {
  putImmutable: true,
  head: true,
  getStream: true,
  issueReadGrant: true,
  deleteIfEligible: true,
} as const satisfies Readonly<Record<keyof ObjectStorePortV1, true>>;

type RuntimeCallbackMethodsV1 = Pick<
  RuntimeEventCallbackPortV1,
  "deliver"
>;

const RUNTIME_CALLBACK_METHODS_V1 = {
  deliver: true,
} as const satisfies Readonly<
  Record<keyof RuntimeCallbackMethodsV1, true>
>;

export function createRuntimeExecutionApplicationV1(
  rawDependencies: RuntimeExecutionDependenciesV1,
  options: Readonly<{
    now?: () => Date;
    max_adapter_turns?: number;
    max_retry_attempts?: number;
    retry_base_backoff_ms?: number;
    retry_max_backoff_ms?: number;
    retry_jitter?: "none" | "full";
    tool_timeout_ms?: number;
    /**
     * Keep the durable Runtime Run lease alive while a provider turn is in
     * flight. The worker cannot do this itself because it awaits execution.
     */
    heartbeat_interval_ms?: number;
    random?: () => number;
    validation_call_id_factory?: () => string;
    sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  }> = {},
): RuntimeExecutionApplicationV1 {
  const dependencySources = exactOwnDataRecordV1(
    rawDependencies,
    [
      "store",
      "reservation",
      "control_tokens",
      "context_snapshots",
      "policy_checkpoints",
      "profiles",
      "adapter",
      "tools",
      "skills",
      "object_store",
      "callback",
    ],
    "Runtime execution dependencies",
  );
  const adapterIdentity = Object.freeze({
    adapter_id: captureRuntimeOwnDataV1(
      dependencySources.adapter,
      "adapter_id",
      "Runtime adapter",
    ),
    sdk_package: captureRuntimeOwnDataV1(
      dependencySources.adapter,
      "sdk_package",
      "Runtime adapter",
    ),
    sdk_version: captureRuntimeOwnDataV1(
      dependencySources.adapter,
      "sdk_version",
      "Runtime adapter",
    ),
    model: captureRuntimeOwnDataV1(
      dependencySources.adapter,
      "model",
      "Runtime adapter",
    ),
  });
  if (
    adapterIdentity.adapter_id !== "ClaudeAgentSdkRuntimeAdapter" ||
    adapterIdentity.sdk_package !==
      "@anthropic-ai/claude-agent-sdk" ||
    adapterIdentity.sdk_version !== "0.3.212" ||
    typeof adapterIdentity.model !== "string" ||
    adapterIdentity.model.length === 0 ||
    adapterIdentity.model.length > 256 ||
    /[\r\n]/u.test(adapterIdentity.model)
  ) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      "Action Runtime requires ClaudeAgentSdkRuntimeAdapter backed by @anthropic-ai/claude-agent-sdk@0.3.212",
    );
  }
  const adapterMethods = captureRuntimePortV1<RuntimeAdapterMethodsV1>(
    dependencySources.adapter,
    RUNTIME_ADAPTER_METHODS_V1,
    "Runtime adapter",
  );
  const callbackIdentity = Object.freeze({
    worker_id: captureRuntimeOwnDataV1(
      dependencySources.callback,
      "worker_id",
      "Runtime callback dispatcher",
    ),
    lease_seconds: captureRuntimeOwnDataV1(
      dependencySources.callback,
      "lease_seconds",
      "Runtime callback dispatcher",
    ),
    transport_epoch: captureRuntimeOwnDataV1(
      dependencySources.callback,
      "transport_epoch",
      "Runtime callback dispatcher",
    ),
    transport_generation: captureRuntimeOwnDataV1(
      dependencySources.callback,
      "transport_generation",
      "Runtime callback dispatcher",
    ),
  });
  if (
    typeof callbackIdentity.worker_id !== "string" ||
    !/^[A-Za-z0-9._:-]{1,128}$/u.test(callbackIdentity.worker_id) ||
    !Number.isSafeInteger(callbackIdentity.lease_seconds) ||
    (callbackIdentity.lease_seconds as number) < 1 ||
    (callbackIdentity.lease_seconds as number) > 300 ||
    typeof callbackIdentity.transport_epoch !== "string" ||
    callbackIdentity.transport_epoch.length < 1 ||
    callbackIdentity.transport_epoch.length > 128 ||
    !Number.isSafeInteger(callbackIdentity.transport_generation) ||
    (callbackIdentity.transport_generation as number) < 1
  ) {
    throw new RuntimeExecutionErrorV1(
      "runtime_adapter_failed",
      "Runtime callback dispatcher has no valid worker lease and transport authority",
    );
  }
  const callbackMethods =
    captureRuntimePortV1<Pick<RuntimeEventCallbackPortV1, "deliver">>(
      dependencySources.callback,
      RUNTIME_CALLBACK_METHODS_V1,
      "Runtime callback dispatcher",
    );
  const dependencies = Object.freeze({
    store: captureRuntimePortV1<RuntimeExecutionStoreV1>(
      dependencySources.store,
      RUNTIME_STORE_METHODS_V1,
      "Runtime owner store",
    ),
    reservation:
      captureRuntimePortV1<RuntimeStartReservationValidationPortV1>(
        dependencySources.reservation,
        RUNTIME_RESERVATION_METHODS_V1,
        "Runtime reservation verifier",
      ),
    control_tokens:
      captureRuntimePortV1<RuntimeControlTokenVerifierPortV1>(
        dependencySources.control_tokens,
        RUNTIME_CONTROL_TOKEN_METHODS_V1,
        "Runtime control-token verifier",
      ),
    context_snapshots:
      captureRuntimePortV1<RuntimeContextSnapshotPortV1>(
        dependencySources.context_snapshots,
        RUNTIME_CONTEXT_SNAPSHOT_METHODS_V1,
        "Runtime context-snapshot resolver",
      ),
    policy_checkpoints:
      captureRuntimePortV1<RuntimePolicyCheckpointPortV1>(
        dependencySources.policy_checkpoints,
        RUNTIME_POLICY_CHECKPOINT_METHODS_V1,
        "Runtime policy checkpoint",
      ),
    profiles:
      captureRuntimePortV1<RuntimeToolPermissionProfilePortV1>(
        dependencySources.profiles,
        RUNTIME_PROFILE_METHODS_V1,
        "Runtime tool-profile resolver",
      ),
    adapter: Object.freeze({
      adapter_id: adapterIdentity.adapter_id,
      sdk_package: adapterIdentity.sdk_package,
      sdk_version: adapterIdentity.sdk_version,
      model: adapterIdentity.model,
      ...adapterMethods,
    }),
    tools: captureRuntimePortV1<RuntimeToolPortV1>(
      dependencySources.tools,
      RUNTIME_TOOL_METHODS_V1,
      "Runtime tool dispatcher",
    ),
    skills: captureRuntimePortV1<RuntimeSkillPortV1>(
      dependencySources.skills,
      RUNTIME_SKILL_METHODS_V1,
      "Runtime skill resolver",
    ),
    object_store: captureRuntimePortV1<ObjectStorePortV1>(
      dependencySources.object_store,
      RUNTIME_OBJECT_STORE_METHODS_V1,
      "Runtime ObjectStore",
    ),
    callback: Object.freeze({
      worker_id: callbackIdentity.worker_id,
      lease_seconds: callbackIdentity.lease_seconds as number,
      transport_epoch: callbackIdentity.transport_epoch,
      transport_generation:
        callbackIdentity.transport_generation as number,
      ...callbackMethods,
    }),
  }) satisfies RuntimeExecutionDependenciesV1;
  const profilePort = dependencies.profiles;
  const skillPort = dependencies.skills;
  const toolCapabilityFor = dependencies.tools.capabilityFor;
  const invokeTool = dependencies.tools.invoke;
  const adapterStart = dependencies.adapter.start;
  const adapterNext = dependencies.adapter.next;
  const adapterCancel = dependencies.adapter.cancel;
  const now = options.now ?? (() => new Date());
  const maxAdapterTurns = options.max_adapter_turns ?? 1_000;
  const maxRetryAttempts = options.max_retry_attempts ?? 5;
  const retryBaseBackoffMs = options.retry_base_backoff_ms ?? 500;
  const retryMaxBackoffMs = options.retry_max_backoff_ms ?? 30_000;
  const retryJitter = options.retry_jitter ?? "full";
  const toolTimeoutMs = options.tool_timeout_ms ?? 300_000;
  const heartbeatIntervalMs = options.heartbeat_interval_ms ?? 5_000;
  const random = options.random ?? Math.random;
  const validationCallIdFactory =
    options.validation_call_id_factory ??
    (() => `runtime-start-validation:${randomUUID()}`);
  const sleep = options.sleep ?? sleepAbortableV1;
  assertPositiveSafeInteger(maxAdapterTurns, "max_adapter_turns");
  if (
    !Number.isSafeInteger(maxRetryAttempts) ||
    maxRetryAttempts < 0 ||
    maxRetryAttempts > 10 ||
    !Number.isSafeInteger(retryBaseBackoffMs) ||
    retryBaseBackoffMs < 100 ||
    retryBaseBackoffMs > 5_000 ||
    !Number.isSafeInteger(retryMaxBackoffMs) ||
    retryMaxBackoffMs < 1_000 ||
    retryMaxBackoffMs > 120_000 ||
    retryBaseBackoffMs > retryMaxBackoffMs ||
    (retryJitter !== "none" && retryJitter !== "full") ||
    !Number.isSafeInteger(toolTimeoutMs) ||
    toolTimeoutMs < 1_000 ||
    toolTimeoutMs > 3_600_000 ||
    !Number.isSafeInteger(heartbeatIntervalMs) ||
    heartbeatIntervalMs < 1 ||
    heartbeatIntervalMs > 20_000
  ) {
    throw new Error(
      "Action Runtime retry or tool timeout configuration is invalid",
    );
  }
  const beginReservationValidationCallV1 = async (
    request: RuntimeStoredStartRequestV1,
    startRequestHash: string,
    actorBindingHash: string,
    stage: RuntimeReservationValidationStageV1,
    ownerRequest: RuntimeStartReservationValidateRequestV1,
  ): Promise<RuntimeStartValidationCallV1> => {
    const validationCallId = validationCallIdFactory();
    const requestedAt = now().toISOString();
    if (
      typeof validationCallId !== "string" ||
      !/^[A-Za-z0-9._:-]{1,256}$/u.test(validationCallId) ||
      !Number.isFinite(Date.parse(requestedAt))
    ) {
      throw new RuntimeExecutionErrorV1(
        "schema_validation_failed",
        "Runtime Start validation call identity is invalid",
      );
    }
    const call: RuntimeStartValidationCallV1 = Object.freeze({
      validation_call_id: validationCallId,
      validation_stage: stage,
      request_hash: canonicalPayloadHashV1(ownerRequest),
      trace_id: ownerRequest.trace_id,
      requested_at: requestedAt,
    });
    const prepared =
      await dependencies.store.beginStartValidationCall({
        runtime_run_id: request.runtime_run_id,
        request_hash: startRequestHash,
        start_fence_token_hash:
          request.start_fence_token_hash,
        actor_binding_hash: actorBindingHash,
        call,
      });
    if (prepared.outcome !== "prepared") {
      throw new RuntimeExecutionErrorV1(
        "reservation_unavailable",
        "Runtime Start validation call identity was already used; no duplicate owner interaction was issued",
        true,
      );
    }
    const persistedAttempt = prepared.attempt;
    const persisted = persistedAttempt.validation_calls.find(
      (candidate) =>
        candidate.validation_call_id ===
        call.validation_call_id,
    );
    if (
      persisted === undefined ||
      canonicalJsonV1(persisted) !== canonicalJsonV1(call)
    ) {
      throw new RuntimeExecutionErrorV1(
        "idempotency_conflict",
        "Runtime Start validation call was not durably prepared before owner interaction",
      );
    }
    return persisted;
  };
  const appendStartValidationEvidenceV1 = async (
    request: RuntimeStoredStartRequestV1,
    startRequestHash: string,
    actorBindingHash: string,
    fact: RuntimeStartValidationFactInputV1,
  ): Promise<RuntimeStartValidationFactV1> => {
    const findCommittedEvidence = (
      attempt: RuntimeStartAttemptV1 | undefined,
    ): RuntimeStartValidationFactV1 | undefined =>
      attempt?.validation_facts.find(
        (candidate) =>
          candidate.validation_call_id ===
            fact.validation_call_id &&
          candidate.validation_stage ===
            fact.validation_stage &&
          candidate.validation_result ===
            fact.validation_result &&
          candidate.response_source === fact.response_source &&
          candidate.response_schema_version ===
            fact.response_schema_version &&
          candidate.request_hash === fact.request_hash &&
          secureDigestEqualsV1(
            candidate.start_fence_token_hash,
            fact.start_fence_token_hash,
          ) &&
          candidate.response_hash === fact.response_hash &&
          canonicalJsonV1(candidate.response) ===
            canonicalJsonV1(fact.response),
      );
    try {
      const committedAttempt =
        await dependencies.store.appendStartValidation({
          runtime_run_id: request.runtime_run_id,
          request_hash: startRequestHash,
          start_fence_token_hash:
            request.start_fence_token_hash,
          actor_binding_hash: actorBindingHash,
          fact,
        });
      const committedEvidence =
        findCommittedEvidence(committedAttempt);
      if (committedEvidence === undefined) {
        throw new RuntimeExecutionErrorV1(
          "idempotency_conflict",
          "Runtime Start owner response append returned without the exact durable ledger fact",
        );
      }
      return committedEvidence;
    } catch (appendError) {
      const attempt = await dependencies.store.readStartAttempt(
        request.runtime_run_id,
      );
      const committedEvidence = findCommittedEvidence(attempt);
      if (committedEvidence !== undefined) {
        return committedEvidence;
      }
      if (appendError instanceof RuntimeExecutionErrorV1) {
        throw appendError;
      }
      throw new RuntimeExecutionErrorV1(
        "reservation_unavailable",
        "Runtime Start owner response evidence could not be made durable",
        true,
      );
    }
  };
  const appendReservationOwnerErrorEvidenceV1 = async (
    error: unknown,
    request: RuntimeStoredStartRequestV1,
    startRequestHash: string,
    actorBindingHash: string,
    validationCall: RuntimeStartValidationCallV1 | undefined,
  ): Promise<RuntimeStartValidationFactV1 | undefined> => {
    if (!(error instanceof RuntimeReservationOwnerErrorV1)) {
      return undefined;
    }
    if (validationCall === undefined) {
      throw new RuntimeExecutionErrorV1(
        "idempotency_conflict",
        "Runtime Start owner response has no durable validation call identity",
      );
    }
    const fact = runtimeStartValidationErrorFactV1(
      validationCall,
      request.start_fence_token_hash,
      error.owner_response,
      now().toISOString(),
    );
    return appendStartValidationEvidenceV1(
      request,
      startRequestHash,
      actorBindingHash,
      fact,
    );
  };
  const ownerFailureDecisionFromValidationLedgerV1 = (
    durableOwnerEvidence: RuntimeStartValidationFactV1,
    validationCall: RuntimeStartValidationCallV1,
    request: Pick<
      RuntimeStoredStartRequestV1,
      "trigger_process_id" | "start_attempt_no"
    >,
  ): Readonly<{
    failure_code: RuntimeExecutionErrorCodeV1;
    retryable: boolean;
  }> => {
    if (
      durableOwnerEvidence.validation_result !== "error" ||
      durableOwnerEvidence.response.schema_version !==
        "runtime_start_reservation_validate_error.v1" ||
      durableOwnerEvidence.validation_call_id !==
        validationCall.validation_call_id ||
      durableOwnerEvidence.validation_stage !==
        validationCall.validation_stage ||
      durableOwnerEvidence.request_hash !==
        validationCall.request_hash
    ) {
      throw new RuntimeExecutionErrorV1(
        "idempotency_conflict",
        "Runtime Start owner failure cannot drive retry or terminal state without its exact durable call-bound ledger evidence",
      );
    }
    const ownerResponse = durableOwnerEvidence.response;
    if (
      ownerResponse.trace_id !== validationCall.trace_id ||
      (ownerResponse.details.trigger_process_id !== null &&
        ownerResponse.details.trigger_process_id !==
          request.trigger_process_id) ||
      (ownerResponse.details.start_attempt_no !== null &&
        ownerResponse.details.start_attempt_no !==
          request.start_attempt_no) ||
      (ownerResponse.details.validation_stage !== null &&
        ownerResponse.details.validation_stage !==
          durableOwnerEvidence.validation_stage)
    ) {
      return Object.freeze({
        failure_code: "reservation_invalid",
        retryable: false,
      });
    }
    return Object.freeze({
      failure_code:
        ownerResponse.code === "storage_unavailable" ||
        ownerResponse.code === "internal_error"
          ? "reservation_unavailable"
          : (ownerResponse.code as RuntimeExecutionErrorCodeV1),
      retryable: ownerResponse.retryable,
    });
  };
  const startFailureDecisionFromValidationLedgerV1 = (
    error: unknown,
    durableOwnerEvidence: RuntimeStartValidationFactV1 | undefined,
    validationCall: RuntimeStartValidationCallV1 | undefined,
    request: Pick<
      RuntimeStoredStartRequestV1,
      "trigger_process_id" | "start_attempt_no"
    >,
  ): Readonly<{
    failure_code: RuntimeExecutionErrorCodeV1;
    retryable: boolean;
  }> => {
    if (error instanceof RuntimeReservationOwnerErrorV1) {
      if (
        durableOwnerEvidence === undefined ||
        validationCall === undefined ||
        durableOwnerEvidence.response_hash !==
          canonicalPayloadHashV1(error.owner_response) ||
        canonicalJsonV1(durableOwnerEvidence.response) !==
          canonicalJsonV1(error.owner_response)
      ) {
        throw new RuntimeExecutionErrorV1(
          "idempotency_conflict",
          "Runtime Start owner failure cannot drive retry or terminal state without its exact durable ledger evidence",
        );
      }
      return ownerFailureDecisionFromValidationLedgerV1(
        durableOwnerEvidence,
        validationCall,
        request,
      );
    }
    return Object.freeze({
      failure_code:
        error instanceof RuntimeExecutionErrorV1
          ? error.code
          : "reservation_invalid",
      retryable:
        error instanceof RuntimeExecutionErrorV1 &&
        error.retryable,
    });
  };
  const latestDurableOwnerFailureAtStageV1 = (
    attempt: RuntimeStartAttemptV1,
    stage: RuntimeReservationValidationStageV1,
  ):
    | Readonly<{
        evidence: RuntimeStartValidationFactV1;
        decision: Readonly<{
          failure_code: RuntimeExecutionErrorCodeV1;
          retryable: boolean;
        }>;
      }>
    | undefined => {
    const latestEvidence = [...attempt.validation_facts]
      .reverse()
      .find(
        (fact) =>
          fact.validation_stage === stage,
      );
    if (
      latestEvidence === undefined ||
      latestEvidence.validation_result !== "error" ||
      latestEvidence.response.schema_version !==
        "runtime_start_reservation_validate_error.v1"
    ) {
      return undefined;
    }
    const evidence = latestEvidence;
    const validationCall = attempt.validation_calls.find(
      (call) =>
        call.validation_call_id ===
        evidence.validation_call_id,
    );
    if (validationCall === undefined) {
      throw new RuntimeExecutionErrorV1(
        "idempotency_conflict",
        "Runtime Start owner failure ledger references no durable validation call",
      );
    }
    return Object.freeze({
      evidence,
      decision: ownerFailureDecisionFromValidationLedgerV1(
        evidence,
        validationCall,
        attempt,
      ),
    });
  };
  const waitBeforeRetry = async (
    retryIndex: number,
    signal?: AbortSignal,
  ): Promise<void> => {
    const exponentialCap = Math.min(
      retryMaxBackoffMs,
      retryBaseBackoffMs * 2 ** Math.min(retryIndex, 30),
    );
    let delay = exponentialCap;
    if (retryJitter === "full") {
      const sample = random();
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new Error(
          "Action Runtime retry random source must return [0, 1)",
        );
      }
      delay = Math.floor(sample * exponentialCap);
    }
    await sleep(delay, signal);
  };
  function assertRuntimeEvent(event: RuntimeDomainEventV1): void {
    if (!Value.Check(RuntimeDomainEventV1Schema, event)) {
      throw new RuntimeExecutionErrorV1(
        "schema_validation_failed",
        "Action Runtime produced an invalid domain event",
      );
    }
    assertRuntimeDomainEventSemanticBindingsV1(event);
  }

  function snapshotOutboxRecordV1(
    value: unknown,
    expectedStatus?: RuntimeOutboxRecordV1["status"],
  ): RuntimeOutboxRecordV1 {
    const record =
      canonicalJsonSnapshotV1<RuntimeOutboxRecordV1>(
        value,
        "runtime_adapter_failed",
        "Runtime owner returned a non-canonical outbox record",
      );
    if (
      Object.keys(record).sort().join(",") !==
        "attempt_count,event,id,status" ||
      typeof record.id !== "string" ||
      record.id.length < 1 ||
      record.id.length > 2_048 ||
      !Number.isSafeInteger(record.attempt_count) ||
      record.attempt_count < 0 ||
      (record.status !== "pending" &&
        record.status !== "sent" &&
        record.status !== "failed") ||
      (expectedStatus !== undefined && record.status !== expectedStatus)
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime owner returned an invalid outbox record",
      );
    }
    assertRuntimeEvent(record.event);
    return record;
  }

  function runtimeRunIdForOutboxV1(
    record: RuntimeOutboxRecordV1,
  ): string {
    const payload = record.event.payload as Readonly<
      Record<string, unknown>
    >;
    if (
      typeof payload.runtime_run_id !== "string" ||
      payload.runtime_run_id.length < 1
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime outbox event has no owner identity",
      );
    }
    return payload.runtime_run_id;
  }

  function sameOutboxIdentityV1(
    left: RuntimeOutboxRecordV1,
    right: RuntimeOutboxRecordV1,
  ): boolean {
    return (
      left.id === right.id &&
      runtimeRunIdForOutboxV1(left) ===
        runtimeRunIdForOutboxV1(right) &&
      left.event.event_id === right.event.event_id &&
      canonicalPayloadHashV1(left.event) ===
        canonicalPayloadHashV1(right.event)
    );
  }

  function snapshotOutboxClaimV1(
    value: unknown,
  ): RuntimeOutboxClaimRecordV1 {
    const claim =
      canonicalJsonSnapshotV1<RuntimeOutboxClaimRecordV1>(
        value,
        "runtime_adapter_failed",
        "Runtime owner returned a non-canonical outbox claim",
      );
    if (
      Object.keys(claim).sort().join(",") !==
        "attempt_count,claim_token,event,id,lease_expires_at,status,transport_epoch,transport_generation,worker_id" ||
      claim.status !== "pending" ||
      typeof claim.worker_id !== "string" ||
      !/^[A-Za-z0-9._:-]{1,128}$/u.test(claim.worker_id) ||
      typeof claim.claim_token !== "string" ||
      claim.claim_token.length < 1 ||
      claim.claim_token.length > 256 ||
      !Number.isFinite(Date.parse(claim.lease_expires_at)) ||
      typeof claim.transport_epoch !== "string" ||
      claim.transport_epoch.length < 1 ||
      claim.transport_epoch.length > 128 ||
      !Number.isSafeInteger(claim.transport_generation) ||
      claim.transport_generation < 1
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime owner returned an invalid outbox claim",
      );
    }
    snapshotOutboxRecordV1(
      {
        id: claim.id,
        event: claim.event,
        status: claim.status,
        attempt_count: claim.attempt_count,
      },
      "pending",
    );
    if (claim.attempt_count < 1) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime owner returned an unattempted outbox claim",
      );
    }
    return claim;
  }

  function snapshotOutboxAckConfirmationV1(
    value: unknown,
  ): RuntimeOutboxAckConfirmationV1 {
    const confirmation =
      canonicalJsonSnapshotV1<RuntimeOutboxAckConfirmationV1>(
        value,
        "runtime_adapter_failed",
        "Runtime owner returned a non-canonical outbox ACK",
      );
    if (
      Object.keys(confirmation).length !== 1 ||
      confirmation.acknowledged !== true
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime outbox ACK did not confirm its fenced compare-and-set",
      );
    }
    return confirmation;
  }

  function snapshotAuthoritativeOutboxAckV1(
    value: unknown,
  ): RuntimeOutboxAuthoritativeAckV1 {
    const authoritative =
      canonicalJsonSnapshotV1<RuntimeOutboxAuthoritativeAckV1>(
        value,
        "runtime_adapter_failed",
        "Runtime owner returned a non-canonical authoritative ACK",
      );
    if (
      Object.keys(authoritative).sort().join(",") !==
        "acknowledged_at,claim_token,record,transport_epoch,transport_generation,transport_ref" ||
      typeof authoritative.claim_token !== "string" ||
      authoritative.claim_token.length < 1 ||
      authoritative.claim_token.length > 256 ||
      typeof authoritative.transport_ref !== "string" ||
      authoritative.transport_ref.length < 1 ||
      authoritative.transport_ref.length > 2_048 ||
      typeof authoritative.transport_epoch !== "string" ||
      authoritative.transport_epoch.length < 1 ||
      authoritative.transport_epoch.length > 128 ||
      !Number.isSafeInteger(authoritative.transport_generation) ||
      authoritative.transport_generation < 1 ||
      !Number.isFinite(Date.parse(authoritative.acknowledged_at)) ||
      Date.parse(authoritative.acknowledged_at) > now().getTime()
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime owner returned an invalid authoritative ACK",
      );
    }
    snapshotOutboxRecordV1(authoritative.record, "sent");
    return authoritative;
  }

  async function acknowledgeOutboxClaimV1(
    claim: RuntimeOutboxClaimRecordV1,
    outcome:
      | Readonly<{ kind: "sent"; transport_ref: string }>
      | Readonly<{
        kind: "retry_wait";
        error: Readonly<Record<string, unknown>>;
      }>
      | Readonly<{
        kind: "failed";
        error: Readonly<Record<string, unknown>>;
      }>,
  ): Promise<void> {
    const acknowledgedAt = now().toISOString();
    const sent = outcome.kind === "sent";
    const failed = outcome.kind === "failed";
    const request = Object.freeze({
      outbox_id: claim.id,
      claim_token: claim.claim_token,
      outcome: sent
        ? ("sent" as const)
        : failed
          ? ("failed" as const)
          : ("retry_wait" as const),
      next_retry_at: sent || failed ? null : acknowledgedAt,
      error: sent
        ? null
        : outcome.error,
      transport_ref: sent ? outcome.transport_ref : null,
      transport_epoch: sent ? claim.transport_epoch : null,
      transport_generation: sent
        ? claim.transport_generation
        : null,
      current_transport_epoch: claim.transport_epoch,
      current_transport_generation: claim.transport_generation,
      now: acknowledgedAt,
      runtime_run_id: runtimeRunIdForOutboxV1(claim),
      event_id: claim.event.event_id,
      event_hash: canonicalPayloadHashV1(claim.event),
      expected_attempt_count: claim.attempt_count,
    }) satisfies RuntimeOutboxAckRequestV1;
    try {
      snapshotOutboxAckConfirmationV1(
        await dependencies.store.acknowledgeOutbox(request),
      );
      return;
    } catch (ackError) {
      if (!sent) throw ackError;
      const authoritativeValue =
        await dependencies.store.readOutboxAcknowledgeState(
          request,
        );
      if (authoritativeValue === undefined) throw ackError;
      const authoritative =
        snapshotAuthoritativeOutboxAckV1(authoritativeValue);
      if (
        !sameOutboxIdentityV1(claim, authoritative.record) ||
        authoritative.record.attempt_count !==
          claim.attempt_count ||
        authoritative.claim_token !== claim.claim_token ||
        authoritative.transport_ref !== outcome.transport_ref ||
        authoritative.transport_epoch !== claim.transport_epoch ||
        authoritative.transport_generation !==
          claim.transport_generation
      ) {
        throw ackError;
      }
    }
  }

  function callbackFailureDetailsV1(
    error: unknown,
  ): Readonly<Record<string, unknown>> {
    if (error instanceof InternalClientError) {
      return Object.freeze({
        code: error.code,
        retryable: error.retryable,
        ...(error.status === undefined ? {} : { status: error.status }),
      });
    }
    if (error instanceof RuntimeExecutionErrorV1) {
      return Object.freeze({
        code: error.code,
        retryable: error.retryable,
      });
    }
    return Object.freeze({ code: "callback_delivery_failed", retryable: true });
  }

  function isPermanentCallbackFailureV1(error: unknown): boolean {
    return (
      (error instanceof InternalClientError && !error.retryable) ||
      (error instanceof RuntimeExecutionErrorV1 && !error.retryable)
    );
  }

  async function deliverClaimedOutboxV1(
    claimValue: RuntimeOutboxClaimRecordV1,
    signal?: AbortSignal,
  ): Promise<void> {
    const claim = snapshotOutboxClaimV1(claimValue);
    if (
      claim.worker_id !== dependencies.callback.worker_id ||
      claim.transport_epoch !==
        dependencies.callback.transport_epoch ||
      claim.transport_generation !==
        dependencies.callback.transport_generation ||
      Date.parse(claim.lease_expires_at) <= now().getTime()
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime callback claim is stale or bound to another worker authority",
      );
    }
    let receiptValue: Readonly<{ transport_ref: string }>;
    try {
      receiptValue = await dependencies.callback.deliver(
        claim.event,
        Object.freeze({
          outbox_id: claim.id,
          claim_token: claim.claim_token,
          attempt_count: claim.attempt_count,
          transport_epoch: claim.transport_epoch,
          transport_generation: claim.transport_generation,
        }),
        signal,
      );
    } catch (deliveryError) {
      if (signal?.aborted === true) throw signal.reason;
      const error = callbackFailureDetailsV1(deliveryError);
      try {
        await acknowledgeOutboxClaimV1(claim, {
          kind: isPermanentCallbackFailureV1(deliveryError)
            ? "failed"
            : "retry_wait",
          error,
        });
      } catch {
        // The claim remains leased when retry scheduling is commit-unknown.
      }
      throw deliveryError;
    }
    const receipt =
      canonicalJsonSnapshotV1<Readonly<{ transport_ref: string }>>(
        receiptValue,
        "runtime_adapter_failed",
        "Runtime callback returned a non-canonical transport receipt",
      );
    if (
      Object.keys(receipt).length !== 1 ||
      typeof receipt.transport_ref !== "string" ||
      receipt.transport_ref.length < 1 ||
      receipt.transport_ref.length > 2_048
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime callback returned an invalid transport receipt",
      );
    }
    await acknowledgeOutboxClaimV1(claim, {
      kind: "sent",
      transport_ref: receipt.transport_ref,
    });
  }

  async function claimAndDeliverPendingCallbacksV1(
    limit: number,
    signal = new AbortController().signal,
  ): Promise<Readonly<{ attempted: number; sent: number }>> {
    assertPositiveSafeInteger(limit, "limit");
    const claimRequest = Object.freeze({
      worker_id: dependencies.callback.worker_id,
      limit,
      lease_seconds: dependencies.callback.lease_seconds,
      now: now().toISOString(),
      current_transport_epoch:
        dependencies.callback.transport_epoch,
      current_transport_generation:
        dependencies.callback.transport_generation,
    }) satisfies RuntimeOutboxClaimRequestV1;
    const claims =
      canonicalJsonSnapshotV1<readonly RuntimeOutboxClaimRecordV1[]>(
        await dependencies.store.claimOutbox(claimRequest),
        "runtime_adapter_failed",
        "Runtime owner returned a non-canonical outbox claim batch",
      );
    if (
      !Array.isArray(claims) ||
      claims.length > limit ||
      new Set(claims.map(({ id }) => id)).size !== claims.length
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Runtime owner returned an invalid outbox claim batch",
      );
    }
    let sent = 0;
    for (const claimValue of claims) {
      if (signal.aborted) throw signal.reason;
      try {
        await deliverClaimedOutboxV1(claimValue, signal);
        sent += 1;
      } catch {
        // A retry ACK releases the lease; an unknown ACK keeps it fenced.
      }
    }
    return Object.freeze({ attempted: claims.length, sent });
  }

  async function appendAndTryCallback(
    runtimeRunId: string,
    leaseGeneration: number,
    event: RuntimeDomainEventV1,
    nextStatus?: RuntimeRunStatusV1,
    terminalReason?: string,
    signal?: AbortSignal,
  ): Promise<RuntimeRunRecordV1> {
    assertRuntimeEvent(event);
    const run = await dependencies.store.appendEvent({
      runtime_run_id: runtimeRunId,
      lease_generation: leaseGeneration,
      event,
      ...(nextStatus === undefined ? {} : { next_status: nextStatus }),
      ...(terminalReason === undefined
        ? {}
        : { terminal_reason: terminalReason }),
    });
    return tryCallbackForCommittedEvent(run, event, signal);
  }

  async function readCurrentWorkerLeaseV1(
    runtimeRunId: string,
    workerId: string,
    leaseGeneration: number,
  ): Promise<RuntimeRunRecordV1> {
    const current = await dependencies.store.readRun(runtimeRunId);
    if (
      current === undefined ||
      !isRuntimeLeaseActiveStatusV1(current.status) ||
      current.lease?.owner_id !== workerId
    ) {
      throw new RuntimeExecutionErrorV1("stale_lease_generation");
    }
    assertLease(current, leaseGeneration, now());
    return current;
  }

  async function tryCallbackForCommittedEvent(
    committed: RuntimeRunRecordV1,
    event: RuntimeDomainEventV1,
    signal?: AbortSignal,
  ): Promise<RuntimeRunRecordV1> {
    const matching = committed.outbox.find(
      ({ event: candidate }) => candidate.event_id === event.event_id,
    );
    if (
      matching === undefined ||
      canonicalJsonV1(matching.event) !== canonicalJsonV1(event)
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "Owner event commit did not atomically create its exact outbox record",
      );
    }
    if (matching.status === "sent") return committed;
    try {
      await claimAndDeliverPendingCallbacksV1(16, signal);
    } catch {
      // The owner outbox is authoritative. Recovery retries after commit.
    }
    return (
      (await dependencies.store.readRun(
        committed.request.runtime_run_id,
      )) ?? committed
    );
  }

  function assertRuntimeArtifactRequestV1(
    artifact: RuntimeArtifactRequestV1,
  ): void {
    if (
      artifact.artifact_id.length === 0 ||
      artifact.artifact_kind.length === 0 ||
      artifact.media_type.length === 0 ||
      artifact.media_type.length > 256 ||
      artifact.body.byteLength === 0 ||
      !/^sha256:[0-9a-f]{64}$/u.test(artifact.expected_sha256) ||
      sha256BytesV1(artifact.body) !== artifact.expected_sha256 ||
      !Number.isFinite(Date.parse(artifact.retention_until)) ||
      Date.parse(artifact.retention_until) <= now().getTime()
    ) {
      throw new RuntimeExecutionErrorV1(
        "artifact_integrity_mismatch",
        "Runtime artifact bytes or metadata failed pre-upload integrity validation",
      );
    }
  }

  function assertArtifactRecordMatchesRequestV1(
    record: RuntimeArtifactRecordV1,
    run: RuntimeRunRecordV1,
    artifact: RuntimeArtifactMetadataV1,
    objectStoreIdempotencyKey: string,
    requestHash: string,
  ): void {
    if (
      record.runtime_run_id !== run.request.runtime_run_id ||
      record.start_fence_generation !== run.start_fence_generation ||
      record.artifact_id !== artifact.artifact_id ||
      record.artifact_kind !== artifact.artifact_kind ||
      record.media_type !== artifact.media_type ||
      record.content_hash !== artifact.content_hash ||
      record.size_bytes !== artifact.size_bytes ||
      record.retention_until !== artifact.retention_until ||
      record.object_store_idempotency_key !==
        objectStoreIdempotencyKey ||
      record.request_hash !== requestHash
    ) {
      throw new RuntimeExecutionErrorV1(
        "artifact_integrity_mismatch",
        "Durable artifact handoff differs from the exact immutable request",
      );
    }
  }

  async function putRuntimeArtifactV1(
    run: RuntimeRunRecordV1,
    record: RuntimeArtifactRecordV1,
    body?: Uint8Array,
    signal?: AbortSignal,
  ): Promise<Awaited<ReturnType<ObjectStorePortV1["putImmutable"]>>> {
    const scope: BotObjectScopeV1 = {
      scope_kind: "bot",
      workspace_id: run.request.workspace_id,
      bot_id: run.request.bot_id,
      owner_agent_id: run.request.owner_agent_id,
      deployment_environment: run.request.deployment_environment,
      release_channel: run.request.release_channel,
    };
    const stored = await dependencies.object_store.putImmutable({
      owner_service: "action_runtime",
      owner_object_id: record.artifact_id,
      owner_state_version: record.start_fence_generation,
      scope,
      capability: "runtime.artifact.write",
      object_class: "runtime_artifact",
      idempotency_key: record.object_store_idempotency_key,
      expected_sha256: record.content_hash,
      size_bytes: record.size_bytes,
      media_type: record.media_type,
      retention_until: record.retention_until,
      body: (async function* () {
        if (signal?.aborted === true) throw signal.reason;
        // A restart has no SDK bytes by design. The empty probe is safe only
        // when ObjectStore resolves the existing idempotency reservation
        // before consuming it; a fresh upload cannot pass integrity checks.
        yield body ?? new Uint8Array();
      })(),
    });
    if (body === undefined && !stored.replayed) {
      throw new ObjectStoreErrorV1(
        "integrity_mismatch",
        "ObjectStore restart probe did not resolve an existing immutable object",
        false,
      );
    }
    if (
      stored.sha256 !== record.content_hash ||
      stored.size_bytes !== record.size_bytes ||
      stored.media_type !== record.media_type ||
      stored.retention_until !== record.retention_until ||
      stored.object_ref.length === 0
    ) {
      throw new ObjectStoreErrorV1(
        "integrity_mismatch",
        "ObjectStore result is not bound to the uploaded runtime artifact",
        false,
        { reconciliation_required: true },
      );
    }
    return stored;
  }

  async function finalizeArtifactAndTryCallbackV1(
    run: RuntimeRunRecordV1,
    record: RuntimeArtifactRecordV1,
    terminalStatus: "available" | "failed",
    finalizedAt: string,
    options: Readonly<{
      lease_generation?: number;
      reconciliation_owner?: string;
      reconciliation_generation?: number;
      artifact_ref?: string;
      failure_code?: string;
      error?: unknown;
      signal?: AbortSignal;
    }>,
  ): Promise<RuntimeRunRecordV1> {
    const artifact = artifactMetadataFromRecordV1(record);
    const event = artifactEventFor(
      run,
      artifact,
      terminalStatus === "available"
        ? "runtime.artifact.created"
        : "runtime.artifact.failed",
      terminalStatus,
      options.artifact_ref ?? null,
      finalizedAt,
      options.error,
    );
    assertRuntimeEvent(event);
    const committed = await dependencies.store.finalizeArtifact({
      runtime_run_id: run.request.runtime_run_id,
      artifact_id: record.artifact_id,
      expected_start_fence_generation: run.start_fence_generation,
      expected_status: "creating",
      ...(options.lease_generation === undefined
        ? {}
        : { lease_generation: options.lease_generation }),
      ...(options.reconciliation_owner === undefined
        ? {}
        : { reconciliation_owner: options.reconciliation_owner }),
      ...(options.reconciliation_generation === undefined
        ? {}
        : {
            reconciliation_generation:
              options.reconciliation_generation,
          }),
      terminal_status: terminalStatus,
      ...(options.artifact_ref === undefined
        ? {}
        : { artifact_ref: options.artifact_ref }),
      ...(options.failure_code === undefined
        ? {}
        : { failure_code: options.failure_code }),
      event,
      request_hash: record.request_hash,
      finalized_at: finalizedAt,
    });
    return tryCallbackForCommittedEvent(
      committed,
      event,
      options.signal,
    );
  }

  async function persistRuntimeArtifact(
    run: RuntimeRunRecordV1,
    leaseGeneration: number,
    artifact: RuntimeArtifactRequestV1,
    signal?: AbortSignal,
  ): Promise<
    Readonly<{ run: RuntimeRunRecordV1; artifact_ref: string }>
  > {
    assertRuntimeArtifactRequestV1(artifact);
    const artifactMetadata = artifactMetadataFromRequestV1(artifact);
    const createdKey =
      `${run.request.runtime_run_id}:artifact:${artifact.artifact_id}:available`;
    const objectStoreIdempotencyKey =
      `${run.request.runtime_run_id}:artifact:${artifact.artifact_id}`;
    const requestHash = runtimeArtifactRequestHashV1(
      run,
      artifactMetadata,
      objectStoreIdempotencyKey,
    );
    // This owner record is the durable handoff. Upload is forbidden until the
    // exact bytes/hash/fences have been committed by the Runtime owner.
    let reservation: Awaited<
      ReturnType<RuntimeExecutionStoreV1["reserveArtifact"]>
    >;
    try {
      reservation = await dependencies.store.reserveArtifact({
        runtime_run_id: run.request.runtime_run_id,
        expected_start_fence_generation: run.start_fence_generation,
        lease_generation: leaseGeneration,
        artifact,
        object_store_idempotency_key: objectStoreIdempotencyKey,
        request_hash: requestHash,
        created_at: now().toISOString(),
      });
    } catch (error) {
      if (
        error instanceof RuntimeExecutionErrorV1 &&
        error.code === "idempotency_conflict"
      ) {
        throw new RuntimeExecutionErrorV1(
          "artifact_integrity_mismatch",
          "Artifact identity was replayed with different immutable metadata",
        );
      }
      throw error;
    }
    const record = reservation.artifact;
    assertArtifactRecordMatchesRequestV1(
      record,
      run,
      artifactMetadata,
      objectStoreIdempotencyKey,
      requestHash,
    );
    if (record.status === "available") {
      if (record.artifact_ref === undefined) {
        throw new RuntimeExecutionErrorV1(
          "artifact_integrity_mismatch",
          "Available artifact owner record is missing its immutable reference",
        );
      }
      const current =
        (await dependencies.store.readRun(
          run.request.runtime_run_id,
        )) ?? run;
      const created = current.events.find(
        ({ idempotency_key }) => idempotency_key === createdKey,
      );
      if (
        created === undefined ||
        created.event_type !== "runtime.artifact.created" ||
        !availableArtifactEventMatchesRequestV1(
          created,
          current,
          artifactMetadata,
          createdKey,
        ) ||
        created.payload.artifact_ref !== record.artifact_ref
      ) {
        throw new RuntimeExecutionErrorV1(
          "artifact_integrity_mismatch",
          "Available artifact owner row and committed event are not identical",
        );
      }
      return Object.freeze({
        run: current,
        artifact_ref: record.artifact_ref,
      });
    }
    if (record.status === "failed") {
      throw new RuntimeExecutionErrorV1(
        "artifact_integrity_mismatch",
        "Runtime artifact owner record is terminal failed",
      );
    }
    let stored: Awaited<ReturnType<ObjectStorePortV1["putImmutable"]>>;
    try {
      stored = await putRuntimeArtifactV1(
        run,
        record,
        artifact.body,
        signal,
      );
    } catch (error) {
      if (
        !(error instanceof ObjectStoreErrorV1) ||
        error.retryable ||
        error.details.reconciliation_required === true
      ) {
        // The result may have committed remotely. Keep the owner row in
        // creating so a claimed idempotent replay can converge after restart.
        throw error;
      }
      const current =
        (await dependencies.store.readRun(
          run.request.runtime_run_id,
        )) ?? run;
      try {
        await finalizeArtifactAndTryCallbackV1(
          current,
          record,
          "failed",
          now().toISOString(),
          {
            lease_generation: leaseGeneration,
            failure_code: error.code,
            error,
            ...(signal === undefined ? {} : { signal }),
          },
        );
      } catch {
        throw new ObjectStoreErrorV1(
          "storage_unavailable",
          "Runtime artifact failure finalization requires reconciliation",
          true,
          { reconciliation_required: true },
        );
      }
      throw error;
    }
    const current =
      (await dependencies.store.readRun(
        run.request.runtime_run_id,
      )) ?? run;
    // Owner status + exact event + outbox commit together. A commit disconnect
    // leaves a replayable creating/available record; it is never rewritten as
    // failed after ObjectStore has accepted the immutable object.
    let committed: RuntimeRunRecordV1;
    try {
      committed = await finalizeArtifactAndTryCallbackV1(
        current,
        record,
        "available",
        now().toISOString(),
        {
          lease_generation: leaseGeneration,
          artifact_ref: stored.object_ref,
          ...(signal === undefined ? {} : { signal }),
        },
      );
    } catch {
      // A commit-then-disconnect is resolved from owner facts before deciding
      // that reconciliation is still required.
      const [authoritativeArtifact, authoritativeRun] = await Promise.all([
        dependencies.store.readArtifact(
          run.request.runtime_run_id,
          artifact.artifact_id,
        ),
        dependencies.store.readRun(run.request.runtime_run_id),
      ]);
      const created = authoritativeRun?.events.find(
        ({ idempotency_key }) => idempotency_key === createdKey,
      );
      if (
        authoritativeArtifact?.status === "available" &&
        authoritativeArtifact.artifact_ref === stored.object_ref &&
        authoritativeArtifact.request_hash === requestHash &&
        authoritativeRun !== undefined &&
        created !== undefined &&
        availableArtifactEventMatchesRequestV1(
          created,
          authoritativeRun,
          artifactMetadata,
          createdKey,
        ) &&
        (created.payload as Readonly<{ artifact_ref?: string }>)
          .artifact_ref === stored.object_ref
      ) {
        committed = await tryCallbackForCommittedEvent(
          authoritativeRun,
          created,
          signal,
        );
      } else {
        throw new ObjectStoreErrorV1(
          "storage_unavailable",
          "Runtime artifact availability finalization requires reconciliation",
          true,
          { reconciliation_required: true },
        );
      }
    }
    return Object.freeze({
      run: committed,
      artifact_ref: stored.object_ref,
    });
  }

  async function handlePendingControl(
    run: RuntimeRunRecordV1,
    leaseGeneration: number,
    adapterSession?: RuntimeAdapterSessionV1,
  ): Promise<RuntimeRunRecordV1 | undefined> {
    const control = await dependencies.store.pendingControl(
      run.request.runtime_run_id,
      leaseGeneration,
    );
    if (control === undefined) return undefined;
    const authoritative = await dependencies.store.readRun(
      run.request.runtime_run_id,
    );
    if (
      authoritative === undefined ||
      authoritative.lease?.generation !== leaseGeneration ||
      !isRuntimeLeaseActiveStatusV1(authoritative.status)
    ) {
      throw new RuntimeExecutionErrorV1("stale_lease_generation");
    }
    run = authoritative;
    if (
      !run.events.some(
        (event) =>
          event.event_type === "runtime.control_signal.received" &&
          event.payload.runtime_signal_id ===
            control.request.runtime_signal_id,
      )
    ) {
      run = await appendAndTryCallback(
        run.request.runtime_run_id,
        leaseGeneration,
        controlReceivedEventFor(run, control, now().toISOString()),
      );
    }
    const fencedLeaseGeneration = incrementSafeIntegerV1(
      leaseGeneration,
      "lease_generation",
    );
    const handledControl: RuntimeControlRecordV1 = {
      ...control,
      status: "handled",
      handled_status: "handled_safe_point",
      handled_lease_generation: leaseGeneration,
      final_fencing_generation: Math.max(
        incrementSafeIntegerV1(
          run.start_fence_generation,
          "start_fence_generation",
        ),
        fencedLeaseGeneration,
      ),
    };
    const handledPreview: RuntimeRunRecordV1 = {
      ...run,
      lease: {
        ...assertLease(run, leaseGeneration, now()),
        generation: fencedLeaseGeneration,
      },
      controls: run.controls.map((candidate) =>
        candidate.request.runtime_signal_id ===
        control.request.runtime_signal_id
          ? handledControl
          : candidate,
      ),
    };
    const controlEvent = controlHandledEventFor(
      handledPreview,
      handledControl,
      now().toISOString(),
      "handled_safe_point",
      leaseGeneration,
    );
    const afterControlPreview: RuntimeRunRecordV1 = {
      ...handledPreview,
      next_sequence_no: incrementSafeIntegerV1(
        handledPreview.next_sequence_no,
        "runtime_sequence_no",
      ),
      events: [...handledPreview.events, controlEvent],
    };
    const runEvent = eventFor(
      afterControlPreview,
      control.control_type === "preempt"
        ? "runtime.run.preempted"
        : "runtime.run.cancelled",
      "cancelled",
      now().toISOString(),
      control.request.reason_code,
      null,
      null,
    );
    assertRuntimeEvent(controlEvent);
    assertRuntimeEvent(runEvent);
    const terminalReason =
      control.requested_by === "action_runtime"
        ? control.request.reason_code
        : control.control_type;
    let handled: RuntimeRunRecordV1;
    try {
      handled = await dependencies.store.handleControl({
        runtime_run_id: run.request.runtime_run_id,
        runtime_signal_id: control.request.runtime_signal_id,
        lease_generation: leaseGeneration,
        handled_status: "handled_safe_point",
        handled_event: controlEvent,
        terminal_event: runEvent,
        terminal_reason: terminalReason,
      });
    } catch (error) {
      // A control writer may commit its terminal events and lease fence before
      // the database connection drops. Resolve only the exact durable facts;
      // otherwise leave the received control pending for a safe retry.
      const committed = await dependencies.store.readRun(
        run.request.runtime_run_id,
      );
      const committedControl = committed?.controls.find(
        ({ request: candidate }) =>
          candidate.runtime_signal_id ===
          control.request.runtime_signal_id,
      );
      const committedHandledEvent = committed?.events.find(
        ({ event_id }) => event_id === controlEvent.event_id,
      );
      const committedTerminalEvent = committed?.events.find(
        ({ event_id }) => event_id === runEvent.event_id,
      );
      if (
        committed === undefined ||
        committed.status !== "cancelled" ||
        committed.terminal_reason !== terminalReason ||
        committed.lease === undefined ||
        committed.lease.generation <= leaseGeneration ||
        committedControl?.status !== "handled" ||
        committedControl.handled_lease_generation !==
          leaseGeneration ||
        committedHandledEvent === undefined ||
        canonicalJsonV1(committedHandledEvent) !==
          canonicalJsonV1(controlEvent) ||
        committedTerminalEvent === undefined ||
        canonicalJsonV1(committedTerminalEvent) !==
          canonicalJsonV1(runEvent)
      ) {
        throw error;
      }
      handled = committed;
    }
    if (adapterSession !== undefined) {
      // Owner fencing is the isolation proof. Provider cancellation is
      // best-effort cleanup and must never reopen or rewrite the durable
      // terminal decision when the SDK rejects or stalls.
      try {
        void adapterCancel(
          adapterSession,
          control.request.reason_code,
        )
          .catch(() => undefined);
      } catch {
        // A synchronous adapter failure is equally isolated by the committed
        // generation fence.
      }
    }
    handled = await tryCallbackForCommittedEvent(
      handled,
      controlEvent,
    );
    return tryCallbackForCommittedEvent(handled, runEvent);
  }

  async function checkpointPolicyAndHandleV1(
    run: RuntimeRunRecordV1,
    leaseGeneration: number | null,
    checkpoint: RuntimePolicyCheckpointKindV1,
    adapterSession?: RuntimeAdapterSessionV1,
    signal?: AbortSignal,
    safetyClaim?: Readonly<{
      worker_id: string;
      expected_start_fence_generation: number;
      lease_seconds: number;
    }>,
  ): Promise<RuntimeRunRecordV1 | undefined> {
    const checkedAt = now().toISOString();
    let result: Awaited<
      ReturnType<RuntimePolicyCheckpointPortV1["check"]>
    >;
    try {
      result = await dependencies.policy_checkpoints.check(
        {
          schema_version: "runtime_policy_checkpoint.v1",
          checkpoint,
          runtime_run_id: run.request.runtime_run_id,
          policy_snapshot_id: run.response.details.policy_snapshot_id,
          workspace_id: run.request.workspace_id,
          bot_id: run.request.bot_id,
          owner_agent_id: run.request.owner_agent_id,
          deployment_environment:
            run.request.deployment_environment,
          release_channel: run.request.release_channel,
          expected_security_revocation_epoch:
            run.request.intent_policy_snapshot
              .security_revocation_epoch,
          policy_expires_at: run.request.policy.expires_at,
          checked_at: checkedAt,
        },
        signal,
      );
    } catch {
      throw new RuntimeExecutionErrorV1(
        "policy_checkpoint_unavailable",
        "Current Runtime policy validity could not be verified",
        true,
      );
    }
    result = canonicalJsonSnapshotV1<
      Awaited<ReturnType<RuntimePolicyCheckpointPortV1["check"]>>
    >(
      result,
      "policy_checkpoint_unavailable",
      "Runtime policy checkpoint result is not canonical JSON",
    );
    const expectedEpoch =
      run.request.intent_policy_snapshot.security_revocation_epoch;
    if (
      result.schema_version !==
        "runtime_policy_checkpoint_result.v1" ||
      result.checkpoint !== checkpoint ||
      result.runtime_run_id !== run.request.runtime_run_id ||
      result.policy_snapshot_id !==
        run.response.details.policy_snapshot_id ||
      result.expected_security_revocation_epoch !== expectedEpoch ||
      !Number.isSafeInteger(
        result.current_security_revocation_epoch,
      ) ||
      result.current_security_revocation_epoch < expectedEpoch ||
      result.checked_at !== checkedAt
    ) {
      throw new RuntimeExecutionErrorV1(
        "policy_checkpoint_unavailable",
        "Runtime policy checkpoint result is stale or identity-mismatched",
        true,
      );
    }
    const expectedStatus =
      result.current_security_revocation_epoch > expectedEpoch
        ? ("security_revocation_epoch_advanced" as const)
        : Date.parse(run.request.policy.expires_at) <=
            Date.parse(checkedAt)
          ? ("runtime_policy_expired" as const)
          : ("valid" as const);
    if (result.status !== expectedStatus) {
      throw new RuntimeExecutionErrorV1(
        "policy_checkpoint_unavailable",
        "Runtime policy checkpoint status contradicts owner facts",
        true,
      );
    }
    if (expectedStatus === "valid") return undefined;
    if (leaseGeneration === null) {
      if (safetyClaim === undefined) {
        throw new RuntimeExecutionErrorV1(
          "policy_checkpoint_unavailable",
          "Internal safety control has no fenced worker claim",
          true,
        );
      }
      run = await dependencies.store.claimQueuedRun({
        runtime_run_id: run.request.runtime_run_id,
        worker_id: safetyClaim.worker_id,
        expected_start_fence_generation:
          safetyClaim.expected_start_fence_generation,
        lease_seconds: safetyClaim.lease_seconds,
        now: new Date(checkedAt),
        internal_safety: {
          reason_code: expectedStatus,
          current_security_revocation_epoch:
            result.current_security_revocation_epoch,
          checked_at: checkedAt,
        },
      });
      if (
        run.lease === undefined ||
        run.lease.recovery_state !== "active"
      ) {
        throw new RuntimeExecutionErrorV1(
          "artifact_reconciliation_required",
          "Internal safety takeover is blocked by unresolved owner facts",
          true,
        );
      }
      leaseGeneration = run.lease.generation;
    }
    let after: RuntimeRunRecordV1;
    try {
      after = (
        await dependencies.store.receiveInternalControl({
          runtime_run_id: run.request.runtime_run_id,
          expected_start_fence_generation:
            run.start_fence_generation,
          expected_lease_generation: leaseGeneration,
          reason_code: expectedStatus,
          current_security_revocation_epoch:
            result.current_security_revocation_epoch,
          requested_at: checkedAt,
          trace_id: run.request.trace_id,
        })
      ).run;
    } catch (error) {
      // Resolve a writer commit-then-disconnect from the durable control fact;
      // never fall back to a direct process kill or terminal run write.
      const authoritative = await dependencies.store.readRun(
        run.request.runtime_run_id,
      );
      const durable = authoritative?.controls.find(
        (control) =>
          control.requested_by === "action_runtime" &&
          control.request.reason_code === expectedStatus &&
          control.target_lease_generation === leaseGeneration,
      );
      if (authoritative === undefined || durable === undefined) {
        throw error;
      }
      after = authoritative;
    }
    return handlePendingControl(
      after,
      leaseGeneration,
      adapterSession,
    );
  }

  const application: RuntimeExecutionApplicationV1 = {
    async start(
      principal: RuntimeStartPrincipalV1,
      requestValue: unknown,
      signal = new AbortController().signal,
    ): Promise<RuntimeStartResponseV1> {
      const canonicalRequest =
        canonicalJsonSnapshotV1<unknown>(
          requestValue,
          "schema_validation_failed",
          "Runtime Start request is not canonical JSON",
        );
      if (!Value.Check(RuntimeStartRequestV1Schema, canonicalRequest)) {
        throw new RuntimeExecutionErrorV1("schema_validation_failed");
      }
      const request = canonicalRequest as RuntimeStartRequestV1;
      if (!startScopeMatches(principal, request)) {
        throw new RuntimeExecutionErrorV1("authorization_scope_mismatch");
      }
      // This identity is intentionally absent from the Runtime Start body.
      // It can enter Action Runtime only through the verified workload JWT
      // principal supplied by service composition.
      const runtimeActorBinding =
        snapshotRuntimeActorBindingV1(principal, request);
      // trace_id is observability-only. TP persists the reservation hash over
      // the complete Runtime Start command minus trace_id, so retries may
      // carry a fresh trace without changing the idempotent business request.
      const requestHash = hashWithout(request, "trace_id");
      const startFenceTokenHash = sha256TextV1(
        request.start_fence_token,
      );
      // Store ports receive only this sanitized snapshot. The plaintext
      // Start/control credentials are confined to the authenticated inbound
      // request and the two Trigger Processor validation calls.
      const storedRequest = storedStartRequestV1(request);
      const existing = await dependencies.store.readRun(
        request.runtime_run_id,
      );
      if (existing !== undefined) {
        const existingActorBinding =
          runtimeActorBindingForRunV1(existing);
        if (
          existing.request.idempotency_key !== request.idempotency_key ||
          existing.request_hash !== requestHash ||
          !secureDigestEqualsV1(
            existingActorBinding.actor_binding_hash,
            runtimeActorBinding.actor_binding_hash,
          ) ||
          !secureDigestEqualsV1(
            existing.request.start_fence_token_hash,
            startFenceTokenHash,
          )
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        return existing.response;
      }
      const begun = await dependencies.store.beginStartAttempt(
        storedRequest,
        requestHash,
        runtimeActorBinding.actor_binding,
        runtimeActorBinding.actor_binding_hash,
        now().toISOString(),
      );
      if (begun.outcome === "conflict") {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      if (begun.attempt.status === "terminal") {
        throw new RuntimeExecutionErrorV1(
          begun.attempt.failure_code ?? "reservation_invalid",
        );
      }
      if (begun.attempt.status === "accepted") {
        throw new RuntimeExecutionErrorV1(
          "reservation_invalid",
          "Accepted Runtime Start attempt has no durable run",
        );
      }
      const tombstone =
        await dependencies.store.findControlTombstone(storedRequest);
      const latestRequestEvidence = [
        ...begun.attempt.validation_facts,
      ]
        .reverse()
        .find(
          (fact) =>
            fact.validation_stage === "request_received",
        );
      const durableFirstValidation =
        latestRequestEvidence?.validation_result === "valid" &&
        latestRequestEvidence.response.schema_version ===
          "runtime_start_reservation_validate_response.v1"
          ? (latestRequestEvidence as RuntimeStartValidationFactV1 & {
              validation_result: "valid";
              response: RuntimeStartReservationValidateResponseV1;
            })
          : undefined;
      if (durableFirstValidation === undefined) {
        const recoveredFailure =
          latestDurableOwnerFailureAtStageV1(
            begun.attempt,
            "request_received",
          );
        if (
          recoveredFailure !== undefined &&
          !recoveredFailure.decision.retryable
        ) {
          await dependencies.store.terminalizeStartAttempt({
            runtime_run_id: request.runtime_run_id,
            request_hash: requestHash,
            actor_binding_hash:
              runtimeActorBinding.actor_binding_hash,
            failure_code:
              recoveredFailure.decision.failure_code,
            terminalized_at: now().toISOString(),
          });
          throw new RuntimeExecutionErrorV1(
            recoveredFailure.decision.failure_code,
            "Runtime Start recovered a non-retryable owner failure from its durable validation ledger",
            false,
          );
        }
      }
      let firstValidation: RuntimeStartReservationValidateResponseV1;
      let firstValidationCall:
        | RuntimeStartValidationCallV1
        | undefined;
      try {
        if (durableFirstValidation === undefined) {
          const ownerRequest = reservationRequest(
            request,
            requestHash,
            "request_received",
          );
          firstValidationCall =
            await beginReservationValidationCallV1(
              storedRequest,
              requestHash,
              runtimeActorBinding.actor_binding_hash,
              "request_received",
              ownerRequest,
            );
          firstValidation = await validateReservation(
            dependencies.reservation,
            request,
            ownerRequest,
            "request_received",
            signal,
          );
          await appendStartValidationEvidenceV1(
            storedRequest,
            requestHash,
            runtimeActorBinding.actor_binding_hash,
            runtimeStartValidationFactV1(
              firstValidationCall,
              startFenceTokenHash,
              firstValidation,
              now().toISOString(),
            ),
          );
        } else {
          firstValidation = durableFirstValidation.response;
        }
      } catch (error) {
        const durableOwnerEvidence =
          await appendReservationOwnerErrorEvidenceV1(
          error,
          storedRequest,
          requestHash,
          runtimeActorBinding.actor_binding_hash,
          firstValidationCall,
        );
        const failureDecision =
          startFailureDecisionFromValidationLedgerV1(
            error,
            durableOwnerEvidence,
            firstValidationCall,
            storedRequest,
          );
        if (!failureDecision.retryable) {
          await dependencies.store.terminalizeStartAttempt({
            runtime_run_id: request.runtime_run_id,
            request_hash: requestHash,
            actor_binding_hash:
              runtimeActorBinding.actor_binding_hash,
            failure_code: failureDecision.failure_code,
            terminalized_at: now().toISOString(),
          });
        }
        throw error;
      }
      if (tombstone !== undefined) {
        if (
          tombstone.start_fence_generation !==
          firstValidation.validated_fence_generation
        ) {
          throw new RuntimeExecutionErrorV1("stale_start_fence");
        }
        const failureCode =
          tombstone.control_type === "preempt"
            ? ("runtime_preempted" as const)
            : ("runtime_cancelled" as const);
        await dependencies.store.terminalizeStartAttempt({
          runtime_run_id: request.runtime_run_id,
          request_hash: requestHash,
          actor_binding_hash: runtimeActorBinding.actor_binding_hash,
          failure_code: failureCode,
          terminalized_at: now().toISOString(),
        });
        throw new RuntimeExecutionErrorV1(
          failureCode,
          "Runtime Start is fenced by a durable pre-start control tombstone",
        );
      }
      const currentValidationAttempt =
        await dependencies.store.readStartAttempt(
          request.runtime_run_id,
        );
      if (currentValidationAttempt === undefined) {
        throw new RuntimeExecutionErrorV1(
          "idempotency_conflict",
          "Runtime Start validation ledger disappeared before preflight",
        );
      }
      const latestRequestFailure =
        latestDurableOwnerFailureAtStageV1(
          currentValidationAttempt,
          "request_received",
        );
      if (latestRequestFailure !== undefined) {
        if (!latestRequestFailure.decision.retryable) {
          await dependencies.store.terminalizeStartAttempt({
            runtime_run_id: request.runtime_run_id,
            request_hash: requestHash,
            actor_binding_hash:
              runtimeActorBinding.actor_binding_hash,
            failure_code:
              latestRequestFailure.decision.failure_code,
            terminalized_at: now().toISOString(),
          });
        }
        throw new RuntimeExecutionErrorV1(
          latestRequestFailure.decision.failure_code,
          "Runtime Start request validation is fenced by the latest durable owner failure",
          latestRequestFailure.decision.retryable,
        );
      }
      const latestRequestSuccess = [
        ...currentValidationAttempt.validation_facts,
      ]
        .reverse()
        .find(
          (
            fact,
          ): fact is RuntimeStartValidationFactV1 & {
            validation_result: "valid";
            response: RuntimeStartReservationValidateResponseV1;
          } =>
            fact.validation_stage === "request_received" &&
            fact.validation_result === "valid" &&
            fact.response.schema_version ===
              "runtime_start_reservation_validate_response.v1",
        );
      if (latestRequestSuccess === undefined) {
        throw new RuntimeExecutionErrorV1(
          "idempotency_conflict",
          "Runtime Start has no authoritative request validation success before preflight",
        );
      }
      firstValidation = latestRequestSuccess.response;
      const recoveredPreflightFailure =
        latestDurableOwnerFailureAtStageV1(
          currentValidationAttempt,
          "preflight_completed",
        );
      if (
        recoveredPreflightFailure !== undefined &&
        !recoveredPreflightFailure.decision.retryable
      ) {
        await dependencies.store.terminalizeStartAttempt({
          runtime_run_id: request.runtime_run_id,
          request_hash: requestHash,
          actor_binding_hash:
            runtimeActorBinding.actor_binding_hash,
          failure_code:
            recoveredPreflightFailure.decision.failure_code,
          terminalized_at: now().toISOString(),
        });
        throw new RuntimeExecutionErrorV1(
          recoveredPreflightFailure.decision.failure_code,
          "Runtime Start recovered a non-retryable preflight owner failure from its durable validation ledger",
          false,
        );
      }
      let policy: Awaited<ReturnType<typeof validatePolicyAndCatalog>>;
      let contextSnapshot: ContextSnapshotV1;
      let secondValidation: RuntimeStartReservationValidateResponseV1;
      let secondValidationCall:
        | RuntimeStartValidationCallV1
        | undefined;
      try {
        // ContextSnapshot resolution is part of Start preflight. No runtime
        // aggregate, policy snapshot, lease, provider session, or side effect
        // can exist until the exact owner snapshot and catalog binding pass.
        contextSnapshot = await resolveRuntimeContextSnapshotV1(
          dependencies.context_snapshots,
          request,
          now,
          signal,
        );
        policy = await validatePolicyAndCatalog(
          request,
          runtimeActorBinding.actor_binding_hash,
          contextSnapshot,
          profilePort,
          skillPort,
          now().getTime(),
          signal,
        );
        const ownerRequest = reservationRequest(
          request,
          requestHash,
          "preflight_completed",
        );
        secondValidationCall =
          await beginReservationValidationCallV1(
            storedRequest,
            requestHash,
            runtimeActorBinding.actor_binding_hash,
            "preflight_completed",
            ownerRequest,
          );
        secondValidation = await validateReservation(
          dependencies.reservation,
          request,
          ownerRequest,
          "preflight_completed",
          signal,
        );
      } catch (error) {
        const durableOwnerEvidence =
          await appendReservationOwnerErrorEvidenceV1(
          error,
          storedRequest,
          requestHash,
          runtimeActorBinding.actor_binding_hash,
          secondValidationCall,
        );
        const failureDecision =
          startFailureDecisionFromValidationLedgerV1(
            error,
            durableOwnerEvidence,
            secondValidationCall,
            storedRequest,
          );
        if (!failureDecision.retryable) {
          await dependencies.store.terminalizeStartAttempt({
            runtime_run_id: request.runtime_run_id,
            request_hash: requestHash,
            actor_binding_hash:
              runtimeActorBinding.actor_binding_hash,
            failure_code: failureDecision.failure_code,
            terminalized_at: now().toISOString(),
          });
        }
        throw error;
      }
      if (
        firstValidation.validated_fence_generation !==
          secondValidation.validated_fence_generation ||
        RUNTIME_RESERVATION_STATUS_RANK_V1[
          secondValidation.reservation_status
        ] <
          RUNTIME_RESERVATION_STATUS_RANK_V1[
            firstValidation.reservation_status
          ]
      ) {
        const failureCode =
          firstValidation.validated_fence_generation !==
          secondValidation.validated_fence_generation
            ? ("stale_start_fence" as const)
            : ("reservation_invalid" as const);
        await dependencies.store.terminalizeStartAttempt({
          runtime_run_id: request.runtime_run_id,
          request_hash: requestHash,
          actor_binding_hash: runtimeActorBinding.actor_binding_hash,
          failure_code: failureCode,
          terminalized_at: now().toISOString(),
        });
        throw new RuntimeExecutionErrorV1(failureCode);
      }
      const preflightValidationFact = runtimeStartValidationFactV1(
        secondValidationCall,
        startFenceTokenHash,
        secondValidation,
        now().toISOString(),
      );
      const policySnapshotId = `runtime_policy:${request.runtime_run_id}`;
      const response: RuntimeStartResponseV1 = {
        code: "runtime_queued",
        message: "Runtime execution queued",
        retryable: false,
        details: {
          status: "queued",
          runtime_run_id: request.runtime_run_id,
          start_attempt_no: request.start_attempt_no,
          start_fence_generation:
            firstValidation.validated_fence_generation,
          policy_snapshot_id: policySnapshotId,
          policy_snapshot_hash:
            policy.policy_snapshot_hash as `sha256:${string}`,
          requested_catalog_version: request.expected_catalog_version,
          effective_catalog_version: policy.catalog.version,
          catalog_as_of: policy.catalog.as_of,
        },
        trace_id: request.trace_id,
      };
      const accepted = await dependencies.store.acceptStart(
        storedRequest,
        requestHash,
        runtimeActorBinding.actor_binding,
        runtimeActorBinding.actor_binding_hash,
        response,
        policy.skill_resolutions,
        policy.profile.tool_arg_constraints,
        runtimePermissionsForV1(
          request,
          policy.profile,
          toolCapabilityFor,
          policySnapshotId,
          runtimeActorBinding.actor_binding,
          runtimeActorBinding.actor_binding_hash,
          now().toISOString(),
        ),
        dependencies.adapter.model,
        preflightValidationFact,
      );
      if (accepted.outcome === "conflict") {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      if (accepted.outcome === "fenced") {
        throw new RuntimeExecutionErrorV1(
          accepted.tombstone.control_type === "preempt"
            ? "runtime_preempted"
            : "runtime_cancelled",
          "Runtime Start was atomically fenced by a pre-start control tombstone",
        );
      }
      return accepted.run.response;
    },

    async readPolicyInput(
      principal,
      runtimeRunId,
      startAttemptNo,
    ): Promise<RuntimePolicyInputReadArtifactV1> {
      if (
        principal.sub !== "skill_registry" ||
        principal.aud !== "action_runtime" ||
        !principal.capability.includes("runtime.policy_input.read") ||
        runtimeRunId.length === 0 ||
        !Number.isSafeInteger(startAttemptNo) ||
        startAttemptNo < 1
      ) {
        throw new RuntimeExecutionErrorV1(
          "authorization_scope_mismatch",
        );
      }
      const artifact =
        await dependencies.store.readPolicyInputArtifact(
          runtimeRunId,
          startAttemptNo,
        );
      if (
        artifact === undefined ||
        !runtimeScopeMatches(principal.scope, artifact)
      ) {
        // Do not expose cross-scope or other-attempt existence.
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      return Object.freeze(structuredClone(artifact));
    },

    async readPolicyInputByReference(
      principal,
      policyInputRef,
    ): Promise<RuntimePolicyInputReadArtifactV1> {
      if (
        principal.sub !== "skill_registry" ||
        principal.aud !== "action_runtime" ||
        !principal.capability.includes("runtime.policy_input.read") ||
        policyInputRef.length === 0 ||
        policyInputRef.length > 512
      ) {
        throw new RuntimeExecutionErrorV1(
          "authorization_scope_mismatch",
        );
      }
      const artifact =
        await dependencies.store.readPolicyInputArtifactByReference(
          policyInputRef,
        );
      if (
        artifact === undefined ||
        !runtimeScopeMatches(principal.scope, artifact)
      ) {
        // Do not expose cross-scope policy-reference existence.
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      return Object.freeze(structuredClone(artifact));
    },

    async receiveControl(
      principal: RuntimeStartPrincipalV1,
      requestValue: unknown,
    ): Promise<Readonly<{ accepted: true; replayed: boolean }>> {
      const canonicalRequest =
        canonicalJsonSnapshotV1<unknown>(
          requestValue,
          "schema_validation_failed",
          "Runtime control request is not canonical JSON",
        );
      if (!isControlRequest(canonicalRequest)) {
        throw new RuntimeExecutionErrorV1("schema_validation_failed");
      }
      const request = canonicalRequest;
      if (
        principal.sub !== "trigger_processor" ||
        principal.aud !== "action_runtime" ||
        !principal.capability.includes("runtime.control") ||
        principal.scope.workspace_id.length === 0
      ) {
        throw new RuntimeExecutionErrorV1("authorization_scope_mismatch");
      }
      snapshotRuntimeActorBindingV1(principal, principal.scope);
      const requestHash = hashWithout(request, "trace_id");
      const storedRequest = storedControlRequestV1(request);
      const observed = await dependencies.store.readRun(
        request.runtime_run_id,
      );
      const allowExpiredTerminalReplay =
        observed !== undefined &&
        (observed.status === "completed" ||
          observed.status === "failed" ||
          observed.status === "cancelled");
      let verification: RuntimeControlTokenClaimsV1;
      try {
        verification = await verifyControlTokenV1(
          dependencies.control_tokens,
          principal,
          request,
          now(),
          allowExpiredTerminalReplay,
        );
      } catch (error) {
        if (
          !allowExpiredTerminalReplay ||
          observed === undefined ||
          !(error instanceof RuntimeExecutionErrorV1) ||
          error.code !== "control_token_invalid"
        ) {
          throw error;
        }
        const legacyClaims = legacyTerminalControlClaimsV1(
          observed,
          principal,
          request,
        );
        if (legacyClaims === undefined) throw error;
        verification = legacyClaims;
      }
      if (
        observed !== undefined &&
        (observed.status === "completed" ||
          observed.status === "failed" ||
          observed.status === "cancelled")
      ) {
        const committed = observed.controls.find(
          (control) =>
            control.request.runtime_signal_id ===
            request.runtime_signal_id,
        );
        if (
          committed !== undefined &&
          committed.request_hash === requestHash &&
          secureDigestEqualsV1(
            committed.request.preempt_token_hash,
            sha256TextV1(request.preempt_token),
          )
        ) {
          return Object.freeze({
            accepted: true as const,
            replayed: true,
          });
        }
        if (
          observed.request.trigger_process_id !== request.trigger_process_id ||
          observed.request.start_attempt_no !== request.start_attempt_no ||
          !secureDigestEqualsV1(
            observed.request.preempt_token_hash,
            sha256TextV1(request.preempt_token),
          ) ||
          observed.start_fence_generation !==
            verification.start_fence_generation ||
          verification.control_valid_until !==
            addMilliseconds(
              new Date(observed.request.policy.expires_at),
              15 * 60 * 1_000,
            ) ||
          observed.request.workspace_id !== principal.scope.workspace_id ||
          observed.request.bot_id !== principal.scope.bot_id ||
          observed.request.owner_agent_id !==
            principal.scope.owner_agent_id ||
          observed.request.deployment_environment !==
            principal.scope.deployment_environment ||
          observed.request.release_channel !==
            principal.scope.release_channel
        ) {
          throw new RuntimeExecutionErrorV1("stale_start_fence");
        }
        const handledLeaseGeneration = observed.lease?.generation ?? null;
        const terminalReplayCompatibility =
          allowExpiredTerminalReplay &&
          Date.parse(verification.control_valid_until) <= now().getTime();
        const handledControl: RuntimeControlRecordV1 = Object.freeze({
          request: storedRequest,
          control_type: controlType(request),
          requested_by: "trigger_processor",
          control_valid_until: verification.control_valid_until,
          target_lease_generation: handledLeaseGeneration,
          request_hash: requestHash,
          status: "handled",
          handled_status: "already_terminal",
          handled_lease_generation: handledLeaseGeneration,
          final_fencing_generation: Math.max(
            incrementSafeIntegerV1(
              observed.start_fence_generation,
              "start_fence_generation",
            ),
            incrementSafeIntegerV1(
              handledLeaseGeneration ?? 0,
              "lease_generation",
            ),
          ),
        });
        const {
          handled_status: _handledStatus,
          handled_lease_generation: _handledLeaseGeneration,
          final_fencing_generation: _finalFencingGeneration,
          ...receivedControlBase
        } = handledControl;
        const receivedControl: RuntimeControlRecordV1 = Object.freeze({
          ...receivedControlBase,
          status: "received",
        });
        const occurredAt = now().toISOString();
        const receivedEvent = controlReceivedEventFor(
          observed,
          receivedControl,
          occurredAt,
        );
        const afterReceived: RuntimeRunRecordV1 = Object.freeze({
          ...observed,
          next_sequence_no: incrementSafeIntegerV1(
            observed.next_sequence_no,
            "runtime_sequence_no",
          ),
        });
        const handledEvent = controlHandledEventFor(
          afterReceived,
          handledControl,
          occurredAt,
          "already_terminal",
          handledLeaseGeneration,
        );
        const terminalOutcome =
          await dependencies.store.finalizeAlreadyTerminalControl({
            request: storedRequest,
            request_hash: requestHash,
            control_type: controlType(request),
            verification,
            terminal_replay_compatibility: terminalReplayCompatibility,
            runtime_run_id: request.runtime_run_id,
            runtime_signal_id: request.runtime_signal_id,
            received_event: receivedEvent,
            handled_event: handledEvent,
          });
        if (
          !terminalOutcome.replayed &&
          terminalOutcome.run.outbox.some(
            ({ status }) => status === "pending",
          )
        ) {
          try {
            await claimAndDeliverPendingCallbacksV1(16);
          } catch {
            // The owner transaction committed both terminal-control events;
            // bounded outbox recovery remains the only retry authority.
          }
        }
        return Object.freeze({
          accepted: true as const,
          replayed: terminalOutcome.replayed,
        });
      }
      let after: RuntimeRunRecordV1;
      let received: RuntimeControlRecordV1;
      let replayed: boolean;
      if (observed === undefined) {
        const outcome =
          await dependencies.store.receiveControlTombstone(
            principal,
            storedRequest,
            requestHash,
            controlType(request),
            verification,
          );
        if (outcome.outcome === "tombstoned") {
          if (
            outcome.tombstone.outbox.some(
              ({ status }) => status === "pending",
            )
          ) {
            try {
              await claimAndDeliverPendingCallbacksV1(16);
            } catch {
              // Durable tombstone outbox remains pending for bounded recovery.
            }
          }
          return Object.freeze({
            accepted: true as const,
            replayed: outcome.replayed,
          });
        }
        after = outcome.run;
        received = outcome.control;
        replayed = outcome.replayed;
      } else {
        if (
          observed.request.trigger_process_id !==
            request.trigger_process_id ||
          observed.request.start_attempt_no !== request.start_attempt_no ||
          !secureDigestEqualsV1(
            observed.request.preempt_token_hash,
            sha256TextV1(request.preempt_token),
          ) ||
          observed.start_fence_generation !==
            verification.start_fence_generation ||
          verification.control_valid_until !==
            addMilliseconds(
              new Date(observed.request.policy.expires_at),
              15 * 60 * 1_000,
            ) ||
          observed.request.workspace_id !== principal.scope.workspace_id ||
          observed.request.bot_id !== principal.scope.bot_id ||
          observed.request.owner_agent_id !==
            principal.scope.owner_agent_id ||
          observed.request.deployment_environment !==
            principal.scope.deployment_environment ||
          observed.request.release_channel !==
            principal.scope.release_channel
        ) {
          throw new RuntimeExecutionErrorV1("stale_start_fence");
        }
        const outcome = await dependencies.store.receiveControl(
          storedRequest,
          requestHash,
          controlType(request),
          verification,
        );
        after = outcome.run;
        received = outcome.control;
        replayed = outcome.replayed;
      }
      const receivedEventIdempotencyKey =
        `${request.idempotency_key}:received`;
      if (
        isRuntimeLeaseActiveStatusV1(after.status) &&
        !after.events.some(
          ({ idempotency_key }) =>
            idempotency_key === receivedEventIdempotencyKey,
        )
      ) {
        if (after.lease === undefined) {
          throw new RuntimeExecutionErrorV1(
            "stale_lease_generation",
          );
        }
        const event = controlReceivedEventFor(
          after,
          received,
          now().toISOString(),
        );
        try {
          await appendAndTryCallback(
            request.runtime_run_id,
            after.lease.generation,
            event,
          );
        } catch (error) {
          const concurrent = await dependencies.store.readRun(
            request.runtime_run_id,
          );
          if (
            !(error instanceof RuntimeExecutionErrorV1) ||
            (!concurrent?.events.some(
              ({ idempotency_key }) =>
                idempotency_key === receivedEventIdempotencyKey,
            ) &&
              !concurrent?.controls.some(
                (control) =>
                  control.request.runtime_signal_id ===
                    request.runtime_signal_id &&
                  control.status === "handled",
              ))
          ) {
            throw error;
          }
        }
      }
      return Object.freeze({
        accepted: true as const,
        replayed,
      });
    },

    async executeQueued(
      executionRequestValue: Readonly<{
        runtime_run_id: string;
        worker_id: string;
        expected_start_fence_generation: number;
        lease_seconds: number;
        deadline_at: string;
      }>,
      signal = new AbortController().signal,
    ): Promise<RuntimeRunRecordV1> {
      const executionRequest =
        canonicalJsonSnapshotV1<typeof executionRequestValue>(
          executionRequestValue,
          "schema_validation_failed",
          "Runtime worker claim is not canonical JSON",
        );
      if (
        Object.keys(executionRequest).sort().join(",") !==
          "deadline_at,expected_start_fence_generation,lease_seconds,runtime_run_id,worker_id" ||
        !/^[A-Za-z0-9._:-]{1,128}$/u.test(
          executionRequest.worker_id,
        ) ||
        executionRequest.runtime_run_id.length < 1 ||
        executionRequest.runtime_run_id.length > 512 ||
        !Number.isFinite(Date.parse(executionRequest.deadline_at))
      ) {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
          "Runtime worker claim identity is invalid",
        );
      }
      assertPositiveSafeInteger(
        executionRequest.expected_start_fence_generation,
        "expected_start_fence_generation",
      );
      assertPositiveSafeInteger(executionRequest.lease_seconds, "lease_seconds");
      const queuedValue = await dependencies.store.readRun(
        executionRequest.runtime_run_id,
      );
      const queued =
        queuedValue === undefined
          ? undefined
          : canonicalJsonSnapshotV1<RuntimeRunRecordV1>(
              queuedValue,
              "runtime_adapter_failed",
              "Runtime owner returned a non-canonical queued run",
            );
      if (queued === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      if (
        queued.request.runtime_run_id !==
          executionRequest.runtime_run_id ||
        queued.start_fence_generation !==
          executionRequest.expected_start_fence_generation
      ) {
        throw new RuntimeExecutionErrorV1("stale_start_fence");
      }
      // Reject owner-row drift before policy, reservation, lease, provider, or
      // tool work can observe an unbound delegated identity.
      runtimeActorBindingForRunV1(queued);
      const validationAttempt =
        await dependencies.store.readStartAttempt(
          queued.request.runtime_run_id,
        );
      if (validationAttempt === undefined) {
        throw new RuntimeExecutionErrorV1(
          "idempotency_conflict",
          "Queued Runtime has no durable Start validation ledger",
        );
      }
      const recoveredBeforeRunningFailure =
        latestDurableOwnerFailureAtStageV1(
          validationAttempt,
          "before_running",
        );
      if (
        recoveredBeforeRunningFailure !== undefined &&
        !recoveredBeforeRunningFailure.decision.retryable
      ) {
        throw new RuntimeExecutionErrorV1(
          recoveredBeforeRunningFailure.decision.failure_code,
          "Runtime worker claim is fenced by a non-retryable owner failure in the durable validation ledger",
          false,
        );
      }
      const safetyControlledBeforeClaim =
        await checkpointPolicyAndHandleV1(
          queued,
          null,
          "worker_claim",
          undefined,
          signal,
          {
            worker_id: executionRequest.worker_id,
            expected_start_fence_generation:
              executionRequest.expected_start_fence_generation,
            lease_seconds: executionRequest.lease_seconds,
          },
        );
      if (safetyControlledBeforeClaim !== undefined) {
        return safetyControlledBeforeClaim;
      }
      const requestHash = queued.request_hash;
      // Re-resolve the same immutable owner snapshot immediately before the
      // worker claim. This refreshes delivery bytes while the Start preflight
      // remains the gate that prevented a queued run from being created.
      const resolvedContextSnapshot = await resolveRuntimeContextSnapshotV1(
        dependencies.context_snapshots,
        queued.request,
        now,
        signal,
      );
      // Context resolution may block on ObjectStore or redaction repair.
      // Re-read the Trigger owner fence only after that work so a cancellation
      // committed during the read cannot pass a stale "before_running" check.
      let finalValidation: RuntimeStartReservationValidateResponseV1;
      let finalValidationCall:
        | RuntimeStartValidationCallV1
        | undefined;
      try {
        const ownerRequest: RuntimeStartReservationValidateRequestV1 = {
          schema_version:
            "runtime_start_reservation_validate_request.v1",
          runtime_run_id: queued.request.runtime_run_id,
          start_fence_token_hash:
            queued.request
              .start_fence_token_hash as `sha256:${string}`,
          request_hash: requestHash as `sha256:${string}`,
          validation_stage: "before_running",
          trace_id: queued.request.trace_id,
        };
        finalValidationCall =
          await beginReservationValidationCallV1(
            queued.request,
            requestHash,
            queued.actor_binding_hash,
            "before_running",
            ownerRequest,
          );
        finalValidation =
          await validateBeforeRunningReservation(
            dependencies.reservation,
            queued.request,
            ownerRequest,
            signal,
          );
      } catch (error) {
        const durableOwnerEvidence =
          await appendReservationOwnerErrorEvidenceV1(
          error,
          queued.request,
          requestHash,
          queued.actor_binding_hash,
          finalValidationCall,
        );
        if (error instanceof RuntimeReservationOwnerErrorV1) {
          const failureDecision =
            startFailureDecisionFromValidationLedgerV1(
              error,
              durableOwnerEvidence,
              finalValidationCall,
              queued.request,
            );
          throw new RuntimeExecutionErrorV1(
            failureDecision.failure_code,
            error.message,
            failureDecision.retryable,
          );
        }
        throw error;
      }
      const finalFence =
        finalValidation.validated_fence_generation;
      if (
        finalFence !== queued.start_fence_generation ||
        finalFence !== executionRequest.expected_start_fence_generation
      ) {
        throw new RuntimeExecutionErrorV1("stale_start_fence");
      }
      const beforeRunningValidationFact =
        runtimeStartValidationFactV1(
          finalValidationCall,
          queued.request.start_fence_token_hash,
          finalValidation,
          now().toISOString(),
        );
      const claimed = canonicalJsonSnapshotV1<RuntimeRunRecordV1>(
        await dependencies.store.claimQueuedRun(Object.freeze({
          runtime_run_id: executionRequest.runtime_run_id,
          worker_id: executionRequest.worker_id,
        expected_start_fence_generation:
          executionRequest.expected_start_fence_generation,
        lease_seconds: executionRequest.lease_seconds,
          now: now(),
          before_running_validation: beforeRunningValidationFact,
        })),
        "runtime_adapter_failed",
        "Runtime owner returned a non-canonical worker claim",
      );
      const lease = claimed.lease;
      if (
        lease === undefined ||
        claimed.request.runtime_run_id !==
          executionRequest.runtime_run_id ||
        claimed.start_fence_generation !==
          executionRequest.expected_start_fence_generation ||
        lease.runtime_run_id !== executionRequest.runtime_run_id
      ) {
        throw new RuntimeExecutionErrorV1("stale_lease_generation");
      }
      if (lease.recovery_state === "takeover_pending") {
        throw new RuntimeExecutionErrorV1(
          "artifact_reconciliation_required",
          "Lease takeover is blocked by a creating Runtime artifact",
          true,
        );
      }
      if (lease.owner_id !== executionRequest.worker_id) {
        throw new RuntimeExecutionErrorV1("stale_lease_generation");
      }
      const freezeUnknownTool = async (
        current: RuntimeRunRecordV1,
        call: RuntimeToolCallV1,
        suppliedResult: RuntimeToolResultV1,
        durableOutputRef?: string,
      ): Promise<never> => {
        let outputRef = durableOutputRef;
        if (outputRef === undefined) {
          const persistedResult = await persistRuntimeArtifact(
            current,
            lease.generation,
            runtimeArtifactFromJsonV1(
              current,
              `tool_result:${call.tool_call_id}`,
              "tool-result",
              suppliedResult,
            ),
            signal,
          );
          current = persistedResult.run;
          outputRef = persistedResult.artifact_ref;
        }
        const result = bindToolEvidenceRefV1(
          current.request.runtime_run_id,
          call.tool_call_id,
          suppliedResult,
          outputRef,
        );
        assertToolResult(result);
        const audit = current.tools.find(
          ({ tool_invocation_id }) =>
            tool_invocation_id === call.tool_call_id,
        );
        if (audit === undefined) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        const terminalAudit: RuntimeToolAuditV1 = Object.freeze({
          ...audit,
          status: "failed",
          side_effect_status: "unknown",
          output_ref: outputRef,
          result,
        });
        const toolEvent = toolEventFor(
          current,
          call,
          "runtime.tool.failed",
          "failed",
          now().toISOString(),
          terminalAudit,
          result,
        );
        const terminalEvent = eventFor(
          {
            ...current,
            next_sequence_no: incrementSafeIntegerV1(
              current.next_sequence_no,
              "runtime_sequence_no",
            ),
          },
          "runtime.run.failed",
          "failed",
          now().toISOString(),
          "tool_side_effect_unknown",
          "Tool outcome is unknown and requires reconciliation",
          null,
        );
        assertRuntimeEvent(toolEvent);
        assertRuntimeEvent(terminalEvent);
        const frozen = await dependencies.store.freezeUnknownSideEffect({
          runtime_run_id: current.request.runtime_run_id,
          lease_generation: lease.generation,
          tool_invocation_id: call.tool_call_id,
          output_ref: outputRef,
          result,
          event: toolEvent,
          terminal_event: terminalEvent,
        });
        const afterToolCallback =
          await tryCallbackForCommittedEvent(
            frozen,
            toolEvent,
            signal,
          );
        await tryCallbackForCommittedEvent(
          afterToolCallback,
          terminalEvent,
          signal,
        );
        throw new RuntimeExecutionErrorV1(
          "tool_side_effect_unknown",
          "Tool outcome is unknown; automatic retry is frozen until reconciled",
        );
      };
      let run = claimed;
      runtimeActorBindingForRunV1(run);
      const controlledByClaimCheckpoint =
        await checkpointPolicyAndHandleV1(
          run,
          lease.generation,
          "worker_claim",
          undefined,
          signal,
        );
      if (controlledByClaimCheckpoint !== undefined) {
        return controlledByClaimCheckpoint;
      }
      const leaseWasTakenOver =
        isRuntimeLeaseActiveStatusV1(queued.status) &&
        queued.lease !== undefined &&
        queued.lease.generation < lease.generation;
      if (leaseWasTakenOver) {
        const unresolved = run.tools.find(
          (audit) =>
            audit.side_effect_status === "unknown" ||
            (audit.status === "running" &&
              audit.result === undefined),
        );
        if (unresolved !== undefined) {
          const unknownResult =
            unresolved.result?.side_effect_status === "unknown"
              ? unresolved.result
              : {
                  outcome: "failed" as const,
                  retryable: false,
                  side_effect_status: "unknown" as const,
                  error: {
                    code: "tool_takeover_outcome_unknown",
                    message:
                      "The previous lease ended after tool dispatch without a durable terminal result",
                  },
                };
          return await freezeUnknownTool(
            run,
            {
              tool_call_id: unresolved.tool_invocation_id,
              tool_name: unresolved.tool_name,
              capability: "takeover.reconciliation_required",
              arguments: {},
            },
            unknownResult,
            unresolved.output_ref,
          );
        }
        for (const requested of run.tools.filter(
          (audit) =>
            audit.status === "requested" &&
            audit.result === undefined,
        )) {
          const cancelledEvent = toolEventFor(
            run,
            {
              tool_call_id: requested.tool_invocation_id,
              tool_name: requested.tool_name,
              capability: "takeover.cancelled_before_dispatch",
              arguments: {},
            },
            "runtime.tool.cancelled",
            "cancelled",
            now().toISOString(),
            requested,
          );
          assertRuntimeEvent(cancelledEvent);
          run = await dependencies.store.cancelUndispatchedTool({
            runtime_run_id: run.request.runtime_run_id,
            lease_generation: lease.generation,
            tool_invocation_id: requested.tool_invocation_id,
            event: cancelledEvent,
          });
          run = await tryCallbackForCommittedEvent(
            run,
            cancelledEvent,
            signal,
          );
        }
        if (
          run.tools.some(
            (audit) =>
              audit.status === "completed" ||
              audit.status === "failed",
          )
        ) {
          const failedEvent = eventFor(
            run,
            "runtime.run.failed",
            "failed",
            now().toISOString(),
            "adapter_session_not_resumable",
            "A tool result exists but the non-persistent SDK session cannot be resumed safely after lease takeover",
            null,
          );
          return await appendAndTryCallback(
            run.request.runtime_run_id,
            lease.generation,
            failedEvent,
            "failed",
            "adapter_session_not_resumable",
            signal,
          );
        }
      }
      const controlledBeforeStart = await handlePendingControl(
        run,
        lease.generation,
      );
      if (controlledBeforeStart !== undefined) {
        return controlledBeforeStart;
      }
      if (
        !run.events.some(
          ({ event_type }) => event_type === "runtime.run.started",
        )
      ) {
        run = await appendAndTryCallback(
            run.request.runtime_run_id,
          lease.generation,
          eventFor(
              run,
            "runtime.run.started",
            "running",
            now().toISOString(),
            null,
            null,
            null,
          ),
          "running",
          undefined,
          signal,
        );
      }
      const requestedDeadlineMs = Date.parse(executionRequest.deadline_at);
      const policyDeadlineMs = Date.parse(run.request.policy.expires_at);
      const deadlineMs = Math.min(
        requestedDeadlineMs,
        policyDeadlineMs,
      );
      if (
        !Number.isFinite(requestedDeadlineMs) ||
        !Number.isFinite(policyDeadlineMs) ||
        deadlineMs <= now().getTime()
      ) {
        if (
          Number.isFinite(policyDeadlineMs) &&
          policyDeadlineMs <= now().getTime()
        ) {
          const controlled = await checkpointPolicyAndHandleV1(
            run,
            lease.generation,
            "worker_claim",
            undefined,
            signal,
          );
          if (controlled !== undefined) return controlled;
          throw new RuntimeExecutionErrorV1(
            "policy_checkpoint_unavailable",
            "Expired Runtime policy did not produce a durable safety control",
            true,
          );
        }
        const failedEvent = eventFor(
          run,
          "runtime.run.failed",
          "failed",
          now().toISOString(),
          "deadline_exceeded",
          "Runtime deadline was already expired",
          null,
        );
        return appendAndTryCallback(
          run.request.runtime_run_id,
          lease.generation,
          failedEvent,
          "failed",
          "deadline_exceeded",
          signal,
        );
      }
      const effectiveDeadlineAt = new Date(deadlineMs).toISOString();
      const adapterAbort = new AbortController();
      const onAbort = () => adapterAbort.abort(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      const deadlineTimer = setTimeout(
        () =>
          adapterAbort.abort(
            new RuntimeExecutionErrorV1("runtime_deadline_exceeded"),
          ),
        Math.min(
          Math.max(0, deadlineMs - now().getTime()),
          2_147_483_647,
        ),
      );
      // A worker awaits the full provider interaction, so its outer polling
      // loop cannot renew this run's lease. Keep the lease durable for the
      // entire execution scope instead of relying on a stale local snapshot.
      let heartbeatTimer: NodeJS.Timeout | undefined;
      let heartbeatInFlight: Promise<void> | undefined;
      let heartbeatFailure: unknown;
      let heartbeatsStopped = false;
      const runningLeaseGeneration = lease.generation;
      const assertHeartbeat = (): void => {
        if (heartbeatFailure !== undefined) throw heartbeatFailure;
      };
      const renewLease = (): void => {
        if (
          heartbeatsStopped ||
          adapterAbort.signal.aborted ||
          heartbeatInFlight !== undefined
        ) {
          return;
        }
        heartbeatInFlight = (async () => {
          const renewedLease = await dependencies.store.heartbeat({
            runtime_run_id: run.request.runtime_run_id,
            worker_id: executionRequest.worker_id,
            lease_generation: runningLeaseGeneration,
            lease_seconds: executionRequest.lease_seconds,
            now: now(),
          });
          const snapshot = canonicalJsonSnapshotV1<RuntimeLeaseV1>(
            renewedLease,
            "runtime_adapter_failed",
            "Runtime owner returned a non-canonical background heartbeat lease",
          );
          if (
            snapshot.runtime_run_id !== run.request.runtime_run_id ||
            snapshot.owner_id !== executionRequest.worker_id ||
            snapshot.generation !== runningLeaseGeneration
          ) {
            throw new RuntimeExecutionErrorV1("stale_lease_generation");
          }
        })()
          .catch((error: unknown) => {
            heartbeatFailure =
              error instanceof RuntimeExecutionErrorV1
                ? error
                : new RuntimeExecutionErrorV1(
                    "runtime_adapter_failed",
                    "Runtime lease heartbeat failed",
                  );
            adapterAbort.abort(heartbeatFailure);
          })
          .finally(() => {
            heartbeatInFlight = undefined;
          });
      };
      heartbeatTimer = setInterval(renewLease, heartbeatIntervalMs);
      heartbeatTimer.unref?.();
      let session: RuntimeAdapterSessionV1 | undefined;
      let lastToolCallId: string | undefined;
      let lastToolResult: RuntimeToolResultV1 | undefined;
      let lastSkill: RuntimeSkillResolutionV1 | undefined;
      let lastSkillMaterialization:
        | RuntimeSkillMaterializationV1
        | undefined;
      let lastSkillAuditEventId: string | undefined;
      let lastArtifactId: string | undefined;
      let lastArtifactRef: string | undefined;
      // This is deliberately an enum-like boundary marker, never an error
      // message. It gives production operators a safe way to distinguish a
      // provider turn from an artifact persistence failure.
      let diagnosticStage = "adapter_start";
      const adapterContext = (): RuntimeAdapterContextV1 => ({
        runtime_run_id: run.request.runtime_run_id,
        trigger_process_id: run.request.trigger_process_id,
        lease_generation: lease.generation,
        deadline_at: effectiveDeadlineAt,
        signal: adapterAbort.signal,
        context_snapshot: resolvedContextSnapshot,
        ...(lastToolCallId === undefined
          ? {}
          : { last_tool_call_id: lastToolCallId }),
        ...(lastToolResult === undefined
          ? {}
          : { last_tool_result: lastToolResult }),
        ...(lastSkill === undefined ? {} : { last_skill: lastSkill }),
        ...(lastSkillMaterialization === undefined
          ? {}
          : {
              last_skill_materialization:
                lastSkillMaterialization,
            }),
        ...(lastSkillAuditEventId === undefined
          ? {}
          : { last_skill_audit_event_id: lastSkillAuditEventId }),
        ...(lastArtifactId === undefined
          ? {}
          : { last_artifact_id: lastArtifactId }),
        ...(lastArtifactRef === undefined
          ? {}
          : { last_artifact_ref: lastArtifactRef }),
      });
      try {
        assertHeartbeat();
        runtimeActorBindingForRunV1(run);
        session = await awaitAbortable(
          adapterStart(
            adapterStartRequestV1(
              run.request,
              run.permissions,
              run.skill_resolutions,
            ),
            adapterContext(),
          ),
          adapterAbort.signal,
        );
        for (let turnIndex = 0; turnIndex < maxAdapterTurns; turnIndex += 1) {
          assertHeartbeat();
          const controlled = await handlePendingControl(
            run,
            lease.generation,
            session,
          );
          if (controlled !== undefined) return controlled;
          if (now().getTime() >= deadlineMs) {
            if (policyDeadlineMs <= now().getTime()) {
              const policyControlled =
                await checkpointPolicyAndHandleV1(
                  run,
                  lease.generation,
                  "worker_claim",
                  session,
                  signal,
                );
              if (policyControlled !== undefined) {
                return policyControlled;
              }
              throw new RuntimeExecutionErrorV1(
                "policy_checkpoint_unavailable",
                "Expired Runtime policy did not produce a durable safety control",
                true,
              );
            }
            adapterAbort.abort(
              new RuntimeExecutionErrorV1("runtime_deadline_exceeded"),
            );
            const event = eventFor(
              run,
              "runtime.run.failed",
              "failed",
              now().toISOString(),
              "deadline_exceeded",
              "Runtime execution exceeded its deadline",
              null,
            );
            return await appendAndTryCallback(
              run.request.runtime_run_id,
              lease.generation,
              event,
              "failed",
              "deadline_exceeded",
              signal,
            );
          }
          const refreshed = await dependencies.store.readRun(
            run.request.runtime_run_id,
          );
          if (
            refreshed === undefined ||
            !isRuntimeLeaseActiveStatusV1(refreshed.status) ||
            refreshed.lease?.generation !== lease.generation
          ) {
            throw new RuntimeExecutionErrorV1(
              "stale_lease_generation",
            );
          }
          run = refreshed;
          runtimeActorBindingForRunV1(run);
          const controlledAfterRefresh = await handlePendingControl(
            run,
            lease.generation,
            session,
          );
          if (controlledAfterRefresh !== undefined) {
            return controlledAfterRefresh;
          }
          assertLease(run, lease.generation, now());
          diagnosticStage = "adapter_next_wait";
          const nextAdapterValue = await awaitAbortable(
            adapterNext(session, adapterContext()),
            adapterAbort.signal,
          );
          diagnosticStage = "adapter_next_snapshot";
          let turn = snapshotRuntimeAdapterTurnV1(nextAdapterValue);
          assertHeartbeat();
          let retryAttempt = 0;
          while (
            turn.kind === "failed" &&
            turn.retryable &&
            retryAttempt < maxRetryAttempts
          ) {
            const controlledDuringRetry = await handlePendingControl(
              run,
              lease.generation,
              session,
            );
            if (controlledDuringRetry !== undefined) {
              return controlledDuringRetry;
            }
            await waitBeforeRetry(retryAttempt, adapterAbort.signal);
            retryAttempt += 1;
            diagnosticStage = "adapter_next_wait";
            const retryAdapterValue = await awaitAbortable(
              adapterNext(session, adapterContext()),
              adapterAbort.signal,
            );
            diagnosticStage = "adapter_next_snapshot";
            turn = snapshotRuntimeAdapterTurnV1(retryAdapterValue);
            assertHeartbeat();
          }
          if (turn.kind === "checkpoint") continue;
          if (turn.kind === "tool_call") {
            const policyControlled =
              await checkpointPolicyAndHandleV1(
                run,
                lease.generation,
                "tool_dispatch",
                session,
                signal,
              );
            if (policyControlled !== undefined) {
              return policyControlled;
            }
            const call = turn.call;
            const profile = snapshotRuntimeToolProfileV1(
              await profilePort.resolveExact(
                {
                  workspace_id: run.request.workspace_id,
                  bot_id: run.request.bot_id,
                  owner_agent_id: run.request.owner_agent_id,
                  deployment_environment:
                    run.request.deployment_environment,
                  release_channel: run.request.release_channel,
                  profile_ref:
                    run.request.intent_policy_snapshot
                      .tool_permission_profile_ref,
                  revision:
                    run.request.intent_policy_snapshot
                      .tool_permission_profile_revision,
                  profile_hash:
                    run.request.intent_policy_snapshot
                      .tool_permission_profile_hash,
                  policy_epoch:
                    run.request.intent_policy_snapshot.tool_policy_epoch,
                },
                adapterAbort.signal,
              ),
            );
            if (
              profile.profile_ref !==
                run.request.intent_policy_snapshot
                  .tool_permission_profile_ref ||
              profile.revision !==
                run.request.intent_policy_snapshot
                  .tool_permission_profile_revision ||
              profile.profile_hash !==
                run.request.intent_policy_snapshot
                  .tool_permission_profile_hash ||
              profile.policy_epoch !==
                run.request.intent_policy_snapshot.tool_policy_epoch
            ) {
              throw new RuntimeExecutionErrorV1(
                "tool_policy_denied",
                "Runtime tool profile changed before dispatch",
              );
            }
            if (!run.request.allowed_tools.includes(call.tool_name)) {
              throw new RuntimeExecutionErrorV1(
                "tool_policy_denied",
                "Adapter emitted a tool outside the frozen request",
              );
            }
            if (!profile.allowed_tools.includes(call.tool_name)) {
              throw new RuntimeExecutionErrorV1(
                "tool_policy_denied",
                "Adapter emitted a tool outside the frozen profile",
              );
            }
            if (!profile.validateArguments(call.tool_name, call.arguments)) {
              throw new RuntimeExecutionErrorV1(
                "tool_policy_denied",
                "Adapter emitted arguments outside the frozen profile",
              );
            }
            const invocationRequest = Object.freeze({
              schema_version:
                "runtime_tool_invocation_request.v1",
              runtime_run_id: run.request.runtime_run_id,
              adapter_tool_call_id: call.tool_call_id,
              tool_name: call.tool_name,
              normalized_args: call.arguments,
            });
            if (
              !Value.Check(
                RuntimeToolInvocationRequestV1Schema,
                invocationRequest,
              )
            ) {
              throw new RuntimeExecutionErrorV1(
                "schema_validation_failed",
                "Tool invocation request is not a JSON object accepted by the owner contract",
              );
            }
            const typedInvocationRequest: RuntimeToolInvocationRequestV1 =
              invocationRequest;
            const normalizedArgsHash = canonicalPayloadHashV1(
              typedInvocationRequest.normalized_args,
            );
            const toolActorBinding =
              runtimeActorBindingForRunV1(run);
            if (
              toolRequiresDelegatedPrincipalV1(
                call.tool_name,
                call.capability,
              ) &&
              toolActorBinding.actor_binding
                .delegated_principal === null
            ) {
              throw new RuntimeExecutionErrorV1(
                "tool_policy_denied",
                "The tool requires a signed delegated principal",
              );
            }
            const permission = run.permissions.find(
              (candidate) =>
                candidate.capability === call.capability &&
                candidate.actor_binding_hash ===
                  toolActorBinding.actor_binding_hash &&
                candidate.scope.tool_name === call.tool_name &&
                candidate.policy_snapshot_id ===
                  run.response.details.policy_snapshot_id &&
                candidate.runtime_run_id === run.request.runtime_run_id &&
                Date.parse(candidate.expires_at) > now().getTime(),
            );
            if (permission === undefined) {
              throw new RuntimeExecutionErrorV1(
                "tool_policy_denied",
                "No durable runtime permission projection authorizes the tool call",
              );
            }
            const inputArtifact = await persistRuntimeArtifact(
              run,
              lease.generation,
              runtimeArtifactFromJsonV1(
                run,
                `tool_input:${call.tool_call_id}`,
                "tool-input",
                typedInvocationRequest,
              ),
              signal,
            );
            run = inputArtifact.run;
            const artifactActorBinding =
              runtimeActorBindingForRunV1(run);
            if (
              artifactActorBinding.actor_binding_hash !==
                permission.actor_binding_hash
            ) {
              throw new RuntimeExecutionErrorV1(
                "tool_policy_denied",
                "Runtime artifact returned a different delegated principal binding",
              );
            }
            const audit: RuntimeToolAuditV1 = {
              tool_invocation_id: call.tool_call_id,
              tool_name: call.tool_name,
              capability_token_id: permission.id,
              input_ref: inputArtifact.artifact_ref,
              lease_generation: lease.generation,
              request_hash: canonicalPayloadHashV1(
                {
                  invocation: typedInvocationRequest,
                  runtime_actor_binding_hash:
                    artifactActorBinding.actor_binding_hash,
                },
              ),
              normalized_args_hash: normalizedArgsHash,
              actor_binding_hash:
                artifactActorBinding.actor_binding_hash,
              status: "requested",
              side_effect_status: "none",
              downstream_idempotency_key:
                `${run.request.runtime_run_id}:tool:${call.tool_call_id}`,
            };
            const previousAudit = run.tools.find(
              ({ tool_invocation_id }) =>
                tool_invocation_id === call.tool_call_id,
            );
            if (previousAudit !== undefined) {
              if (
                previousAudit.request_hash !== audit.request_hash ||
                previousAudit.normalized_args_hash !==
                  audit.normalized_args_hash ||
                previousAudit.actor_binding_hash !==
                  audit.actor_binding_hash ||
                previousAudit.capability_token_id !==
                  audit.capability_token_id ||
                previousAudit.input_ref !== audit.input_ref
              ) {
                throw new RuntimeExecutionErrorV1(
                  "idempotency_conflict",
                );
              }
              if (previousAudit.result !== undefined) {
                if (
                  previousAudit.result.side_effect_status === "unknown"
                ) {
                  return await freezeUnknownTool(
                    run,
                    call,
                    previousAudit.result,
                    previousAudit.output_ref,
                  );
                }
                const resultEventKey =
                  `${run.request.runtime_run_id}:tool:${call.tool_call_id}:${previousAudit.result.outcome}`;
                if (
                  !run.events.some(
                    ({ idempotency_key }) =>
                      idempotency_key === resultEventKey,
                  )
                ) {
                  run = await appendAndTryCallback(
                    run.request.runtime_run_id,
                    lease.generation,
                    toolEventFor(
                      run,
                      call,
                      previousAudit.result.outcome === "completed"
                        ? "runtime.tool.completed"
                        : "runtime.tool.failed",
                      previousAudit.result.outcome,
                      now().toISOString(),
                      previousAudit,
                      previousAudit.result,
                      true,
                    ),
                    undefined,
                    undefined,
                    signal,
                  );
                }
                lastToolCallId = call.tool_call_id;
                lastToolResult = previousAudit.result;
                continue;
              }
            }
            const requestedEvent = toolEventFor(
              run,
              call,
              "runtime.tool.requested",
              "requested",
              now().toISOString(),
              audit,
            );
            run = await dependencies.store.recordToolRequested({
              runtime_run_id: run.request.runtime_run_id,
              lease_generation: lease.generation,
              audit,
              event: requestedEvent,
            });
            run = await tryCallbackForCommittedEvent(
              run,
              requestedEvent,
              signal,
            );
            const controlledBeforeTool = await handlePendingControl(
              run,
              lease.generation,
              session,
            );
            if (controlledBeforeTool !== undefined) {
              return controlledBeforeTool;
            }
            let toolRetryAttempt = 0;
            let toolMarkedRunning = false;
            let result: RuntimeToolResultV1;
            while (true) {
              const dispatchControlled =
                await checkpointPolicyAndHandleV1(
                  run,
                  lease.generation,
                  "tool_dispatch",
                  session,
                  signal,
                );
              if (dispatchControlled !== undefined) {
                return dispatchControlled;
              }
              const controlledAtDispatchFence =
                await handlePendingControl(
                  run,
                  lease.generation,
                  session,
                );
              if (controlledAtDispatchFence !== undefined) {
                return controlledAtDispatchFence;
              }
              if (!toolMarkedRunning) {
                await dependencies.store.markToolRunning({
                  runtime_run_id: run.request.runtime_run_id,
                  lease_generation: lease.generation,
                  tool_invocation_id: call.tool_call_id,
                });
                toolMarkedRunning = true;
              }
              // The dispatch writer, policy I/O, and every retry are separate
              // await boundaries. Re-read owner facts after the writer and
              // directly before the external call so an expired or taken-over
              // generation cannot issue a fresh side effect.
              run = await readCurrentWorkerLeaseV1(
                run.request.runtime_run_id,
                executionRequest.worker_id,
                lease.generation,
              );
              const dispatchActorBinding =
                runtimeActorBindingForRunV1(run);
              const dispatchPermission = run.permissions.find(
                (candidate) =>
                  candidate.id === permission.id &&
                  candidate.runtime_run_id ===
                    run.request.runtime_run_id &&
                  candidate.policy_snapshot_id ===
                    run.response.details.policy_snapshot_id &&
                  candidate.capability === call.capability &&
                  candidate.scope.tool_name === call.tool_name &&
                  candidate.actor_binding_hash ===
                    dispatchActorBinding.actor_binding_hash &&
                  Date.parse(candidate.expires_at) >
                    now().getTime(),
              );
              if (dispatchPermission === undefined) {
                throw new RuntimeExecutionErrorV1(
                  "tool_policy_denied",
                  "The current owner row no longer authorizes the delegated principal tool binding",
                );
              }
              if (
                canonicalPayloadHashV1(call.arguments) !==
                  normalizedArgsHash ||
                canonicalPayloadHashV1(
                  typedInvocationRequest.normalized_args,
                ) !== normalizedArgsHash ||
                audit.normalized_args_hash !== normalizedArgsHash
              ) {
                throw new RuntimeExecutionErrorV1(
                  "idempotency_conflict",
                  "Tool arguments changed after their durable policy and audit binding",
                );
              }
              const toolController = new AbortController();
              const onExecutionAbort = () =>
                toolController.abort(adapterAbort.signal.reason);
              adapterAbort.signal.addEventListener(
                "abort",
                onExecutionAbort,
                { once: true },
              );
              const remainingRunMs = Math.max(
                1,
                Date.parse(executionRequest.deadline_at) -
                  now().getTime(),
              );
              const timeout = setTimeout(
                () =>
                  toolController.abort(
                    new Error("runtime_tool_timeout"),
                  ),
                Math.min(toolTimeoutMs, remainingRunMs),
              );
              try {
                const upstreamResult = await awaitAbortable(
                  invokeTool(call, Object.freeze({
                    runtime_run_id: run.request.runtime_run_id,
                    trigger_process_id:
                      run.request.trigger_process_id,
                    trace_id: run.request.trace_id,
                    lease_generation: lease.generation,
                    idempotency_key: audit.downstream_idempotency_key,
                    policy_snapshot_id:
                      run.response.details.policy_snapshot_id,
                    policy_snapshot_hash:
                      run.response.details.policy_snapshot_hash,
                    permission_id: dispatchPermission.id,
                    permission_expires_at:
                      dispatchPermission.expires_at,
                    actor_binding:
                      dispatchActorBinding.actor_binding,
                    actor_binding_hash:
                      dispatchActorBinding.actor_binding_hash,
                    signal: toolController.signal,
                  })),
                  toolController.signal,
                );
                result =
                  canonicalJsonSnapshotV1<RuntimeToolResultV1>(
                    upstreamResult,
                    "runtime_adapter_failed",
                    "Tool adapter result is not canonical JSON",
                  );
              } catch {
                result = {
                  outcome: "failed",
                  retryable: false,
                  side_effect_status: "unknown",
                  error: {
                    code:
                      adapterAbort.signal.aborted
                        ? "tool_call_aborted"
                        : toolController.signal.aborted
                          ? "tool_call_timeout_without_commit_proof"
                          : "tool_call_failed_without_commit_proof",
                    message:
                      "Tool call ended without durable proof of its side effect",
                  },
                };
              } finally {
                clearTimeout(timeout);
                adapterAbort.signal.removeEventListener(
                  "abort",
                  onExecutionAbort,
                );
              }
              result = sanitizeToolResultV1(result);
              const validationResult = bindToolEvidenceRefV1(
                run.request.runtime_run_id,
                call.tool_call_id,
                result,
              );
              assertToolResult(validationResult);
              if (
                result.outcome === "completed" ||
                result.side_effect_status === "unknown" ||
                result.side_effect_status === "produced" ||
                !result.retryable ||
                toolRetryAttempt >= maxRetryAttempts
              ) {
                break;
              }
              const controlledBeforeRetry = await handlePendingControl(
                run,
                lease.generation,
                session,
              );
              if (controlledBeforeRetry !== undefined) {
                return controlledBeforeRetry;
              }
              await waitBeforeRetry(
                toolRetryAttempt,
                adapterAbort.signal,
              );
              toolRetryAttempt += 1;
            }
            const outputArtifact = await persistRuntimeArtifact(
              run,
              lease.generation,
              runtimeArtifactFromJsonV1(
                run,
                `tool_result:${call.tool_call_id}`,
                "tool-result",
                result,
              ),
              signal,
            );
            run = outputArtifact.run;
            diagnosticStage = "tool_result_bind";
            result = bindToolEvidenceRefV1(
              run.request.runtime_run_id,
              call.tool_call_id,
              result,
              outputArtifact.artifact_ref,
            );
            assertToolResult(result);
            const auditResult = toolAuditResultV1(result);
            lastToolCallId = call.tool_call_id;
            lastToolResult = result;
            if (result.side_effect_status === "unknown") {
              return await freezeUnknownTool(
                run,
                call,
                auditResult,
                outputArtifact.artifact_ref,
              );
            }
            // Keep the durable tool-result commit separately observable from
            // the next adapter turn. A completed output artifact alone is not
            // enough: the owner ledger and its outbox event must commit before
            // the provider can be resumed safely.
            diagnosticStage = "tool_result_event";
            const resultEvent = toolEventFor(
              run,
              call,
              result.outcome === "completed"
                ? "runtime.tool.completed"
                : "runtime.tool.failed",
              result.outcome,
              now().toISOString(),
              {
                ...audit,
                status: result.outcome,
                side_effect_status: result.side_effect_status,
                output_ref: outputArtifact.artifact_ref,
                result: auditResult,
              },
              auditResult,
            );
            diagnosticStage = "tool_result_commit";
            run = await dependencies.store.recordToolResult({
              runtime_run_id: run.request.runtime_run_id,
              lease_generation: lease.generation,
              tool_invocation_id: call.tool_call_id,
              output_ref: outputArtifact.artifact_ref,
              result: auditResult,
              event: resultEvent,
            });
            diagnosticStage = "tool_result_callback";
            run = await tryCallbackForCommittedEvent(
              run,
              resultEvent,
              signal,
            );
            continue;
          }
          if (turn.kind === "skill_load") {
            const policyControlled =
              await checkpointPolicyAndHandleV1(
                run,
                lease.generation,
                "skill_load",
                session,
                signal,
              );
            if (policyControlled !== undefined) {
              return policyControlled;
            }
            if (!run.request.allowed_skills.includes(turn.skill_key)) {
              throw new RuntimeExecutionErrorV1("tool_policy_denied");
            }
            const resolved = run.skill_resolutions.find(
              ({ skill_key: skillKey }) => skillKey === turn.skill_key,
            );
            if (
              resolved === undefined ||
              resolved.security_revocation_epoch !==
                run.request.intent_policy_snapshot
                  .security_revocation_epoch ||
              Date.parse(resolved.valid_until) <= now().getTime()
            ) {
              throw new RuntimeExecutionErrorV1(
                "skill_content_mismatch",
                "Frozen skill resolution is missing, expired, or has stale policy epochs",
              );
            }
            const skillEventKey = (
              status: "requested" | "resolved" | "materialized" | "failed",
            ) =>
              `${run.request.runtime_run_id}:skill:${turn.skill_key}:${status}`;
            const materialized = run.events.find(
              ({ idempotency_key }) =>
                idempotency_key === skillEventKey("materialized"),
            );
            if (
              materialized !== undefined &&
              materialized.event_type ===
                "runtime.skill.load.materialized"
            ) {
              if (
                resolved.skill_key !== turn.skill_key ||
                resolved.version !== materialized.payload.skill_version ||
                resolved.resolution_id !==
                  materialized.payload.materialized_artifact_ref
              ) {
                throw new RuntimeExecutionErrorV1(
                  "idempotency_conflict",
                  "Materialized skill no longer matches its exact resolution",
                );
              }
              const contentControlled =
                await checkpointPolicyAndHandleV1(
                  run,
                  lease.generation,
                  "skill_content_fetch",
                  session,
                  signal,
                );
              if (contentControlled !== undefined) {
                return contentControlled;
              }
              const replayedMaterialization =
                snapshotRuntimeSkillMaterializationV1(
                  await skillPort.load(
                    resolved,
                    {
                      runtime_run_id: run.request.runtime_run_id,
                      trace_id: run.request.trace_id,
                      scope: run.actor_binding.scope,
                    },
                    adapterAbort.signal,
                  ),
                );
              assertSdkCompatibleSkillMaterializationV1(
                resolved,
                replayedMaterialization,
                now().getTime(),
              );
              lastSkill = resolved;
              lastSkillMaterialization =
                replayedMaterialization;
              lastSkillAuditEventId = materialized.event_id;
              continue;
            }
            if (
              !run.events.some(
                ({ idempotency_key }) =>
                  idempotency_key === skillEventKey("requested"),
              )
            ) {
              run = await appendAndTryCallback(
                run.request.runtime_run_id,
                lease.generation,
                skillEventFor(
                  run,
                  turn.skill_key,
                  "runtime.skill.load.requested",
                  "requested",
                  now().toISOString(),
                ),
                undefined,
                undefined,
                signal,
              );
            }
            try {
              if (
                !run.events.some(
                  ({ idempotency_key }) =>
                    idempotency_key === skillEventKey("resolved"),
                )
              ) {
                run = await appendAndTryCallback(
                  run.request.runtime_run_id,
                  lease.generation,
                  skillEventFor(
                    run,
                    turn.skill_key,
                    "runtime.skill.load.resolved",
                    "resolved",
                    now().toISOString(),
                    resolved,
                  ),
                  undefined,
                  undefined,
                  signal,
                );
              }
              const contentControlled =
                await checkpointPolicyAndHandleV1(
                  run,
                  lease.generation,
                  "skill_content_fetch",
                  session,
                  signal,
                );
              if (contentControlled !== undefined) {
                return contentControlled;
              }
              const materialization =
                snapshotRuntimeSkillMaterializationV1(
                  await skillPort.load(
                    resolved,
                    {
                      runtime_run_id: run.request.runtime_run_id,
                      trace_id: run.request.trace_id,
                      scope: run.actor_binding.scope,
                    },
                    adapterAbort.signal,
                  ),
                );
              assertSdkCompatibleSkillMaterializationV1(
                resolved,
                materialization,
                now().getTime(),
              );
              run = await appendAndTryCallback(
                run.request.runtime_run_id,
                lease.generation,
                skillEventFor(
                  run,
                  turn.skill_key,
                  "runtime.skill.load.materialized",
                  "materialized",
                  now().toISOString(),
                  resolved,
                ),
                undefined,
                undefined,
                signal,
              );
              lastSkill = resolved;
              lastSkillMaterialization = materialization;
              lastSkillAuditEventId = run.events.find(
                ({ idempotency_key }) =>
                  idempotency_key === skillEventKey("materialized"),
              )?.event_id;
              if (lastSkillAuditEventId === undefined) {
                throw new RuntimeExecutionErrorV1(
                  "skill_content_mismatch",
                  "Materialized skill audit event is unavailable",
                );
              }
            } catch (error) {
              if (
                !run.events.some(
                  ({ idempotency_key }) =>
                    idempotency_key === skillEventKey("failed"),
                )
              ) {
                run = await appendAndTryCallback(
                  run.request.runtime_run_id,
                  lease.generation,
                  skillEventFor(
                    run,
                    turn.skill_key,
                    "runtime.skill.load.failed",
                    "failed",
                    now().toISOString(),
                    undefined,
                    error,
                  ),
                  undefined,
                  undefined,
                  signal,
                );
              }
              throw error;
            }
            continue;
          }
          if (turn.kind === "artifact") {
            diagnosticStage = "artifact_persist";
            const suppliedArtifact = turn.artifact;
            const artifact: RuntimeArtifactRequestV1 = Object.freeze({
              ...suppliedArtifact,
              body:
                suppliedArtifact.body instanceof Uint8Array
                  ? Uint8Array.from(suppliedArtifact.body)
                  : new Uint8Array(),
            });
            const persisted = await persistRuntimeArtifact(
              run,
              lease.generation,
              artifact,
              signal,
            );
            run = persisted.run;
            lastArtifactId = artifact.artifact_id;
            lastArtifactRef = persisted.artifact_ref;
            continue;
          }
          if (turn.kind === "complete") {
            diagnosticStage = "terminal_event";
            if (
              turn.terminal_artifact_ref !== null &&
              !isCommittedAvailableArtifactRefV1(
                run,
                turn.terminal_artifact_ref,
              )
            ) {
              throw new RuntimeExecutionErrorV1(
                "artifact_integrity_mismatch",
                "Terminal artifact reference is not bound to a committed available artifact in this runtime run",
              );
            }
            const event = eventFor(
              run,
              "runtime.run.completed",
              "completed",
              now().toISOString(),
              null,
              null,
              turn.terminal_artifact_ref,
            );
            return await appendAndTryCallback(
              run.request.runtime_run_id,
              lease.generation,
              event,
              "completed",
              // Runtime terminal rows require an explicit reason for every
              // terminal status.  Without this, PostgreSQL correctly rejects
              // the completed transition after the final artifact is already
              // durable, and the generic catch path incorrectly reports an
              // adapter failure instead of delivering the result.
              "runtime_completed",
              signal,
            );
          }
          const safeFailure = safeAdapterFailureV1(
            turn.reason_code,
          );
          diagnosticStage = "terminal_event";
          const event = eventFor(
            run,
            "runtime.run.failed",
            "failed",
            now().toISOString(),
            safeFailure.reason_code,
            safeFailure.error_summary,
            null,
          );
          return await appendAndTryCallback(
            run.request.runtime_run_id,
            lease.generation,
            event,
            "failed",
            safeFailure.reason_code,
            signal,
          );
        }
        const event = eventFor(
          run,
          "runtime.run.failed",
          "failed",
          now().toISOString(),
          "adapter_turn_limit",
          "Runtime adapter exceeded its bounded turn limit",
          null,
        );
        diagnosticStage = "terminal_event";
        return await appendAndTryCallback(
          run.request.runtime_run_id,
          lease.generation,
          event,
          "failed",
          "adapter_turn_limit",
          signal,
        );
      } catch (error) {
        const attachDiagnosticStage = <T extends object>(failure: T): T => {
          Object.defineProperty(failure, "diagnostic_stage", {
            value: diagnosticStage,
            enumerable: true,
            configurable: false,
            writable: false,
          });
          const protectedDetail = protectedAdapterSnapshotDiagnosticV1(
            diagnosticStage,
            error,
          );
          if (protectedDetail !== undefined) {
            Object.defineProperty(failure, "diagnostic_detail", {
              value: protectedDetail,
              enumerable: true,
              configurable: false,
              writable: false,
            });
          }
          const protectedFingerprint = protectedAdapterSnapshotFingerprintV1(
            diagnosticStage,
            error,
          );
          if (protectedFingerprint !== undefined) {
            Object.defineProperty(failure, "diagnostic_fingerprint", {
              value: protectedFingerprint,
              enumerable: true,
              configurable: false,
              writable: false,
            });
          }
          return failure;
        };
        if (
          error instanceof RuntimeExecutionErrorV1 &&
          (error.code === "tool_side_effect_unknown" ||
            error.code === "policy_checkpoint_unavailable" ||
            error.code === "artifact_reconciliation_required")
        ) {
          throw error;
        }
        if (
          error instanceof ObjectStoreErrorV1 &&
          diagnosticStage === "artifact_persist" &&
          !error.retryable &&
          error.details.reconciliation_required !== true
        ) {
          // `persistRuntimeArtifact` has already committed the matching
          // runtime.artifact.failed event and marked the owner row failed.
          // Leaving the Runtime run active here would permanently occupy the
          // Trigger foreground slot, even though its final result can never
          // become available. Convert only this durable, non-reconcilable
          // artifact rejection into the normal fenced terminal path below.
          error = new RuntimeExecutionErrorV1(
            "artifact_integrity_mismatch",
            "Runtime final artifact was durably rejected by ObjectStore",
          );
        }
        if (error instanceof ObjectStoreErrorV1) throw error;
        if (signal.aborted) {
          throw new RuntimeExecutionErrorV1("runtime_cancelled");
        }
        const current =
          (await dependencies.store.readRun(run.request.runtime_run_id)) ?? run;
        if (
          adapterAbort.signal.aborted &&
          adapterAbort.signal.reason instanceof RuntimeExecutionErrorV1 &&
          adapterAbort.signal.reason.code === "runtime_deadline_exceeded"
        ) {
          if (!isRuntimeLeaseActiveStatusV1(current.status)) {
            throw adapterAbort.signal.reason;
          }
          if (
            Date.parse(current.request.policy.expires_at) <=
            now().getTime()
          ) {
            const controlled = await checkpointPolicyAndHandleV1(
              current,
              lease.generation,
              "worker_claim",
              session,
              signal,
            );
            if (controlled !== undefined) return controlled;
            throw new RuntimeExecutionErrorV1(
              "policy_checkpoint_unavailable",
              "Expired Runtime policy did not produce a durable safety control",
              true,
            );
          }
          const deadlineEvent = eventFor(
            current,
            "runtime.run.failed",
            "failed",
            now().toISOString(),
            "deadline_exceeded",
            "Runtime execution exceeded its deadline",
            null,
          );
          return await appendAndTryCallback(
            current.request.runtime_run_id,
            lease.generation,
            deadlineEvent,
            "failed",
            "deadline_exceeded",
            signal,
          );
        }
        if (
          !isRuntimeLeaseActiveStatusV1(current.status) ||
          current.frozen_side_effect === true ||
          current.lease?.generation !== lease.generation
        ) {
          if (error instanceof RuntimeExecutionErrorV1) {
            throw attachDiagnosticStage(new RuntimeExecutionErrorV1(
              error.code,
              safeRuntimeFailureSummaryV1(error.code),
              error.retryable,
            ));
          }
          throw attachDiagnosticStage(new RuntimeExecutionErrorV1(
            "runtime_adapter_failed",
            safeRuntimeFailureSummaryV1(
              "runtime_adapter_failed",
            ),
          ));
        }
        const terminalFailureCode =
          error instanceof RuntimeExecutionErrorV1
            ? error.code
            : "runtime_adapter_failed";
        const failedEvent = eventFor(
          current,
          "runtime.run.failed",
          "failed",
          now().toISOString(),
          terminalFailureCode,
          safeRuntimeFailureSummaryV1(terminalFailureCode),
          null,
        );
        await appendAndTryCallback(
          current.request.runtime_run_id,
          lease.generation,
          failedEvent,
          "failed",
          terminalFailureCode,
          signal,
        );
        if (error instanceof RuntimeExecutionErrorV1) {
          throw attachDiagnosticStage(new RuntimeExecutionErrorV1(
            error.code,
            safeRuntimeFailureSummaryV1(error.code),
            error.retryable,
          ));
        }
        throw attachDiagnosticStage(new RuntimeExecutionErrorV1(
          "runtime_adapter_failed",
          safeRuntimeFailureSummaryV1("runtime_adapter_failed"),
        ));
      } finally {
        heartbeatsStopped = true;
        if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
        await heartbeatInFlight?.catch(() => undefined);
        clearTimeout(deadlineTimer);
        signal.removeEventListener("abort", onAbort);
        if (!adapterAbort.signal.aborted) {
          adapterAbort.abort(
            new Error("runtime_execution_scope_finished"),
          );
        }
      }
    },

    async heartbeat(
      requestValue: Readonly<{
        runtime_run_id: string;
        worker_id: string;
        lease_generation: number;
        lease_seconds: number;
      }>,
    ): Promise<RuntimeLeaseV1> {
      const request = canonicalJsonSnapshotV1<typeof requestValue>(
        requestValue,
        "schema_validation_failed",
        "Runtime heartbeat claim is not canonical JSON",
      );
      const lease = await dependencies.store.heartbeat(Object.freeze({
        ...request,
        now: now(),
      }));
      const snapshot = canonicalJsonSnapshotV1<RuntimeLeaseV1>(
        lease,
        "runtime_adapter_failed",
        "Runtime owner returned a non-canonical heartbeat lease",
      );
      if (
        snapshot.runtime_run_id !== request.runtime_run_id ||
        snapshot.owner_id !== request.worker_id ||
        snapshot.generation !== request.lease_generation
      ) {
        throw new RuntimeExecutionErrorV1(
          "stale_lease_generation",
        );
      }
      return snapshot;
    },

    async reconcileUnknownTool(
      principal: RuntimeToolReconciliationPrincipalV1,
      requestValue: unknown,
    ): Promise<RuntimeToolReconciliationResultV1> {
      const request =
        canonicalJsonSnapshotV1<RuntimeToolReconciliationRequestV1>(
          requestValue,
          "schema_validation_failed",
          "Tool reconciliation request is not canonical JSON",
        );
      assertToolReconciliationRequestV1(request);
      if (
        principal.sub !== "action_runtime" ||
        principal.aud !== "action_runtime" ||
        !principal.capability.includes("runtime.tool.reconcile")
      ) {
        throw new RuntimeExecutionErrorV1(
          "authorization_scope_mismatch",
        );
      }
      const run = await dependencies.store.readRun(
        request.runtime_run_id,
      );
      if (
        run === undefined ||
        !runtimeScopeMatches(principal.scope, run.request)
      ) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      const boundResult = sanitizeToolResultV1(
        request.result.outcome === "completed"
          ? Object.freeze({
              ...request.result,
              external_response_ref:
                request.result.external_response_ref ??
                request.evidence_ref,
            })
          : Object.freeze({
              ...request.result,
              external_error_ref:
                request.result.external_error_ref ??
                request.evidence_ref,
            }),
      );
      assertToolResult(boundResult);
      if (
        boundResult.retryable ||
        boundResult.side_effect_status === "unknown"
      ) {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
          "Tool reconciliation must converge unknown to a terminal produced or none result",
        );
      }
      const normalizedRequest = Object.freeze({
        ...request,
        result: boundResult,
      });
      const persistedRequest = Object.freeze({
        ...normalizedRequest,
        result: toolAuditResultV1(boundResult),
      });
      let reconciliationRequestHash: string;
      try {
        reconciliationRequestHash = hashWithout(
          normalizedRequest,
          "trace_id",
        );
      } catch {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
          "Tool reconciliation request is not canonical JSON",
        );
      }
      const reconciledAt = now().toISOString();
      const stored = await dependencies.store.reconcileUnknownTool({
        reconciliation: persistedRequest,
        reconciliation_request_hash: reconciliationRequestHash,
        reconciled_at: reconciledAt,
      });
      return Object.freeze({
        runtime_run_id: request.runtime_run_id,
        tool_invocation_id: request.tool_invocation_id,
        side_effect_status:
          stored.audit.side_effect_status as "none" | "produced",
        outcome: stored.audit.status as "completed" | "failed",
        evidence_ref:
          stored.audit.reconciliation_evidence_ref ??
          request.evidence_ref,
        reconciled_at:
          stored.audit.reconciled_at ?? reconciledAt,
        replayed: stored.replayed,
      });
    },

    async recoverPendingArtifacts(
      requestValue: Readonly<{
        worker_id: string;
        limit?: number;
        lease_seconds?: number;
      }>,
      signal = new AbortController().signal,
    ): Promise<
      Readonly<{
        attempted: number;
        available: number;
        failed: number;
        pending: number;
      }>
    > {
      const request =
        canonicalJsonSnapshotV1<typeof requestValue>(
          requestValue,
          "schema_validation_failed",
          "Artifact reconciliation request is not canonical JSON",
        );
      if (
        Object.keys(request).some(
          (key) =>
            !["worker_id", "limit", "lease_seconds"].includes(key),
        )
      ) {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
          "Artifact reconciliation request contains unknown fields",
        );
      }
      const limit = request.limit ?? 16;
      const leaseSeconds = request.lease_seconds ?? 30;
      if (
        !/^[A-Za-z0-9._:-]{1,128}$/u.test(request.worker_id) ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 1_000 ||
        !Number.isSafeInteger(leaseSeconds) ||
        leaseSeconds < 1 ||
        leaseSeconds > 300
      ) {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
          "Artifact reconciliation claim is invalid",
        );
      }
      const claims =
        canonicalJsonSnapshotV1<readonly RuntimeArtifactRecordV1[]>(
          await dependencies.store.claimPendingArtifacts(
            Object.freeze({
              worker_id: request.worker_id,
              limit,
              lease_seconds: leaseSeconds,
              now: now().toISOString(),
            }),
          ),
          "artifact_integrity_mismatch",
          "Artifact owner returned a non-canonical claim batch",
        );
      if (
        !Array.isArray(claims) ||
        claims.length > limit ||
        new Set(
          claims.map(
            (record) =>
              `${record.runtime_run_id}\u0000${record.artifact_id}`,
          ),
        ).size !== claims.length
      ) {
        throw new RuntimeExecutionErrorV1(
          "artifact_integrity_mismatch",
          "Artifact owner returned an invalid or duplicate claim batch",
        );
      }
      let available = 0;
      let failed = 0;
      let pending = 0;
      for (const record of claims) {
        if (signal.aborted) throw signal.reason;
        const runValue = await dependencies.store.readRun(
          record.runtime_run_id,
        );
        if (runValue === undefined) {
          throw new RuntimeExecutionErrorV1(
            "artifact_integrity_mismatch",
            "Claimed artifact has no owner Runtime run",
          );
        }
        const run = canonicalJsonSnapshotV1<RuntimeRunRecordV1>(
          runValue,
          "artifact_integrity_mismatch",
          "Claimed artifact owner run is not canonical JSON",
        );
        if (
          run.request.runtime_run_id !== record.runtime_run_id ||
          run.start_fence_generation !==
            record.start_fence_generation
        ) {
          throw new RuntimeExecutionErrorV1(
            "artifact_integrity_mismatch",
            "Claimed artifact is bound to another Runtime owner fence",
          );
        }
        const artifact = artifactMetadataFromRecordV1(record);
        if (
          !Number.isSafeInteger(
            record.originating_lease_generation,
          ) ||
          record.originating_lease_generation < 1 ||
          !Number.isSafeInteger(record.size_bytes) ||
          record.size_bytes < 1 ||
          !/^sha256:[0-9a-f]{64}$/u.test(record.content_hash) ||
          record.media_type.length < 1 ||
          record.media_type.length > 256 ||
          !Number.isFinite(Date.parse(record.retention_until))
        ) {
          throw new RuntimeExecutionErrorV1(
            "artifact_integrity_mismatch",
            "Claimed artifact metadata is malformed",
          );
        }
        const originatingLease = run.lease;
        if (
          originatingLease !== undefined &&
          originatingLease.generation ===
            record.originating_lease_generation &&
          originatingLease.recovery_state === "active" &&
          Date.parse(originatingLease.expires_at) > now().getTime()
        ) {
          throw new RuntimeExecutionErrorV1(
            "artifact_integrity_mismatch",
            "Artifact owner claimed reconciliation while its originating lease is active",
          );
        }
        const expectedHash = runtimeArtifactRequestHashV1(
          run,
          artifact,
          record.object_store_idempotency_key,
        );
        assertArtifactRecordMatchesRequestV1(
          record,
          run,
          artifact,
          record.object_store_idempotency_key,
          expectedHash,
        );
        if (
          record.reconciliation_owner !== request.worker_id ||
          record.reconciliation_expires_at === undefined ||
          !Number.isSafeInteger(record.reconciliation_generation) ||
          record.reconciliation_generation < 1 ||
          !Number.isFinite(
            Date.parse(record.reconciliation_expires_at),
          ) ||
          Date.parse(record.reconciliation_expires_at) <=
            now().getTime()
        ) {
          throw new RuntimeExecutionErrorV1(
            "artifact_integrity_mismatch",
            "Artifact reconciliation claim is not owner-fenced",
          );
        }
        try {
          const stored = await putRuntimeArtifactV1(
            run,
            record,
            undefined,
            signal,
          );
          const currentValue =
            await dependencies.store.readRun(
              record.runtime_run_id,
            );
          const current =
            currentValue === undefined
              ? run
              : canonicalJsonSnapshotV1<RuntimeRunRecordV1>(
                  currentValue,
                  "artifact_integrity_mismatch",
                  "Artifact owner returned a non-canonical current run",
                );
          await finalizeArtifactAndTryCallbackV1(
            current,
            record,
            "available",
            now().toISOString(),
            {
              reconciliation_owner: request.worker_id,
              reconciliation_generation:
                record.reconciliation_generation,
              artifact_ref: stored.object_ref,
              signal,
            },
          );
          available += 1;
        } catch (error) {
          if (signal.aborted) throw signal.reason;
          if (
            error instanceof ObjectStoreErrorV1 &&
            !error.retryable &&
            error.details.reconciliation_required !== true
          ) {
            const currentValue =
              await dependencies.store.readRun(
                record.runtime_run_id,
              );
            const current =
              currentValue === undefined
                ? run
                : canonicalJsonSnapshotV1<RuntimeRunRecordV1>(
                    currentValue,
                    "artifact_integrity_mismatch",
                    "Artifact owner returned a non-canonical current run",
                  );
            try {
              await finalizeArtifactAndTryCallbackV1(
                current,
                record,
                "failed",
                now().toISOString(),
                {
                  reconciliation_owner: request.worker_id,
                  reconciliation_generation:
                    record.reconciliation_generation,
                  failure_code: error.code,
                  error,
                  signal,
                },
              );
              failed += 1;
              continue;
            } catch {
              // The immutable object outcome is known, but owner finalization
              // remains pending behind the claim/sequence fence.
            }
          }
          pending += 1;
        }
      }
      return Object.freeze({
        attempted: claims.length,
        available,
        failed,
        pending,
      });
    },

    async recoverPendingCallbacks(
      limit = 16,
      signal = new AbortController().signal,
    ): Promise<Readonly<{ attempted: number; sent: number }>> {
      return claimAndDeliverPendingCallbacksV1(limit, signal);
    },
  };
  return Object.freeze(application);
}

/**
 * Test/reference store with the same atomic boundaries required from the
 * PostgreSQL owner writer implementation. It intentionally snapshots values so
 * caller mutation cannot change a fence, policy, or event after validation.
 */
export function createInMemoryRuntimeExecutionStoreV1(
  options: Readonly<{
    now?: () => Date;
    transport_epoch?: string;
    transport_generation?: number;
  }> = {},
): RuntimeExecutionStoreV1 {
  const runs = new Map<string, RuntimeRunRecordV1>();
  const startAttempts = new Map<string, RuntimeStartAttemptV1>();
  const policyInputArtifacts = new Map<
    string,
    RuntimePolicyInputReadArtifactV1
  >();
  const artifacts = new Map<string, RuntimeArtifactRecordV1>();
  const startByIdempotency = new Map<string, string>();
  const validationCallOwner = new Map<string, string>();
  const controlById = new Map<string, string>();
  const controlByIdempotency = new Map<string, string>();
  const controlTombstones = new Map<string, RuntimeControlTombstoneV1>();
  const outboxOwner = new Map<string, string>();
  const outboxClaims = new Map<
    string,
    Readonly<{
      worker_id: string;
      claim_token: string;
      lease_expires_at: string;
      transport_epoch: string;
      transport_generation: number;
    }>
  >();
  const outboxRetryAt = new Map<string, string>();
  const outboxAcknowledgements = new Map<
    string,
    RuntimeOutboxAuthoritativeAckV1
  >();
  const currentTime = options.now ?? (() => new Date());
  const activeTransportEpoch =
    options.transport_epoch ?? "runtime-callback.v1";
  const activeTransportGeneration =
    options.transport_generation ?? 1;
  if (
    activeTransportEpoch.length < 1 ||
    activeTransportEpoch.length > 128 ||
    !Number.isSafeInteger(activeTransportGeneration) ||
    activeTransportGeneration < 1
  ) {
    throw new Error("In-memory Runtime transport authority is invalid");
  }
  const artifactKeyV1 = (runtimeRunId: string, artifactId: string) =>
    `${runtimeRunId}\u0000${artifactId}`;

  const snapshot = <T>(value: T): T =>
    structuredClone(value) as T;

  const replace = (
    runtimeRunId: string,
    update: (run: RuntimeRunRecordV1) => RuntimeRunRecordV1,
  ): RuntimeRunRecordV1 => {
    const run = runs.get(runtimeRunId);
    if (run === undefined) {
      throw new RuntimeExecutionErrorV1("runtime_not_found");
    }
    const next = Object.freeze(update(run));
    runs.set(runtimeRunId, next);
    return next;
  };

  const readOutboxRecordByIdV1 = (
    outboxId: string,
  ): RuntimeOutboxRecordV1 | undefined => {
    const runtimeRunId = outboxOwner.get(outboxId);
    if (runtimeRunId === undefined) return undefined;
    if (runtimeRunId.startsWith("tombstone:")) {
      const signalId = runtimeRunId.slice("tombstone:".length);
      return controlTombstones
        .get(signalId)
        ?.outbox.find(({ id }) => id === outboxId);
    }
    return runs
      .get(runtimeRunId)
      ?.outbox.find(({ id }) => id === outboxId);
  };

  const replaceOutboxRecordV1 = (
    outboxId: string,
    update: (
      record: RuntimeOutboxRecordV1,
    ) => RuntimeOutboxRecordV1,
  ): RuntimeOutboxRecordV1 => {
    const runtimeRunId = outboxOwner.get(outboxId);
    if (runtimeRunId === undefined) {
      throw new RuntimeExecutionErrorV1(
        "idempotency_conflict",
        "Runtime outbox target does not exist",
      );
    }
    let updated: RuntimeOutboxRecordV1 | undefined;
    if (runtimeRunId.startsWith("tombstone:")) {
      const signalId = runtimeRunId.slice("tombstone:".length);
      const tombstone = controlTombstones.get(signalId);
      if (tombstone === undefined) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      controlTombstones.set(
        signalId,
        Object.freeze({
          ...tombstone,
          outbox: Object.freeze(
            tombstone.outbox.map((record) =>
              record.id === outboxId
                ? (updated = Object.freeze(update(record)))
                : record,
            ),
          ),
        }),
      );
    } else {
      replace(runtimeRunId, (run) => ({
        ...run,
        outbox: Object.freeze(
          run.outbox.map((record) =>
            record.id === outboxId
              ? (updated = Object.freeze(update(record)))
              : record,
          ),
        ),
      }));
    }
    if (updated === undefined) {
      throw new RuntimeExecutionErrorV1("idempotency_conflict");
    }
    return updated;
  };

  const activeLease = (
    run: RuntimeRunRecordV1,
    generation: number,
    current = currentTime(),
  ): RuntimeLeaseV1 => assertLease(run, generation, current);

  const appendValidationFactV1 = (
    attempt: RuntimeStartAttemptV1,
    factValue: RuntimeStartValidationFactInputV1,
  ): RuntimeStartAttemptV1 => {
    const fact = snapshot(factValue);
    const successResponse =
      fact.response.schema_version ===
      "runtime_start_reservation_validate_response.v1"
        ? fact.response
        : undefined;
    const errorResponse =
      fact.response.schema_version ===
      "runtime_start_reservation_validate_error.v1"
        ? fact.response
        : undefined;
    const validationCall = attempt.validation_calls.find(
      (candidate) =>
        candidate.validation_call_id ===
        fact.validation_call_id,
    );
    if (
      Object.keys(fact).sort().join(",") !==
        "request_hash,response,response_hash,response_schema_version,response_source,start_fence_token_hash,validated_at,validation_call_id,validation_result,validation_stage" ||
      validationCall === undefined ||
      validationCall.validation_stage !==
        fact.validation_stage ||
      validationCall.request_hash !== fact.request_hash ||
      !/^sha256:[0-9a-f]{64}$/u.test(fact.request_hash) ||
      !secureDigestEqualsV1(
        fact.start_fence_token_hash,
        attempt.start_fence_token_hash,
      ) ||
      fact.response_source !== "trigger_processor" ||
      fact.response_schema_version !==
        fact.response.schema_version ||
      (successResponse === undefined
        ? errorResponse === undefined ||
          fact.validation_result !== "error" ||
          !Value.Check(
            RuntimeStartReservationValidateErrorV1Schema,
            errorResponse,
          )
        : fact.validation_result !== "valid" ||
          !Value.Check(
            RuntimeStartReservationValidateResponseV1Schema,
            successResponse,
          ) ||
          successResponse.validation_stage !==
            fact.validation_stage ||
          successResponse.validation_result !== "valid" ||
          successResponse.duplicate_replayed !== false ||
          !RUNTIME_RESERVATION_ALLOWED_STATUS_BY_STAGE_V1[
            fact.validation_stage
          ].has(successResponse.reservation_status)) ||
      fact.response_hash !== canonicalPayloadHashV1(fact.response) ||
      !Number.isFinite(Date.parse(fact.validated_at)) ||
      Date.parse(fact.validated_at) <
        Date.parse(validationCall.requested_at) ||
      Date.parse(fact.validated_at) > currentTime().getTime()
    ) {
      throw new RuntimeExecutionErrorV1("idempotency_conflict");
    }
    const existing = attempt.validation_facts.find(
      (candidate) =>
        candidate.validation_call_id ===
          fact.validation_call_id,
    );
    if (existing !== undefined) {
      if (
        existing.validation_stage !== fact.validation_stage ||
        existing.validation_result !== fact.validation_result ||
        existing.response_source !== fact.response_source ||
        existing.response_schema_version !==
          fact.response_schema_version ||
        existing.request_hash !== fact.request_hash ||
        !secureDigestEqualsV1(
          existing.start_fence_token_hash,
          fact.start_fence_token_hash,
        ) ||
        existing.response_hash !== fact.response_hash ||
        canonicalJsonV1(existing.response) !==
          canonicalJsonV1(fact.response)
      ) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      return attempt;
    }
    const successfulFacts = attempt.validation_facts.filter(
      (
        candidate,
      ): candidate is RuntimeStartValidationFactV1 & {
        validation_result: "valid";
        response: RuntimeStartReservationValidateResponseV1;
      } =>
        candidate.validation_result === "valid" &&
        candidate.response.schema_version ===
          "runtime_start_reservation_validate_response.v1",
    );
    const hasSuccessfulStage = (
      stage: RuntimeReservationValidationStageV1,
    ) =>
      successfulFacts.some(
        (candidate) => candidate.validation_stage === stage,
      );
    const expectedStage =
      !hasSuccessfulStage("request_received")
        ? "request_received"
        : !hasSuccessfulStage("preflight_completed")
          ? "preflight_completed"
          : !hasSuccessfulStage("before_running")
            ? "before_running"
            : undefined;
    const previousValidation =
      successfulFacts[successfulFacts.length - 1];
    const previousFact =
      attempt.validation_facts[
        attempt.validation_facts.length - 1
      ];
    if (
      (fact.validation_stage !== expectedStage &&
        fact.validation_stage !==
          previousValidation?.validation_stage) ||
      (fact.validation_stage === "before_running"
        ? attempt.status !== "accepted"
        : attempt.status !== "validating" &&
          !(
            attempt.status === "accepted" &&
            fact.validation_stage ===
              previousValidation?.validation_stage
          )) ||
      (previousFact !== undefined &&
        Date.parse(fact.validated_at) <
          Date.parse(previousFact.validated_at)) ||
      (successResponse !== undefined &&
        successfulFacts[0]?.response.validated_fence_generation !==
          undefined &&
        successfulFacts[0].response.validated_fence_generation !==
          successResponse.validated_fence_generation) ||
      (successResponse !== undefined &&
        previousValidation !== undefined &&
        RUNTIME_RESERVATION_STATUS_RANK_V1[
          successResponse.reservation_status
        ] <
          RUNTIME_RESERVATION_STATUS_RANK_V1[
            previousValidation.response.reservation_status
          ])
    ) {
      throw new RuntimeExecutionErrorV1("stale_start_fence");
    }
    const validationSequenceNo = incrementSafeIntegerV1(
      previousFact?.validation_sequence_no ?? 0,
      "runtime_start_validation_sequence_no",
    );
    return Object.freeze({
      ...attempt,
      validation_facts: Object.freeze([
        ...attempt.validation_facts,
        Object.freeze({
          ...fact,
          validation_sequence_no: validationSequenceNo,
        }),
      ]),
      updated_at: fact.validated_at,
    });
  };

  const attachControl = (
    request: RuntimeStoredControlRequestV1,
    requestHash: string,
    type: RuntimeControlTypeV1,
    verification: RuntimeControlTokenClaimsV1,
    expectedScope?: RuntimeStartPrincipalV1["scope"],
  ): Readonly<{
    control: RuntimeControlRecordV1;
    run: RuntimeRunRecordV1;
    replayed: boolean;
  }> => {
    const globalOwner = controlById.get(request.runtime_signal_id);
    const idempotencyOwner = controlByIdempotency.get(
      request.idempotency_key,
    );
    if (
      globalOwner !== undefined &&
      globalOwner !== request.runtime_run_id
    ) {
      throw new RuntimeExecutionErrorV1("idempotency_conflict");
    }
    if (
      idempotencyOwner !== undefined &&
      idempotencyOwner !== request.runtime_signal_id
    ) {
      throw new RuntimeExecutionErrorV1("idempotency_conflict");
    }
    let result: RuntimeControlRecordV1 | undefined;
    let replayed = false;
    const updated = replace(request.runtime_run_id, (run) => {
      if (
        run.request.trigger_process_id !== request.trigger_process_id ||
        run.request.start_attempt_no !== request.start_attempt_no ||
        !secureDigestEqualsV1(
          run.request.preempt_token_hash,
          request.preempt_token_hash,
        ) ||
        run.start_fence_generation !==
          verification.start_fence_generation ||
        verification.control_valid_until !==
          addMilliseconds(
            new Date(run.request.policy.expires_at),
            15 * 60 * 1_000,
          ) ||
        currentTime().getTime() >
          Date.parse(verification.control_valid_until) ||
        (expectedScope !== undefined &&
          !runtimeScopeMatches(expectedScope, run.request))
      ) {
        throw new RuntimeExecutionErrorV1("stale_start_fence");
      }
      const existing = run.controls.find(
        ({ request: candidate }) =>
          candidate.runtime_signal_id === request.runtime_signal_id,
      );
      if (existing !== undefined) {
        if (existing.request_hash !== requestHash) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        result = existing;
        replayed = true;
        return run;
      }
      if (
        run.status === "completed" ||
        run.status === "failed" ||
        run.status === "cancelled"
      ) {
        throw new RuntimeExecutionErrorV1(
          "runtime_terminal",
          "A terminal Runtime rejects new control commands",
        );
      }
      const control: RuntimeControlRecordV1 = Object.freeze({
        request: snapshot(request),
        control_type: type,
        requested_by: "trigger_processor",
        control_valid_until: verification.control_valid_until,
        target_lease_generation: run.lease?.generation ?? null,
        request_hash: requestHash,
        status: "received",
      });
      result = control;
      controlById.set(request.runtime_signal_id, request.runtime_run_id);
      controlByIdempotency.set(
        request.idempotency_key,
        request.runtime_signal_id,
      );
      return {
        ...run,
        ...(run.status === "running"
          ? {
              status:
                type === "preempt"
                  ? ("preempt_requested" as const)
                  : ("cancelling" as const),
            }
          : {}),
        controls: Object.freeze([...run.controls, control]),
      };
    });
    return Object.freeze({
      control: snapshot(result!),
      run: snapshot(updated),
      replayed,
    });
  };

  const store: RuntimeExecutionStoreV1 = {
    async beginStartAttempt(
      request,
      requestHash,
      actorBinding,
      actorBindingHash,
      createdAt,
    ) {
      const verifiedActorBinding = snapshotRuntimeActorBindingV1(
        {
          sub: actorBinding.workload_service,
          aud: "action_runtime",
          capability: [],
          ...(actorBinding.delegated_principal === null
            ? {}
            : {
                delegated_principal:
                  actorBinding.delegated_principal,
              }),
          scope: actorBinding.scope,
        },
        request,
      );
      const idempotencyOwner = startByIdempotency.get(
        request.idempotency_key,
      );
      if (
        idempotencyOwner !== undefined &&
        idempotencyOwner !== request.runtime_run_id
      ) {
        return Object.freeze({ outcome: "conflict" as const });
      }
      const existing = startAttempts.get(request.runtime_run_id);
      const startFenceTokenHash = request.start_fence_token_hash;
      if (existing !== undefined) {
        if (
          existing.trigger_process_id !==
            request.trigger_process_id ||
          existing.start_attempt_no !== request.start_attempt_no ||
          existing.idempotency_key !== request.idempotency_key ||
          existing.request_hash !== requestHash ||
          !secureDigestEqualsV1(
            existing.start_fence_token_hash,
            startFenceTokenHash,
          ) ||
          !secureDigestEqualsV1(
            existing.actor_binding_hash,
            actorBindingHash,
          )
        ) {
          return Object.freeze({ outcome: "conflict" as const });
        }
        return Object.freeze({
          outcome: "replayed" as const,
          attempt: snapshot(existing),
        });
      }
      const created = new Date(createdAt);
      if (
        !Number.isFinite(created.getTime()) ||
        created.getTime() > currentTime().getTime() ||
        !secureDigestEqualsV1(
          verifiedActorBinding.actor_binding_hash,
          actorBindingHash,
        )
      ) {
        throw new RuntimeExecutionErrorV1(
          "authorization_scope_mismatch",
        );
      }
      const attempt: RuntimeStartAttemptV1 = Object.freeze({
        runtime_run_id: request.runtime_run_id,
        trigger_process_id: request.trigger_process_id,
        start_attempt_no: request.start_attempt_no,
        idempotency_key: request.idempotency_key,
        request_hash: requestHash,
        start_fence_token_hash: startFenceTokenHash,
        actor_binding: verifiedActorBinding.actor_binding,
        actor_binding_hash:
          verifiedActorBinding.actor_binding_hash,
        status: "validating",
        validation_calls: Object.freeze([]),
        validation_facts: Object.freeze([]),
        created_at: created.toISOString(),
        updated_at: created.toISOString(),
      });
      startAttempts.set(request.runtime_run_id, attempt);
      startByIdempotency.set(
        request.idempotency_key,
        request.runtime_run_id,
      );
      return Object.freeze({
        outcome: "begun" as const,
        attempt: snapshot(attempt),
      });
    },

    async readStartAttempt(runtimeRunId) {
      const attempt = startAttempts.get(runtimeRunId);
      return attempt === undefined ? undefined : snapshot(attempt);
    },

    async beginStartValidationCall(request) {
      const attempt = startAttempts.get(request.runtime_run_id);
      if (
        attempt === undefined ||
        attempt.request_hash !== request.request_hash ||
        !secureDigestEqualsV1(
          attempt.start_fence_token_hash,
          request.start_fence_token_hash,
        ) ||
        !secureDigestEqualsV1(
          attempt.actor_binding_hash,
          request.actor_binding_hash,
        )
      ) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      const call = snapshot(request.call);
      if (
      Object.keys(call).sort().join(",") !==
          "request_hash,requested_at,trace_id,validation_call_id,validation_stage" ||
        !/^[A-Za-z0-9._:-]{1,256}$/u.test(
          call.validation_call_id,
        ) ||
        !/^sha256:[0-9a-f]{64}$/u.test(call.request_hash) ||
        call.trace_id.length < 1 ||
        call.trace_id.length > 256 ||
        !Number.isFinite(Date.parse(call.requested_at)) ||
        Date.parse(call.requested_at) >
          currentTime().getTime()
      ) {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
        );
      }
      const globallyBoundRun = validationCallOwner.get(
        call.validation_call_id,
      );
      if (
        globallyBoundRun !== undefined &&
        globallyBoundRun !== request.runtime_run_id
      ) {
        throw new RuntimeExecutionErrorV1(
          "idempotency_conflict",
        );
      }
      const existing = attempt.validation_calls.find(
        (candidate) =>
          candidate.validation_call_id ===
          call.validation_call_id,
      );
      if (existing !== undefined) {
        if (
          canonicalJsonV1(existing) !== canonicalJsonV1(call)
        ) {
          throw new RuntimeExecutionErrorV1(
            "idempotency_conflict",
          );
        }
        return Object.freeze({
          outcome: "replayed" as const,
          attempt: snapshot(attempt),
        });
      }
      const successfulStages = new Set(
        attempt.validation_facts
          .filter((fact) => fact.validation_result === "valid")
          .map((fact) => fact.validation_stage),
      );
      const expectedStage =
        !successfulStages.has("request_received")
          ? "request_received"
          : !successfulStages.has("preflight_completed")
            ? "preflight_completed"
            : !successfulStages.has("before_running")
              ? "before_running"
              : undefined;
      const previousCall =
        attempt.validation_calls[
          attempt.validation_calls.length - 1
        ];
      const stageIsAllowed =
        call.validation_stage === "before_running"
          ? attempt.status === "accepted" &&
            successfulStages.has("request_received") &&
            successfulStages.has("preflight_completed")
          : attempt.status === "validating" &&
            call.validation_stage === expectedStage;
      if (
        !stageIsAllowed ||
        (previousCall !== undefined &&
          Date.parse(call.requested_at) <
            Date.parse(previousCall.requested_at))
      ) {
        throw new RuntimeExecutionErrorV1(
          "stale_start_fence",
        );
      }
      const updated: RuntimeStartAttemptV1 = Object.freeze({
        ...attempt,
        validation_calls: Object.freeze([
          ...attempt.validation_calls,
          Object.freeze(call),
        ]),
        updated_at: call.requested_at,
      });
      validationCallOwner.set(
        call.validation_call_id,
        request.runtime_run_id,
      );
      startAttempts.set(request.runtime_run_id, updated);
      return Object.freeze({
        outcome: "prepared" as const,
        attempt: snapshot(updated),
      });
    },

    async appendStartValidation(request) {
      const attempt = startAttempts.get(request.runtime_run_id);
      if (
        attempt === undefined ||
        attempt.request_hash !== request.request_hash ||
        !secureDigestEqualsV1(
          attempt.start_fence_token_hash,
          request.start_fence_token_hash,
        ) ||
        !secureDigestEqualsV1(
          attempt.actor_binding_hash,
          request.actor_binding_hash,
        )
      ) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      const updated = appendValidationFactV1(attempt, request.fact);
      startAttempts.set(request.runtime_run_id, updated);
      return snapshot(updated);
    },

    async terminalizeStartAttempt(request) {
      const attempt = startAttempts.get(request.runtime_run_id);
      if (
        attempt === undefined ||
        attempt.request_hash !== request.request_hash ||
        !secureDigestEqualsV1(
          attempt.actor_binding_hash,
          request.actor_binding_hash,
        )
      ) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      if (attempt.status === "accepted") {
        throw new RuntimeExecutionErrorV1("runtime_terminal");
      }
      if (attempt.status === "terminal") {
        if (attempt.failure_code !== request.failure_code) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        return snapshot(attempt);
      }
      const terminalizedAt = new Date(request.terminalized_at);
      if (
        !Number.isFinite(terminalizedAt.getTime()) ||
        terminalizedAt.getTime() <
          Date.parse(attempt.updated_at) ||
        terminalizedAt.getTime() > currentTime().getTime()
      ) {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
        );
      }
      const terminal: RuntimeStartAttemptV1 = Object.freeze({
        ...attempt,
        status: "terminal",
        failure_code: request.failure_code,
        updated_at: terminalizedAt.toISOString(),
      });
      startAttempts.set(request.runtime_run_id, terminal);
      return snapshot(terminal);
    },

    async acceptStart(
      request,
      requestHash,
      actorBinding,
      actorBindingHash,
      response,
      skillResolutions,
      toolArgConstraints,
      permissions,
      model,
      preflightValidation,
    ) {
      const verifiedActorBinding = snapshotRuntimeActorBindingV1(
        {
          sub: actorBinding.workload_service,
          aud: "action_runtime",
          capability: [],
          ...(actorBinding.delegated_principal === null
            ? {}
            : {
                delegated_principal:
                  actorBinding.delegated_principal,
              }),
          scope: actorBinding.scope,
        },
        request,
      );
      if (
        typeof actorBindingHash !== "string" ||
        !secureDigestEqualsV1(
          verifiedActorBinding.actor_binding_hash,
          actorBindingHash,
        ) ||
        permissions.some(
          (permission) =>
            typeof permission.actor_binding_hash !== "string" ||
            !secureDigestEqualsV1(
              permission.actor_binding_hash,
              actorBindingHash,
            ),
        )
      ) {
        throw new RuntimeExecutionErrorV1(
          "authorization_scope_mismatch",
          "Runtime Start owner write rejected a delegated principal binding drift",
        );
      }
      const idempotencyOwner = startByIdempotency.get(
        request.idempotency_key,
      );
      if (
        idempotencyOwner !== undefined &&
        idempotencyOwner !== request.runtime_run_id
      ) {
        return { outcome: "conflict" as const };
      }
      const startAttempt = startAttempts.get(request.runtime_run_id);
      if (
        startAttempt === undefined ||
        startAttempt.request_hash !== requestHash ||
        startAttempt.idempotency_key !== request.idempotency_key ||
        !secureDigestEqualsV1(
          startAttempt.start_fence_token_hash,
          request.start_fence_token_hash,
        ) ||
        !secureDigestEqualsV1(
          startAttempt.actor_binding_hash,
          actorBindingHash,
        )
      ) {
        return { outcome: "conflict" as const };
      }
      let acceptedAttempt: RuntimeStartAttemptV1;
      try {
        acceptedAttempt = appendValidationFactV1(
          startAttempt,
          preflightValidation,
        );
      } catch {
        return { outcome: "conflict" as const };
      }
      const successfulValidationFacts =
        acceptedAttempt.validation_facts.filter(
          (fact) => fact.validation_result === "valid",
        );
      if (
        !successfulValidationFacts.some(
          (fact) =>
            fact.validation_stage === "request_received",
        ) ||
        !successfulValidationFacts.some(
          (fact) =>
            fact.validation_stage === "preflight_completed",
        ) ||
        successfulValidationFacts.some(
          (fact) => fact.validation_stage === "before_running",
        ) ||
        preflightValidation.response.schema_version !==
          "runtime_start_reservation_validate_response.v1" ||
        preflightValidation.response.validated_fence_generation !==
          response.details.start_fence_generation
      ) {
        return { outcome: "conflict" as const };
      }
      const existing = runs.get(request.runtime_run_id);
      if (existing !== undefined) {
        if (
          existing.request.idempotency_key !== request.idempotency_key ||
          existing.request_hash !== requestHash ||
          !secureDigestEqualsV1(
            existing.actor_binding_hash,
            actorBindingHash,
          )
        ) {
          return { outcome: "conflict" as const };
        }
        startAttempts.set(
          request.runtime_run_id,
          Object.freeze(acceptedAttempt),
        );
        return {
          outcome: "replayed" as const,
          run: snapshot(existing),
        };
      }
      const fencingTombstone = [...controlTombstones.values()].find(
        (candidate) =>
          controlTombstoneMatchesStartV1(
            candidate,
            request,
            currentTime(),
          ),
      );
      if (fencingTombstone !== undefined) {
        startAttempts.set(
          request.runtime_run_id,
          Object.freeze({
            ...acceptedAttempt,
            status: "terminal",
            failure_code:
              fencingTombstone.control_type === "preempt"
                ? "runtime_preempted"
                : "runtime_cancelled",
            updated_at: preflightValidation.validated_at,
          }),
        );
        return {
          outcome: "fenced" as const,
          tombstone: snapshot(fencingTombstone),
        };
      }
      const requestSnapshot = snapshot(request);
      snapshot(toolArgConstraints);
      const responseSnapshot = snapshot(response);
      const run: RuntimeRunRecordV1 = Object.freeze({
        request: requestSnapshot,
        request_hash: requestHash,
        actor_binding: verifiedActorBinding.actor_binding,
        actor_binding_hash:
          verifiedActorBinding.actor_binding_hash,
        response: responseSnapshot,
        status: "queued",
        start_fence_generation:
          response.details.start_fence_generation,
        policy_snapshot_hash: response.details.policy_snapshot_hash,
        model,
        next_sequence_no: 1,
        events: Object.freeze([]),
        outbox: Object.freeze([]),
        tools: Object.freeze([]),
        permissions: Object.freeze(snapshot(permissions)),
        skill_resolutions: Object.freeze(snapshot(skillResolutions)),
        controls: Object.freeze([]),
      });
      runs.set(request.runtime_run_id, run);
      policyInputArtifacts.set(
        `${request.runtime_run_id}\u0000${request.start_attempt_no}`,
        Object.freeze({
          schema_version:
            "runtime_policy_input_read_artifact.v1",
          policy_input_ref: request.policy_input_ref,
          policy_input_hash: request.policy_input_hash,
          trigger_process_id: request.trigger_process_id,
          runtime_run_id: request.runtime_run_id,
          start_attempt_no: request.start_attempt_no,
          workspace_id: request.workspace_id,
          bot_id: request.bot_id,
          owner_agent_id: request.owner_agent_id,
          deployment_environment: request.deployment_environment,
          release_channel: request.release_channel,
          expected_catalog_version:
            request.expected_catalog_version,
          catalog_as_of: request.catalog_as_of,
          intent_policy_snapshot_ref:
            request.intent_policy_snapshot_ref,
          intent_policy_snapshot_hash:
            request.intent_policy_snapshot_hash,
          intent_policy_snapshot: snapshot(
            request.intent_policy_snapshot,
          ),
          skill_permission_summary_ref:
            request.intent_policy_snapshot
              .skill_permission_summary_ref,
          skill_permission_summary_hash:
            request.intent_policy_snapshot
              .skill_permission_summary_hash,
          policy: snapshot(request.policy),
        }),
      );
      startByIdempotency.set(
        request.idempotency_key,
        request.runtime_run_id,
      );
      startAttempts.set(
        request.runtime_run_id,
        Object.freeze({
          ...acceptedAttempt,
          status: "accepted",
          updated_at: preflightValidation.validated_at,
        }),
      );
      return { outcome: "accepted" as const, run: snapshot(run) };
    },

    async readRun(runtimeRunId) {
      const run = runs.get(runtimeRunId);
      return run === undefined ? undefined : snapshot(run);
    },

    async readPolicyInputArtifact(
      runtimeRunId,
      startAttemptNo,
    ) {
      const artifact = policyInputArtifacts.get(
        `${runtimeRunId}\u0000${startAttemptNo}`,
      );
      return artifact === undefined
        ? undefined
        : snapshot(artifact);
    },

    async readPolicyInputArtifactByReference(policyInputRef) {
      const artifact = [...policyInputArtifacts.values()].find(
        (candidate) => candidate.policy_input_ref === policyInputRef,
      );
      return artifact === undefined
        ? undefined
        : snapshot(artifact);
    },

    async claimQueuedRun(request) {
      assertPositiveSafeInteger(request.lease_seconds, "lease_seconds");
      if (
        request.before_running_validation === undefined &&
        request.internal_safety === undefined
      ) {
        throw new RuntimeExecutionErrorV1(
          "reservation_invalid",
          "A normal queued claim requires its atomic before_running validation fact",
        );
      }
      let validatedAttempt: RuntimeStartAttemptV1 | undefined;
      if (request.before_running_validation !== undefined) {
        const attempt = startAttempts.get(request.runtime_run_id);
        if (attempt === undefined) {
          throw new RuntimeExecutionErrorV1(
            "reservation_invalid",
          );
        }
        validatedAttempt = appendValidationFactV1(
          attempt,
          request.before_running_validation,
        );
        const successfulValidationFacts =
          validatedAttempt.validation_facts.filter(
            (fact) => fact.validation_result === "valid",
          );
        if (
          ![
            "request_received",
            "preflight_completed",
            "before_running",
          ].every((stage) =>
            successfulValidationFacts.some(
              (fact) => fact.validation_stage === stage,
            ),
          ) ||
          request.before_running_validation.response
            .schema_version !==
            "runtime_start_reservation_validate_response.v1" ||
          request.before_running_validation.response
            .validated_fence_generation !==
            request.expected_start_fence_generation
        ) {
          throw new RuntimeExecutionErrorV1(
            "stale_start_fence",
          );
        }
      }
      const claimed = replace(request.runtime_run_id, (run) => {
          if (
            run.start_fence_generation !==
              request.expected_start_fence_generation
          ) {
            throw new RuntimeExecutionErrorV1("stale_start_fence");
          }
          const mayClaimQueued = run.status === "queued";
          const mayReclaimExpired =
            isRuntimeLeaseActiveStatusV1(run.status) &&
            run.lease !== undefined &&
            Date.parse(run.lease.expires_at) <= request.now.getTime();
          if (request.internal_safety !== undefined) {
            const safety = request.internal_safety;
            if (
              !Number.isSafeInteger(
                safety.current_security_revocation_epoch,
              ) ||
              safety.current_security_revocation_epoch < 0 ||
              safety.checked_at !== request.now.toISOString() ||
              (safety.reason_code === "runtime_policy_expired"
                ? request.now.getTime() <
                  Date.parse(run.request.policy.expires_at)
                : safety.current_security_revocation_epoch <=
                  run.request.intent_policy_snapshot
                    .security_revocation_epoch)
            ) {
              throw new RuntimeExecutionErrorV1(
                "policy_checkpoint_unavailable",
              );
            }
          }
          if (!mayClaimQueued && !mayReclaimExpired) {
            throw new RuntimeExecutionErrorV1(
              "stale_lease_generation",
            );
          }
          if (
            mayReclaimExpired &&
            [...artifacts.values()].some(
              (artifact) =>
                artifact.runtime_run_id ===
                  request.runtime_run_id &&
                artifact.status === "creating",
            )
          ) {
            return {
              ...run,
              lease: Object.freeze({
                ...run.lease!,
                recovery_state: "takeover_pending" as const,
              }),
            };
          }
          const nextGeneration = incrementSafeIntegerV1(
            run.lease?.generation ?? 0,
            "lease_generation",
          );
          const lease: RuntimeLeaseV1 = Object.freeze({
            runtime_run_id: request.runtime_run_id,
            owner_id: request.worker_id,
            generation: nextGeneration,
            expires_at: addMilliseconds(
              request.now,
              request.lease_seconds * 1_000,
            ),
            heartbeat_at: request.now.toISOString(),
            recovery_state: "active",
          });
          return {
            ...run,
            status:
              request.internal_safety !== undefined
                ? ("cancelling" as const)
                : mayClaimQueued
                  ? ("running" as const)
                  : run.status,
            lease,
          };
        });
      if (validatedAttempt !== undefined) {
        startAttempts.set(
          request.runtime_run_id,
          validatedAttempt,
        );
      }
      return snapshot(claimed);
    },

    async heartbeat(request) {
      assertPositiveSafeInteger(request.lease_seconds, "lease_seconds");
      const run = replace(request.runtime_run_id, (current) => {
        if (!isRuntimeLeaseActiveStatusV1(current.status)) {
          throw new RuntimeExecutionErrorV1("stale_lease_generation");
        }
        const lease = activeLease(
          current,
          request.lease_generation,
          request.now,
        );
        if (lease.owner_id !== request.worker_id) {
          throw new RuntimeExecutionErrorV1("stale_lease_generation");
        }
        return {
          ...current,
          lease: Object.freeze({
            ...lease,
            heartbeat_at: request.now.toISOString(),
            recovery_state: "active",
            expires_at: addMilliseconds(
              request.now,
              request.lease_seconds * 1_000,
            ),
          }),
        };
      });
      return snapshot(run.lease!);
    },

    async appendEvent(request) {
      return snapshot(
        replace(request.runtime_run_id, (run) => {
          activeLease(run, request.lease_generation);
          if (
            run.events.some(
              ({ event_id }) => event_id === request.event.event_id,
            )
          ) {
            const existing = run.events.find(
              ({ event_id }) => event_id === request.event.event_id,
            );
            if (
              existing === undefined ||
              canonicalJsonV1(existing) !== canonicalJsonV1(request.event)
            ) {
              throw new RuntimeExecutionErrorV1("idempotency_conflict");
            }
            return run;
          }
          if (
            run.status === "completed" ||
            run.status === "failed" ||
            run.status === "cancelled"
          ) {
            throw new RuntimeExecutionErrorV1("stale_lease_generation");
          }
          if (
            run.events.some(
              ({ idempotency_key }) =>
                idempotency_key === request.event.idempotency_key,
            ) ||
            request.event.payload.sequence_no !== run.next_sequence_no
          ) {
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
            );
          }
          const event = snapshot(request.event);
          const outboxId = `runtime_outbox:${event.event_id}`;
          outboxOwner.set(outboxId, request.runtime_run_id);
          return {
            ...run,
            ...(request.next_status === undefined
              ? {}
              : { status: request.next_status }),
            ...(request.terminal_reason === undefined
              ? {}
              : { terminal_reason: request.terminal_reason }),
            next_sequence_no: incrementSafeIntegerV1(
              run.next_sequence_no,
              "runtime_sequence_no",
            ),
            events: Object.freeze([...run.events, event]),
            outbox: Object.freeze([
              ...run.outbox,
              Object.freeze({
                id: outboxId,
                event,
                status: "pending" as const,
                attempt_count: 0,
              }),
            ]),
          };
        }),
      );
    },

    async reserveArtifact(request) {
      const run = runs.get(request.runtime_run_id);
      if (run === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      activeLease(run, request.lease_generation);
      if (
        run.start_fence_generation !==
          request.expected_start_fence_generation ||
        !isRuntimeLeaseActiveStatusV1(run.status) ||
        sha256BytesV1(request.artifact.body) !==
          request.artifact.expected_sha256
      ) {
        throw new RuntimeExecutionErrorV1(
          "stale_lease_generation",
        );
      }
      const key = artifactKeyV1(
        request.runtime_run_id,
        request.artifact.artifact_id,
      );
      const existing = artifacts.get(key);
      if (existing !== undefined) {
        if (
          existing.request_hash !== request.request_hash ||
          existing.start_fence_generation !==
            request.expected_start_fence_generation ||
          existing.originating_lease_generation !==
            request.lease_generation ||
          existing.object_store_idempotency_key !==
            request.object_store_idempotency_key ||
          existing.artifact_kind !== request.artifact.artifact_kind ||
          existing.media_type !== request.artifact.media_type ||
          existing.content_hash !==
            request.artifact.expected_sha256 ||
          existing.size_bytes !== request.artifact.body.byteLength ||
          existing.retention_until !==
            request.artifact.retention_until
        ) {
          throw new RuntimeExecutionErrorV1(
            "idempotency_conflict",
          );
        }
        return Object.freeze({
          artifact: snapshot(existing),
          replayed: true,
        });
      }
      const createdAt = new Date(request.created_at);
      if (
        !Number.isFinite(createdAt.getTime()) ||
        createdAt.getTime() > currentTime().getTime()
      ) {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
        );
      }
      const artifact: RuntimeArtifactRecordV1 = Object.freeze({
        artifact_id: request.artifact.artifact_id,
        runtime_run_id: request.runtime_run_id,
        start_fence_generation:
          request.expected_start_fence_generation,
        originating_lease_generation: request.lease_generation,
        artifact_kind: request.artifact.artifact_kind,
        media_type: request.artifact.media_type,
        content_hash: request.artifact.expected_sha256,
        size_bytes: request.artifact.body.byteLength,
        retention_until: request.artifact.retention_until,
        object_store_idempotency_key:
          request.object_store_idempotency_key,
        request_hash: request.request_hash,
        status: "creating",
        reconciliation_generation: 0,
        created_at: createdAt.toISOString(),
        updated_at: createdAt.toISOString(),
      });
      artifacts.set(key, artifact);
      return Object.freeze({
        artifact: snapshot(artifact),
        replayed: false,
      });
    },

    async finalizeArtifact(request) {
      return snapshot(
        replace(request.runtime_run_id, (run) => {
          const key = artifactKeyV1(
            request.runtime_run_id,
            request.artifact_id,
          );
          const artifact = artifacts.get(key);
          if (
            artifact === undefined ||
            artifact.request_hash !== request.request_hash ||
            artifact.start_fence_generation !==
              request.expected_start_fence_generation
          ) {
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
            );
          }
          const existingEvent = run.events.find(
            ({ event_id }) => event_id === request.event.event_id,
          );
          if (artifact.status !== request.expected_status) {
            if (
              artifact.status === request.terminal_status &&
              existingEvent !== undefined &&
              canonicalJsonV1(existingEvent) ===
                canonicalJsonV1(request.event) &&
              (request.terminal_status !== "available" ||
                artifact.artifact_ref === request.artifact_ref) &&
              (request.terminal_status !== "failed" ||
                artifact.failure_code === request.failure_code)
            ) {
              return run;
            }
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
            );
          }
          if (request.lease_generation !== undefined) {
            activeLease(run, request.lease_generation);
          } else {
            if (
              request.reconciliation_owner === undefined ||
              request.reconciliation_generation === undefined ||
              artifact.reconciliation_owner !==
                request.reconciliation_owner ||
              artifact.reconciliation_generation !==
                request.reconciliation_generation ||
              artifact.reconciliation_expires_at === undefined ||
              Date.parse(artifact.reconciliation_expires_at) <=
                currentTime().getTime()
            ) {
              throw new RuntimeExecutionErrorV1(
                "stale_lease_generation",
              );
            }
          }
          if (
            run.start_fence_generation !==
              request.expected_start_fence_generation ||
            !isRuntimeLeaseActiveStatusV1(run.status) ||
            existingEvent !== undefined ||
            run.events.some(
              ({ idempotency_key }) =>
                idempotency_key === request.event.idempotency_key,
            ) ||
            request.event.payload.sequence_no !== run.next_sequence_no ||
            (request.terminal_status === "available"
              ? request.artifact_ref === undefined ||
                request.artifact_ref.length === 0 ||
                request.failure_code !== undefined
              : request.artifact_ref !== undefined ||
                request.failure_code === undefined ||
                request.failure_code.length === 0)
          ) {
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
            );
          }
          const finalizedAt = new Date(request.finalized_at);
          if (
            !Number.isFinite(finalizedAt.getTime()) ||
            finalizedAt.getTime() < Date.parse(artifact.created_at) ||
            finalizedAt.getTime() > currentTime().getTime()
          ) {
            throw new RuntimeExecutionErrorV1(
              "schema_validation_failed",
            );
          }
          const event = snapshot(request.event);
          const outboxId = `runtime_outbox:${event.event_id}`;
          const {
            reconciliation_owner: _reconciliationOwner,
            reconciliation_expires_at: _reconciliationExpiresAt,
            ...unclaimedArtifact
          } = artifact;
          const finalized: RuntimeArtifactRecordV1 = Object.freeze({
            ...unclaimedArtifact,
            status: request.terminal_status,
            ...(request.artifact_ref === undefined
              ? {}
              : { artifact_ref: request.artifact_ref }),
            ...(request.failure_code === undefined
              ? {}
              : { failure_code: request.failure_code }),
            updated_at: finalizedAt.toISOString(),
          });
          artifacts.set(key, finalized);
          outboxOwner.set(outboxId, request.runtime_run_id);
          return {
            ...run,
            next_sequence_no: incrementSafeIntegerV1(
              run.next_sequence_no,
              "runtime_sequence_no",
            ),
            events: Object.freeze([...run.events, event]),
            outbox: Object.freeze([
              ...run.outbox,
              Object.freeze({
                id: outboxId,
                event,
                status: "pending" as const,
                attempt_count: 0,
              }),
            ]),
          };
        }),
      );
    },

    async claimPendingArtifacts(request) {
      assertPositiveSafeInteger(request.limit, "limit");
      assertPositiveSafeInteger(
        request.lease_seconds,
        "lease_seconds",
      );
      const claimNow = new Date(request.now);
      if (
        !Number.isFinite(claimNow.getTime()) ||
        claimNow.getTime() > currentTime().getTime()
      ) {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
          "Artifact reconciliation claim timestamp is invalid",
        );
      }
      const claimed: RuntimeArtifactRecordV1[] = [];
      for (const [key, artifact] of artifacts) {
        if (claimed.length >= request.limit) break;
        const run = runs.get(artifact.runtime_run_id);
        const originatingLeaseStillActive =
          run?.lease !== undefined &&
          run.lease.generation ===
            artifact.originating_lease_generation &&
          run.lease.recovery_state === "active" &&
          Date.parse(run.lease.expires_at) >
            claimNow.getTime();
        if (
          artifact.status !== "creating" ||
          run === undefined ||
          originatingLeaseStillActive ||
          (artifact.reconciliation_expires_at !== undefined &&
            Date.parse(artifact.reconciliation_expires_at) >
              claimNow.getTime())
        ) {
          continue;
        }
        const next: RuntimeArtifactRecordV1 = Object.freeze({
          ...artifact,
          reconciliation_generation:
            incrementSafeIntegerV1(
              artifact.reconciliation_generation,
              "artifact_reconciliation_generation",
            ),
          reconciliation_owner: request.worker_id,
          reconciliation_expires_at: addMilliseconds(
            claimNow,
            request.lease_seconds * 1_000,
          ),
          updated_at: claimNow.toISOString(),
        });
        artifacts.set(key, next);
        claimed.push(snapshot(next));
      }
      return Object.freeze(claimed);
    },

    async readArtifact(runtimeRunId, artifactId) {
      const artifact = artifacts.get(
        artifactKeyV1(runtimeRunId, artifactId),
      );
      return artifact === undefined
        ? undefined
        : snapshot(artifact);
    },

    async readArtifactByReference(runtimeRunId, artifactRef) {
      for (const artifact of artifacts.values()) {
        if (
          artifact.runtime_run_id === runtimeRunId &&
          artifact.artifact_ref === artifactRef
        ) {
          return snapshot(artifact);
        }
      }
      return undefined;
    },

    async recordToolRequested(request) {
      return snapshot(replace(request.runtime_run_id, (run) => {
        activeLease(run, request.lease_generation);
        const actorBinding =
          runtimeActorBindingForRunV1(run);
        const permission = run.permissions.find(
          (candidate) =>
            candidate.id === request.audit.capability_token_id &&
            candidate.actor_binding_hash ===
              actorBinding.actor_binding_hash,
        );
        if (
          request.audit.actor_binding_hash !==
            actorBinding.actor_binding_hash ||
          permission === undefined
        ) {
          throw new RuntimeExecutionErrorV1(
            "authorization_scope_mismatch",
            "Tool audit does not match the frozen Runtime actor permission",
          );
        }
        const existing = run.tools.find(
          ({ tool_invocation_id }) =>
            tool_invocation_id === request.audit.tool_invocation_id,
        );
        if (existing !== undefined) {
          if (
            existing.tool_name !== request.audit.tool_name ||
            existing.lease_generation !==
              request.audit.lease_generation ||
            existing.request_hash !== request.audit.request_hash ||
            existing.normalized_args_hash !==
              request.audit.normalized_args_hash ||
            existing.actor_binding_hash !==
              request.audit.actor_binding_hash ||
            existing.capability_token_id !==
              request.audit.capability_token_id ||
            existing.input_ref !== request.audit.input_ref ||
            existing.downstream_idempotency_key !==
              request.audit.downstream_idempotency_key
          ) {
            throw new RuntimeExecutionErrorV1("idempotency_conflict");
          }
          const existingEvent = run.events.find(
            ({ event_id }) => event_id === request.event.event_id,
          );
          if (
            existingEvent === undefined ||
            canonicalJsonV1(existingEvent) !== canonicalJsonV1(request.event)
          ) {
            throw new RuntimeExecutionErrorV1("idempotency_conflict");
          }
          return run;
        }
        if (
          request.event.payload.sequence_no !== run.next_sequence_no ||
          run.events.some(
            ({ event_id, idempotency_key }) =>
              event_id === request.event.event_id ||
              idempotency_key === request.event.idempotency_key,
          )
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        const event = snapshot(request.event);
        const outboxId = `runtime_outbox:${event.event_id}`;
        outboxOwner.set(outboxId, request.runtime_run_id);
        return {
          ...run,
          tools: Object.freeze([...run.tools, snapshot(request.audit)]),
          next_sequence_no: incrementSafeIntegerV1(
            run.next_sequence_no,
            "runtime_sequence_no",
          ),
          events: Object.freeze([...run.events, event]),
          outbox: Object.freeze([
            ...run.outbox,
            Object.freeze({
              id: outboxId,
              event,
              status: "pending" as const,
              attempt_count: 0,
            }),
          ]),
        };
      }));
    },

    async markToolRunning(request) {
      replace(request.runtime_run_id, (run) => {
        activeLease(run, request.lease_generation);
        const index = run.tools.findIndex(
          ({ tool_invocation_id }) =>
            tool_invocation_id === request.tool_invocation_id,
        );
        if (index < 0) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        const tools = [...run.tools];
        const previous = tools[index]!;
        if (previous.status === "running") return run;
        if (
          previous.status !== "requested" ||
          previous.result !== undefined ||
          previous.side_effect_status !== "none" ||
          previous.lease_generation !== request.lease_generation
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        tools[index] = Object.freeze({
          ...previous,
          status: "running" as const,
        });
        return { ...run, tools: Object.freeze(tools) };
      });
    },

    async recordToolResult(request) {
      return snapshot(replace(request.runtime_run_id, (run) => {
        activeLease(run, request.lease_generation);
        const index = run.tools.findIndex(
          ({ tool_invocation_id }) =>
            tool_invocation_id === request.tool_invocation_id,
        );
        if (index < 0) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        const tools = [...run.tools];
        const previous = tools[index]!;
        if (previous.result !== undefined) {
          if (
            canonicalJsonV1(previous.result) !==
              canonicalJsonV1(request.result) ||
            previous.output_ref !== request.output_ref
          ) {
            throw new RuntimeExecutionErrorV1("idempotency_conflict");
          }
          const existingEvent = run.events.find(
            ({ event_id }) => event_id === request.event.event_id,
          );
          if (
            existingEvent === undefined ||
            canonicalJsonV1(existingEvent) !== canonicalJsonV1(request.event)
          ) {
            throw new RuntimeExecutionErrorV1("idempotency_conflict");
          }
          return run;
        }
        if (
          previous.status !== "running" ||
          previous.lease_generation !== request.lease_generation
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        if (
          request.event.payload.sequence_no !== run.next_sequence_no ||
          run.events.some(
            ({ event_id, idempotency_key }) =>
              event_id === request.event.event_id ||
              idempotency_key === request.event.idempotency_key,
          )
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        tools[index] = Object.freeze({
          ...previous,
          result: snapshot(request.result),
          output_ref: request.output_ref,
          status:
            request.result.side_effect_status === "unknown"
              ? "failed"
              : request.result.outcome,
          side_effect_status: request.result.side_effect_status,
        });
        const event = snapshot(request.event);
        const outboxId = `runtime_outbox:${event.event_id}`;
        outboxOwner.set(outboxId, request.runtime_run_id);
        return {
          ...run,
          tools: Object.freeze(tools),
          next_sequence_no: incrementSafeIntegerV1(
            run.next_sequence_no,
            "runtime_sequence_no",
          ),
          events: Object.freeze([...run.events, event]),
          outbox: Object.freeze([
            ...run.outbox,
            Object.freeze({
              id: outboxId,
              event,
              status: "pending" as const,
              attempt_count: 0,
            }),
          ]),
        };
      }));
    },

    async freezeUnknownSideEffect(request) {
      return snapshot(replace(request.runtime_run_id, (run) => {
        const existingToolEvent = run.events.find(
          ({ event_id }) => event_id === request.event.event_id,
        );
        const existingTerminalEvent = run.events.find(
          ({ event_id }) =>
            event_id === request.terminal_event.event_id,
        );
        if (
          existingToolEvent !== undefined ||
          existingTerminalEvent !== undefined
        ) {
          if (
            run.frozen_side_effect === true &&
            existingToolEvent !== undefined &&
            existingTerminalEvent !== undefined &&
            run.tools.some(
              (audit) =>
                audit.tool_invocation_id ===
                  request.tool_invocation_id &&
                audit.result !== undefined &&
                canonicalJsonV1(audit.result) ===
                  canonicalJsonV1(request.result) &&
                audit.output_ref === request.output_ref,
            ) &&
            canonicalJsonV1(existingToolEvent) ===
              canonicalJsonV1(request.event) &&
            canonicalJsonV1(existingTerminalEvent) ===
              canonicalJsonV1(request.terminal_event)
          ) {
            return run;
          }
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        if (
          run.events.some(
            ({ idempotency_key }) =>
              idempotency_key === request.event.idempotency_key ||
              idempotency_key ===
                request.terminal_event.idempotency_key,
          ) ||
          request.event.payload.sequence_no !== run.next_sequence_no ||
          request.terminal_event.payload.sequence_no !==
            incrementSafeIntegerV1(
              run.next_sequence_no,
              "runtime_sequence_no",
            )
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        activeLease(run, request.lease_generation);
        const audit = run.tools.find(
          ({ tool_invocation_id }) =>
            tool_invocation_id === request.tool_invocation_id,
        );
        if (audit === undefined) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        assertToolResult(request.result);
        if (
          request.result.side_effect_status !== "unknown" ||
          request.result.retryable ||
          (audit.result !== undefined &&
            canonicalJsonV1(audit.result) !==
              canonicalJsonV1(request.result)) ||
          (audit.result === undefined &&
            audit.status !== "running") ||
          (audit.result !== undefined &&
            audit.side_effect_status !== "unknown")
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        const tools = run.tools.map((entry) =>
          entry.tool_invocation_id === request.tool_invocation_id
            ? Object.freeze({
                ...entry,
                status: "failed" as const,
                side_effect_status: "unknown" as const,
                output_ref: request.output_ref,
                result: snapshot(request.result),
              })
            : entry,
        );
        const events = [
          snapshot(request.event),
          snapshot(request.terminal_event),
        ];
        const outboxRecords = events.map((event) => {
          const id = `runtime_outbox:${event.event_id}`;
          outboxOwner.set(id, request.runtime_run_id);
          return Object.freeze({
            id,
            event,
            status: "pending" as const,
            attempt_count: 0,
          });
        });
        return {
          ...run,
          status: "failed",
          terminal_reason: "tool_side_effect_unknown",
          frozen_side_effect: true,
          tools: Object.freeze(tools),
          next_sequence_no: incrementSafeIntegerV1(
            run.next_sequence_no,
            "runtime_sequence_no",
            2,
          ),
          events: Object.freeze([...run.events, ...events]),
          outbox: Object.freeze([...run.outbox, ...outboxRecords]),
        };
      }));
    },

    async cancelUndispatchedTool(request) {
      return snapshot(replace(request.runtime_run_id, (run) => {
        activeLease(run, request.lease_generation);
        const index = run.tools.findIndex(
          ({ tool_invocation_id }) =>
            tool_invocation_id === request.tool_invocation_id,
        );
        if (index < 0) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        const existingEvent = run.events.find(
          ({ event_id }) => event_id === request.event.event_id,
        );
        const previous = run.tools[index]!;
        if (existingEvent !== undefined) {
          if (
            previous.status === "cancelled" &&
            canonicalJsonV1(existingEvent) ===
              canonicalJsonV1(request.event)
          ) {
            return run;
          }
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        if (
          run.events.some(
            ({ idempotency_key }) =>
              idempotency_key === request.event.idempotency_key,
          ) ||
          previous.status !== "requested" ||
          previous.result !== undefined ||
          previous.side_effect_status !== "none" ||
          previous.lease_generation >= request.lease_generation ||
          request.event.event_type !== "runtime.tool.cancelled" ||
          request.event.payload.sequence_no !== run.next_sequence_no
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        const tools = [...run.tools];
        tools[index] = Object.freeze({
          ...previous,
          status: "cancelled" as const,
        });
        const event = snapshot(request.event);
        const outboxId = `runtime_outbox:${event.event_id}`;
        outboxOwner.set(outboxId, request.runtime_run_id);
        return {
          ...run,
          tools: Object.freeze(tools),
          next_sequence_no: incrementSafeIntegerV1(
            run.next_sequence_no,
            "runtime_sequence_no",
          ),
          events: Object.freeze([...run.events, event]),
          outbox: Object.freeze([
            ...run.outbox,
            Object.freeze({
              id: outboxId,
              event,
              status: "pending" as const,
              attempt_count: 0,
            }),
          ]),
        };
      }));
    },

    async reconcileUnknownTool(request) {
      let replayed = false;
      let reconciledAudit: RuntimeToolAuditV1 | undefined;
      replace(
        request.reconciliation.runtime_run_id,
        (run) => {
          const index = run.tools.findIndex(
            ({ tool_invocation_id }) =>
              tool_invocation_id ===
              request.reconciliation.tool_invocation_id,
          );
          if (index < 0) {
            throw new RuntimeExecutionErrorV1("runtime_not_found");
          }
          const previous = run.tools[index]!;
          if (
            previous.reconciliation_idempotency_key !== undefined
          ) {
            if (
              previous.reconciliation_idempotency_key ===
                request.reconciliation.idempotency_key &&
              previous.reconciliation_request_hash ===
                request.reconciliation_request_hash
            ) {
              replayed = true;
              reconciledAudit = previous;
              return run;
            }
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
            );
          }
          if (
            run.status !== "failed" ||
            run.frozen_side_effect !== true ||
            run.terminal_reason !== "tool_side_effect_unknown" ||
            run.start_fence_generation !==
              request.reconciliation
                .expected_start_fence_generation ||
            previous.lease_generation !==
              request.reconciliation
                .expected_invocation_lease_generation ||
            previous.request_hash !==
              request.reconciliation.expected_request_hash ||
            previous.downstream_idempotency_key !==
              request.reconciliation
                .expected_downstream_idempotency_key ||
            previous.side_effect_status !== "unknown" ||
            previous.result?.side_effect_status !== "unknown" ||
            request.reconciliation.result.side_effect_status ===
              "unknown" ||
            request.reconciliation.result.retryable
          ) {
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
            );
          }
          const tools = [...run.tools];
          const next = Object.freeze({
            ...previous,
            status: request.reconciliation.result.outcome,
            side_effect_status:
              request.reconciliation.result.side_effect_status,
            result: snapshot(request.reconciliation.result),
            reconciled_at: request.reconciled_at,
            reconciliation_evidence_ref:
              request.reconciliation.evidence_ref,
            reconciliation_idempotency_key:
              request.reconciliation.idempotency_key,
            reconciliation_request_hash:
              request.reconciliation_request_hash,
          });
          tools[index] = next;
          reconciledAudit = next;
          return {
            ...run,
            frozen_side_effect: false,
            tools: Object.freeze(tools),
          };
        },
      );
      if (reconciledAudit === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      return Object.freeze({
        audit: snapshot(reconciledAudit),
        replayed,
      });
    },

    async receiveControl(request, requestHash, type, verification) {
      return attachControl(request, requestHash, type, verification);
    },

    async receiveInternalControl(request) {
      assertPositiveSafeInteger(
        request.expected_start_fence_generation,
        "expected_start_fence_generation",
      );
      assertPositiveSafeInteger(
        request.expected_lease_generation,
        "expected_lease_generation",
      );
      if (
        !Number.isSafeInteger(
          request.current_security_revocation_epoch,
        ) ||
        request.current_security_revocation_epoch < 0 ||
        !Number.isFinite(Date.parse(request.requested_at))
      ) {
        throw new RuntimeExecutionErrorV1(
          "schema_validation_failed",
        );
      }
      let result: RuntimeControlRecordV1 | undefined;
      let replayed = false;
      const updated = replace(request.runtime_run_id, (run) => {
        const lease = activeLease(
          run,
          request.expected_lease_generation,
        );
        if (
          run.start_fence_generation !==
            request.expected_start_fence_generation ||
          lease.recovery_state !== "active" ||
          (request.reason_code === "runtime_policy_expired"
            ? Date.parse(request.requested_at) <
              Date.parse(run.request.policy.expires_at)
            : request.current_security_revocation_epoch <=
              run.request.intent_policy_snapshot
                .security_revocation_epoch)
        ) {
          throw new RuntimeExecutionErrorV1(
            "stale_lease_generation",
          );
        }
        const suffix =
          request.reason_code ===
          "security_revocation_epoch_advanced"
            ? `:${request.current_security_revocation_epoch}`
            : "";
        const runtimeSignalId =
          `${run.request.runtime_run_id}:internal:${request.reason_code}${suffix}`;
        const idempotencyKey =
          `${run.request.runtime_run_id}:control:${request.reason_code}${suffix}`;
        const requestHash = canonicalPayloadHashV1({
          schema_version: "runtime_internal_control.v1",
          runtime_run_id: run.request.runtime_run_id,
          trigger_process_id: run.request.trigger_process_id,
          start_attempt_no: run.request.start_attempt_no,
          start_fence_generation: run.start_fence_generation,
          target_lease_generation: lease.generation,
          reason_code: request.reason_code,
          current_security_revocation_epoch:
            request.current_security_revocation_epoch,
          idempotency_key: idempotencyKey,
        });
        const existing = run.controls.find(
          ({ request: candidate }) =>
            candidate.runtime_signal_id === runtimeSignalId,
        );
        if (existing !== undefined) {
          if (
            existing.request_hash !== requestHash ||
            existing.requested_by !== "action_runtime" ||
            existing.control_type !== "cancel"
          ) {
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
            );
          }
          result = existing;
          replayed = true;
          return run;
        }
        if (
          run.status === "completed" ||
          run.status === "failed" ||
          run.status === "cancelled"
        ) {
          throw new RuntimeExecutionErrorV1("runtime_terminal");
        }
        const storedRequest: RuntimeStoredControlRequestV1 =
          Object.freeze({
            schema_version: "runtime_cancel.v1",
            runtime_signal_id: runtimeSignalId,
            runtime_run_id: run.request.runtime_run_id,
            trigger_process_id: run.request.trigger_process_id,
            start_attempt_no: run.request.start_attempt_no,
            preempt_token_hash: run.request.preempt_token_hash,
            reason_code: request.reason_code,
            requested_at: request.requested_at,
            idempotency_key: idempotencyKey,
            trace_id: request.trace_id,
          });
        const control: RuntimeControlRecordV1 = Object.freeze({
          request: storedRequest,
          control_type: "cancel",
          requested_by: "action_runtime",
          control_valid_until: addMilliseconds(
            new Date(request.requested_at),
            15 * 60 * 1_000,
          ),
          target_lease_generation: lease.generation,
          request_hash: requestHash,
          status: "received",
        });
        result = control;
        controlById.set(runtimeSignalId, run.request.runtime_run_id);
        controlByIdempotency.set(idempotencyKey, runtimeSignalId);
        return {
          ...run,
          status: "cancelling",
          controls: Object.freeze([...run.controls, control]),
        };
      });
      return Object.freeze({
        control: snapshot(result!),
        run: snapshot(updated),
        replayed,
      });
    },

    async receiveControlTombstone(
      principal,
      request,
      requestHash,
      type,
      verification,
    ) {
      const globalOwner = controlById.get(request.runtime_signal_id);
      const idempotencyOwner = controlByIdempotency.get(
        request.idempotency_key,
      );
      if (
        globalOwner !== undefined &&
        globalOwner !== request.runtime_run_id
      ) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      if (
        idempotencyOwner !== undefined &&
        idempotencyOwner !== request.runtime_signal_id
      ) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      const existingRun = runs.get(request.runtime_run_id);
      if (existingRun !== undefined) {
        const attached = attachControl(
          request,
          requestHash,
          type,
          verification,
          principal.scope,
        );
        return {
          outcome: "attached" as const,
          ...attached,
        };
      }
      const existing = controlTombstones.get(
        request.runtime_signal_id,
      );
      if (existing !== undefined) {
        if (
          existing.request_hash !== requestHash ||
          canonicalJsonV1(existing.scope) !==
            canonicalJsonV1(principal.scope) ||
          existing.start_fence_generation !==
            verification.start_fence_generation ||
          existing.control_valid_until !==
            verification.control_valid_until ||
          !secureDigestEqualsV1(
            existing.request.preempt_token_hash,
            request.preempt_token_hash,
          )
        ) {
          throw new RuntimeExecutionErrorV1(
            "idempotency_conflict",
          );
        }
        return {
          outcome: "tombstoned" as const,
          tombstone: snapshot(existing),
          replayed: true,
        };
      }
      const tombstone: RuntimeControlTombstoneV1 = Object.freeze({
        request: snapshot(request),
        control_type: type,
        request_hash: requestHash,
        scope: snapshot(principal.scope),
        start_fence_generation: verification.start_fence_generation,
        control_valid_until: verification.control_valid_until,
        events: Object.freeze(
          controlTombstoneEventsV1(
            principal,
            request,
            type,
            verification,
            currentTime().toISOString(),
          ).map((event) => {
            if (!Value.Check(RuntimeDomainEventV1Schema, event)) {
              throw new RuntimeExecutionErrorV1(
                "schema_validation_failed",
                "Control tombstone produced an invalid Runtime event",
              );
            }
            assertRuntimeDomainEventSemanticBindingsV1(event);
            return snapshot(event);
          }),
        ),
        outbox: Object.freeze([]),
      });
      const tombstoneWithOutbox: RuntimeControlTombstoneV1 =
        Object.freeze({
          ...tombstone,
          outbox: Object.freeze(
            tombstone.events.map((event) => {
              const id = `runtime_outbox:${event.event_id}`;
              outboxOwner.set(id, `tombstone:${request.runtime_signal_id}`);
              return Object.freeze({
                id,
                event,
                status: "pending" as const,
                attempt_count: 0,
              });
            }),
          ),
        });
      controlTombstones.set(
        request.runtime_signal_id,
        tombstoneWithOutbox,
      );
      controlById.set(
        request.runtime_signal_id,
        request.runtime_run_id,
      );
      controlByIdempotency.set(
        request.idempotency_key,
        request.runtime_signal_id,
      );
      return {
        outcome: "tombstoned" as const,
        tombstone: snapshot(tombstoneWithOutbox),
        replayed: false,
      };
    },

    async findControlTombstone(request) {
      const tombstone = [...controlTombstones.values()].find(
        (candidate) =>
          controlTombstoneMatchesStartV1(
            candidate,
            request,
            currentTime(),
          ),
      );
      return tombstone === undefined
        ? undefined
        : snapshot(tombstone);
    },

    async pendingControl(runtimeRunId, leaseGeneration) {
      const run = runs.get(runtimeRunId);
      if (run === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      activeLease(run, leaseGeneration);
      const control = run.controls.find(
        ({ status }) => status === "received",
      );
      return control === undefined ? undefined : snapshot(control);
    },

    async handleControl(request) {
      return snapshot(
        replace(request.runtime_run_id, (run) => {
          const index = run.controls.findIndex(
            ({ request: candidate }) =>
              candidate.runtime_signal_id === request.runtime_signal_id,
          );
          if (index < 0) {
            throw new RuntimeExecutionErrorV1("idempotency_conflict");
          }
          const controls = [...run.controls];
          const current = controls[index]!;
          if (current.status === "handled") {
            const handledEvent = run.events.find(
              ({ event_id }) =>
                event_id === request.handled_event.event_id,
            );
            const terminalEvent = run.events.find(
              ({ event_id }) =>
                event_id === request.terminal_event.event_id,
            );
            if (
              run.status === "cancelled" &&
              handledEvent !== undefined &&
              terminalEvent !== undefined &&
              canonicalJsonV1(handledEvent) ===
                canonicalJsonV1(request.handled_event) &&
              canonicalJsonV1(terminalEvent) ===
                canonicalJsonV1(request.terminal_event)
            ) {
              return run;
            }
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
            );
          }
          activeLease(run, request.lease_generation);
          if (
            current.target_lease_generation !== null &&
            request.lease_generation <
              current.target_lease_generation
          ) {
            throw new RuntimeExecutionErrorV1(
              "stale_lease_generation",
            );
          }
          controls[index] = Object.freeze({
            ...current,
            status: "handled",
            handled_status: request.handled_status,
            handled_lease_generation: request.lease_generation,
            final_fencing_generation: Math.max(
              incrementSafeIntegerV1(
                run.start_fence_generation,
                "start_fence_generation",
              ),
              incrementSafeIntegerV1(
                request.lease_generation,
                "lease_generation",
              ),
            ),
          });
          const handledEvent = snapshot(request.handled_event);
          const terminalEvent = snapshot(request.terminal_event);
          const newEvents = [handledEvent, terminalEvent];
          if (
            handledEvent.payload.sequence_no !== run.next_sequence_no ||
            terminalEvent.payload.sequence_no !==
              incrementSafeIntegerV1(
                run.next_sequence_no,
                "runtime_sequence_no",
              )
          ) {
            throw new RuntimeExecutionErrorV1("idempotency_conflict");
          }
          for (const event of newEvents) {
            const existing = run.events.find(
              ({ event_id }) => event_id === event.event_id,
            );
            if (
              existing !== undefined &&
              canonicalJsonV1(existing) !== canonicalJsonV1(event)
            ) {
              throw new RuntimeExecutionErrorV1(
                "idempotency_conflict",
              );
            }
            if (
              run.events.some(
                ({ idempotency_key }) =>
                  idempotency_key === event.idempotency_key,
              )
            ) {
              throw new RuntimeExecutionErrorV1(
                "idempotency_conflict",
              );
            }
          }
          if (
            newEvents.some((event) =>
              run.events.some(
                ({ event_id }) => event_id === event.event_id,
              ),
            )
          ) {
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
            );
          }
          const outboxRecords = newEvents.map((event) => {
            const id = `runtime_outbox:${event.event_id}`;
            outboxOwner.set(id, request.runtime_run_id);
            return Object.freeze({
              id,
              event,
              status: "pending" as const,
              attempt_count: 0,
            });
          });
          return {
            ...run,
            status: "cancelled",
            terminal_reason: request.terminal_reason,
            lease: Object.freeze({
              ...activeLease(run, request.lease_generation),
              generation: incrementSafeIntegerV1(
                request.lease_generation,
                "lease_generation",
              ),
            }),
            controls: Object.freeze(controls),
            next_sequence_no: incrementSafeIntegerV1(
              run.next_sequence_no,
              "runtime_sequence_no",
              2,
            ),
            events: Object.freeze([...run.events, ...newEvents]),
            outbox: Object.freeze([...run.outbox, ...outboxRecords]),
          };
        }),
      );
    },

    async finalizeAlreadyTerminalControl(request) {
      let result: RuntimeControlRecordV1 | undefined;
      let replayed = false;
      const updated = replace(request.runtime_run_id, (run) => {
        if (
          run.status !== "completed" &&
          run.status !== "failed" &&
          run.status !== "cancelled"
        ) {
          throw new RuntimeExecutionErrorV1("stale_lease_generation");
        }
        if (
          run.request.trigger_process_id !== request.request.trigger_process_id ||
          run.request.start_attempt_no !== request.request.start_attempt_no ||
          !secureDigestEqualsV1(
            run.request.preempt_token_hash,
            request.request.preempt_token_hash,
          ) ||
          run.start_fence_generation !==
            request.verification.start_fence_generation ||
          request.verification.control_valid_until !==
            addMilliseconds(
              new Date(run.request.policy.expires_at),
              15 * 60 * 1_000,
            )
        ) {
          throw new RuntimeExecutionErrorV1("stale_start_fence");
        }
        const requestedEvents = [
          snapshot(request.received_event),
          snapshot(request.handled_event),
        ];
        const receivedPayload = requestedEvents[0]!.payload as Readonly<
          Record<string, unknown>
        >;
        const handledPayload = requestedEvents[1]!.payload as Readonly<{
          runtime_run_id: string;
          trigger_process_id: string;
          runtime_signal_id: string;
          status: string;
          handled_status: string | null;
          target_lease_generation: number | null;
          handled_lease_generation: number | null;
          final_fencing_generation: number | null;
          safe_point_reached: boolean | null;
          late_events_isolated: boolean | null;
          last_runtime_sequence_no: number | null;
          isolation_proof_ref: string | null;
        }>;
        if (
          requestedEvents[0]!.event_type !==
            "runtime.control_signal.received" ||
          requestedEvents[1]!.event_type !==
            "runtime.control_signal.handled" ||
          requestedEvents[0]!.idempotency_key !==
            `${request.request.idempotency_key}:received` ||
          requestedEvents[1]!.idempotency_key !==
            `${request.request.idempotency_key}:handled` ||
          receivedPayload.runtime_run_id !== run.request.runtime_run_id ||
          receivedPayload.trigger_process_id !==
            run.request.trigger_process_id ||
          receivedPayload.runtime_signal_id !== request.runtime_signal_id ||
          receivedPayload.status !== "received" ||
          handledPayload.runtime_run_id !== run.request.runtime_run_id ||
          handledPayload.trigger_process_id !==
            run.request.trigger_process_id ||
          handledPayload.runtime_signal_id !== request.runtime_signal_id ||
          handledPayload.status !== "handled" ||
          handledPayload.handled_status !== "already_terminal" ||
          handledPayload.safe_point_reached !== false ||
          handledPayload.late_events_isolated !== true ||
          handledPayload.final_fencing_generation === null ||
          !Number.isSafeInteger(
            handledPayload.final_fencing_generation,
          ) ||
          handledPayload.last_runtime_sequence_no === null ||
          !Number.isSafeInteger(
            handledPayload.last_runtime_sequence_no,
          )
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        const existing = run.controls.find(
          ({ request: candidate }) =>
            candidate.runtime_signal_id === request.runtime_signal_id,
        );
        if (existing !== undefined) {
          if (
            existing.request_hash !== request.request_hash ||
            existing.status !== "handled" ||
            existing.handled_status !== "already_terminal"
          ) {
            throw new RuntimeExecutionErrorV1("idempotency_conflict");
          }
          result = existing;
          replayed = true;
        } else {
          const control: RuntimeControlRecordV1 = Object.freeze({
            request: snapshot(request.request),
            control_type: request.control_type,
            requested_by: "trigger_processor",
            control_valid_until: request.verification.control_valid_until,
            target_lease_generation:
              handledPayload.target_lease_generation,
            request_hash: request.request_hash,
            status: "handled",
            handled_status: "already_terminal",
            handled_lease_generation:
              handledPayload.handled_lease_generation,
            final_fencing_generation:
              handledPayload.final_fencing_generation,
          });
          result = control;
          controlById.set(
            request.runtime_signal_id,
            request.runtime_run_id,
          );
          controlByIdempotency.set(
            request.request.idempotency_key,
            request.runtime_signal_id,
          );
        }
        const existingEvents = requestedEvents.map((event) =>
          run.events.find(({ event_id }) => event_id === event.event_id),
        );
        if (existingEvents.some((event) => event !== undefined)) {
          if (
            existingEvents.every((event) => event !== undefined) &&
            existingEvents.every(
              (event, index) =>
                canonicalJsonV1(event) ===
                canonicalJsonV1(requestedEvents[index]),
            )
          ) {
            return run;
          }
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        if (
          requestedEvents[0]!.payload.sequence_no !== run.next_sequence_no ||
          requestedEvents[1]!.payload.sequence_no !==
            incrementSafeIntegerV1(
              run.next_sequence_no,
              "runtime_sequence_no",
            )
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        for (const event of requestedEvents) {
          if (
            run.events.some(
              ({ idempotency_key }) =>
                idempotency_key === event.idempotency_key,
            )
          ) {
            throw new RuntimeExecutionErrorV1("idempotency_conflict");
          }
        }
        const outboxRecords = requestedEvents.map((event) => {
          const id = `runtime_outbox:${event.event_id}`;
          outboxOwner.set(id, request.runtime_run_id);
          return Object.freeze({
            id,
            event,
            status: "pending" as const,
            attempt_count: 0,
          });
        });
        return {
          ...run,
          controls:
            existing === undefined
              ? Object.freeze([...run.controls, result!])
              : run.controls,
          next_sequence_no: incrementSafeIntegerV1(
            run.next_sequence_no,
            "runtime_sequence_no",
            2,
          ),
          events: Object.freeze([...run.events, ...requestedEvents]),
          outbox: Object.freeze([...run.outbox, ...outboxRecords]),
        };
      });
      return Object.freeze({
        control: snapshot(result!),
        run: snapshot(updated),
        replayed,
      });
    },

    async claimOutbox(request) {
      assertPositiveSafeInteger(request.limit, "limit");
      assertPositiveSafeInteger(
        request.lease_seconds,
        "lease_seconds",
      );
      const claimNow = new Date(request.now);
      if (
        !/^[A-Za-z0-9._:-]{1,128}$/u.test(request.worker_id) ||
        request.limit > 1_000 ||
        request.lease_seconds > 300 ||
        !Number.isFinite(claimNow.getTime()) ||
        claimNow.getTime() > currentTime().getTime() ||
        request.current_transport_epoch !== activeTransportEpoch ||
        request.current_transport_generation !==
          activeTransportGeneration
      ) {
        throw new RuntimeExecutionErrorV1(
          "idempotency_conflict",
          "Runtime outbox claim authority is invalid",
        );
      }
      const candidates = [
        ...[...runs.values()].flatMap(({ outbox }) => outbox),
        ...[...controlTombstones.values()].flatMap(
          ({ outbox }) => outbox,
        ),
      ];
      const claims: RuntimeOutboxClaimRecordV1[] = [];
      for (const candidate of candidates) {
        if (claims.length >= request.limit) break;
        const activeClaim = outboxClaims.get(candidate.id);
        const retryAt = outboxRetryAt.get(candidate.id);
        if (
          candidate.status !== "pending" ||
          (activeClaim !== undefined &&
            Date.parse(activeClaim.lease_expires_at) >
              claimNow.getTime()) ||
          (retryAt !== undefined &&
            Date.parse(retryAt) > claimNow.getTime())
        ) {
          continue;
        }
        const attempted = replaceOutboxRecordV1(
          candidate.id,
          (record) =>
            Object.freeze({
              ...record,
              attempt_count: incrementSafeIntegerV1(
                record.attempt_count,
                "outbox_attempt_count",
              ),
            }),
        );
        const leaseExpiresAt = addMilliseconds(
          claimNow,
          request.lease_seconds * 1_000,
        );
        const claimToken = sha256TextV1(
          canonicalJsonV1({
            outbox_id: attempted.id,
            worker_id: request.worker_id,
            attempt_count: attempted.attempt_count,
            transport_epoch: activeTransportEpoch,
            transport_generation: activeTransportGeneration,
            claim_nonce: randomUUID(),
          }),
        );
        const claimState = Object.freeze({
          worker_id: request.worker_id,
          claim_token: claimToken,
          lease_expires_at: leaseExpiresAt,
          transport_epoch: activeTransportEpoch,
          transport_generation: activeTransportGeneration,
        });
        outboxClaims.set(candidate.id, claimState);
        outboxRetryAt.delete(candidate.id);
        if (attempted.status !== "pending") {
          throw new RuntimeExecutionErrorV1(
            "idempotency_conflict",
            "Runtime outbox claim changed a non-pending record",
          );
        }
        claims.push(
          Object.freeze({
            ...snapshot(attempted),
            status: "pending" as const,
            ...claimState,
          }),
        );
      }
      return Object.freeze(snapshot(claims));
    },

    async readOutboxAcknowledgeState(request) {
      const authoritative = outboxAcknowledgements.get(
        request.outbox_id,
      );
      if (
        authoritative === undefined ||
        request.outcome !== "sent" ||
        request.next_retry_at !== null ||
        request.error !== null ||
        request.transport_ref === null ||
        request.transport_epoch === null ||
        request.transport_generation === null ||
        authoritative.claim_token !== request.claim_token ||
        authoritative.transport_ref !== request.transport_ref ||
        authoritative.transport_epoch !==
          request.transport_epoch ||
        authoritative.transport_generation !==
          request.transport_generation ||
        authoritative.transport_epoch !==
          request.current_transport_epoch ||
        authoritative.transport_generation !==
          request.current_transport_generation ||
        authoritative.record.id !== request.outbox_id ||
        runtimeRunIdForOutboxRecordV1(authoritative.record) !==
          request.runtime_run_id ||
        authoritative.record.event.event_id !== request.event_id ||
        canonicalPayloadHashV1(authoritative.record.event) !==
          request.event_hash ||
        authoritative.record.attempt_count !==
          request.expected_attempt_count
      ) {
        return undefined;
      }
      return snapshot(authoritative);
    },

    async acknowledgeOutbox(request) {
      const acknowledgedAt = new Date(request.now);
      const record = readOutboxRecordByIdV1(request.outbox_id);
      const claim = outboxClaims.get(request.outbox_id);
      const previousAcknowledgement =
        outboxAcknowledgements.get(request.outbox_id);
      if (
        previousAcknowledgement !== undefined &&
        request.outcome === "sent" &&
        request.next_retry_at === null &&
        request.error === null &&
        request.transport_ref !== null &&
        request.transport_epoch !== null &&
        request.transport_generation !== null &&
        Number.isFinite(acknowledgedAt.getTime()) &&
        acknowledgedAt.getTime() <= currentTime().getTime() &&
        previousAcknowledgement.claim_token === request.claim_token &&
        previousAcknowledgement.transport_ref ===
          request.transport_ref &&
        previousAcknowledgement.transport_epoch ===
          request.transport_epoch &&
        previousAcknowledgement.transport_generation ===
          request.transport_generation &&
        previousAcknowledgement.transport_epoch ===
          request.current_transport_epoch &&
        previousAcknowledgement.transport_generation ===
          request.current_transport_generation &&
        request.current_transport_epoch === activeTransportEpoch &&
        request.current_transport_generation ===
          activeTransportGeneration &&
        previousAcknowledgement.record.id === request.outbox_id &&
        runtimeRunIdForOutboxRecordV1(
          previousAcknowledgement.record,
        ) === request.runtime_run_id &&
        previousAcknowledgement.record.event.event_id ===
          request.event_id &&
        canonicalPayloadHashV1(
          previousAcknowledgement.record.event,
        ) === request.event_hash &&
        previousAcknowledgement.record.attempt_count ===
          request.expected_attempt_count
      ) {
        return Object.freeze({ acknowledged: true as const });
      }
      if (
        record === undefined ||
        claim === undefined ||
        record.status !== "pending" ||
        !Number.isFinite(acknowledgedAt.getTime()) ||
        acknowledgedAt.getTime() > currentTime().getTime() ||
        Date.parse(claim.lease_expires_at) <=
          acknowledgedAt.getTime() ||
        claim.claim_token !== request.claim_token ||
        claim.transport_epoch !==
          request.current_transport_epoch ||
        claim.transport_generation !==
          request.current_transport_generation ||
        request.current_transport_epoch !== activeTransportEpoch ||
        request.current_transport_generation !==
          activeTransportGeneration ||
        runtimeRunIdForOutboxRecordV1(record) !==
          request.runtime_run_id ||
        record.event.event_id !== request.event_id ||
        canonicalPayloadHashV1(record.event) !==
          request.event_hash ||
        record.attempt_count !== request.expected_attempt_count
      ) {
        throw new RuntimeExecutionErrorV1(
          "idempotency_conflict",
          "Runtime outbox ACK is stale or does not match its claim",
        );
      }
      if (request.outcome === "sent") {
        if (
          request.next_retry_at !== null ||
          request.error !== null ||
          typeof request.transport_ref !== "string" ||
          request.transport_ref.length < 1 ||
          request.transport_ref.length > 2_048 ||
          request.transport_epoch !== claim.transport_epoch ||
          request.transport_generation !==
            claim.transport_generation
        ) {
          throw new RuntimeExecutionErrorV1(
            "idempotency_conflict",
            "Runtime outbox sent ACK has an invalid transport receipt",
          );
        }
        const sentRecord = replaceOutboxRecordV1(
          request.outbox_id,
          (current) =>
            Object.freeze({
              ...current,
              status: "sent" as const,
            }),
        );
        const authoritative: RuntimeOutboxAuthoritativeAckV1 =
          Object.freeze({
            record: snapshot(sentRecord),
            claim_token: claim.claim_token,
            transport_ref: request.transport_ref,
            transport_epoch: request.transport_epoch,
            transport_generation: request.transport_generation,
            acknowledged_at: acknowledgedAt.toISOString(),
          });
        outboxAcknowledgements.set(
          request.outbox_id,
          authoritative,
        );
        outboxClaims.delete(request.outbox_id);
        outboxRetryAt.delete(request.outbox_id);
      } else {
        if (
          request.transport_ref !== null ||
          request.transport_epoch !== null ||
          request.transport_generation !== null ||
          request.error === null ||
          (request.outcome === "retry_wait"
            ? request.next_retry_at === null ||
              !Number.isFinite(Date.parse(request.next_retry_at)) ||
              Date.parse(request.next_retry_at) <
                acknowledgedAt.getTime()
            : request.next_retry_at !== null)
        ) {
          throw new RuntimeExecutionErrorV1(
            "idempotency_conflict",
            "Runtime outbox non-sent ACK has an invalid retry or error shape",
          );
        }
        if (request.outcome === "failed") {
          replaceOutboxRecordV1(
            request.outbox_id,
            (current) =>
              Object.freeze({
                ...current,
                status: "failed" as const,
              }),
          );
          outboxRetryAt.delete(request.outbox_id);
        } else {
          const nextRetryAt = request.next_retry_at;
          if (nextRetryAt === null) {
            throw new RuntimeExecutionErrorV1(
              "idempotency_conflict",
              "Runtime outbox retry ACK has no next retry time",
            );
          }
          outboxRetryAt.set(
            request.outbox_id,
            nextRetryAt,
          );
        }
        outboxClaims.delete(request.outbox_id);
      }
      return Object.freeze({ acknowledged: true as const });
    },
  };
  return Object.freeze(store);
}
