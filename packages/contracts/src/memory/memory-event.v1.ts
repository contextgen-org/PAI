import { Type, type Static } from "@sinclair/typebox";

import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  MemoryAppliedCountsV1Schema,
  MemoryBotScopeV1Schema,
  MemoryPointStatusV1Schema,
  MemoryRevisionRefV1Schema,
  MemorySeriesStatusV1Schema,
  MemoryTimestampV1Schema,
} from "./common.v1.js";
import { MemoryIntegrationModeV1Schema } from "./integration-job.v1.js";
import { MemoryIdV1Schema } from "./write-batch.v1.js";

const base = {
  event_id: MemoryIdV1Schema,
  schema_version: Type.Literal("memory.event.v1"),
  producer: Type.Literal("memory"),
  occurred_at: MemoryTimestampV1Schema,
  idempotency_key: Type.String({
    minLength: 1,
    maxUtf8Bytes: 512,
  }),
  trace_id: MemoryIdV1Schema,
} as const;

function identity<A extends string>(
  aggregateType: A,
) {
  return {
    ...MemoryBotScopeV1Schema.properties,
    aggregate_id: MemoryIdV1Schema,
    aggregate_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    aggregate_type: Type.Literal(aggregateType),
  } as const;
}

const pointCreated = Type.Object(
  {
    ...identity("memory_point"),
    memory_point_id: MemoryIdV1Schema,
    series_id: MemoryIdV1Schema,
    topic_key: MemoryIdV1Schema,
    state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    source_trigger_process_id: MemoryIdV1Schema,
    write_batch_id: MemoryIdV1Schema,
    redaction_status: Type.Union([
      Type.Literal("redacted"),
      Type.Literal("not_required"),
    ]),
  },
  { additionalProperties: false },
);

const pointUpdated = Type.Object(
  {
    ...identity("memory_point"),
    memory_point_id: MemoryIdV1Schema,
    previous_status: MemoryPointStatusV1Schema,
    status: MemoryPointStatusV1Schema,
    state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    reason_code: MemoryIdV1Schema,
    revision_refs: Type.Array(MemoryRevisionRefV1Schema, {
      minItems: 1,
      maxItems: 64,
    }),
  },
  { additionalProperties: false },
);

const seriesCreated = Type.Object(
  {
    ...identity("memory_series"),
    series_id: MemoryIdV1Schema,
    topic_key: MemoryIdV1Schema,
    topic_family_key: MemoryIdV1Schema,
    status: Type.Union([
      Type.Literal("active"),
      Type.Literal("pending_conflict"),
    ]),
    state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
  },
  { additionalProperties: false },
);

const seriesUpdated = Type.Object(
  {
    ...identity("memory_series"),
    series_id: MemoryIdV1Schema,
    previous_status: MemorySeriesStatusV1Schema,
    status: MemorySeriesStatusV1Schema,
    state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    reason_code: MemoryIdV1Schema,
    changed_point_ids: Type.Array(MemoryIdV1Schema, {
      maxItems: 1_000,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

const conflictDetected = Type.Object(
  {
    ...identity("memory_conflict"),
    conflict_id: MemoryIdV1Schema,
    conflict_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    conflict_type: MemoryIdV1Schema,
    left_memory_point_id: MemoryIdV1Schema,
    right_memory_point_id: MemoryIdV1Schema,
    evidence_refs: Type.Array(TypedEvidenceRefV1Schema, {
      minItems: 1,
      maxItems: 64,
      uniqueByCanonicalIdentity: true,
    }),
  },
  { additionalProperties: false },
);

const conflictUpdated = Type.Object(
  {
    ...identity("memory_conflict"),
    conflict_id: MemoryIdV1Schema,
    previous_status: Type.Union([
      Type.Literal("open"),
      Type.Literal("feedback_requested"),
    ]),
    status: Type.Union([
      Type.Literal("feedback_requested"),
      Type.Literal("resolved"),
    ]),
    conflict_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    reason_code: MemoryIdV1Schema,
    revision_refs: Type.Array(MemoryRevisionRefV1Schema, {
      minItems: 1,
      maxItems: 64,
    }),
  },
  { additionalProperties: false },
);

const integrationFinished = Type.Object(
  {
    ...identity("integration_job"),
    integration_job_id: MemoryIdV1Schema,
    mode: MemoryIntegrationModeV1Schema,
    status: Type.Union([
      Type.Literal("completed"),
      Type.Literal("partial_failed"),
      Type.Literal("failed"),
    ]),
    checkpoint_ref: Type.Optional(MemoryIdV1Schema),
    applied_counts: MemoryAppliedCountsV1Schema,
    failure_refs: Type.Array(TypedEvidenceRefV1Schema, {
      maxItems: 10_000,
      uniqueByCanonicalIdentity: true,
    }),
  },
  { additionalProperties: false },
);

export const MEMORY_EVENT_TYPES_V1 = [
  "memory.point.created",
  "memory.point.updated",
  "memory.series.created",
  "memory.series.updated",
  "memory.conflict.detected",
  "memory.conflict.updated",
  "memory.integration.finished",
] as const;

export const MEMORY_EVENT_PAYLOAD_SCHEMAS_V1 = Object.freeze({
  "memory.point.created": pointCreated,
  "memory.point.updated": pointUpdated,
  "memory.series.created": seriesCreated,
  "memory.series.updated": seriesUpdated,
  "memory.conflict.detected": conflictDetected,
  "memory.conflict.updated": conflictUpdated,
  "memory.integration.finished": integrationFinished,
} as const);

function memoryEventBranchV1<
  const TEventType extends (typeof MEMORY_EVENT_TYPES_V1)[number],
>(
  eventType: TEventType,
  payload: (typeof MEMORY_EVENT_PAYLOAD_SCHEMAS_V1)[TEventType],
) {
  return Type.Object(
    {
      ...base,
      event_type: Type.Literal(eventType),
      payload,
    },
    { additionalProperties: false },
  );
}

export const MEMORY_EVENT_BRANCH_SCHEMAS_V1 = Object.freeze([
  memoryEventBranchV1(
    "memory.point.created",
    MEMORY_EVENT_PAYLOAD_SCHEMAS_V1["memory.point.created"],
  ),
  memoryEventBranchV1(
    "memory.point.updated",
    MEMORY_EVENT_PAYLOAD_SCHEMAS_V1["memory.point.updated"],
  ),
  memoryEventBranchV1(
    "memory.series.created",
    MEMORY_EVENT_PAYLOAD_SCHEMAS_V1["memory.series.created"],
  ),
  memoryEventBranchV1(
    "memory.series.updated",
    MEMORY_EVENT_PAYLOAD_SCHEMAS_V1["memory.series.updated"],
  ),
  memoryEventBranchV1(
    "memory.conflict.detected",
    MEMORY_EVENT_PAYLOAD_SCHEMAS_V1["memory.conflict.detected"],
  ),
  memoryEventBranchV1(
    "memory.conflict.updated",
    MEMORY_EVENT_PAYLOAD_SCHEMAS_V1["memory.conflict.updated"],
  ),
  memoryEventBranchV1(
    "memory.integration.finished",
    MEMORY_EVENT_PAYLOAD_SCHEMAS_V1["memory.integration.finished"],
  ),
] as const);

export const MemoryEventEnvelopeV1Schema = Type.Union(
  [...MEMORY_EVENT_BRANCH_SCHEMAS_V1],
  { $id: "urn:pai:memory:event-envelope:v1" },
);

export type MemoryEventEnvelopeV1 = Static<
  typeof MemoryEventEnvelopeV1Schema
>;
export type MemoryEventTypeV1 = MemoryEventEnvelopeV1["event_type"];

export const MEMORY_EVENT_CONSUMERS_V1 = Object.freeze({
  "memory.point.created": Object.freeze(["meta", "memory_projection"]),
  "memory.point.updated": Object.freeze(["meta", "memory_projection"]),
  "memory.series.created": Object.freeze(["meta", "memory_projection"]),
  "memory.series.updated": Object.freeze(["meta", "memory_projection"]),
  "memory.conflict.detected": Object.freeze(["meta", "feedback_router"]),
  "memory.conflict.updated": Object.freeze([
    "meta",
    "feedback_router",
    "memory_projection",
  ]),
  "memory.integration.finished": Object.freeze(["operator_projection"]),
} satisfies Readonly<Record<MemoryEventTypeV1, readonly string[]>>);

export function memoryEventConsumersV1(
  eventType: MemoryEventTypeV1,
): readonly string[] {
  return MEMORY_EVENT_CONSUMERS_V1[eventType];
}

export function assertMemoryEventConsumerV1(
  eventType: MemoryEventTypeV1,
  consumer: string,
): void {
  if (!MEMORY_EVENT_CONSUMERS_V1[eventType].includes(consumer)) {
    throw new Error(`${consumer} is not allowed for ${eventType}`);
  }
}

export function assertMemoryEventEnvelopeSemanticBindingsV1(
  event: MemoryEventEnvelopeV1,
): void {
  if (Object.keys(event).length !== 8) {
    throw new Error("memory event envelope must contain exactly 8 fields");
  }
  const payload = event.payload;
  const expectedKey =
    payload.aggregate_type === "memory_point"
      ? `point:${payload.aggregate_id}:v${payload.aggregate_version}`
      : payload.aggregate_type === "memory_series"
        ? `series:${payload.aggregate_id}:v${payload.aggregate_version}`
        : payload.aggregate_type === "memory_conflict"
          ? `conflict:${payload.aggregate_id}:v${payload.aggregate_version}`
          : `integration:${payload.aggregate_id}:v${payload.aggregate_version}`;
  if (event.idempotency_key !== expectedKey) {
    throw new Error("memory event idempotency key binding mismatch");
  }
  let identity: readonly [string, number];
  switch (payload.aggregate_type) {
    case "memory_point":
      identity = [payload.memory_point_id, payload.state_version];
      break;
    case "memory_series":
      identity = [payload.series_id, payload.state_version];
      break;
    case "memory_conflict":
      identity = [payload.conflict_id, payload.conflict_version];
      break;
    case "integration_job":
      identity = [payload.integration_job_id, payload.aggregate_version];
      break;
  }
  if (
    identity[0] !== payload.aggregate_id ||
    identity[1] !== payload.aggregate_version
  ) {
    throw new Error("memory event aggregate identity/version mismatch");
  }
  if (
    event.event_type === "memory.conflict.detected" &&
    new Set(event.payload.evidence_refs).size !==
      event.payload.evidence_refs.length
  ) {
    throw new Error("memory conflict event contains duplicate evidence refs");
  }
  if (
    (event.event_type === "memory.point.updated" ||
      event.event_type === "memory.conflict.updated") &&
    new Set(
      event.payload.revision_refs.map(
        (revision) =>
          `${revision.aggregate_type}:${revision.aggregate_id}:${revision.revision_id}`,
      ),
    ).size !== event.payload.revision_refs.length
  ) {
    throw new Error("memory update event contains duplicate revision refs");
  }
  if (
    event.event_type === "memory.integration.finished" &&
    new Set(event.payload.failure_refs).size !==
      event.payload.failure_refs.length
  ) {
    throw new Error("memory integration event contains duplicate failure refs");
  }
}
