import {
  MetaJobQueryDetailsV1Schema,
  QualitySignalSeverityV1Schema,
  QualitySignalTypeV1Schema,
  RuntimeRunQueryDetailsV1Schema,
  ServiceIdV1Schema,
  ToolInvocationQueryStatusV1Schema,
  ToolInvocationSideEffectStatusV1Schema,
  TriggerProcessQueryDetailsV1Schema,
  TriggerProcessSseEventV1Schema,
} from "@pai/contracts";
import { Type, type Static } from "@sinclair/typebox";

const IdentifierV1Schema = Type.String({ minLength: 1, maxLength: 512 });
const TimestampV1Schema = Type.String({ format: "date-time" });
const NonNegativeSafeIntegerV1Schema = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});
const processOwner = TriggerProcessQueryDetailsV1Schema.properties;
const runtimeOwner =
  RuntimeRunQueryDetailsV1Schema.properties.runtime_run.properties;
const metaOwner = MetaJobQueryDetailsV1Schema.properties;
const SafeJsonScalarV1Schema = Type.Union([
  Type.String({ maxLength: 1_024 }),
  Type.Number(),
  Type.Boolean(),
  Type.Null(),
]);
const SafeJsonArrayV1Schema = Type.Array(SafeJsonScalarV1Schema, {
  maxItems: 64,
});
const SafeJsonObjectV1Schema = Type.Record(
  Type.String({ minLength: 1, maxLength: 128 }),
  Type.Union([SafeJsonScalarV1Schema, SafeJsonArrayV1Schema]),
  { maxProperties: 64 },
);
const SafeJsonValueV1Schema = Type.Union([
  SafeJsonScalarV1Schema,
  SafeJsonArrayV1Schema,
  SafeJsonObjectV1Schema,
]);
const SafeSummaryV1Schema = Type.Record(
  Type.String({ minLength: 1, maxLength: 128 }),
  SafeJsonValueV1Schema,
  { maxProperties: 64 },
);

export const OBSERVATION_DEGRADED_FLAGS_V1 = [
  "runtime_unavailable",
  "meta_unavailable",
  "meta_projection_lag",
  "runtime_token_stream_unavailable",
  "optional_detail_timeout",
] as const;

export const ObservationDegradedFlagV1Schema = Type.Union(
  OBSERVATION_DEGRADED_FLAGS_V1.map((value) => Type.Literal(value)),
);

export const ObservationTriggerProcessSummaryV1Schema = Type.Object(
  {
    id: processOwner.id,
    trigger_id: processOwner.trigger_id,
    bot_id: processOwner.bot_id,
    phase: processOwner.phase,
    status: processOwner.status,
    terminal_reason: processOwner.terminal_reason,
    terminal_outcome: processOwner.terminal_outcome,
    terminal_outcome_finalized_at:
      processOwner.terminal_outcome_finalized_at,
    canonical_reason_code: processOwner.canonical_reason_code,
    successor_process_id: processOwner.successor_process_id,
    snapshot_transfer_ref: processOwner.snapshot_transfer_ref,
    boundary_system_event_ref: processOwner.boundary_system_event_ref,
    cooldown_until: processOwner.cooldown_until,
    snapshot_retention_until: processOwner.snapshot_retention_until,
    runtime_run_id: processOwner.runtime_run_id,
    meta_job_id: processOwner.meta_job_id,
    meta_status: processOwner.meta_status,
    meta_summary_ref: processOwner.meta_summary_ref,
    observation_finalized: processOwner.observation_finalized,
  },
  { additionalProperties: false },
);

export const ObservationRuntimeSummaryV1Schema = Type.Object(
  {
    runtime_run_id: runtimeOwner.runtime_run_id,
    status: runtimeOwner.status,
    started_at: runtimeOwner.started_at,
    completed_at: runtimeOwner.completed_at,
    terminal_reason: runtimeOwner.terminal_reason,
  },
  {
    $id: "urn:pai:observation:runtime-summary:v1",
    additionalProperties: false,
  },
);

export const ObservationMetaSummaryV1Schema = Type.Object(
  {
    job_id: metaOwner.job_id,
    status: metaOwner.status,
    result_status: metaOwner.result_status,
    updated_at: metaOwner.updated_at,
    quality_signals_count: NonNegativeSafeIntegerV1Schema,
    partial_failures_count: NonNegativeSafeIntegerV1Schema,
    error_summary: Type.Optional(Type.String({ maxLength: 1_024 })),
  },
  {
    $id: "urn:pai:observation:meta-summary:v1",
    additionalProperties: false,
  },
);

export const ObservationRuntimeDetailsResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("1.0.0"),
    runtime: ObservationRuntimeSummaryV1Schema,
    redacted_field_count: NonNegativeSafeIntegerV1Schema,
    trace_id: IdentifierV1Schema,
  },
  {
    $id: "urn:pai:observation:runtime-details-response:v1",
    additionalProperties: false,
  },
);

export const ObservationMetaDetailsResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("1.0.0"),
    meta: ObservationMetaSummaryV1Schema,
    redacted_field_count: NonNegativeSafeIntegerV1Schema,
    trace_id: IdentifierV1Schema,
  },
  {
    $id: "urn:pai:observation:meta-details-response:v1",
    additionalProperties: false,
  },
);

export const ObservationSnapshotResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("1.0.0"),
    trigger_process: ObservationTriggerProcessSummaryV1Schema,
    runtime: Type.Union([ObservationRuntimeSummaryV1Schema, Type.Null()]),
    meta: Type.Union([ObservationMetaSummaryV1Schema, Type.Null()]),
    snapshot_watermark: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    degraded_flags: Type.Array(ObservationDegradedFlagV1Schema, {
      uniqueItems: true,
    }),
    redacted_field_count: NonNegativeSafeIntegerV1Schema,
    trace_id: IdentifierV1Schema,
  },
  {
    $id: "observation.snapshot.response",
    additionalProperties: false,
  },
);

export const ObservationEventV1Schema = Type.Object(
  {
    schema_version: Type.Literal("1.0.0"),
    event_type: Type.Index(TriggerProcessSseEventV1Schema, [
      "event_type",
    ]),
    producer: Type.Union([
      Type.Literal("trigger_processor"),
      Type.Literal("action_runtime"),
    ]),
    trigger_process_id: IdentifierV1Schema,
    append_sequence_no: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    durable: Type.Literal(true),
    occurred_at: TimestampV1Schema,
    trace_id: IdentifierV1Schema,
    payload_summary: SafeSummaryV1Schema,
    redacted_field_count: NonNegativeSafeIntegerV1Schema,
  },
  {
    $id: "observation.event",
    additionalProperties: false,
  },
);

export const ObservationSseControlV1Schema = Type.Object(
  {
    schema_version: Type.Literal("1.0.0"),
    code: Type.Union([
      Type.Literal("observation.snapshot"),
      Type.Literal("observation.degraded"),
    ]),
    trace_id: IdentifierV1Schema,
    details: SafeSummaryV1Schema,
  },
  {
    $id: "observation.sse.control",
    additionalProperties: false,
  },
);

export const ObservationSseErrorV1Schema = Type.Object(
  {
    schema_version: Type.Literal("1.0.0"),
    code: Type.Literal("observation.error"),
    error_code: Type.String({ minLength: 1, maxLength: 256 }),
    retryable: Type.Boolean(),
    trace_id: IdentifierV1Schema,
  },
  {
    $id: "observation.sse.error",
    additionalProperties: false,
  },
);

export const ObservationToolInvocationV1Schema = Type.Object(
  {
    tool_invocation_id: IdentifierV1Schema,
    tool_name: IdentifierV1Schema,
    status: ToolInvocationQueryStatusV1Schema,
    side_effect_status: ToolInvocationSideEffectStatusV1Schema,
    failure_class: Type.Union([IdentifierV1Schema, Type.Null()]),
    started_at: TimestampV1Schema,
    completed_at: Type.Union([TimestampV1Schema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const ObservationToolInvocationListV1Schema = Type.Object(
  {
    schema_version: Type.Literal("1.0.0"),
    items: Type.Array(ObservationToolInvocationV1Schema, {
      maxItems: 200,
    }),
    next_cursor: Type.Optional(IdentifierV1Schema),
    runtime_resolution: Type.Union([
      Type.Literal("resolved"),
      Type.Literal("not_started"),
      Type.Literal("not_projected"),
    ]),
    degraded_flags: Type.Array(ObservationDegradedFlagV1Schema, {
      uniqueItems: true,
    }),
    redacted_field_count: NonNegativeSafeIntegerV1Schema,
    trace_id: IdentifierV1Schema,
  },
  {
    $id: "observation.tool-invocation.list",
    additionalProperties: false,
  },
);

export const ObservationQualitySignalV1Schema = Type.Object(
  {
    id: IdentifierV1Schema,
    signal_type: QualitySignalTypeV1Schema,
    severity: QualitySignalSeverityV1Schema,
    source_kind: Type.Union([
      Type.Literal("service"),
      Type.Literal("manual"),
      Type.Literal("operator"),
      Type.Literal("offline_repair"),
    ]),
    source_service: Type.Union([ServiceIdV1Schema, Type.Null()]),
    source_ref: IdentifierV1Schema,
    evidence_refs: Type.Array(IdentifierV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    recommended_action: Type.Union([
      Type.String({ maxLength: 1_024 }),
      Type.Null(),
    ]),
    payload_summary: SafeSummaryV1Schema,
    created_at: TimestampV1Schema,
  },
  { additionalProperties: false },
);

export const ObservationQualitySignalListV1Schema = Type.Object(
  {
    schema_version: Type.Literal("1.0.0"),
    items: Type.Array(ObservationQualitySignalV1Schema, { maxItems: 200 }),
    next_cursor: Type.Optional(IdentifierV1Schema),
    degraded_flags: Type.Array(ObservationDegradedFlagV1Schema, {
      uniqueItems: true,
    }),
    redacted_field_count: NonNegativeSafeIntegerV1Schema,
    trace_id: IdentifierV1Schema,
  },
  {
    $id: "observation.quality-signal.list",
    additionalProperties: false,
  },
);

export type ObservationSnapshotResponseV1 = Static<
  typeof ObservationSnapshotResponseV1Schema
>;
export type ObservationRuntimeDetailsResponseV1 = Static<
  typeof ObservationRuntimeDetailsResponseV1Schema
>;
export type ObservationMetaDetailsResponseV1 = Static<
  typeof ObservationMetaDetailsResponseV1Schema
>;
export type ObservationEventV1 = Static<typeof ObservationEventV1Schema>;
export type ObservationSseControlV1 = Static<
  typeof ObservationSseControlV1Schema
>;
export type ObservationSseErrorV1 = Static<
  typeof ObservationSseErrorV1Schema
>;
export type ObservationToolInvocationListV1 = Static<
  typeof ObservationToolInvocationListV1Schema
>;
export type ObservationQualitySignalListV1 = Static<
  typeof ObservationQualitySignalListV1Schema
>;
