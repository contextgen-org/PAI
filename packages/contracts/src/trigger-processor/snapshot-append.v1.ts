import { Type, type Static } from "@sinclair/typebox";

import {
  ActionRuntimeDomainEventTypeV1Schema,
  type ActionRuntimeDomainEventTypeV1,
} from "../action-runtime/runtime-events.v1.js";
import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorTimestampV1Schema,
} from "./contract-primitives.v1.js";
import { TriggerProcessSourceSequenceMapV1Schema } from "./process-snapshot.v1.js";

const nullableReason = Type.Union([
  TriggerProcessorReasonCodeV1Schema,
  Type.Null(),
]);
const nullableShortSummary = Type.Union([
  Type.String({ minLength: 1, maxLength: 1_024 }),
  Type.Null(),
]);
const nullableRef = Type.Union([
  TriggerProcessorIdentifierV1Schema,
  Type.Null(),
]);

const runtimeObservationSummaryBase = {
  status: TriggerProcessorReasonCodeV1Schema,
  duration_ms: Type.Union([
    Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    Type.Null(),
  ]),
  reason_code: nullableReason,
  error_summary: nullableShortSummary,
  artifact_ref: nullableRef,
} as const;

export const RuntimeObservationSummaryV1Schema = Type.Union([
  Type.Object(
    {
      ...runtimeObservationSummaryBase,
      runtime_run_id: TriggerProcessorIdentifierV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...runtimeObservationSummaryBase,
      tool_invocation_id: TriggerProcessorIdentifierV1Schema,
      tool_name: TriggerProcessorIdentifierV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...runtimeObservationSummaryBase,
      runtime_signal_id: TriggerProcessorIdentifierV1Schema,
      safe_point_ref: nullableRef,
      isolation_proof_ref: nullableRef,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...runtimeObservationSummaryBase,
      skill_key: TriggerProcessorIdentifierV1Schema,
      skill_version: nullableRef,
    },
    { additionalProperties: false },
  ),
]);

export const RuntimeEventAppendRequestV1Schema = Type.Object(
  {
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    runtime_run_id: TriggerProcessorIdentifierV1Schema,
    source_event_id: TriggerProcessorIdentifierV1Schema,
    source_service: Type.Literal("action_runtime"),
    source_sequence_no: TriggerProcessorPositiveVersionV1Schema,
    event_type: ActionRuntimeDomainEventTypeV1Schema,
    schema_version: TriggerProcessorIdentifierV1Schema,
    occurred_at: TriggerProcessorTimestampV1Schema,
    trace_id: TriggerProcessorIdentifierV1Schema,
    append_type: Type.Literal("runtime_event"),
    payload_ref: TriggerProcessorIdentifierV1Schema,
    payload_hash: TriggerProcessorSha256V1Schema,
    observation_summary: RuntimeObservationSummaryV1Schema,
    idempotency_key: TriggerProcessorIdentifierV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:runtime-event-append-request:v1",
    additionalProperties: false,
  },
);

export const RuntimeEventAppendCommittedResponseV1Schema = Type.Object(
  {
    code: Type.Literal("snapshot_appended"),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Literal(false),
    trace_id: TriggerProcessorIdentifierV1Schema,
    details: Type.Object(
      {
        trigger_process_id: TriggerProcessorIdentifierV1Schema,
        snapshot_version: TriggerProcessorPositiveVersionV1Schema,
        append_sequence_no: TriggerProcessorPositiveVersionV1Schema,
        last_sequence_by_source: TriggerProcessSourceSequenceMapV1Schema,
        duplicate_replayed: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const RuntimeEventAppendPendingGapResponseV1Schema = Type.Object(
  {
    code: Type.Literal("snapshot_pending_gap"),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Literal(false),
    trace_id: TriggerProcessorIdentifierV1Schema,
    details: Type.Object(
      {
        trigger_process_id: TriggerProcessorIdentifierV1Schema,
        source_service: Type.Literal("action_runtime"),
        source_event_id: TriggerProcessorIdentifierV1Schema,
        source_sequence_no: TriggerProcessorPositiveVersionV1Schema,
        expected_source_sequence_no: TriggerProcessorPositiveVersionV1Schema,
        pending_event_id: TriggerProcessorIdentifierV1Schema,
        duplicate_replayed: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const RuntimeEventAppendLateEventResponseV1Schema = Type.Object(
  {
    code: Type.Literal("snapshot_late_event_isolated"),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Literal(false),
    trace_id: TriggerProcessorIdentifierV1Schema,
    details: Type.Object(
      {
        trigger_process_id: TriggerProcessorIdentifierV1Schema,
        source_service: Type.Literal("action_runtime"),
        source_event_id: TriggerProcessorIdentifierV1Schema,
        source_sequence_no: TriggerProcessorPositiveVersionV1Schema,
        last_contiguous_source_sequence_no:
          TriggerProcessorPositiveVersionV1Schema,
        isolation_ref: TriggerProcessorIdentifierV1Schema,
        duplicate_replayed: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const RuntimeEventAppendResponseV1Schema = Type.Union([
  RuntimeEventAppendCommittedResponseV1Schema,
  RuntimeEventAppendPendingGapResponseV1Schema,
  RuntimeEventAppendLateEventResponseV1Schema,
]);

export const SnapshotAppendContractV1Schema = Type.Union(
  [RuntimeEventAppendRequestV1Schema, RuntimeEventAppendResponseV1Schema],
  { $id: "urn:pai:trigger-processor:snapshot-append:v1" },
);

export type RuntimeEventAppendRequestV1 = Static<
  typeof RuntimeEventAppendRequestV1Schema
>;
export type RuntimeEventAppendResponseV1 = Static<
  typeof RuntimeEventAppendResponseV1Schema
>;

export function assertRuntimeEventAppendBindingsV1(
  request: RuntimeEventAppendRequestV1,
  authenticatedProducer: "action_runtime",
  payload: Readonly<{
    producer: "action_runtime";
    event_type: ActionRuntimeDomainEventTypeV1;
    event_id: string;
    schema_version: string;
    occurred_at: string;
    trace_id: string;
    payload: Readonly<{
      trigger_process_id: string;
      runtime_run_id: string;
    }>;
  }>,
): void {
  if (
    authenticatedProducer !== request.source_service ||
    payload.producer !== request.source_service ||
    payload.event_id !== request.source_event_id ||
    payload.event_type !== request.event_type ||
    payload.schema_version !== request.schema_version ||
    payload.occurred_at !== request.occurred_at ||
    payload.trace_id !== request.trace_id ||
    payload.payload.trigger_process_id !== request.trigger_process_id ||
    payload.payload.runtime_run_id !== request.runtime_run_id ||
    request.idempotency_key !==
      `${request.source_service}:${request.source_event_id}`
  ) {
    throw new Error("SnapshotAppendContractV1 semantic binding mismatch");
  }
}

export function assertRuntimeObservationSummaryBindingsV1(
  request: RuntimeEventAppendRequestV1,
  event: Readonly<{
    event_type: ActionRuntimeDomainEventTypeV1;
    payload: Readonly<Record<string, unknown>>;
  }>,
): void {
  const payload = event.payload;
  const summary = request.observation_summary as Readonly<Record<string, unknown>>;
  let expectedIdentity: Readonly<Record<string, unknown>>;
  let expectedDuration: unknown = null;
  let expectedError: unknown = null;
  let expectedArtifact: unknown = null;

  if (event.event_type.startsWith("runtime.run.")) {
    expectedIdentity = { runtime_run_id: payload.runtime_run_id };
    expectedDuration = payload.duration_ms;
    expectedError = payload.error_summary;
    expectedArtifact = payload.terminal_artifact_ref;
  } else if (event.event_type.startsWith("runtime.tool.")) {
    expectedIdentity = {
      tool_invocation_id: payload.tool_invocation_id,
      tool_name: payload.tool_name,
    };
    expectedDuration = payload.duration_ms;
    expectedError = payload.error_summary;
    expectedArtifact = payload.artifact_ref;
  } else if (event.event_type.startsWith("runtime.control_signal.")) {
    expectedIdentity = {
      runtime_signal_id: payload.runtime_signal_id,
      safe_point_ref: payload.safe_point_ref,
      isolation_proof_ref: payload.isolation_proof_ref,
    };
  } else if (event.event_type.startsWith("runtime.skill.load.")) {
    expectedIdentity = {
      skill_key: payload.skill_key,
      skill_version: payload.skill_version,
    };
    expectedError = payload.error_summary;
    expectedArtifact = payload.materialized_artifact_ref;
  } else {
    expectedIdentity = { runtime_run_id: payload.runtime_run_id };
    expectedError = payload.error_summary;
    expectedArtifact = payload.artifact_ref;
  }

  if (
    summary.status !== payload.status ||
    summary.reason_code !== payload.reason_code ||
    summary.duration_ms !== expectedDuration ||
    summary.error_summary !== expectedError ||
    summary.artifact_ref !== expectedArtifact ||
    Object.entries(expectedIdentity).some(
      ([key, value]) => summary[key] !== value,
    )
  ) {
    throw new Error("SnapshotAppendContractV1 observation summary mismatch");
  }
}
