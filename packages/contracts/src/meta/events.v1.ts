import { Type, type Static, type TLiteral, type TSchema } from "@sinclair/typebox";

import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import { DurableEventEnvelopeV1Schema } from "../shared/durable-event-envelope.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";
import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorTimestampV1Schema,
} from "../trigger-processor/index-internal.v1.js";

export const META_COGNITION_DOMAIN_EVENT_TYPES_V1 = Object.freeze([
  "meta.job.created",
  "meta.job.started",
  "meta.job.retry_wait",
  "meta.experience.created",
  "meta.memory.write_requested",
  "meta.knowthat.write_requested",
  "meta.candidate.review_requested",
  "meta.candidate.reviewed",
  "meta.skill.candidate_application_requested",
  "meta.feedback.required",
  "meta.result.updated",
  "meta.result.finalized",
  "meta.job.completed",
  "meta.job.failed",
] as const);

export const META_COGNITION_DOMAIN_EVENT_CONSUMERS_V1 = Object.freeze({
  "meta.job.created": Object.freeze(["trigger_processor"]),
  "meta.job.started": Object.freeze(["trigger_processor"]),
  "meta.job.retry_wait": Object.freeze(["trigger_processor"]),
  "meta.experience.created": Object.freeze([]),
  "meta.memory.write_requested": Object.freeze(["memory"]),
  "meta.knowthat.write_requested": Object.freeze(["knowthat"]),
  "meta.candidate.review_requested": Object.freeze(["knowthat"]),
  "meta.candidate.reviewed": Object.freeze([]),
  "meta.skill.candidate_application_requested": Object.freeze([
    "skill_registry",
  ]),
  "meta.feedback.required": Object.freeze(["meta_cognition"]),
  "meta.result.updated": Object.freeze(["trigger_processor"]),
  "meta.result.finalized": Object.freeze(["trigger_processor"]),
  "meta.job.completed": Object.freeze(["trigger_processor"]),
  "meta.job.failed": Object.freeze(["trigger_processor"]),
} as const);

const nullableIdentifier = Type.Union([
  TriggerProcessorIdentifierV1Schema,
  Type.Null(),
]);
const nullableTimestamp = Type.Union([
  TriggerProcessorTimestampV1Schema,
  Type.Null(),
]);
const boundedCount = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});

const metaScope = {
  workspace_id: TriggerProcessorIdentifierV1Schema,
  bot_id: TriggerProcessorIdentifierV1Schema,
  owner_agent_id: TriggerProcessorIdentifierV1Schema,
  deployment_environment: DeploymentEnvironmentV1Schema,
  release_channel: ReleaseChannelV1Schema,
} as const;

const metaJobIdentity = {
  ...metaScope,
  meta_job_id: TriggerProcessorIdentifierV1Schema,
  trigger_process_id: TriggerProcessorIdentifierV1Schema,
} as const;

export const MetaCognitionEnqueueReasonV1Schema = Type.Union([
  Type.Literal("cooldown_expired"),
  Type.Literal("user_retracted"),
  Type.Literal("system_interrupted"),
  Type.Literal("failed_with_learnable_snapshot"),
]);

export const MetaJobProjectionStatusV1Schema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("retry_wait"),
  Type.Literal("completed"),
  Type.Literal("failed"),
]);

export const MetaResultProjectionStatusV1Schema = Type.Union([
  Type.Literal("complete"),
  Type.Literal("partial_pending"),
  Type.Literal("partial_failed"),
]);

const metaFailureEnvelope = Type.Object(
  {
    code: TriggerProcessorReasonCodeV1Schema,
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Boolean(),
    source: TriggerProcessorIdentifierV1Schema,
    details_ref: Type.Optional(TriggerProcessorIdentifierV1Schema),
  },
  { additionalProperties: false },
);

function payload<const T extends Record<string, TSchema>>(properties: T) {
  return Type.Object(
    {
      ...metaJobIdentity,
      ...properties,
    },
    { additionalProperties: false },
  );
}

function event<const TEvent extends string, const TPayload extends TSchema>(
  eventType: TLiteral<TEvent>,
  eventPayload: TPayload,
) {
  return Type.Object(
    {
      event_id: DurableEventEnvelopeV1Schema.properties.event_id,
      event_type: eventType,
      schema_version: Type.Literal("meta_cognition_event.v1"),
      producer: Type.Literal("meta_cognition"),
      occurred_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
      idempotency_key:
        DurableEventEnvelopeV1Schema.properties.idempotency_key,
      trace_id: DurableEventEnvelopeV1Schema.properties.trace_id,
      payload: eventPayload,
    },
    { additionalProperties: false },
  );
}

export const META_COGNITION_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1 = Object.freeze({
  "meta.job.created": payload({
    previous_meta_status: Type.Null(),
    next_meta_status: Type.Literal("queued"),
    projection_version: TriggerProcessorPositiveVersionV1Schema,
    reason_code: Type.Literal("meta_job_created"),
    snapshot_ref: TriggerProcessorIdentifierV1Schema,
    snapshot_hash: TriggerProcessorSha256V1Schema,
    snapshot_version: TriggerProcessorPositiveVersionV1Schema,
    attempt_count: boundedCount,
  }),
  "meta.job.started": payload({
    previous_meta_status: Type.Union([
      Type.Literal("queued"),
      Type.Literal("retry_wait"),
      Type.Literal("running"),
    ]),
    next_meta_status: Type.Literal("running"),
    projection_version: TriggerProcessorPositiveVersionV1Schema,
    reason_code: TriggerProcessorReasonCodeV1Schema,
    lease_id: TriggerProcessorIdentifierV1Schema,
    lease_generation: TriggerProcessorPositiveVersionV1Schema,
    attempt: TriggerProcessorPositiveVersionV1Schema,
    started_at: TriggerProcessorTimestampV1Schema,
  }),
  "meta.job.retry_wait": payload({
    previous_meta_status: Type.Literal("running"),
    next_meta_status: Type.Literal("retry_wait"),
    projection_version: TriggerProcessorPositiveVersionV1Schema,
    reason_code: TriggerProcessorReasonCodeV1Schema,
    next_retry_at: TriggerProcessorTimestampV1Schema,
    attempt_count: TriggerProcessorPositiveVersionV1Schema,
    error_code: Type.Optional(TriggerProcessorReasonCodeV1Schema),
  }),
  "meta.experience.created": payload({
    experience_record_id: TriggerProcessorIdentifierV1Schema,
    solidified_event_range: Type.Object(
      {
        first_append_sequence_no: boundedCount,
        last_append_sequence_no: boundedCount,
      },
      { additionalProperties: false },
    ),
    quality_score: Type.Optional(Type.Null()),
  }),
  "meta.memory.write_requested": payload({
    memory_write_request_id: TriggerProcessorIdentifierV1Schema,
    split_plan_id: TriggerProcessorIdentifierV1Schema,
    plan_version: TriggerProcessorPositiveVersionV1Schema,
    chunk_no: TriggerProcessorPositiveVersionV1Schema,
    chunk_hash: TriggerProcessorSha256V1Schema,
    request_payload_ref: TriggerProcessorIdentifierV1Schema,
    request_payload_hash: TriggerProcessorSha256V1Schema,
    idempotency_key: DurableEventEnvelopeV1Schema.properties.idempotency_key,
    source_meta_job_id: TriggerProcessorIdentifierV1Schema,
    source_trigger_process_id: TriggerProcessorIdentifierV1Schema,
  }),
  "meta.knowthat.write_requested": payload({
    knowthat_write_request_id: TriggerProcessorIdentifierV1Schema,
    request_payload_ref: TriggerProcessorIdentifierV1Schema,
    request_payload_hash: TriggerProcessorSha256V1Schema,
    idempotency_key: DurableEventEnvelopeV1Schema.properties.idempotency_key,
    source_meta_job_id: TriggerProcessorIdentifierV1Schema,
  }),
  "meta.candidate.review_requested": payload({
    candidate_id: TriggerProcessorIdentifierV1Schema,
    suggestion_id: TriggerProcessorIdentifierV1Schema,
    target_candidate_version: TriggerProcessorPositiveVersionV1Schema,
    suggested_action: Type.Union([
      Type.Literal("promote"),
      Type.Literal("keep_candidate"),
      Type.Literal("reject"),
      Type.Literal("expire"),
      Type.Literal("request_feedback"),
    ]),
    request_payload_ref: TriggerProcessorIdentifierV1Schema,
    request_payload_hash: TriggerProcessorSha256V1Schema,
    idempotency_key: DurableEventEnvelopeV1Schema.properties.idempotency_key,
  }),
  "meta.candidate.reviewed": payload({
    candidate_id: TriggerProcessorIdentifierV1Schema,
    suggestion_id: TriggerProcessorIdentifierV1Schema,
    target_candidate_version: TriggerProcessorPositiveVersionV1Schema,
    review_id: TriggerProcessorIdentifierV1Schema,
    status: TriggerProcessorIdentifierV1Schema,
    decision: TriggerProcessorIdentifierV1Schema,
    reason_code: TriggerProcessorReasonCodeV1Schema,
    candidate_version_after: Type.Optional(
      TriggerProcessorPositiveVersionV1Schema,
    ),
    linkage_check_ids: Type.Optional(
      Type.Array(TriggerProcessorIdentifierV1Schema, {
        maxItems: 10_000,
        uniqueItems: true,
      }),
    ),
  }),
  "meta.skill.candidate_application_requested": payload({
    candidate_id: TriggerProcessorIdentifierV1Schema,
    review_version: TriggerProcessorPositiveVersionV1Schema,
    application_id: TriggerProcessorIdentifierV1Schema,
    candidate_type: TriggerProcessorIdentifierV1Schema,
    skill_key: TriggerProcessorIdentifierV1Schema,
    application_payload_ref: TriggerProcessorIdentifierV1Schema,
    application_payload_hash: TriggerProcessorSha256V1Schema,
    baseline_catalog_version: TriggerProcessorIdentifierV1Schema,
    reviewer_principal_id: TriggerProcessorIdentifierV1Schema,
    idempotency_key: DurableEventEnvelopeV1Schema.properties.idempotency_key,
    trace_id: DurableEventEnvelopeV1Schema.properties.trace_id,
    command_schema_version: Type.Literal("skill_candidate_application.v1"),
  }),
  "meta.feedback.required": payload({
    feedback_request_id: TriggerProcessorIdentifierV1Schema,
    dedupe_scope_ref: TriggerProcessorIdentifierV1Schema,
    question_key: TriggerProcessorIdentifierV1Schema,
    candidate_id: Type.Optional(TriggerProcessorIdentifierV1Schema),
    conflict_id: Type.Optional(TriggerProcessorIdentifierV1Schema),
    delivery_mode: TriggerProcessorIdentifierV1Schema,
    target_actor_ref: Type.Optional(TriggerProcessorIdentifierV1Schema),
    target_binding_ref: Type.Optional(TriggerProcessorIdentifierV1Schema),
    delivery_channel: Type.Optional(TriggerProcessorIdentifierV1Schema),
    delivery_version: TriggerProcessorPositiveVersionV1Schema,
    question_payload_ref: TriggerProcessorIdentifierV1Schema,
    question_payload_hash: TriggerProcessorSha256V1Schema,
    expires_at: TriggerProcessorTimestampV1Schema,
    status: Type.Literal("open"),
  }),
  "meta.result.updated": payload({
    meta_result_id: TriggerProcessorIdentifierV1Schema,
    previous_result_version: boundedCount,
    result_version: TriggerProcessorPositiveVersionV1Schema,
    previous_result_status: Type.Union([
      MetaResultProjectionStatusV1Schema,
      Type.Null(),
    ]),
    result_status: MetaResultProjectionStatusV1Schema,
    changed_failure_ids: Type.Array(TriggerProcessorIdentifierV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    active_compensation_count: boundedCount,
    active_repair_count: boundedCount,
    meta_summary_ref: nullableIdentifier,
    updated_at: TriggerProcessorTimestampV1Schema,
  }),
  "meta.result.finalized": payload({
    meta_result_id: TriggerProcessorIdentifierV1Schema,
    result_version: TriggerProcessorPositiveVersionV1Schema,
    result_status: Type.Union([
      Type.Literal("complete"),
      Type.Literal("partial_failed"),
    ]),
    finalized_at: TriggerProcessorTimestampV1Schema,
    previous_meta_status: Type.Union([
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    next_meta_status: Type.Union([
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    projection_version: TriggerProcessorPositiveVersionV1Schema,
    meta_enqueue_reason: MetaCognitionEnqueueReasonV1Schema,
    active_compensation_count: Type.Literal(0),
    active_repair_count: Type.Literal(0),
    meta_summary_ref: nullableIdentifier,
  }),
  "meta.job.completed": payload({
    previous_meta_status: Type.Union([
      Type.Literal("running"),
      Type.Literal("retry_wait"),
    ]),
    next_meta_status: Type.Literal("completed"),
    projection_version: TriggerProcessorPositiveVersionV1Schema,
    reason_code: TriggerProcessorReasonCodeV1Schema,
    meta_result_id: TriggerProcessorIdentifierV1Schema,
    result_version: TriggerProcessorPositiveVersionV1Schema,
    result_status: MetaResultProjectionStatusV1Schema,
    completed_at: TriggerProcessorTimestampV1Schema,
    partial_failures_count: boundedCount,
    meta_enqueue_reason: MetaCognitionEnqueueReasonV1Schema,
    active_compensation_count: boundedCount,
    active_repair_count: boundedCount,
    meta_summary_ref: nullableIdentifier,
    result_finalized_at: nullableTimestamp,
  }),
  "meta.job.failed": Type.Union([
    payload({
      previous_meta_status: Type.Union([
        Type.Literal("queued"),
        Type.Literal("running"),
        Type.Literal("retry_wait"),
      ]),
      next_meta_status: Type.Literal("failed"),
      projection_version: TriggerProcessorPositiveVersionV1Schema,
      reason_code: TriggerProcessorReasonCodeV1Schema,
      failed_at: TriggerProcessorTimestampV1Schema,
      attempt_count: boundedCount,
      error: metaFailureEnvelope,
      result_disposition: Type.Literal("not_created"),
      failure_stage: TriggerProcessorIdentifierV1Schema,
      no_result_reason: TriggerProcessorReasonCodeV1Schema,
      active_compensation: Type.Literal(false),
      meta_enqueue_reason: MetaCognitionEnqueueReasonV1Schema,
      dlq_ref: Type.Optional(TriggerProcessorIdentifierV1Schema),
    }),
    payload({
      previous_meta_status: Type.Union([
        Type.Literal("running"),
        Type.Literal("retry_wait"),
      ]),
      next_meta_status: Type.Literal("failed"),
      projection_version: TriggerProcessorPositiveVersionV1Schema,
      reason_code: TriggerProcessorReasonCodeV1Schema,
      failed_at: TriggerProcessorTimestampV1Schema,
      attempt_count: boundedCount,
      error: metaFailureEnvelope,
      result_disposition: Type.Literal("finalized"),
      meta_result_id: TriggerProcessorIdentifierV1Schema,
      result_version: TriggerProcessorPositiveVersionV1Schema,
      result_status: Type.Literal("partial_failed"),
      result_finalized_at: TriggerProcessorTimestampV1Schema,
      active_compensation: Type.Literal(false),
      meta_enqueue_reason: MetaCognitionEnqueueReasonV1Schema,
      dlq_ref: Type.Optional(TriggerProcessorIdentifierV1Schema),
    }),
  ]),
} as const);

export const META_COGNITION_DOMAIN_EVENT_BRANCH_SCHEMAS_V1 = Object.freeze({
  ...Object.fromEntries(
    META_COGNITION_DOMAIN_EVENT_TYPES_V1.map((eventType) => [
      eventType,
      event(
        Type.Literal(eventType),
        META_COGNITION_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[eventType],
      ),
    ]),
  ),
}) as Readonly<
  Record<
    (typeof META_COGNITION_DOMAIN_EVENT_TYPES_V1)[number],
    ReturnType<typeof event>
  >
>;

export const MetaCognitionDomainEventV1Schema = Type.Union(
  META_COGNITION_DOMAIN_EVENT_TYPES_V1.map(
    (eventType) => META_COGNITION_DOMAIN_EVENT_BRANCH_SCHEMAS_V1[eventType],
  ),
  { $id: "urn:pai:meta:domain-event:v1" },
);

export type MetaCognitionDomainEventV1 = Static<
  typeof MetaCognitionDomainEventV1Schema
>;

export function assertMetaCognitionDomainEventSemanticBindingsV1(
  eventValue: MetaCognitionDomainEventV1,
): void {
  const eventPayload = eventValue.payload;
  if (
    ("source_meta_job_id" in eventPayload &&
      eventPayload.source_meta_job_id !== eventPayload.meta_job_id) ||
    ("source_trigger_process_id" in eventPayload &&
      eventPayload.source_trigger_process_id !==
        eventPayload.trigger_process_id) ||
    ("idempotency_key" in eventPayload &&
      eventPayload.idempotency_key !== eventValue.idempotency_key) ||
    ("trace_id" in eventPayload &&
      eventPayload.trace_id !== eventValue.trace_id) ||
    ("result_version" in eventPayload &&
      "previous_result_version" in eventPayload &&
      eventPayload.result_version <= eventPayload.previous_result_version) ||
    ("solidified_event_range" in eventPayload &&
      eventPayload.solidified_event_range.first_append_sequence_no >
        eventPayload.solidified_event_range.last_append_sequence_no) ||
    (eventValue.event_type === "meta.result.finalized" &&
      eventPayload.previous_meta_status !== eventPayload.next_meta_status) ||
    (eventValue.event_type === "meta.job.completed" &&
      ((eventPayload.result_status === "partial_pending") !==
        (eventPayload.result_finalized_at === null) ||
        (eventPayload.result_status !== "partial_pending" &&
          (eventPayload.active_compensation_count !== 0 ||
            eventPayload.active_repair_count !== 0)))) ||
    (eventValue.event_type === "meta.job.failed" &&
      eventPayload.result_disposition === "finalized" &&
      eventPayload.result_finalized_at > eventValue.occurred_at)
  ) {
    throw new Error("MetaCognitionDomainEventV1 semantic binding mismatch");
  }
}
