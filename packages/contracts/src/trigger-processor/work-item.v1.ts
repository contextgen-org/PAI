import { Type, type Static, type TSchema } from "@sinclair/typebox";

import {
  ContextComposeRequestV1Schema,
} from "./context-compose.v1.js";
import {
  IntentSynthesizeRequestV1Schema,
} from "./intent-synthesize.v1.js";
import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorUtcTimestampV1Schema,
} from "./index-internal.v1.js";
import { TriggerProcessStateV1Schema } from "./trigger-process-state.v1.js";
import { RuntimeStartRequestV1Schema } from "../action-runtime/runtime-start.v1.js";
import { MetaJobCreateRequestV1Schema } from "../meta/meta-job-create.v1.js";

export const TRIGGER_PROCESS_WORK_KINDS_V1 = Object.freeze([
  "stage_execute",
  "stage_retry",
  "runtime_start_recompose",
  "snapshot_repair",
  "meta_enqueue",
] as const);

export const TRIGGER_PROCESS_WORK_SCHEMA_VERSION_BY_KIND_V1 = Object.freeze({
  stage_execute: "trigger_stage_execute_work.v1",
  stage_retry: "trigger_stage_retry_work.v1",
  runtime_start_recompose: "trigger_runtime_start_recompose_work.v1",
  snapshot_repair: "trigger_snapshot_repair_work.v1",
  meta_enqueue: "trigger_meta_enqueue_work.v1",
} as const);

const nullableIdentifier = Type.Union([
  TriggerProcessorIdentifierV1Schema,
  Type.Null(),
]);

const workFence = {
  trigger_process_id: TriggerProcessorIdentifierV1Schema,
  expected_process_state: TriggerProcessStateV1Schema,
  expected_process_state_version: TriggerProcessorPositiveVersionV1Schema,
  immutable_input_hash: TriggerProcessorSha256V1Schema,
  trace_id: TriggerProcessorIdentifierV1Schema,
} as const;

function stagePayload<TVersion extends string>(
  schemaVersion: TVersion,
  additional: Readonly<Record<string, TSchema>> = {},
) {
  return Type.Union([
    Type.Object(
      {
        schema_version: Type.Literal(schemaVersion),
        ...workFence,
        ...additional,
        target_stage: Type.Literal("context"),
        request: ContextComposeRequestV1Schema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        schema_version: Type.Literal(schemaVersion),
        ...workFence,
        ...additional,
        target_stage: Type.Literal("intent"),
        request: IntentSynthesizeRequestV1Schema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        schema_version: Type.Literal(schemaVersion),
        ...workFence,
        ...additional,
        target_stage: Type.Literal("runtime_start"),
        request: RuntimeStartRequestV1Schema,
      },
      { additionalProperties: false },
    ),
  ]);
}

export const TriggerStageExecuteWorkV1Schema = stagePayload(
  "trigger_stage_execute_work.v1",
);

export const TriggerStageRetryWorkV1Schema = stagePayload(
  "trigger_stage_retry_work.v1",
  {
    failed_stage: Type.Union([
      Type.Literal("admission"),
      Type.Literal("context"),
      Type.Literal("intent"),
      Type.Literal("runtime_start"),
    ]),
    reason_code: TriggerProcessorReasonCodeV1Schema,
    retry_attempt: TriggerProcessorPositiveVersionV1Schema,
    next_retry_at: TriggerProcessorUtcTimestampV1Schema,
  },
);

export const TriggerRuntimeStartRecomposeWorkV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_runtime_start_recompose_work.v1"),
    ...workFence,
    old_start_attempt_no: TriggerProcessorPositiveVersionV1Schema,
    old_start_fence_generation: TriggerProcessorPositiveVersionV1Schema,
    catalog_conflict_ref: TriggerProcessorIdentifierV1Schema,
    no_run_proof_ref: TriggerProcessorIdentifierV1Schema,
    previous_context_snapshot_ref: TriggerProcessorIdentifierV1Schema,
    previous_context_snapshot_hash: TriggerProcessorSha256V1Schema,
    previous_intent_ref: TriggerProcessorIdentifierV1Schema,
    previous_intent_hash: TriggerProcessorSha256V1Schema,
    request: ContextComposeRequestV1Schema,
  },
  { additionalProperties: false },
);

export const TriggerSnapshotRepairWorkV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_snapshot_repair_work.v1"),
    ...workFence,
    repair_job_id: TriggerProcessorIdentifierV1Schema,
    snapshot_manifest_ref: TriggerProcessorIdentifierV1Schema,
    snapshot_version: TriggerProcessorPositiveVersionV1Schema,
    snapshot_hash: TriggerProcessorSha256V1Schema,
    missing_first_append_sequence_no: TriggerProcessorPositiveVersionV1Schema,
    missing_last_append_sequence_no: TriggerProcessorPositiveVersionV1Schema,
    retention_until: TriggerProcessorUtcTimestampV1Schema,
    source_refs: Type.Array(TriggerProcessorIdentifierV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

export const TriggerMetaEnqueueWorkV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_meta_enqueue_work.v1"),
    ...workFence,
    snapshot_ref: TriggerProcessorIdentifierV1Schema,
    snapshot_version: TriggerProcessorPositiveVersionV1Schema,
    snapshot_hash: TriggerProcessorSha256V1Schema,
    snapshot_retention_until: TriggerProcessorUtcTimestampV1Schema,
    enqueue_reason: Type.Union([
      Type.Literal("cooldown_expired"),
      Type.Literal("user_retracted"),
      Type.Literal("system_interrupted"),
      Type.Literal("failed_with_learnable_snapshot"),
    ]),
    boundary_system_event_ref: nullableIdentifier,
    meta_request_hash: TriggerProcessorSha256V1Schema,
    request: MetaJobCreateRequestV1Schema,
  },
  { additionalProperties: false },
);

export const TriggerProcessWorkPayloadV1Schema = Type.Union(
  [
    TriggerStageExecuteWorkV1Schema,
    TriggerStageRetryWorkV1Schema,
    TriggerRuntimeStartRecomposeWorkV1Schema,
    TriggerSnapshotRepairWorkV1Schema,
    TriggerMetaEnqueueWorkV1Schema,
  ],
  {
    $id: "urn:pai:trigger-processor:work-item:v1",
  },
);

export type TriggerProcessWorkKindV1 =
  (typeof TRIGGER_PROCESS_WORK_KINDS_V1)[number];
export type TriggerStageExecuteWorkV1 = Static<
  typeof TriggerStageExecuteWorkV1Schema
>;
export type TriggerStageRetryWorkV1 = Static<
  typeof TriggerStageRetryWorkV1Schema
>;
export type TriggerRuntimeStartRecomposeWorkV1 = Static<
  typeof TriggerRuntimeStartRecomposeWorkV1Schema
>;
export type TriggerSnapshotRepairWorkV1 = Static<
  typeof TriggerSnapshotRepairWorkV1Schema
>;
export type TriggerMetaEnqueueWorkV1 = Static<
  typeof TriggerMetaEnqueueWorkV1Schema
>;
export type TriggerProcessWorkPayloadV1 = Static<
  typeof TriggerProcessWorkPayloadV1Schema
>;

export function assertTriggerProcessWorkPayloadBindingsV1(
  workKind: TriggerProcessWorkKindV1,
  payload: TriggerProcessWorkPayloadV1,
): void {
  const expectedSchema =
    TRIGGER_PROCESS_WORK_SCHEMA_VERSION_BY_KIND_V1[workKind];
  const request =
    "request" in payload
      ? (payload.request as Readonly<{ trigger_process_id?: string }>)
      : undefined;
  if (
    payload.schema_version !== expectedSchema ||
    (request !== undefined &&
      request.trigger_process_id !== payload.trigger_process_id) ||
    ("target_stage" in payload &&
      "failed_stage" in payload &&
      payload.failed_stage !== "admission" &&
      payload.target_stage !== payload.failed_stage) ||
    ("old_start_attempt_no" in payload &&
      (payload.expected_process_state.phase !== "context" ||
        payload.expected_process_state.status !== "running" ||
        payload.expected_process_state.wait_reason !== null ||
        payload.expected_process_state.terminal_reason !== null)) ||
    ("missing_first_append_sequence_no" in payload &&
      payload.missing_first_append_sequence_no >
        payload.missing_last_append_sequence_no) ||
    ("enqueue_reason" in payload &&
      (payload.request.enqueue_reason !== payload.enqueue_reason ||
        payload.request.snapshot_ref !== payload.snapshot_ref ||
        payload.request.snapshot_version !== payload.snapshot_version ||
        payload.request.snapshot_hash !== payload.snapshot_hash ||
        payload.request.snapshot_retention_until !==
          payload.snapshot_retention_until ||
        payload.request.boundary_system_event_ref !==
          payload.boundary_system_event_ref))
  ) {
    throw new Error("Trigger Process work payload binding mismatch");
  }
}
