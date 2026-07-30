import { Type, type Static } from "@sinclair/typebox";

import { DurableEventEnvelopeV1Schema } from "../shared/durable-event-envelope.v1.js";
import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";

const identifier = Type.String({ minLength: 1, maxLength: 512 });
const nullableIdentifier = Type.Union([identifier, Type.Null()]);
const nullableTimestamp = Type.Union([
  DurableEventEnvelopeV1Schema.properties.occurred_at,
  Type.Null(),
]);

export const META_JOB_QUERY_STATUSES_V1 = [
  "queued",
  "running",
  "retry_wait",
  "completed",
  "failed",
] as const;
export const META_RESULT_STATUSES_V1 = [
  "complete",
  "partial_pending",
  "partial_failed",
] as const;

export const MetaJobQueryStatusV1Schema = Type.Union(
  META_JOB_QUERY_STATUSES_V1.map((status) => Type.Literal(status)),
);
export const MetaResultStatusV1Schema = Type.Union(
  META_RESULT_STATUSES_V1.map((status) => Type.Literal(status)),
);

const MetaExperienceSummaryV1Schema = Type.Object(
  {
    summary: Type.String({ minLength: 1, maxLength: 16_384 }),
    reflection_summary: Type.Union([
      Type.String({ minLength: 1, maxLength: 16_384 }),
      Type.Null(),
    ]),
    evidence_refs: Type.Array(TypedEvidenceRefV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

const MetaJobVisibleSummaryV1Schema = Type.Object(
  {
    experience_summary: MetaExperienceSummaryV1Schema,
    result_status: MetaResultStatusV1Schema,
    partial_failures_count: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    quality_signals_count: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    memory_write_refs: Type.Array(identifier, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    knowthat_write_refs: Type.Array(identifier, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    candidate_review_refs: Type.Array(identifier, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    skill_candidate_refs: Type.Array(identifier, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    personality_suggestion_refs: Type.Array(identifier, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

const MetaJobVisibleErrorV1Schema = Type.Object(
  {
    code: identifier,
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    retryable: Type.Boolean(),
    details_ref: Type.Optional(identifier),
  },
  { additionalProperties: false },
);

export const MetaJobQueryDetailsV1Schema = Type.Object(
  {
    job_id: identifier,
    trigger_process_id: identifier,
    bot_id: identifier,
    status: MetaJobQueryStatusV1Schema,
    result_status: Type.Union([MetaResultStatusV1Schema, Type.Null()]),
    attempt_count: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    next_retry_at: nullableTimestamp,
    summary: Type.Union([MetaJobVisibleSummaryV1Schema, Type.Null()]),
    error: Type.Union([MetaJobVisibleErrorV1Schema, Type.Null()]),
    created_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
    updated_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
    trace_id: identifier,
  },
  {
    $id: "urn:pai:meta:job-query-details:v1",
    additionalProperties: false,
  },
);

export type MetaJobQueryDetailsV1 = Static<
  typeof MetaJobQueryDetailsV1Schema
>;

export function assertMetaJobQueryDetailsSemanticBindingsV1(
  details: MetaJobQueryDetailsV1,
): void {
  if (
    (details.status === "retry_wait") !== (details.next_retry_at !== null) ||
    (details.summary === null) !== (details.result_status === null) ||
    (details.summary !== null &&
      details.summary.result_status !== details.result_status) ||
    Date.parse(details.created_at) > Date.parse(details.updated_at)
  ) {
    throw new Error("MetaJobQueryDetailsV1 semantic binding mismatch");
  }
}
