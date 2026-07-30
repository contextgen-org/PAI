import {
  canonicalJsonV1,
  canonicalPayloadHashV1,
} from "@pai/eventing";
import { createHash } from "node:crypto";
import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import type {
  RuntimeDomainEventV1,
  RuntimeStartResponseV1,
} from "@pai/contracts";
import type { RuntimePolicyInputReadArtifactV1 } from "@pai/contracts/action-runtime/runtime-policy-input-read.v1";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "./permission-manifest.v1.js";
import {
  RuntimeExecutionErrorV1,
  controlReceivedEventFor,
  type AcceptRuntimeStartResultV1,
  type BeginRuntimeStartAttemptResultV1,
  type BeginRuntimeStartValidationCallResultV1,
  type RuntimeActorBindingV1,
  type RuntimeArtifactRecordV1,
  type RuntimeControlRecordV1,
  type RuntimeControlTombstoneV1,
  type RuntimeExecutionErrorCodeV1,
  type RuntimeExecutionStoreV1,
  type RuntimeLeaseV1,
  type RuntimeOutboxAckConfirmationV1,
  type RuntimeOutboxAuthoritativeAckV1,
  type RuntimeOutboxClaimRecordV1,
  type RuntimePermissionProjectionV1,
  type RuntimeRunRecordV1,
  type RuntimeSkillResolutionV1,
  type RuntimeStartAttemptV1,
  type RuntimeStartValidationFactInputV1,
  type RuntimeStoredStartRequestV1,
  type RuntimeToolAuditV1,
  type RuntimeToolResultV1,
} from "../runtime-execution.v1.js";

type ActionRuntimePostgresCompositionV1 = Pick<
  VerifiedOwnerPostgresCompositionV1<
    typeof ACTION_RUNTIME_REPOSITORY_CONTRACT_V1
  >,
  "postgres" | "unit_of_work" | "checkReadiness"
>;

const MAX_SAFE_BIGINT_V1 = BigInt(Number.MAX_SAFE_INTEGER);

function safeIntegerV1(value: unknown, label: string): number {
  const parsed = typeof value === "bigint" ? value : BigInt(String(value));
  if (parsed < 0n || parsed > MAX_SAFE_BIGINT_V1) {
    throw new RuntimeExecutionErrorV1(
      "numeric_boundary_exhausted",
      `${label} is outside the JavaScript safe-integer boundary`,
    );
  }
  return Number(parsed);
}

function positiveSafeIntegerV1(value: unknown, label: string): number {
  const parsed = safeIntegerV1(value, label);
  if (parsed < 1) {
    throw new RuntimeExecutionErrorV1(
      "numeric_boundary_exhausted",
      `${label} must be positive`,
    );
  }
  return parsed;
}

function bigintArgumentV1(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RuntimeExecutionErrorV1("numeric_boundary_exhausted");
  }
  return String(value);
}

function attemptIdV1(runtimeRunId: string): string {
  return `runtime_start_attempt:${runtimeRunId}`;
}

function toIsoV1(value: unknown, label: string): string {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) {
    throw new RuntimeExecutionErrorV1(
      "schema_validation_failed",
      `${label} is not a UTC timestamp`,
    );
  }
  return parsed.toISOString();
}

function addSecondsV1(value: Date, seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 1) {
    throw new RuntimeExecutionErrorV1("schema_validation_failed");
  }
  return new Date(value.getTime() + seconds * 1_000).toISOString();
}

function startFailureCodeV1(
  resultCode: string,
  responsePayload: unknown,
): RuntimeExecutionErrorCodeV1 | undefined {
  if (
    typeof responsePayload === "object" &&
    responsePayload !== null &&
    "failure_code" in responsePayload &&
    typeof responsePayload.failure_code === "string"
  ) {
    return responsePayload.failure_code as RuntimeExecutionErrorCodeV1;
  }
  const mapping: Readonly<Record<string, RuntimeExecutionErrorCodeV1>> = {
    stale_start_fence: "stale_start_fence",
    start_cancelled: "start_cancelled",
    catalog_version_conflict: "catalog_version_mismatch",
    authorization_scope_mismatch: "authorization_scope_mismatch",
    invalid_runtime_policy: "policy_hash_mismatch",
    tool_permission_denied: "tool_policy_denied",
    version_revoked: "skill_content_mismatch",
    required_skill_unavailable: "skill_content_mismatch",
    registry_unavailable: "reservation_unavailable",
    idempotency_conflict: "idempotency_conflict",
    failed: "runtime_adapter_failed",
  };
  return mapping[resultCode];
}

function terminalResultCodeV1(
  code: RuntimeExecutionErrorCodeV1,
): string {
  const mapping: Partial<Record<RuntimeExecutionErrorCodeV1, string>> = {
    stale_start_fence: "stale_start_fence",
    start_cancelled: "start_cancelled",
    runtime_cancelled: "start_cancelled",
    runtime_preempted: "start_cancelled",
    catalog_version_mismatch: "catalog_version_conflict",
    authorization_scope_mismatch: "authorization_scope_mismatch",
    policy_hash_mismatch: "invalid_runtime_policy",
    policy_expired: "invalid_runtime_policy",
    tool_policy_denied: "tool_permission_denied",
    skill_content_mismatch: "required_skill_unavailable",
    reservation_unavailable: "registry_unavailable",
    idempotency_conflict: "idempotency_conflict",
  };
  return mapping[code] ?? "failed";
}

function validationRowV1(
  runtimeRunId: string,
  attempt: RuntimeStartAttemptV1,
  fact: RuntimeStartValidationFactInputV1,
): Readonly<Record<string, unknown>> {
  const success =
    fact.response.schema_version ===
    "runtime_start_reservation_validate_response.v1"
      ? fact.response
      : undefined;
  return {
    id: fact.validation_call_id,
    runtime_start_attempt_id: attemptIdV1(runtimeRunId),
    validation_call_id: fact.validation_call_id,
    validation_stage: fact.validation_stage,
    request_token_kind:
      fact.validation_stage === "before_running"
        ? "persisted_hash"
        : "plaintext_presented",
    validation_sequence_no: attempt.validation_facts.length + 1,
    request_binding_hash: fact.request_hash,
    request_hash: fact.request_hash,
    start_fence_token_hash: fact.start_fence_token_hash,
    actor_binding_hash: attempt.actor_binding_hash,
    validation_result: fact.validation_result,
    reservation_status_snapshot: success === undefined ? "pending" : "valid",
    validated_fence_generation:
      success === undefined ? null : success.validated_fence_generation,
    owner_response_schema_version: fact.response_schema_version,
    owner_response_hash: fact.response_hash,
    owner_response: fact.response,
    error_code:
      success === undefined && "code" in fact.response
        ? fact.response.code
        : null,
    details:
      success === undefined && "details" in fact.response
        ? fact.response.details
        : {},
    trace_id:
      "trace_id" in fact.response ? fact.response.trace_id : "runtime-start",
    validated_at: fact.validated_at,
    response_source: fact.response_source,
    response_schema_version: fact.response_schema_version,
    response_hash: fact.response_hash,
  };
}

function eventPersistenceV1(
  run: Pick<RuntimeRunRecordV1, "request">,
  event: RuntimeDomainEventV1,
): Readonly<{
  event: Readonly<Record<string, unknown>>;
  outbox: Readonly<Record<string, unknown>>;
  canonical_bytes: string;
  payload_hash: string;
}> {
  const payloadHash = canonicalPayloadHashV1(event);
  const payloadRef = `runtime_event:${event.event_id}`;
  return {
    canonical_bytes: canonicalJsonV1(event),
    payload_hash: payloadHash,
    event: {
      id: event.event_id,
      runtime_run_id: run.request.runtime_run_id,
      trigger_process_id: run.request.trigger_process_id,
      event_type: event.event_type,
      sequence_no: event.payload.sequence_no,
      idempotency_key: event.idempotency_key,
      envelope: event,
      created_at: event.occurred_at,
      payload_ref: payloadRef,
      payload_hash: payloadHash,
      retention_until: run.request.policy.expires_at,
      redaction_state: "not_required",
    },
    outbox: {
      id: `runtime_outbox:${event.event_id}`,
      runtime_run_id: run.request.runtime_run_id,
      trigger_process_id: run.request.trigger_process_id,
      source_event_id: event.event_id,
      source: "action_runtime",
      event_id: event.event_id,
      source_sequence_no: event.payload.sequence_no,
      append_type: event.event_type,
      payload_ref: payloadRef,
      payload_hash: payloadHash,
      idempotency_key: event.idempotency_key,
      target: "trigger_processor",
      status: "pending",
      attempt_count: 0,
      created_at: event.occurred_at,
      updated_at: event.occurred_at,
    },
  };
}

function eventBatchPersistenceV1(
  run: Pick<RuntimeRunRecordV1, "request">,
  event: RuntimeDomainEventV1,
): Readonly<{
  event: Readonly<Record<string, unknown>>;
  outbox: Readonly<Record<string, unknown>>;
}> {
  const persisted = eventPersistenceV1(run, event);
  return Object.freeze({
    event: Object.freeze({
      ...persisted.event,
      envelope_canonical_bytes: `\\x${Buffer.from(
        persisted.canonical_bytes,
        "utf8",
      ).toString("hex")}`,
    }),
    outbox: Object.freeze({
      ...persisted.outbox,
      transport_epoch: "0",
      transport_generation: 0,
    }),
  });
}

function startedEventV1(
  run: RuntimeRunRecordV1,
  occurredAt: string,
): RuntimeDomainEventV1 {
  return {
    event_id: `${run.request.runtime_run_id}:${run.next_sequence_no}:runtime.run.started`,
    event_type: "runtime.run.started",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: occurredAt,
    idempotency_key: `${run.request.runtime_run_id}:runtime.run.started:${run.next_sequence_no}`,
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
      status: "running",
      previous_status: "queued",
      next_status: "running",
      model: run.model,
      reason: null,
      duration_ms: null,
      reason_code: null,
      error_summary: null,
      terminal_artifact_ref: null,
    },
  };
}

function reconciledToolEventV1(
  run: RuntimeRunRecordV1,
  audit: RuntimeToolAuditV1,
  result: RuntimeToolResultV1,
  idempotencyKey: string,
  traceId: string,
  reconciledAt: string,
): RuntimeDomainEventV1 {
  const completed = result.outcome === "completed";
  const outputRef = audit.output_ref ??
    result.external_response_ref ??
    result.external_error_ref;
  if (outputRef === undefined) {
    throw new RuntimeExecutionErrorV1("schema_validation_failed");
  }
  return {
    event_id: `${run.request.runtime_run_id}:${run.next_sequence_no}:runtime.tool.${result.outcome}:${audit.tool_invocation_id}:reconciled`,
    event_type: completed ? "runtime.tool.completed" : "runtime.tool.failed",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: reconciledAt,
    idempotency_key: idempotencyKey,
    trace_id: traceId,
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
      tool_invocation_id: audit.tool_invocation_id,
      tool_name: audit.tool_name,
      status: result.outcome,
      policy_snapshot_id: run.response.details.policy_snapshot_id,
      capability_token_id: audit.capability_token_id,
      input_ref: audit.input_ref,
      output_ref: outputRef,
      side_effect_status: result.side_effect_status,
      downstream_idempotency_key: audit.downstream_idempotency_key,
      external_response_ref: completed
        ? (result.external_response_ref ?? outputRef)
        : null,
      external_error_ref: completed
        ? null
        : (result.external_error_ref ?? outputRef),
      duplicate_replayed: true,
      error: completed
        ? null
        : {
            failure_class: "tool_execution_failed",
            code: "tool_execution_failed",
            message:
              "Tool execution failed; inspect the durable tool-result artifact",
            retryable: false,
          },
      duration_ms: null,
      reason_code: completed ? null : "tool_execution_failed",
      error_summary: completed
        ? null
        : "Tool execution failed; inspect the durable tool-result artifact",
      artifact_ref: outputRef,
    },
  } as RuntimeDomainEventV1;
}

export function createPostgresRuntimeExecutionStoreV1(
  composition: ActionRuntimePostgresCompositionV1,
): RuntimeExecutionStoreV1 & Readonly<{
  checkReadiness(signal: AbortSignal): Promise<void>;
}> {
  const readStartAttempt = async (
    runtimeRunId: string,
  ): Promise<RuntimeStartAttemptV1 | undefined> => {
    const result = await composition.postgres.query<{
      attempt: RuntimeStartAttemptV1 | null;
    }>(
      `SELECT CASE WHEN attempt.id IS NULL THEN NULL ELSE jsonb_build_object(
         'runtime_run_id', attempt.runtime_run_id,
         'trigger_process_id', attempt.trigger_process_id,
         'start_attempt_no', attempt.start_attempt_no,
         'idempotency_key', attempt.idempotency_key,
         'request_hash', attempt.request_hash,
         'start_fence_token_hash', attempt.start_fence_token_hash,
         'actor_binding', attempt.actor_binding,
         'actor_binding_hash', attempt.actor_binding_hash,
         'status', CASE
           WHEN attempt.result_code = 'requested' THEN 'validating'
           WHEN attempt.result_code = 'runtime_queued' THEN 'accepted'
           ELSE 'terminal'
         END,
         'validation_calls', COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'validation_call_id', call.validation_call_id,
             'validation_stage', call.validation_stage,
             'request_hash', call.request_hash,
             'trace_id', call.trace_id,
             'requested_at', call.requested_at
           ) ORDER BY call.requested_at, call.validation_call_id)
           FROM action_runtime.runtime_start_reservation_validation_calls AS call
           WHERE call.runtime_start_attempt_id = attempt.id
         ), '[]'::jsonb),
         'validation_facts', COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'validation_call_id', validation.validation_call_id,
             'validation_sequence_no', validation.validation_sequence_no,
             'validation_stage', validation.validation_stage,
             'validation_result', validation.validation_result,
             'response_source', validation.response_source,
             'response_schema_version', validation.response_schema_version,
             'request_hash', validation.request_hash,
             'start_fence_token_hash', validation.start_fence_token_hash,
             'response_hash', validation.response_hash,
             'response', validation.owner_response,
             'validated_at', validation.validated_at
           ) ORDER BY validation.validation_sequence_no)
           FROM action_runtime.runtime_start_reservation_validations AS validation
           WHERE validation.runtime_start_attempt_id = attempt.id
         ), '[]'::jsonb),
         'failure_code', CASE WHEN attempt.result_code IN ('requested','runtime_queued')
           THEN NULL ELSE COALESCE(attempt.response_payload ->> 'failure_code', attempt.result_code) END,
         'created_at', attempt.created_at,
         'updated_at', COALESCE(
           (SELECT max(validation.validated_at)
              FROM action_runtime.runtime_start_reservation_validations AS validation
             WHERE validation.runtime_start_attempt_id = attempt.id),
           attempt.completed_at,
           attempt.created_at
         )
       ) END AS attempt
       FROM (SELECT 1) AS singleton
       LEFT JOIN action_runtime.runtime_start_attempts AS attempt
         ON attempt.runtime_run_id = $1`,
      [runtimeRunId],
    );
    const value = result.rows[0]?.attempt;
    if (value === null || value === undefined) return undefined;
    const failureCode = startFailureCodeV1(
      (value as unknown as { result_code?: string }).result_code ?? "failed",
      value,
    );
    return Object.freeze({
      ...value,
      start_attempt_no: positiveSafeIntegerV1(
        value.start_attempt_no,
        "start_attempt_no",
      ),
      validation_facts: Object.freeze(
        value.validation_facts.map((fact) => Object.freeze({
          ...fact,
          validation_sequence_no: positiveSafeIntegerV1(
            fact.validation_sequence_no,
            "validation_sequence_no",
          ),
          validated_at: toIsoV1(fact.validated_at, "validated_at"),
        })),
      ),
      validation_calls: Object.freeze(
        value.validation_calls.map((call) => Object.freeze({
          ...call,
          requested_at: toIsoV1(call.requested_at, "requested_at"),
        })),
      ),
      ...(value.status === "terminal"
        ? { failure_code: startFailureCodeV1(
            (value as unknown as { failure_code?: string }).failure_code ?? "failed",
            { failure_code: value.failure_code ?? failureCode },
          ) ?? "runtime_adapter_failed" }
        : {}),
      created_at: toIsoV1(value.created_at, "created_at"),
      updated_at: toIsoV1(value.updated_at, "updated_at"),
    });
  };

  const readRun = async (
    runtimeRunId: string,
  ): Promise<RuntimeRunRecordV1 | undefined> => {
    const result = await composition.postgres.query<{
      run_record: RuntimeRunRecordV1 | null;
    }>(
      `SELECT CASE WHEN run.id IS NULL THEN NULL ELSE jsonb_build_object(
         'request', attempt.request_snapshot,
         'request_hash', attempt.request_hash,
         'actor_binding', attempt.actor_binding,
         'actor_binding_hash', attempt.actor_binding_hash,
         'response', attempt.response_payload,
         'status', run.status,
         'start_fence_generation', run.start_fence_generation,
         'policy_snapshot_hash', run.policy_snapshot_hash,
         'model', run.model,
         'lease', CASE WHEN lease.runtime_run_id IS NULL THEN NULL ELSE jsonb_build_object(
           'runtime_run_id', lease.runtime_run_id,
           'owner_id', lease.owner_id,
           'generation', lease.lease_generation,
           'expires_at', lease.lease_expires_at,
           'heartbeat_at', lease.heartbeat_at,
           'recovery_state', CASE WHEN lease.recovery_state = 'takeover_pending'
             THEN 'takeover_pending' ELSE 'active' END
         ) END,
         'next_sequence_no', COALESCE((SELECT max(event.sequence_no) + 1
           FROM action_runtime.runtime_events AS event WHERE event.runtime_run_id = run.id), 1),
         'events', COALESCE((SELECT jsonb_agg(event.envelope ORDER BY event.sequence_no)
           FROM action_runtime.runtime_events AS event WHERE event.runtime_run_id = run.id), '[]'::jsonb),
         'outbox', COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'id', outbox.id,
           'event', event.envelope,
           'status', CASE WHEN outbox.status = 'sent' THEN 'sent'
             WHEN outbox.status = 'failed' THEN 'failed' ELSE 'pending' END,
           'attempt_count', outbox.attempt_count
         ) ORDER BY event.sequence_no)
           FROM action_runtime.runtime_event_outbox AS outbox
           JOIN action_runtime.runtime_events AS event ON event.id = outbox.source_event_id
           WHERE outbox.runtime_run_id = run.id), '[]'::jsonb),
         'tools', COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(
           COALESCE(invocation.input -> 'runtime_tool_audit', '{}'::jsonb)
           || jsonb_build_object(
             'tool_invocation_id', invocation.id,
             'tool_name', invocation.tool_name,
             'status', invocation.status,
             'side_effect_status', invocation.side_effect_status,
             'output_ref', COALESCE(invocation.external_response_ref, invocation.external_error_ref),
             'result', CASE WHEN invocation.status IN ('requested', 'running') THEN NULL
               WHEN invocation.output ? 'runtime_tool_result' THEN invocation.output -> 'runtime_tool_result'
               ELSE jsonb_strip_nulls(jsonb_build_object(
                 'outcome', CASE WHEN invocation.status = 'completed' THEN 'completed' ELSE 'failed' END,
                 'retryable', false,
                 'output', invocation.output,
                 'error', invocation.error,
                 'side_effect_status', invocation.side_effect_status,
                 'external_response_ref', invocation.external_response_ref,
                 'external_error_ref', invocation.external_error_ref
               )) END,
             'reconciled_at', invocation.reconciled_at,
             'reconciliation_evidence_ref', invocation.reconciliation_evidence_ref,
             'reconciliation_idempotency_key', invocation.reconciliation_idempotency_key,
             'reconciliation_request_hash', invocation.reconciliation_request_hash
           )) ORDER BY invocation.started_at, invocation.id)
           FROM action_runtime.tool_invocations AS invocation
           WHERE invocation.runtime_run_id = run.id), '[]'::jsonb),
         'permissions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'id', permission.id,
           'runtime_run_id', permission.runtime_run_id,
           'policy_snapshot_id', permission.policy_snapshot_id,
           'capability', permission.capability,
           'actor_binding_hash', permission.scope ->> 'actor_binding_hash',
           'scope', permission.scope - 'actor_binding_hash',
           'expires_at', permission.expires_at,
           'created_at', permission.created_at
         ) ORDER BY permission.id)
           FROM action_runtime.runtime_permissions AS permission
           WHERE permission.runtime_run_id = run.id), '[]'::jsonb),
         'skill_resolutions', policy.resolved_skills,
         'controls', COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'request', jsonb_build_object(
             'schema_version', CASE signal.signal_type
               WHEN 'cancel' THEN 'runtime_cancel.v1'
               WHEN 'preempt' THEN 'runtime_preempt.v1'
               ELSE 'runtime_user_retract.v1' END,
             'runtime_signal_id', signal.runtime_signal_id,
             'runtime_run_id', signal.runtime_run_id,
             'trigger_process_id', signal.trigger_process_id,
             'start_attempt_no', signal.start_attempt_no,
             'preempt_token_hash', signal.control_token_hash,
             'reason_code', signal.reason_code,
             'requested_at', signal.requested_at,
             'idempotency_key', signal.idempotency_key,
             'trace_id', signal.trace_id
           ),
           'control_type', signal.signal_type,
           'requested_by', signal.requested_by,
           'control_valid_until', signal.control_valid_until,
           'target_lease_generation', signal.target_lease_generation,
           'request_hash', signal.request_hash,
           'status', CASE WHEN signal.status = 'received' THEN 'received' ELSE 'handled' END,
           'handled_status', signal.handled_status,
           'handled_lease_generation', signal.handled_lease_generation,
           'final_fencing_generation', signal.final_fencing_generation
         )) ORDER BY signal.requested_at, signal.runtime_signal_id)
           FROM action_runtime.runtime_control_signals AS signal
           WHERE signal.runtime_run_id = run.id), '[]'::jsonb),
         'terminal_reason', run.terminal_reason,
         'frozen_side_effect', EXISTS(SELECT 1 FROM action_runtime.tool_invocations AS frozen
           WHERE frozen.runtime_run_id = run.id AND frozen.side_effect_status = 'unknown')
       ) END AS run_record
       FROM (SELECT 1) AS singleton
       LEFT JOIN action_runtime.runtime_runs AS run ON run.id = $1
       LEFT JOIN action_runtime.runtime_start_attempts AS attempt ON attempt.runtime_run_id = run.id
       LEFT JOIN action_runtime.runtime_policy_snapshots AS policy ON policy.runtime_run_id = run.id
       LEFT JOIN action_runtime.runtime_run_leases AS lease ON lease.runtime_run_id = run.id`,
      [runtimeRunId],
    );
    const value = result.rows[0]?.run_record;
    if (value === null || value === undefined) return undefined;
    const lease = value.lease;
    const base = {
      ...value,
      start_fence_generation: positiveSafeIntegerV1(
        value.start_fence_generation,
        "start_fence_generation",
      ),
      next_sequence_no: positiveSafeIntegerV1(
        value.next_sequence_no,
        "next_sequence_no",
      ),
      ...(lease === undefined || lease === null
        ? {}
        : {
            lease: Object.freeze({
              ...lease,
              generation: positiveSafeIntegerV1(
                lease.generation,
                "lease_generation",
              ),
              expires_at: toIsoV1(lease.expires_at, "lease_expires_at"),
              heartbeat_at: toIsoV1(lease.heartbeat_at, "heartbeat_at"),
            }),
          }),
      outbox: Object.freeze(value.outbox.map((entry) => Object.freeze({
        ...entry,
        attempt_count: safeIntegerV1(entry.attempt_count, "outbox_attempt_count"),
      }))),
      permissions: Object.freeze(value.permissions.map((permission) => Object.freeze({
        ...permission,
        expires_at: toIsoV1(permission.expires_at, "permission_expires_at"),
        created_at: toIsoV1(permission.created_at, "permission_created_at"),
      }))),
      events: Object.freeze(value.events.map((event) => Object.freeze(event))),
      tools: Object.freeze(value.tools.map((tool) => Object.freeze(tool))),
      skill_resolutions: Object.freeze(value.skill_resolutions.map((skill) => Object.freeze(skill))),
      controls: Object.freeze(value.controls.map((control) => Object.freeze(control))),
    };
    if (lease === undefined || lease === null) {
      delete (base as { lease?: RuntimeLeaseV1 | null }).lease;
    }
    return Object.freeze(base as RuntimeRunRecordV1);
  };

  const readArtifact = async (
    runtimeRunId: string,
    artifactId: string,
  ): Promise<RuntimeArtifactRecordV1 | undefined> => {
    const result = await composition.postgres.query<{
      id: string;
      runtime_run_id: string;
      artifact_type: string;
      status: "creating" | "available" | "failed";
      artifact_ref: string | null;
      content_hash: string | null;
      size_bytes: string | number | bigint | null;
      media_type: string | null;
      retention_until: Date | string | null;
      error: Readonly<Record<string, unknown>> | null;
      metadata: Readonly<Record<string, unknown>>;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT artifact.id, artifact.runtime_run_id, artifact.artifact_type,
              artifact.status, artifact.artifact_ref, artifact.content_hash,
              artifact.size_bytes, artifact.media_type, artifact.retention_until,
              artifact.error, artifact.metadata,
              artifact.created_at, artifact.updated_at
         FROM action_runtime.runtime_artifacts AS artifact
        WHERE artifact.runtime_run_id = $1 AND artifact.id = $2`,
      [runtimeRunId, artifactId],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    const startFenceGeneration = positiveSafeIntegerV1(
      row.metadata.start_fence_generation,
      "artifact_start_fence_generation",
    );
    const sizeBytes = safeIntegerV1(row.size_bytes, "artifact_size_bytes");
    if (
      typeof row.content_hash !== "string" ||
      row.content_hash.length < 1 ||
      typeof row.media_type !== "string" ||
      row.media_type.length < 1 ||
      row.retention_until === null ||
      typeof row.metadata.object_store_idempotency_key !== "string" ||
      row.metadata.object_store_idempotency_key.length < 1 ||
      typeof row.metadata.request_hash !== "string" ||
      row.metadata.request_hash.length < 1
    ) {
      throw new RuntimeExecutionErrorV1(
        "runtime_adapter_failed",
        "PostgreSQL Runtime artifact row is incomplete",
      );
    }
    const failureCode =
      row.status === "failed" && typeof row.error?.code === "string"
        ? row.error.code
        : undefined;
    return Object.freeze({
      artifact_id: row.id,
      runtime_run_id: row.runtime_run_id,
      start_fence_generation: startFenceGeneration,
      originating_lease_generation: positiveSafeIntegerV1(
        row.metadata.originating_lease_generation,
        "artifact_originating_lease_generation",
      ),
      artifact_kind: row.artifact_type,
      media_type: row.media_type,
      content_hash: row.content_hash,
      size_bytes: sizeBytes,
      retention_until: toIsoV1(row.retention_until, "artifact_retention_until"),
      object_store_idempotency_key:
        row.metadata.object_store_idempotency_key,
      request_hash: row.metadata.request_hash,
      status: row.status,
      ...(row.artifact_ref === null ? {} : { artifact_ref: row.artifact_ref }),
      ...(failureCode === undefined ? {} : { failure_code: failureCode }),
      reconciliation_generation: safeIntegerV1(
        row.metadata.reconciliation_generation,
        "artifact_reconciliation_generation",
      ),
      ...(typeof row.metadata.reconciliation_owner !== "string"
        ? {}
        : { reconciliation_owner: row.metadata.reconciliation_owner }),
      ...(typeof row.metadata.reconciliation_expires_at !== "string"
        ? {}
        : {
            reconciliation_expires_at: toIsoV1(
              row.metadata.reconciliation_expires_at,
              "artifact_reconciliation_expires_at",
            ),
          }),
      created_at: toIsoV1(row.created_at, "artifact_created_at"),
      updated_at: toIsoV1(row.updated_at, "artifact_updated_at"),
    });
  };

  type RuntimeOutboxPostgresStateV1 = Readonly<{
    id: string;
    runtime_run_id: string;
    source_event_id: string;
    status: "pending" | "dispatching" | "sent" | "retry_wait" | "failed";
    attempt_count: number;
    event: RuntimeDomainEventV1;
  }>;

  type RuntimeOutboxWriterStateV1 = Readonly<{
    id: string;
    runtime_run_id: string;
    source_event_id: string;
    status: "pending" | "dispatching" | "sent" | "retry_wait" | "failed";
    claim_token: string | null;
    acknowledged_claim_token: string | null;
    claimed_by: string | null;
    locked_until: Date | string | null;
    transport_ref: string | null;
    transport_epoch: string;
    transport_generation: string | number | bigint;
    sent_at: Date | string | null;
    attempt_count: number;
  }>;

  const readOutboxState = async (
    outboxId: string,
  ): Promise<RuntimeOutboxPostgresStateV1 | undefined> => {
    const result = await composition.postgres.query<RuntimeOutboxPostgresStateV1>(
      `SELECT outbox.id, outbox.runtime_run_id, outbox.source_event_id,
              outbox.status, outbox.attempt_count, event.envelope AS event
         FROM action_runtime.runtime_event_outbox AS outbox
         JOIN action_runtime.runtime_events AS event
           ON event.id = outbox.source_event_id
        WHERE outbox.id = $1`,
      [outboxId],
    );
    return result.rows[0];
  };

  const outboxRecordV1 = (
    state: RuntimeOutboxPostgresStateV1,
  ): RuntimeOutboxClaimRecordV1 | RuntimeRunRecordV1["outbox"][number] =>
    Object.freeze({
      id: state.id,
      event: Object.freeze(state.event),
      status:
        state.status === "sent"
          ? "sent"
          : state.status === "failed"
            ? "failed"
            : "pending",
      attempt_count: safeIntegerV1(
        state.attempt_count,
        "outbox_attempt_count",
      ),
    });

  const readControlTombstone = async (
    runtimeSignalId: string,
  ): Promise<RuntimeControlTombstoneV1 | undefined> => {
    const result = await composition.postgres.query<{
      runtime_run_id: string;
      trigger_process_id: string;
      start_attempt_no: number;
      start_fence_generation: string | number | bigint;
      signal_type: RuntimeControlRecordV1["control_type"];
      runtime_signal_id: string;
      idempotency_key: string;
      request_hash: string;
      control_token_hash: string;
      control_valid_until: Date | string;
      reason_code: string;
      scope: RuntimeControlTombstoneV1["scope"];
      trace_id: string;
      requested_at: Date | string;
    }>(
      `SELECT tombstone.runtime_run_id, tombstone.trigger_process_id,
              tombstone.start_attempt_no, tombstone.start_fence_generation,
              tombstone.signal_type, tombstone.runtime_signal_id,
              tombstone.idempotency_key, tombstone.request_hash,
              tombstone.control_token_hash, tombstone.control_valid_until,
              tombstone.reason_code, tombstone.scope, tombstone.trace_id,
              tombstone.requested_at
         FROM action_runtime.runtime_control_tombstones AS tombstone
        WHERE tombstone.runtime_signal_id = $1`,
      [runtimeSignalId],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return Object.freeze({
      request: Object.freeze({
        schema_version:
          row.signal_type === "cancel"
            ? "runtime_cancel.v1"
            : row.signal_type === "preempt"
              ? "runtime_preempt.v1"
              : "runtime_user_retract.v1",
        runtime_signal_id: row.runtime_signal_id,
        runtime_run_id: row.runtime_run_id,
        trigger_process_id: row.trigger_process_id,
        start_attempt_no: row.start_attempt_no,
        preempt_token_hash: row.control_token_hash,
        reason_code: row.reason_code,
        requested_at: toIsoV1(row.requested_at, "control_requested_at"),
        idempotency_key: row.idempotency_key,
        trace_id: row.trace_id,
      }),
      control_type: row.signal_type,
      request_hash: row.request_hash,
      scope: Object.freeze(row.scope),
      start_fence_generation: positiveSafeIntegerV1(
        row.start_fence_generation,
        "control_start_fence_generation",
      ),
      control_valid_until: toIsoV1(
        row.control_valid_until,
        "control_valid_until",
      ),
      events: Object.freeze([]),
      outbox: Object.freeze([]),
    });
  };

  const readLeaseAuthority = async (
    runtimeRunId: string,
  ): Promise<Readonly<{ lease_id: string; owner_id: string }> | undefined> => {
    const result = await composition.postgres.query<{
      lease_id: string;
      owner_id: string;
    }>(
      `SELECT lease.lease_id, lease.owner_id
         FROM action_runtime.runtime_run_leases AS lease
        WHERE lease.runtime_run_id = $1`,
      [runtimeRunId],
    );
    return result.rows[0];
  };

  const executeOutboxAck = async (
    request: Parameters<RuntimeExecutionStoreV1["acknowledgeOutbox"]>[0],
  ): Promise<RuntimeOutboxWriterStateV1> =>
    composition.unit_of_work.withTransaction(
      {
        operation: "ack_runtime_event_outbox",
        idempotency_key: `${request.outbox_id}:${request.claim_token}:${request.outcome}`,
        trace_id: request.event_id,
        isolation: "serializable",
        retry: "serialization_failures",
      },
      async (transaction, { owner }) =>
        owner.executeWriter<
          RuntimeOutboxWriterStateV1,
          "ack_runtime_event_outbox_v1"
        >(transaction, {
          writer: "ack_runtime_event_outbox_v1",
          arguments: {
            p_outbox_id: request.outbox_id,
            p_claim_token: request.claim_token,
            p_outcome: request.outcome,
            p_next_retry_at: request.next_retry_at,
            p_error: request.error,
            p_transport_ref: request.transport_ref,
            p_transport_epoch: request.transport_epoch,
            p_transport_generation:
              request.transport_generation === null
                ? null
                : bigintArgumentV1(request.transport_generation),
            p_current_transport_epoch: request.current_transport_epoch,
            p_current_transport_generation: bigintArgumentV1(
              request.current_transport_generation,
            ),
            p_now: request.now,
          },
          expected_rows: 1,
        }),
    );

  const store: RuntimeExecutionStoreV1 & Readonly<{
    checkReadiness(signal: AbortSignal): Promise<void>;
  }> = {
    checkReadiness(signal) {
      return composition.checkReadiness(signal);
    },

    async beginStartAttempt(
      request,
      requestHash,
      actorBinding,
      actorBindingHash,
      createdAt,
    ): Promise<BeginRuntimeStartAttemptResultV1> {
      const policyCanonical = canonicalJsonV1(request.policy);
      const intentPolicyCanonical = canonicalJsonV1(
        request.intent_policy_snapshot,
      );
      const attemptId = attemptIdV1(request.runtime_run_id);
      let result: Readonly<{ outcome?: string }>;
      try {
        result = await composition.unit_of_work.withTransaction(
          {
            operation: "create_runtime_start_attempt",
            idempotency_key: request.idempotency_key,
            trace_id: request.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) =>
            owner.executeWriter<
              Readonly<{ outcome?: string }>,
              "create_runtime_start_attempt_v1"
            >(transaction, {
              writer: "create_runtime_start_attempt_v1",
              arguments: {
                p_attempt_id: attemptId,
                p_trigger_process_id: request.trigger_process_id,
                p_runtime_run_id: request.runtime_run_id,
                p_start_attempt_no: request.start_attempt_no,
                p_start_fence_generation: null,
                p_policy_input_artifact: {
                  runtime_policy_input_artifacts: {
                    policy_input_ref: request.policy_input_ref,
                    workspace_id: request.workspace_id,
                    bot_id: request.bot_id,
                    owner_agent_id: request.owner_agent_id,
                    deployment_environment: request.deployment_environment,
                    release_channel: request.release_channel,
                    expected_catalog_version: request.expected_catalog_version,
                    catalog_as_of: request.catalog_as_of,
                    policy_canonical_bytes: policyCanonical,
                    policy_input_hash: request.policy_input_hash,
                    intent_policy_snapshot_ref: request.intent_policy_snapshot_ref,
                    intent_policy_snapshot_hash: request.intent_policy_snapshot_hash,
                    intent_policy_snapshot_canonical_bytes: intentPolicyCanonical,
                    policy_created_at: request.policy.created_at,
                    policy_expires_at: request.policy.expires_at,
                    retention_until: request.policy.expires_at,
                    created_at: createdAt,
                    tool_permission_profile_ref:
                      request.intent_policy_snapshot.tool_permission_profile_ref,
                    tool_permission_profile_revision:
                      request.intent_policy_snapshot.tool_permission_profile_revision,
                    tool_permission_profile_hash:
                      request.intent_policy_snapshot.tool_permission_profile_hash,
                    tool_policy_epoch:
                      request.intent_policy_snapshot.tool_policy_epoch,
                    requested_allowed_tools: request.allowed_tools,
                  },
                  runtime_start_attempts: {
                    workspace_id: request.workspace_id,
                    bot_id: request.bot_id,
                    owner_agent_id: request.owner_agent_id,
                    deployment_environment: request.deployment_environment,
                    release_channel: request.release_channel,
                    start_fence_token_hash: request.start_fence_token_hash,
                    request_snapshot: request,
                    actor_binding: actorBinding,
                    actor_binding_hash: actorBindingHash,
                    delegated_principal_hash:
                      actorBinding.delegated_principal_hash ??
                      canonicalPayloadHashV1(null),
                    delegated_scope: actorBinding.scope,
                    delegated_scope_hash: canonicalPayloadHashV1(
                      actorBinding.scope,
                    ),
                    reservation_validation_stage: "request_received",
                    reservation_status_snapshot: "pending",
                    policy_input_ref: request.policy_input_ref,
                    policy_input_hash: request.policy_input_hash,
                    policy_input_created_at: request.policy.created_at,
                    policy_expires_at: request.policy.expires_at,
                    requested_catalog_version:
                      request.expected_catalog_version,
                    result_code: "requested",
                    created_at: createdAt,
                  },
                },
                p_idempotency_key: request.idempotency_key,
                p_request_hash: requestHash,
                p_trace_id: request.trace_id,
              },
              expected_rows: 1,
            }),
        );
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505"
        ) {
          return Object.freeze({ outcome: "conflict" });
        }
        throw error;
      }
      const attempt = await readStartAttempt(request.runtime_run_id);
      if (attempt === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      return Object.freeze({
        outcome: result.outcome === "replayed" ? "replayed" : "begun",
        attempt,
      });
    },

    readStartAttempt,

    async beginStartValidationCall(
      request,
    ): Promise<BeginRuntimeStartValidationCallResultV1> {
      const result = await composition.unit_of_work.withTransaction(
        {
          operation: "begin_runtime_start_validation_call",
          idempotency_key: request.call.validation_call_id,
          trace_id: request.call.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<
            Readonly<{ outcome?: string }>,
            "begin_runtime_start_reservation_validation_call_v1"
          >(transaction, {
            writer: "begin_runtime_start_reservation_validation_call_v1",
            arguments: {
              p_runtime_run_id: request.runtime_run_id,
              p_runtime_start_attempt_id: attemptIdV1(request.runtime_run_id),
              p_expected_start_request_hash: request.request_hash,
              p_expected_start_fence_token_hash:
                request.start_fence_token_hash,
              p_expected_actor_binding_hash: request.actor_binding_hash,
              p_validation_call_id: request.call.validation_call_id,
              p_validation_stage: request.call.validation_stage,
              p_owner_request_hash: request.call.request_hash,
              p_requested_at: request.call.requested_at,
              p_idempotency_key: request.call.validation_call_id,
              p_trace_id: request.call.trace_id,
            },
            expected_rows: 1,
          }),
      );
      const attempt = await readStartAttempt(request.runtime_run_id);
      if (attempt === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      return Object.freeze({
        outcome: result.outcome === "replayed" ? "replayed" : "prepared",
        attempt,
      });
    },

    async appendStartValidation(request) {
      await composition.unit_of_work.withTransaction(
        {
          operation: "append_runtime_start_validation",
          idempotency_key: request.fact.validation_call_id,
          trace_id: request.fact.response.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<
            unknown,
            "append_runtime_start_reservation_validation_v1"
          >(transaction, {
            writer: "append_runtime_start_reservation_validation_v1",
            arguments: {
              p_runtime_run_id: request.runtime_run_id,
              p_runtime_start_attempt_id: attemptIdV1(request.runtime_run_id),
              p_expected_start_request_hash: request.request_hash,
              p_expected_start_fence_token_hash:
                request.start_fence_token_hash,
              p_expected_actor_binding_hash: request.actor_binding_hash,
              p_validation_call_id: request.fact.validation_call_id,
              p_validation_stage: request.fact.validation_stage,
              p_owner_request_hash: request.fact.request_hash,
              p_response_source: request.fact.response_source,
              p_response_schema_version: request.fact.response_schema_version,
              p_response_hash: request.fact.response_hash,
              p_owner_response: request.fact.response,
              p_validated_at: request.fact.validated_at,
              p_idempotency_key: request.fact.validation_call_id,
              p_trace_id: request.fact.response.trace_id,
            },
            expected_rows: 1,
          }),
      );
      const attempt = await readStartAttempt(request.runtime_run_id);
      if (attempt === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      return attempt;
    },

    async terminalizeStartAttempt(request) {
      const attempt = await readStartAttempt(request.runtime_run_id);
      if (attempt === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      const successfulFact = attempt.validation_facts.find(
        (fact) => fact.response.schema_version ===
          "runtime_start_reservation_validate_response.v1",
      );
      const generation = successfulFact?.response.schema_version ===
        "runtime_start_reservation_validate_response.v1"
        ? successfulFact.response.validated_fence_generation
        : undefined;
      await composition.unit_of_work.withTransaction(
        {
          operation: "terminalize_runtime_start_attempt",
          idempotency_key: attempt.idempotency_key,
          trace_id: attempt.validation_calls.at(-1)?.trace_id ?? request.runtime_run_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "transition_runtime_start_attempt_v1">(
            transaction,
            {
              writer: "transition_runtime_start_attempt_v1",
              arguments: {
                p_attempt_id: attemptIdV1(request.runtime_run_id),
                p_runtime_run_id: request.runtime_run_id,
                p_expected_result_code: "requested",
                p_expected_start_fence_generation:
                  bigintArgumentV1(generation ?? 0),
                p_next_result_code: terminalResultCodeV1(request.failure_code),
                p_reservation_validation: {},
                p_start_transition: {
                  runtime_start_attempts: {
                    response_payload: {
                      failure_code: request.failure_code,
                    },
                    completed_at: request.terminalized_at,
                  },
                },
                p_idempotency_key: attempt.idempotency_key,
                p_request_hash: request.request_hash,
                p_trace_id:
                  attempt.validation_calls.at(-1)?.trace_id ?? request.runtime_run_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const terminal = await readStartAttempt(request.runtime_run_id);
      if (terminal === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      return terminal;
    },

    async acceptStart(
      request,
      requestHash,
      _actorBinding,
      actorBindingHash,
      response,
      skillResolutions,
      toolArgConstraints,
      permissions,
      model,
      preflightValidation,
    ): Promise<AcceptRuntimeStartResultV1> {
      const attempt = await readStartAttempt(request.runtime_run_id);
      if (attempt === undefined || attempt.actor_binding_hash !== actorBindingHash) {
        return Object.freeze({ outcome: "conflict" });
      }
      const snapshot = request.intent_policy_snapshot;
      const policySnapshot = {
        id: response.details.policy_snapshot_id,
        runtime_run_id: request.runtime_run_id,
        workspace_id: request.workspace_id,
        bot_id: request.bot_id,
        owner_agent_id: request.owner_agent_id,
        deployment_environment: request.deployment_environment,
        release_channel: request.release_channel,
        policy_input_ref: request.policy_input_ref,
        policy_input_hash: request.policy_input_hash,
        policy_input_created_at: request.policy.created_at,
        policy_input: request.policy,
        requested_catalog_version: request.expected_catalog_version,
        effective_catalog_version: response.details.effective_catalog_version,
        catalog_as_of: request.catalog_as_of,
        skill_resolution_ids: skillResolutions.map((entry) => entry.resolution_id),
        resolved_skill_digests: Object.fromEntries(
          skillResolutions.map((entry) => [entry.skill_key, entry.package_digest]),
        ),
        resolved_skills: skillResolutions,
        allowed_tools: permissions.map((entry) => entry.scope.tool_name),
        tool_scopes: Object.fromEntries(
          permissions.map((entry) => [entry.scope.tool_name, [entry.capability]]),
        ),
        resource_scopes: {},
        network_scope: {},
        filesystem_scope: {},
        timer_scope: {},
        memory_scope: {},
        expires_at: request.policy.expires_at,
        security_revocation_epoch: snapshot.security_revocation_epoch,
        revocation_policy: {
          security_revocation_epoch: snapshot.security_revocation_epoch,
        },
        policy_snapshot_hash: response.details.policy_snapshot_hash,
        created_at: preflightValidation.validated_at,
        tool_permission_profile_ref: snapshot.tool_permission_profile_ref,
        tool_permission_profile_revision: snapshot.tool_permission_profile_revision,
        tool_permission_profile_hash: snapshot.tool_permission_profile_hash,
        tool_policy_epoch: snapshot.tool_policy_epoch,
        requested_allowed_tools: request.allowed_tools,
        tool_arg_constraints: toolArgConstraints,
      };
      let writerResult: Readonly<{
        outcome?: string;
        tombstone?: RuntimeControlTombstoneV1;
      }>;
      try {
        writerResult = await composition.unit_of_work.withTransaction(
          {
            operation: "accept_runtime_start",
            idempotency_key: request.idempotency_key,
            trace_id: request.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) =>
            owner.executeWriter<
              Readonly<{
                outcome?: string;
                tombstone?: RuntimeControlTombstoneV1;
              }>,
              "transition_runtime_start_attempt_v1"
            >(transaction, {
              writer: "transition_runtime_start_attempt_v1",
              arguments: {
                p_attempt_id: attemptIdV1(request.runtime_run_id),
                p_runtime_run_id: request.runtime_run_id,
                p_expected_result_code: "requested",
                p_expected_start_fence_generation: bigintArgumentV1(
                  response.details.start_fence_generation,
                ),
                p_next_result_code: "runtime_queued",
                p_reservation_validation: {
                  runtime_start_reservation_validations: validationRowV1(
                    request.runtime_run_id,
                    attempt,
                    preflightValidation,
                  ),
                },
                p_start_transition: {
                  runtime_runs: {
                    trigger_process_id: request.trigger_process_id,
                    workspace_id: request.workspace_id,
                    bot_id: request.bot_id,
                    owner_agent_id: request.owner_agent_id,
                    deployment_environment: request.deployment_environment,
                    release_channel: request.release_channel,
                    start_attempt_no: request.start_attempt_no,
                    start_fence_generation:
                      response.details.start_fence_generation,
                    status: "queued",
                    cancellation_status: "none",
                    runtime_provider: "ClaudeAgentSdkRuntimeAdapter",
                    model,
                    intent_ref: request.intent_ref,
                    intent_version: request.intent_version,
                    structured_intent_hash: request.structured_intent_hash,
                    structured_intent: request.structured_intent,
                    context_snapshot_ref: request.context_snapshot_ref,
                    context_snapshot_version: request.context_snapshot_version,
                    context_snapshot_hash: request.context_snapshot_hash,
                    policy_snapshot_id: response.details.policy_snapshot_id,
                    policy_snapshot_hash: response.details.policy_snapshot_hash,
                    created_at: preflightValidation.validated_at,
                    updated_at: preflightValidation.validated_at,
                  },
                  runtime_policy_snapshots: policySnapshot,
                  runtime_permissions: permissions.map((permission) => ({
                    id: permission.id,
                    runtime_run_id: request.runtime_run_id,
                    policy_snapshot_id: response.details.policy_snapshot_id,
                    capability: permission.capability,
                    scope: {
                      ...permission.scope,
                      actor_binding_hash: permission.actor_binding_hash,
                    },
                    expires_at: permission.expires_at,
                    created_at: permission.created_at,
                  })),
                  runtime_start_attempts: { response_payload: response },
                },
                p_idempotency_key: request.idempotency_key,
                p_request_hash: requestHash,
                p_trace_id: request.trace_id,
              },
              expected_rows: 1,
            }),
        );
      } catch (error) {
        if (
          typeof error === "object" && error !== null && "code" in error &&
          (error.code === "23505" || error.code === "40001")
        ) {
          const replay = await readRun(request.runtime_run_id);
          return replay === undefined
            ? Object.freeze({ outcome: "conflict" })
            : Object.freeze({ outcome: "replayed", run: replay });
        }
        throw error;
      }
      if (writerResult.outcome === "fenced") {
        const tombstone = await store.findControlTombstone(request);
        if (tombstone === undefined) {
          throw new RuntimeExecutionErrorV1("runtime_adapter_failed");
        }
        return Object.freeze({ outcome: "fenced", tombstone });
      }
      const run = await readRun(request.runtime_run_id);
      if (run === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      return Object.freeze({
        outcome: writerResult.outcome === "replayed" ? "replayed" : "accepted",
        run,
      });
    },

    readRun,

    async readPolicyInputArtifact(runtimeRunId, startAttemptNo) {
      const result = await composition.postgres.query<{
        artifact: RuntimePolicyInputReadArtifactV1;
      }>(
        `SELECT jsonb_build_object(
           'schema_version', 'runtime_policy_input_read_artifact.v1',
           'policy_input_ref', policy.policy_input_ref,
           'policy_input_hash', policy.policy_input_hash,
           'trigger_process_id', policy.trigger_process_id,
           'runtime_run_id', policy.runtime_run_id,
           'start_attempt_no', policy.start_attempt_no,
           'workspace_id', policy.workspace_id,
           'bot_id', policy.bot_id,
           'owner_agent_id', policy.owner_agent_id,
           'deployment_environment', policy.deployment_environment,
           'release_channel', policy.release_channel,
           'expected_catalog_version', policy.expected_catalog_version,
           'catalog_as_of', policy.catalog_as_of,
           'intent_policy_snapshot_ref', policy.intent_policy_snapshot_ref,
           'intent_policy_snapshot_hash', policy.intent_policy_snapshot_hash,
           'intent_policy_snapshot', convert_from(policy.intent_policy_snapshot_canonical_bytes, 'UTF8')::jsonb,
           'skill_permission_summary_ref', convert_from(policy.intent_policy_snapshot_canonical_bytes, 'UTF8')::jsonb ->> 'skill_permission_summary_ref',
           'skill_permission_summary_hash', convert_from(policy.intent_policy_snapshot_canonical_bytes, 'UTF8')::jsonb ->> 'skill_permission_summary_hash',
           'policy', convert_from(policy.policy_canonical_bytes, 'UTF8')::jsonb
         ) AS artifact
         FROM action_runtime.runtime_policy_input_artifacts AS policy
         WHERE policy.runtime_run_id = $1 AND policy.start_attempt_no = $2`,
        [runtimeRunId, startAttemptNo],
      );
      return result.rows[0]?.artifact;
    },

    async readPolicyInputArtifactByReference(policyInputRef) {
      const result = await composition.postgres.query<{
        artifact: RuntimePolicyInputReadArtifactV1;
      }>(
        `SELECT jsonb_build_object(
           'schema_version', 'runtime_policy_input_read_artifact.v1',
           'policy_input_ref', policy.policy_input_ref,
           'policy_input_hash', policy.policy_input_hash,
           'trigger_process_id', policy.trigger_process_id,
           'runtime_run_id', policy.runtime_run_id,
           'start_attempt_no', policy.start_attempt_no,
           'workspace_id', policy.workspace_id,
           'bot_id', policy.bot_id,
           'owner_agent_id', policy.owner_agent_id,
           'deployment_environment', policy.deployment_environment,
           'release_channel', policy.release_channel,
           'expected_catalog_version', policy.expected_catalog_version,
           'catalog_as_of', policy.catalog_as_of,
           'intent_policy_snapshot_ref', policy.intent_policy_snapshot_ref,
           'intent_policy_snapshot_hash', policy.intent_policy_snapshot_hash,
           'intent_policy_snapshot', convert_from(policy.intent_policy_snapshot_canonical_bytes, 'UTF8')::jsonb,
           'skill_permission_summary_ref', convert_from(policy.intent_policy_snapshot_canonical_bytes, 'UTF8')::jsonb ->> 'skill_permission_summary_ref',
           'skill_permission_summary_hash', convert_from(policy.intent_policy_snapshot_canonical_bytes, 'UTF8')::jsonb ->> 'skill_permission_summary_hash',
           'policy', convert_from(policy.policy_canonical_bytes, 'UTF8')::jsonb
         ) AS artifact
         FROM action_runtime.runtime_policy_input_artifacts AS policy
         WHERE policy.policy_input_ref = $1`,
        [policyInputRef],
      );
      return result.rows[0]?.artifact;
    },

    async claimQueuedRun(request) {
      const run = await readRun(request.runtime_run_id);
      if (run === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      if (request.internal_safety !== undefined) {
        await composition.unit_of_work.withTransaction(
          {
            operation: "reject_unsafe_runtime_claim",
            idempotency_key: `${request.runtime_run_id}:${request.internal_safety.reason_code}`,
            trace_id: run.request.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) =>
            owner.executeWriter<unknown, "transition_runtime_run_v1">(
              transaction,
              {
                writer: "transition_runtime_run_v1",
                arguments: {
                  p_runtime_run_id: request.runtime_run_id,
                  p_expected_status: "queued",
                  p_expected_start_fence_generation: bigintArgumentV1(
                    request.expected_start_fence_generation,
                  ),
                  p_expected_lease_generation: "0",
                  p_next_status: "failed",
                  p_transition: {
                    runtime_runs: {
                      terminal_reason: request.internal_safety.reason_code,
                      completed_at: request.internal_safety.checked_at,
                    },
                  },
                  p_event: {},
                  p_envelope_canonical_bytes: "",
                  p_payload_hash: canonicalPayloadHashV1({}),
                  p_outbox: {},
                  p_idempotency_key: `${request.runtime_run_id}:${request.internal_safety.reason_code}`,
                  p_request_hash: canonicalPayloadHashV1(request.internal_safety),
                  p_trace_id: run.request.trace_id,
                },
                expected_rows: 1,
              },
            ),
        );
        const failed = await readRun(request.runtime_run_id);
        if (failed === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
        return failed;
      }
      const fact = request.before_running_validation;
      const event = startedEventV1(run, request.now.toISOString());
      const persisted = eventPersistenceV1(run, event);
      const attempt = await readStartAttempt(request.runtime_run_id);
      if (attempt === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      await composition.unit_of_work.withTransaction(
        {
          operation: "claim_runtime_queued_run",
          idempotency_key: event.idempotency_key,
          trace_id: run.request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) => {
          await owner.executeWriter<
            unknown,
            "append_runtime_start_reservation_validation_v1"
          >(transaction, {
            writer: "append_runtime_start_reservation_validation_v1",
            arguments: {
              p_runtime_run_id: request.runtime_run_id,
              p_runtime_start_attempt_id: attemptIdV1(request.runtime_run_id),
              p_expected_start_request_hash: attempt.request_hash,
              p_expected_start_fence_token_hash: attempt.start_fence_token_hash,
              p_expected_actor_binding_hash: attempt.actor_binding_hash,
              p_validation_call_id: fact.validation_call_id,
              p_validation_stage: fact.validation_stage,
              p_owner_request_hash: fact.request_hash,
              p_response_source: fact.response_source,
              p_response_schema_version: fact.response_schema_version,
              p_response_hash: fact.response_hash,
              p_owner_response: fact.response,
              p_validated_at: fact.validated_at,
              p_idempotency_key: fact.validation_call_id,
              p_trace_id: fact.response.trace_id,
            },
            expected_rows: 1,
          });
          await owner.executeWriter<unknown, "transition_runtime_run_v1">(
            transaction,
            {
              writer: "transition_runtime_run_v1",
              arguments: {
                p_runtime_run_id: request.runtime_run_id,
                p_expected_status: "queued",
                p_expected_start_fence_generation: bigintArgumentV1(
                  request.expected_start_fence_generation,
                ),
                p_expected_lease_generation: "0",
                p_next_status: "running",
                p_transition: {
                  runtime_run_leases: {
                    lease_id: `runtime_lease:${request.runtime_run_id}:1`,
                    lease_generation: 1,
                    owner_id: request.worker_id,
                    lease_expires_at: addSecondsV1(
                      request.now,
                      request.lease_seconds,
                    ),
                    heartbeat_at: request.now.toISOString(),
                    recovery_state: "active",
                  },
                  runtime_runs: { started_at: request.now.toISOString() },
                },
                p_event: { runtime_events: persisted.event },
                p_envelope_canonical_bytes: persisted.canonical_bytes,
                p_payload_hash: persisted.payload_hash,
                p_outbox: { runtime_event_outbox: persisted.outbox },
                p_idempotency_key: event.idempotency_key,
                p_request_hash: canonicalPayloadHashV1({
                  runtime_run_id: request.runtime_run_id,
                  worker_id: request.worker_id,
                  generation: 1,
                }),
                p_trace_id: run.request.trace_id,
              },
              expected_rows: 1,
            },
          );
        },
      );
      const claimed = await readRun(request.runtime_run_id);
      if (claimed === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      return claimed;
    },

    async heartbeat(request): Promise<RuntimeLeaseV1> {
      const run = await readRun(request.runtime_run_id);
      if (run?.lease === undefined) {
        throw new RuntimeExecutionErrorV1("stale_lease_generation");
      }
      const lease = run.lease;
      await composition.unit_of_work.withTransaction(
        {
          operation: "heartbeat_runtime_run",
          idempotency_key: `${request.runtime_run_id}:heartbeat:${request.lease_generation}:${request.now.toISOString()}`,
          trace_id: run.request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "cas_runtime_run_lease_v1">(
            transaction,
            {
              writer: "cas_runtime_run_lease_v1",
              arguments: {
                p_runtime_run_id: request.runtime_run_id,
                p_expected_start_fence_generation: bigintArgumentV1(
                  run.start_fence_generation,
                ),
                p_expected_lease_generation: bigintArgumentV1(
                  request.lease_generation,
                ),
                p_next_lease_generation: bigintArgumentV1(
                  request.lease_generation,
                ),
                p_expected_recovery_state: lease.recovery_state,
                p_next_recovery_state: "active",
                p_lease_id: `runtime_lease:${request.runtime_run_id}:${request.lease_generation}`,
                p_owner_id: request.worker_id,
                p_lease_expires_at: addSecondsV1(
                  request.now,
                  request.lease_seconds,
                ),
                p_now: request.now.toISOString(),
                p_request_hash: canonicalPayloadHashV1(request),
                p_trace_id: run.request.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const updated = await readRun(request.runtime_run_id);
      if (updated?.lease === undefined) {
        throw new RuntimeExecutionErrorV1("stale_lease_generation");
      }
      return updated.lease;
    },

    async appendEvent(request) {
      const run = await readRun(request.runtime_run_id);
      if (run === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      const persisted = eventPersistenceV1(run, request.event);
      const nextStatus = request.next_status;
      await composition.unit_of_work.withTransaction(
        {
          operation: "append_runtime_event",
          idempotency_key: request.event.idempotency_key,
          trace_id: request.event.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) => {
          if (nextStatus === undefined) {
            await owner.executeWriter<unknown, "append_runtime_event_v1">(
              transaction,
              {
                writer: "append_runtime_event_v1",
                arguments: {
                  p_runtime_run_id: request.runtime_run_id,
                  p_expected_start_fence_generation: bigintArgumentV1(
                    run.start_fence_generation,
                  ),
                  p_expected_lease_generation: bigintArgumentV1(
                    request.lease_generation,
                  ),
                  p_event: { runtime_events: persisted.event },
                  p_envelope_canonical_bytes: persisted.canonical_bytes,
                  p_payload_ref: `runtime_event:${request.event.event_id}`,
                  p_payload_hash: persisted.payload_hash,
                  p_retention_until: run.request.policy.expires_at,
                  p_redaction_state: "not_required",
                  p_outbox: { runtime_event_outbox: persisted.outbox },
                  p_idempotency_key: request.event.idempotency_key,
                  p_trace_id: request.event.trace_id,
                },
                expected_rows: 1,
              },
            );
            return;
          }
          await owner.executeWriter<unknown, "transition_runtime_run_v1">(
            transaction,
            {
              writer: "transition_runtime_run_v1",
              arguments: {
                p_runtime_run_id: request.runtime_run_id,
                p_expected_status: run.status,
                p_expected_start_fence_generation: bigintArgumentV1(
                  run.start_fence_generation,
                ),
                p_expected_lease_generation: bigintArgumentV1(
                  request.lease_generation,
                ),
                p_next_status: nextStatus,
                p_transition: {
                  runtime_runs: {
                    ...(request.terminal_reason === undefined
                      ? {}
                      : { terminal_reason: request.terminal_reason }),
                  },
                },
                p_event: { runtime_events: persisted.event },
                p_envelope_canonical_bytes: persisted.canonical_bytes,
                p_payload_hash: persisted.payload_hash,
                p_outbox: { runtime_event_outbox: persisted.outbox },
                p_idempotency_key: request.event.idempotency_key,
                p_request_hash: persisted.payload_hash,
                p_trace_id: request.event.trace_id,
              },
              expected_rows: 1,
            },
          );
        },
      );
      const updated = await readRun(request.runtime_run_id);
      if (updated === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      return updated;
    },

    async reserveArtifact(request) {
      const contentHash = `sha256:${createHash("sha256")
        .update(request.artifact.body)
        .digest("hex")}`;
      if (contentHash !== request.artifact.expected_sha256) {
        throw new RuntimeExecutionErrorV1("stale_lease_generation");
      }
      const run = await readRun(request.runtime_run_id);
      if (run === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      const existing = await readArtifact(
        request.runtime_run_id,
        request.artifact.artifact_id,
      );
      if (existing !== undefined) {
        if (
          existing.request_hash !== request.request_hash ||
          existing.start_fence_generation !==
            request.expected_start_fence_generation ||
          existing.originating_lease_generation !== request.lease_generation ||
          existing.object_store_idempotency_key !==
            request.object_store_idempotency_key ||
          existing.artifact_kind !== request.artifact.artifact_kind ||
          existing.media_type !== request.artifact.media_type ||
          existing.content_hash !== request.artifact.expected_sha256 ||
          existing.size_bytes !== request.artifact.body.byteLength ||
          existing.retention_until !==
            toIsoV1(request.artifact.retention_until, "artifact_retention_until")
        ) {
          throw new RuntimeExecutionErrorV1("idempotency_conflict");
        }
        return Object.freeze({ artifact: existing, replayed: true });
      }
      await composition.unit_of_work.withTransaction(
        {
          operation: "record_runtime_artifact",
          idempotency_key: request.object_store_idempotency_key,
          trace_id: run.request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<
            Readonly<{ outcome?: string }>,
            "record_runtime_artifact_v1"
          >(transaction, {
            writer: "record_runtime_artifact_v1",
            arguments: {
              p_artifact_id: request.artifact.artifact_id,
              p_runtime_run_id: request.runtime_run_id,
              p_expected_start_fence_generation: bigintArgumentV1(
                request.expected_start_fence_generation,
              ),
              p_expected_lease_generation: bigintArgumentV1(
                request.lease_generation,
              ),
              p_artifact_record: {
                runtime_artifacts: {
                  id: request.artifact.artifact_id,
                  runtime_run_id: request.runtime_run_id,
                  bot_id: run.request.bot_id,
                  owner_agent_id: run.request.owner_agent_id,
                  artifact_type: request.artifact.artifact_kind,
                  status: "creating",
                  content_hash: request.artifact.expected_sha256,
                  size_bytes: request.artifact.body.byteLength,
                  media_type: request.artifact.media_type,
                  retention_until: request.artifact.retention_until,
                  metadata: {
                    start_fence_generation:
                      request.expected_start_fence_generation,
                    originating_lease_generation: request.lease_generation,
                    reconciliation_generation: 0,
                    object_store_idempotency_key:
                      request.object_store_idempotency_key,
                    request_hash: request.request_hash,
                  },
                  originating_lease_generation: request.lease_generation,
                  reconciliation_generation: 0,
                  created_at: request.created_at,
                  updated_at: request.created_at,
                },
              },
              p_idempotency_key: request.object_store_idempotency_key,
              p_request_hash: request.request_hash,
              p_trace_id: run.request.trace_id,
            },
            expected_rows: 1,
          }),
      );
      const artifact = await readArtifact(
        request.runtime_run_id,
        request.artifact.artifact_id,
      );
      if (artifact === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_adapter_failed");
      }
      return Object.freeze({ artifact, replayed: false });
    },

    async finalizeArtifact(request) {
      const run = await readRun(request.runtime_run_id);
      const artifact = await readArtifact(
        request.runtime_run_id,
        request.artifact_id,
      );
      if (run === undefined || artifact === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      const persisted = eventPersistenceV1(run, request.event);
      const result = {
        runtime_artifacts: {
          ...(request.artifact_ref === undefined
            ? {}
            : { artifact_ref: request.artifact_ref }),
          ...(request.failure_code === undefined
            ? {}
            : { failure_code: request.failure_code }),
          redaction_status: "complete",
          updated_at: request.finalized_at,
        },
      };
      if (request.lease_generation !== undefined) {
        const leaseGeneration = request.lease_generation;
        await composition.unit_of_work.withTransaction(
          {
            operation: "finalize_runtime_artifact",
            idempotency_key: request.event.idempotency_key,
            trace_id: request.event.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) =>
            owner.executeWriter<unknown, "finalize_runtime_artifact_v1">(
              transaction,
              {
                writer: "finalize_runtime_artifact_v1",
                arguments: {
                  p_artifact_id: request.artifact_id,
                  p_runtime_run_id: request.runtime_run_id,
                  p_expected_status: request.expected_status,
                  p_expected_start_fence_generation: bigintArgumentV1(
                    request.expected_start_fence_generation,
                  ),
                  p_expected_lease_generation: bigintArgumentV1(
                    leaseGeneration,
                  ),
                  p_terminal_status: request.terminal_status,
                  p_artifact_result: result,
                  p_event: { runtime_events: persisted.event },
                  p_envelope_canonical_bytes: persisted.canonical_bytes,
                  p_payload_hash: persisted.payload_hash,
                  p_outbox: { runtime_event_outbox: persisted.outbox },
                  p_idempotency_key: request.event.idempotency_key,
                  p_request_hash: request.request_hash,
                  p_trace_id: request.event.trace_id,
                },
                expected_rows: 1,
              },
            ),
        );
      } else {
        if (
          request.reconciliation_owner === undefined ||
          request.reconciliation_generation === undefined ||
          (artifact.status === "creating" &&
            artifact.reconciliation_expires_at === undefined)
        ) {
          throw new RuntimeExecutionErrorV1("stale_lease_generation");
        }
        const reconciliationOwner = request.reconciliation_owner;
        const reconciliationGeneration = request.reconciliation_generation;
        const reconciliationLockedUntil =
          artifact.reconciliation_expires_at ?? request.finalized_at;
        await composition.unit_of_work.withTransaction(
          {
            operation: "reconcile_runtime_artifact",
            idempotency_key: request.event.idempotency_key,
            trace_id: request.event.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) =>
            owner.executeWriter<unknown, "reconcile_runtime_artifact_v1">(
              transaction,
              {
                writer: "reconcile_runtime_artifact_v1",
                arguments: {
                  p_artifact_id: request.artifact_id,
                  p_runtime_run_id: request.runtime_run_id,
                  p_expected_status: request.expected_status,
                  p_expected_start_fence_generation: bigintArgumentV1(
                    request.expected_start_fence_generation,
                  ),
                  p_expected_originating_lease_generation: bigintArgumentV1(
                    artifact.originating_lease_generation,
                  ),
                  p_reconciliation_owner: reconciliationOwner,
                  p_expected_reconciliation_generation: bigintArgumentV1(
                    reconciliationGeneration,
                  ),
                  p_reconciliation_locked_until:
                    reconciliationLockedUntil,
                  p_now: request.finalized_at,
                  p_terminal_status: request.terminal_status,
                  p_artifact_result: result,
                  p_event: { runtime_events: persisted.event },
                  p_envelope_canonical_bytes: persisted.canonical_bytes,
                  p_payload_hash: persisted.payload_hash,
                  p_outbox: { runtime_event_outbox: persisted.outbox },
                  p_idempotency_key: request.event.idempotency_key,
                  p_request_hash: request.request_hash,
                  p_trace_id: request.event.trace_id,
                },
                expected_rows: 1,
              },
            ),
        );
      }
      const updated = await readRun(request.runtime_run_id);
      if (updated === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      return updated;
    },

    async claimPendingArtifacts(request) {
      const rows = await composition.unit_of_work.withTransaction(
        {
          operation: "claim_runtime_artifact_reconciliation",
          idempotency_key: `${request.worker_id}:${request.now}`,
          trace_id: request.worker_id,
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<
            readonly Readonly<{ id?: unknown; runtime_run_id?: unknown }>[],
            "claim_runtime_artifact_reconciliation_v1"
          >(transaction, {
            writer: "claim_runtime_artifact_reconciliation_v1",
            arguments: {
              p_worker_id: request.worker_id,
              p_limit: request.limit,
              p_lease_seconds: request.lease_seconds,
              p_now: request.now,
            },
            expected_rows: "zero_or_more",
          }),
      );
      const claimed: RuntimeArtifactRecordV1[] = [];
      for (const row of rows) {
        if (typeof row.id !== "string" || typeof row.runtime_run_id !== "string") {
          throw new RuntimeExecutionErrorV1("runtime_adapter_failed");
        }
        const artifact = await readArtifact(row.runtime_run_id, row.id);
        if (artifact === undefined) {
          throw new RuntimeExecutionErrorV1("runtime_adapter_failed");
        }
        claimed.push(artifact);
      }
      return Object.freeze(claimed);
    },
    readArtifact,
    async recordToolRequested(request) {
      const run = await readRun(request.runtime_run_id);
      if (run === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      const persisted = eventPersistenceV1(run, request.event);
      await composition.unit_of_work.withTransaction(
        {
          operation: "record_runtime_tool_request",
          idempotency_key: request.event.idempotency_key,
          trace_id: request.event.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "record_tool_invocation_v1">(
            transaction,
            {
              writer: "record_tool_invocation_v1",
              arguments: {
                p_tool_invocation_id: request.audit.tool_invocation_id,
                p_runtime_run_id: request.runtime_run_id,
                p_expected_start_fence_generation: bigintArgumentV1(
                  run.start_fence_generation,
                ),
                p_expected_lease_generation: bigintArgumentV1(
                  request.lease_generation,
                ),
                p_invocation_record: {
                  tool_invocations: {
                    adapter_tool_call_id: request.audit.tool_invocation_id,
                    tool_name: request.audit.tool_name,
                    status: "requested",
                    normalized_args_hash: request.audit.normalized_args_hash,
                    input: { runtime_tool_audit: request.audit },
                    side_effect_status: "none",
                    downstream_idempotency_key:
                      request.audit.downstream_idempotency_key,
                  },
                },
                p_event: { runtime_events: persisted.event },
                p_envelope_canonical_bytes: persisted.canonical_bytes,
                p_payload_hash: persisted.payload_hash,
                p_outbox: { runtime_event_outbox: persisted.outbox },
                p_idempotency_key: request.event.idempotency_key,
                p_request_hash: request.audit.request_hash,
                p_trace_id: request.event.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const updated = await readRun(request.runtime_run_id);
      if (updated === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      return updated;
    },

    async markToolRunning(request) {
      const run = await readRun(request.runtime_run_id);
      const audit = run?.tools.find(
        ({ tool_invocation_id: id }) => id === request.tool_invocation_id,
      );
      if (run === undefined || audit === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      await composition.unit_of_work.withTransaction(
        {
          operation: "mark_runtime_tool_running",
          idempotency_key: `${request.runtime_run_id}:tool:${request.tool_invocation_id}:running`,
          trace_id: run.request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "mark_tool_invocation_running_v1">(
            transaction,
            {
              writer: "mark_tool_invocation_running_v1",
              arguments: {
                p_tool_invocation_id: request.tool_invocation_id,
                p_runtime_run_id: request.runtime_run_id,
                p_expected_status: audit.status === "running" ? "running" : "requested",
                p_expected_side_effect_status: audit.side_effect_status,
                p_expected_start_fence_generation: bigintArgumentV1(
                  run.start_fence_generation,
                ),
                p_expected_lease_generation: bigintArgumentV1(
                  request.lease_generation,
                ),
                p_request_hash: audit.request_hash,
                p_trace_id: run.request.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
    },

    async recordToolResult(request) {
      const run = await readRun(request.runtime_run_id);
      const audit = run?.tools.find(
        ({ tool_invocation_id: id }) => id === request.tool_invocation_id,
      );
      if (run === undefined || audit === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      const persisted = eventPersistenceV1(run, request.event);
      await composition.unit_of_work.withTransaction(
        {
          operation: "finalize_runtime_tool_invocation",
          idempotency_key: request.event.idempotency_key,
          trace_id: request.event.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "finalize_tool_invocation_v1">(
            transaction,
            {
              writer: "finalize_tool_invocation_v1",
              arguments: {
                p_tool_invocation_id: request.tool_invocation_id,
                p_runtime_run_id: request.runtime_run_id,
                p_expected_status: "running",
                p_expected_side_effect_status: "none",
                p_expected_start_fence_generation: bigintArgumentV1(
                  run.start_fence_generation,
                ),
                p_expected_lease_generation: bigintArgumentV1(
                  request.lease_generation,
                ),
                p_terminal_status: request.result.outcome,
                p_invocation_result: {
                  ...request.result,
                  ...(request.result.outcome === "completed"
                    ? { output: { runtime_tool_result: request.result } }
                    : {}),
                  downstream_idempotency_key:
                    audit.downstream_idempotency_key,
                },
                p_event: persisted.event,
                p_envelope_canonical_bytes: persisted.canonical_bytes,
                p_payload_hash: persisted.payload_hash,
                p_outbox: persisted.outbox,
                p_idempotency_key: request.event.idempotency_key,
                p_request_hash: audit.request_hash,
                p_trace_id: request.event.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const updated = await readRun(request.runtime_run_id);
      if (updated === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      return updated;
    },
    async freezeUnknownSideEffect(request) {
      const run = await readRun(request.runtime_run_id);
      const audit = run?.tools.find(
        ({ tool_invocation_id: id }) => id === request.tool_invocation_id,
      );
      if (run === undefined || audit === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      const toolPersistence = eventBatchPersistenceV1(run, request.event);
      const terminalPersistence = eventBatchPersistenceV1(
        run,
        request.terminal_event,
      );
      await composition.unit_of_work.withTransaction(
        {
          operation: "freeze_unknown_runtime_tool_side_effect",
          idempotency_key: `${request.tool_invocation_id}:freeze`,
          trace_id: request.event.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "freeze_unknown_tool_side_effect_v1">(
            transaction,
            {
              writer: "freeze_unknown_tool_side_effect_v1",
              arguments: {
                p_tool_invocation_id: request.tool_invocation_id,
                p_runtime_run_id: request.runtime_run_id,
                p_expected_status: "running",
                p_expected_side_effect_status: "none",
                p_expected_start_fence_generation: bigintArgumentV1(
                  run.start_fence_generation,
                ),
                p_expected_lease_generation: bigintArgumentV1(
                  request.lease_generation,
                ),
                p_invocation_failure: {
                  result: request.result,
                  output_ref: request.output_ref,
                },
                p_event_batch: [
                  toolPersistence.event,
                  terminalPersistence.event,
                ],
                p_outbox_batch: [
                  toolPersistence.outbox,
                  terminalPersistence.outbox,
                ],
                p_idempotency_key: `${request.tool_invocation_id}:freeze`,
                p_request_hash: audit.request_hash,
                p_trace_id: request.event.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const updated = await readRun(request.runtime_run_id);
      if (updated === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      return updated;
    },

    async cancelUndispatchedTool(request) {
      const run = await readRun(request.runtime_run_id);
      const audit = run?.tools.find(
        ({ tool_invocation_id: id }) => id === request.tool_invocation_id,
      );
      if (run === undefined || audit === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      if (
        audit.status !== "requested" ||
        audit.side_effect_status !== "none" ||
        audit.lease_generation >= request.lease_generation
      ) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      const persisted = eventPersistenceV1(run, request.event);
      await composition.unit_of_work.withTransaction(
        {
          operation: "cancel_undispatched_runtime_tool",
          idempotency_key: request.event.idempotency_key,
          trace_id: request.event.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "finalize_tool_invocation_v1">(
            transaction,
            {
              writer: "finalize_tool_invocation_v1",
              arguments: {
                p_tool_invocation_id: request.tool_invocation_id,
                p_runtime_run_id: request.runtime_run_id,
                p_expected_status: "requested",
                p_expected_side_effect_status: "none",
                p_expected_start_fence_generation: bigintArgumentV1(
                  run.start_fence_generation,
                ),
                p_expected_lease_generation: bigintArgumentV1(
                  request.lease_generation,
                ),
                p_terminal_status: "cancelled",
                p_invocation_result: {
                  side_effect_status: "none",
                  downstream_idempotency_key:
                    audit.downstream_idempotency_key,
                },
                p_event: persisted.event,
                p_envelope_canonical_bytes: persisted.canonical_bytes,
                p_payload_hash: persisted.payload_hash,
                p_outbox: persisted.outbox,
                p_idempotency_key: request.event.idempotency_key,
                p_request_hash: audit.request_hash,
                p_trace_id: request.event.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const updated = await readRun(request.runtime_run_id);
      if (updated === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      return updated;
    },
    async reconcileUnknownTool(request) {
      const reconciliation = request.reconciliation;
      const run = await readRun(reconciliation.runtime_run_id);
      const audit = run?.tools.find(
        ({ tool_invocation_id: id }) =>
          id === reconciliation.tool_invocation_id,
      );
      if (run === undefined || audit === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      if (audit.reconciliation_idempotency_key !== undefined) {
        if (
          audit.reconciliation_idempotency_key ===
            reconciliation.idempotency_key &&
          audit.reconciliation_request_hash ===
            request.reconciliation_request_hash
        ) {
          return Object.freeze({ audit, replayed: true });
        }
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      const event = reconciledToolEventV1(
        run,
        audit,
        reconciliation.result,
        reconciliation.idempotency_key,
        reconciliation.trace_id,
        request.reconciled_at,
      );
      const persisted = eventPersistenceV1(run, event);
      const writerResult = await composition.unit_of_work.withTransaction(
        {
          operation: "reconcile_runtime_tool_invocation",
          idempotency_key: reconciliation.idempotency_key,
          trace_id: reconciliation.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<
            Readonly<{ outcome?: string }>,
            "reconcile_tool_invocation_v1"
          >(transaction, {
            writer: "reconcile_tool_invocation_v1",
            arguments: {
              p_tool_invocation_id: reconciliation.tool_invocation_id,
              p_runtime_run_id: reconciliation.runtime_run_id,
              p_expected_status: "failed",
              p_expected_side_effect_status: "unknown",
              p_expected_start_fence_generation: bigintArgumentV1(
                reconciliation.expected_start_fence_generation,
              ),
              p_expected_invocation_lease_generation: bigintArgumentV1(
                reconciliation.expected_invocation_lease_generation,
              ),
              p_expected_request_hash: reconciliation.expected_request_hash,
              p_expected_downstream_idempotency_key:
                reconciliation.expected_downstream_idempotency_key,
              p_reconciliation_result: {
                result: reconciliation.result,
                evidence_ref: reconciliation.evidence_ref,
                reconciled_at: request.reconciled_at,
                reconciliation_request_hash:
                  request.reconciliation_request_hash,
              },
              p_event: persisted.event,
              p_envelope_canonical_bytes: persisted.canonical_bytes,
              p_payload_hash: persisted.payload_hash,
              p_outbox: persisted.outbox,
              p_idempotency_key: reconciliation.idempotency_key,
              p_trace_id: reconciliation.trace_id,
            },
            expected_rows: 1,
          }),
      );
      const updated = await readRun(reconciliation.runtime_run_id);
      const reconciledAudit = updated?.tools.find(
        ({ tool_invocation_id: id }) =>
          id === reconciliation.tool_invocation_id,
      );
      if (reconciledAudit === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      return Object.freeze({
        audit: reconciledAudit,
        replayed: writerResult.outcome === "replayed",
      });
    },
    async receiveControl(request, requestHash, controlType, verification) {
      const before = await readRun(request.runtime_run_id);
      if (before === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      const replayed = before.controls.some(
        ({ request: current, request_hash: currentHash }) =>
          current.runtime_signal_id === request.runtime_signal_id &&
          currentHash === requestHash,
      );
      const targetLeaseGeneration = before.lease?.generation ?? null;
      const controlPreview: RuntimeControlRecordV1 = Object.freeze({
        request,
        control_type: controlType,
        requested_by: "trigger_processor",
        control_valid_until: verification.control_valid_until,
        target_lease_generation: targetLeaseGeneration,
        request_hash: requestHash,
        status: "received",
      });
      const receivedPersistence =
        before.lease !== undefined &&
        ["running", "preempt_requested", "cancelling"].includes(before.status)
          ? eventPersistenceV1(
              before,
              controlReceivedEventFor(
                before,
                controlPreview,
                request.requested_at,
              ),
            )
          : undefined;
      await composition.unit_of_work.withTransaction(
        {
          operation: "record_runtime_control_signal",
          idempotency_key: request.idempotency_key,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "record_runtime_control_signal_v1">(
            transaction,
            {
              writer: "record_runtime_control_signal_v1",
              arguments: {
                p_runtime_signal_id: request.runtime_signal_id,
                p_runtime_run_id: request.runtime_run_id,
                p_trigger_process_id: request.trigger_process_id,
                p_start_attempt_no: request.start_attempt_no,
                p_expected_start_fence_generation: bigintArgumentV1(
                  verification.start_fence_generation,
                ),
                p_request_source: "trigger_processor",
                p_verified_control_claims: verification,
                p_policy_checkpoint: null,
                p_signal_request: {
                  runtime_control_signals: {
                    runtime_signal_id: request.runtime_signal_id,
                    trigger_process_id: request.trigger_process_id,
                    runtime_run_id: request.runtime_run_id,
                    start_attempt_no: request.start_attempt_no,
                    start_fence_generation:
                      verification.start_fence_generation,
                    signal_type: controlType,
                    idempotency_key: request.idempotency_key,
                    request_hash: requestHash,
                    requested_by: "trigger_processor",
                    reason_code: request.reason_code,
                    control_token_hash: request.preempt_token_hash,
                    control_valid_until: verification.control_valid_until,
                    status: "received",
                    target_lease_generation: targetLeaseGeneration,
                    trace_id: request.trace_id,
                    requested_at: request.requested_at,
                    created_at: request.requested_at,
                    updated_at: request.requested_at,
                  },
                  runtime_runs: {
                    status:
                      controlType === "preempt"
                        ? "preempt_requested"
                        : "cancelling",
                  },
                },
                p_event:
                  receivedPersistence === undefined
                    ? null
                    : { runtime_events: receivedPersistence.event },
                p_envelope_canonical_bytes:
                  receivedPersistence?.canonical_bytes ?? null,
                p_payload_hash: receivedPersistence?.payload_hash ?? null,
                p_outbox:
                  receivedPersistence === undefined
                    ? null
                    : {
                        runtime_event_outbox: receivedPersistence.outbox,
                      },
                p_idempotency_key: request.idempotency_key,
                p_request_hash: requestHash,
                p_trace_id: request.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const run = await readRun(request.runtime_run_id);
      const control = run?.controls.find(
        ({ request: current }) =>
          current.runtime_signal_id === request.runtime_signal_id,
      );
      if (run === undefined || control === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_adapter_failed");
      }
      return Object.freeze({ control, run, replayed });
    },

    async receiveInternalControl(request) {
      const run = await readRun(request.runtime_run_id);
      if (run === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      const suffix =
        request.reason_code === "security_revocation_epoch_advanced"
          ? `:${request.current_security_revocation_epoch}`
          : "";
      const runtimeSignalId =
        `${request.runtime_run_id}:internal:${request.reason_code}${suffix}`;
      const idempotencyKey =
        `${request.runtime_run_id}:control:${request.reason_code}${suffix}`;
      const storedRequest = Object.freeze({
        schema_version: "runtime_cancel.v1" as const,
        runtime_signal_id: runtimeSignalId,
        runtime_run_id: request.runtime_run_id,
        trigger_process_id: run.request.trigger_process_id,
        start_attempt_no: run.request.start_attempt_no,
        preempt_token_hash: run.request.preempt_token_hash,
        reason_code: request.reason_code,
        requested_at: request.requested_at,
        idempotency_key: idempotencyKey,
        trace_id: request.trace_id,
      });
      const requestHash = canonicalPayloadHashV1({
        schema_version: "runtime_internal_control.v1",
        runtime_run_id: request.runtime_run_id,
        trigger_process_id: run.request.trigger_process_id,
        start_attempt_no: run.request.start_attempt_no,
        start_fence_generation: request.expected_start_fence_generation,
        target_lease_generation: request.expected_lease_generation,
        reason_code: request.reason_code,
        current_security_revocation_epoch:
          request.current_security_revocation_epoch,
        idempotency_key: idempotencyKey,
      });
      const replayed = run.controls.some(
        ({ request: current, request_hash: currentHash }) =>
          current.runtime_signal_id === runtimeSignalId &&
          currentHash === requestHash,
      );
      const controlValidUntil = addSecondsV1(
        new Date(request.requested_at),
        15 * 60,
      );
      const controlPreview: RuntimeControlRecordV1 = Object.freeze({
        request: storedRequest,
        control_type: "cancel",
        requested_by: "action_runtime",
        control_valid_until: controlValidUntil,
        target_lease_generation: request.expected_lease_generation,
        request_hash: requestHash,
        status: "received",
      });
      const receivedPersistence = eventPersistenceV1(
        run,
        controlReceivedEventFor(
          run,
          controlPreview,
          request.requested_at,
        ),
      );
      await composition.unit_of_work.withTransaction(
        {
          operation: "record_internal_runtime_control",
          idempotency_key: idempotencyKey,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "record_runtime_control_signal_v1">(
            transaction,
            {
              writer: "record_runtime_control_signal_v1",
              arguments: {
                p_runtime_signal_id: runtimeSignalId,
                p_runtime_run_id: request.runtime_run_id,
                p_trigger_process_id: run.request.trigger_process_id,
                p_start_attempt_no: run.request.start_attempt_no,
                p_expected_start_fence_generation: bigintArgumentV1(
                  request.expected_start_fence_generation,
                ),
                p_request_source: "action_runtime",
                p_verified_control_claims: null,
                p_policy_checkpoint: {
                  reason_code: request.reason_code,
                  current_security_revocation_epoch:
                    request.current_security_revocation_epoch,
                },
                p_signal_request: {
                  runtime_control_signals: {
                    runtime_signal_id: runtimeSignalId,
                    trigger_process_id: run.request.trigger_process_id,
                    runtime_run_id: request.runtime_run_id,
                    start_attempt_no: run.request.start_attempt_no,
                    start_fence_generation:
                      request.expected_start_fence_generation,
                    signal_type: "cancel",
                    idempotency_key: idempotencyKey,
                    request_hash: requestHash,
                    requested_by: "action_runtime",
                    reason_code: request.reason_code,
                    control_token_hash: run.request.preempt_token_hash,
                    control_valid_until: controlValidUntil,
                    status: "received",
                    target_lease_generation:
                      request.expected_lease_generation,
                    trace_id: request.trace_id,
                    requested_at: request.requested_at,
                    created_at: request.requested_at,
                    updated_at: request.requested_at,
                  },
                  runtime_runs: { status: "cancelling" },
                },
                p_event: { runtime_events: receivedPersistence.event },
                p_envelope_canonical_bytes:
                  receivedPersistence.canonical_bytes,
                p_payload_hash: receivedPersistence.payload_hash,
                p_outbox: {
                  runtime_event_outbox: receivedPersistence.outbox,
                },
                p_idempotency_key: idempotencyKey,
                p_request_hash: requestHash,
                p_trace_id: request.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const updated = await readRun(request.runtime_run_id);
      const control = updated?.controls.find(
        ({ request: current }) => current.runtime_signal_id === runtimeSignalId,
      );
      if (updated === undefined || control === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_adapter_failed");
      }
      return Object.freeze({ control, run: updated, replayed });
    },

    async receiveControlTombstone(
      principal,
      request,
      requestHash,
      controlType,
      verification,
    ) {
      if ((await readRun(request.runtime_run_id)) !== undefined) {
        return Object.freeze({
          outcome: "attached" as const,
          ...(await store.receiveControl(
            request,
            requestHash,
            controlType,
            verification,
          )),
        });
      }
      const before = await readControlTombstone(request.runtime_signal_id);
      await composition.unit_of_work.withTransaction(
        {
          operation: "record_runtime_control_tombstone",
          idempotency_key: request.idempotency_key,
          trace_id: request.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "record_runtime_control_signal_v1">(
            transaction,
            {
              writer: "record_runtime_control_signal_v1",
              arguments: {
                p_runtime_signal_id: request.runtime_signal_id,
                p_runtime_run_id: request.runtime_run_id,
                p_trigger_process_id: request.trigger_process_id,
                p_start_attempt_no: request.start_attempt_no,
                p_expected_start_fence_generation: bigintArgumentV1(
                  verification.start_fence_generation,
                ),
                p_request_source: "trigger_processor",
                p_verified_control_claims: verification,
                p_policy_checkpoint: null,
                p_signal_request: {
                  runtime_control_tombstones: {
                    runtime_run_id: request.runtime_run_id,
                    trigger_process_id: request.trigger_process_id,
                    start_attempt_no: request.start_attempt_no,
                    start_fence_generation:
                      verification.start_fence_generation,
                    signal_type: controlType,
                    runtime_signal_id: request.runtime_signal_id,
                    idempotency_key: request.idempotency_key,
                    request_hash: requestHash,
                    control_token_hash: request.preempt_token_hash,
                    control_valid_until: verification.control_valid_until,
                    reason_code: request.reason_code,
                    scope: principal.scope,
                    status: "no_run_tombstoned",
                    trace_id: request.trace_id,
                    requested_at: request.requested_at,
                    created_at: request.requested_at,
                    updated_at: request.requested_at,
                  },
                },
                p_event: null,
                p_envelope_canonical_bytes: null,
                p_payload_hash: null,
                p_outbox: null,
                p_idempotency_key: request.idempotency_key,
                p_request_hash: requestHash,
                p_trace_id: request.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const tombstone = await readControlTombstone(request.runtime_signal_id);
      if (tombstone === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_adapter_failed");
      }
      return Object.freeze({
        outcome: "tombstoned" as const,
        tombstone,
        replayed: before !== undefined,
      });
    },

    async findControlTombstone(request) {
      const result = await composition.postgres.query<{ runtime_signal_id: string }>(
        `SELECT tombstone.runtime_signal_id
           FROM action_runtime.runtime_control_tombstones AS tombstone
          WHERE tombstone.runtime_run_id = $1
            AND tombstone.trigger_process_id = $2
            AND tombstone.start_attempt_no = $3
            AND tombstone.control_token_hash = $4
            AND tombstone.control_valid_until = $5
            AND tombstone.control_valid_until >= clock_timestamp()
            AND tombstone.scope ->> 'workspace_id' = $6
            AND tombstone.scope ->> 'bot_id' = $7
            AND tombstone.scope ->> 'owner_agent_id' = $8
            AND tombstone.scope ->> 'deployment_environment' = $9
            AND tombstone.scope ->> 'release_channel' = $10
            AND tombstone.status IN ('received', 'no_run_tombstoned')
          ORDER BY tombstone.created_at, tombstone.runtime_signal_id
          LIMIT 1`,
        [
          request.runtime_run_id,
          request.trigger_process_id,
          request.start_attempt_no,
          request.preempt_token_hash,
          addSecondsV1(new Date(request.policy.expires_at), 15 * 60),
          request.workspace_id,
          request.bot_id,
          request.owner_agent_id,
          request.deployment_environment,
          request.release_channel,
        ],
      );
      const runtimeSignalId = result.rows[0]?.runtime_signal_id;
      return runtimeSignalId === undefined
        ? undefined
        : readControlTombstone(runtimeSignalId);
    },

    async pendingControl(runtimeRunId, leaseGeneration) {
      const run = await readRun(runtimeRunId);
      if (
        run === undefined ||
        run.lease?.generation !== leaseGeneration ||
        run.lease.recovery_state !== "active" ||
        Date.parse(run.lease.expires_at) <= Date.now()
      ) {
        throw new RuntimeExecutionErrorV1("stale_lease_generation");
      }
      return run.controls.find(({ status }) => status === "received");
    },
    async handleControl(request) {
      const run = await readRun(request.runtime_run_id);
      const control = run?.controls.find(
        ({ request: current }) =>
          current.runtime_signal_id === request.runtime_signal_id,
      );
      const leaseAuthority = await readLeaseAuthority(request.runtime_run_id);
      if (run === undefined || control === undefined || leaseAuthority === undefined) {
        throw new RuntimeExecutionErrorV1("runtime_not_found");
      }
      const handledPersistence = eventBatchPersistenceV1(
        run,
        request.handled_event,
      );
      const terminalPersistence = eventBatchPersistenceV1(
        run,
        request.terminal_event,
      );
      const finalFencingGeneration = Math.max(
        run.start_fence_generation + 1,
        request.lease_generation + 1,
      );
      const handledPayload = request.handled_event.payload as Readonly<{
        last_runtime_sequence_no: number;
        isolation_proof_ref: string | null;
      }>;
      await composition.unit_of_work.withTransaction(
        {
          operation: "handle_runtime_control_signal",
          idempotency_key: request.handled_event.idempotency_key,
          trace_id: request.handled_event.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<unknown, "transition_runtime_control_signal_v1">(
            transaction,
            {
              writer: "transition_runtime_control_signal_v1",
              arguments: {
                p_runtime_signal_id: request.runtime_signal_id,
                p_runtime_run_id: request.runtime_run_id,
                p_expected_status: "received",
                p_expected_start_fence_generation: bigintArgumentV1(
                  run.start_fence_generation,
                ),
                p_worker_lease_id: leaseAuthority.lease_id,
                p_worker_id: leaseAuthority.owner_id,
                p_next_status: "handled",
                p_signal_result: {
                  runtime_control_signals: {
                    handled_status: request.handled_status,
                    handled_lease_generation: request.lease_generation,
                    final_fencing_generation: finalFencingGeneration,
                    safe_point_reached:
                      request.handled_status === "handled_safe_point",
                    late_events_isolated:
                      request.handled_status !== "isolation_unproven",
                    last_runtime_sequence_no:
                      handledPayload.last_runtime_sequence_no,
                    isolation_proof_ref:
                      handledPayload.isolation_proof_ref,
                  },
                  runtime_runs: {
                    terminal_reason: request.terminal_reason,
                  },
                },
                p_event_batch: [
                  handledPersistence.event,
                  terminalPersistence.event,
                ],
                p_outbox_batch: [
                  handledPersistence.outbox,
                  terminalPersistence.outbox,
                ],
                p_idempotency_key: request.handled_event.idempotency_key,
                p_request_hash: control.request_hash,
                p_trace_id: request.handled_event.trace_id,
              },
              expected_rows: 1,
            },
          ),
      );
      const updated = await readRun(request.runtime_run_id);
      if (updated === undefined) throw new RuntimeExecutionErrorV1("runtime_not_found");
      return updated;
    },

    async finalizeAlreadyTerminalControl(request) {
      const run = await readRun(request.runtime_run_id);
      const control = run?.controls.find(
        ({ request: current }) =>
          current.runtime_signal_id === request.runtime_signal_id,
      );
      if (
        run === undefined ||
        control?.status !== "handled" ||
        control.handled_status !== "already_terminal"
      ) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      const received = run.events.find(
        ({ event_id }) => event_id === request.received_event.event_id,
      );
      const handled = run.events.find(
        ({ event_id }) => event_id === request.handled_event.event_id,
      );
      if (
        received === undefined ||
        handled === undefined ||
        canonicalJsonV1(received) !== canonicalJsonV1(request.received_event) ||
        canonicalJsonV1(handled) !== canonicalJsonV1(request.handled_event)
      ) {
        throw new RuntimeExecutionErrorV1("runtime_terminal");
      }
      return run;
    },
    async claimOutbox(request): Promise<readonly RuntimeOutboxClaimRecordV1[]> {
      const rows = await composition.unit_of_work.withTransaction(
        {
          operation: "claim_runtime_event_outbox",
          idempotency_key: `${request.worker_id}:${request.now}:${request.current_transport_epoch}:${request.current_transport_generation}`,
          trace_id: request.worker_id,
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, { owner }) =>
          owner.executeWriter<
            readonly RuntimeOutboxWriterStateV1[],
            "claim_runtime_event_outbox_v1"
          >(transaction, {
            writer: "claim_runtime_event_outbox_v1",
            arguments: {
              p_worker_id: request.worker_id,
              p_limit: request.limit,
              p_lease_seconds: request.lease_seconds,
              p_now: request.now,
              p_current_transport_epoch: request.current_transport_epoch,
              p_current_transport_generation: bigintArgumentV1(
                request.current_transport_generation,
              ),
            },
            expected_rows: "zero_or_more",
          }),
      );
      const claims: RuntimeOutboxClaimRecordV1[] = [];
      for (const row of rows) {
        const state = await readOutboxState(row.id);
        if (
          state === undefined ||
          row.status !== "dispatching" ||
          row.claimed_by !== request.worker_id ||
          row.claim_token === null ||
          row.locked_until === null ||
          state.runtime_run_id !== row.runtime_run_id ||
          state.source_event_id !== row.source_event_id ||
          state.attempt_count !== row.attempt_count
        ) {
          throw new RuntimeExecutionErrorV1("runtime_adapter_failed");
        }
        const record = outboxRecordV1(state);
        claims.push(Object.freeze({
          ...record,
          status: "pending",
          worker_id: request.worker_id,
          claim_token: row.claim_token,
          lease_expires_at: toIsoV1(
            row.locked_until,
            "outbox_lease_expires_at",
          ),
          transport_epoch: request.current_transport_epoch,
          transport_generation: request.current_transport_generation,
        }));
      }
      return Object.freeze(claims);
    },

    async readOutboxAcknowledgeState(
      request,
    ): Promise<RuntimeOutboxAuthoritativeAckV1 | undefined> {
      if (
        request.outcome !== "sent" ||
        request.next_retry_at !== null ||
        request.error !== null ||
        request.transport_ref === null ||
        request.transport_epoch === null ||
        request.transport_generation === null
      ) {
        return undefined;
      }
      const state = await readOutboxState(request.outbox_id);
      if (
        state === undefined ||
        state.runtime_run_id !== request.runtime_run_id ||
        state.source_event_id !== request.event_id ||
        canonicalPayloadHashV1(state.event) !== request.event_hash ||
        safeIntegerV1(state.attempt_count, "outbox_attempt_count") !==
          request.expected_attempt_count ||
        request.transport_epoch !== request.current_transport_epoch ||
        request.transport_generation !== request.current_transport_generation
      ) {
        return undefined;
      }
      let acknowledged: RuntimeOutboxWriterStateV1;
      try {
        acknowledged = await executeOutboxAck(request);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error.code === "40001" || error.code === "23505")
        ) {
          return undefined;
        }
        throw error;
      }
      if (
        acknowledged.status !== "sent" ||
        acknowledged.runtime_run_id !== request.runtime_run_id ||
        acknowledged.source_event_id !== request.event_id ||
        acknowledged.acknowledged_claim_token !== request.claim_token ||
        acknowledged.transport_ref !== request.transport_ref ||
        acknowledged.transport_epoch !== request.transport_epoch ||
        safeIntegerV1(
          acknowledged.transport_generation,
          "outbox_transport_generation",
        ) !== request.transport_generation ||
        acknowledged.sent_at === null
      ) {
        return undefined;
      }
      return Object.freeze({
        record: outboxRecordV1({ ...state, status: "sent" }),
        claim_token: request.claim_token,
        transport_ref: request.transport_ref,
        transport_epoch: request.transport_epoch,
        transport_generation: request.transport_generation,
        acknowledged_at: toIsoV1(
          acknowledged.sent_at,
          "outbox_acknowledged_at",
        ),
      });
    },

    async acknowledgeOutbox(
      request,
    ): Promise<RuntimeOutboxAckConfirmationV1> {
      const state = await readOutboxState(request.outbox_id);
      if (
        state === undefined ||
        state.runtime_run_id !== request.runtime_run_id ||
        state.source_event_id !== request.event_id ||
        canonicalPayloadHashV1(state.event) !== request.event_hash ||
        safeIntegerV1(state.attempt_count, "outbox_attempt_count") !==
          request.expected_attempt_count
      ) {
        throw new RuntimeExecutionErrorV1("idempotency_conflict");
      }
      const updated = await executeOutboxAck(request);
      const expectedStatus =
        request.outcome === "sent"
          ? "sent"
          : request.outcome === "failed"
            ? "failed"
            : "retry_wait";
      if (
        updated.status !== expectedStatus ||
        updated.runtime_run_id !== request.runtime_run_id ||
        updated.source_event_id !== request.event_id
      ) {
        throw new RuntimeExecutionErrorV1("runtime_adapter_failed");
      }
      return Object.freeze({ acknowledged: true });
    },
  };

  return Object.freeze(store);
}
