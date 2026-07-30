import { Type, type Static, type TSchema } from "@sinclair/typebox";

import { DurableEventEnvelopeV1Schema } from "../shared/durable-event-envelope.v1.js";
import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import { KnowThatLinkageCheckRefV1Schema } from "./linkage-check-ref.v1.js";
import {
  KnowThatCategoryV1Schema,
  KnowThatIdV1Schema,
  KnowThatJsonValueV1Schema,
  KnowThatScopeV1Schema,
  assertKnowThatSchemaV1,
} from "./primitives.v1.js";

const basePayload = {
  ...KnowThatScopeV1Schema.properties,
};

export const KnowThatFactEventPayloadV1Schema = Type.Object(
  {
    ...basePayload,
    fact_id: KnowThatIdV1Schema,
    semantic_key: Type.String({ minLength: 1, maxLength: 256 }),
    category: KnowThatCategoryV1Schema,
    previous_status: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
    current_status: Type.String({ minLength: 1, maxLength: 64 }),
    revision_id: Type.Optional(KnowThatIdV1Schema),
    source_ref: TypedEvidenceRefV1Schema,
  },
  { additionalProperties: false },
);

export const KnowThatCandidateEventPayloadV1Schema = Type.Object(
  {
    ...basePayload,
    candidate_id: KnowThatIdV1Schema,
    fact_id: Type.Optional(KnowThatIdV1Schema),
    decision: Type.Union([
      Type.Literal("promoted"),
      Type.Literal("rejected"),
    ]),
    review_id: Type.Optional(KnowThatIdV1Schema),
    reason: Type.String({ minLength: 1, maxLength: 4_096 }),
    evidence_refs: Type.Array(TypedEvidenceRefV1Schema, {
      maxItems: 64,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

export const KnowThatConflictDetectedPayloadV1Schema = Type.Object(
  {
    ...basePayload,
    conflict_id: KnowThatIdV1Schema,
    left_fact_id: KnowThatIdV1Schema,
    right_fact_id: KnowThatIdV1Schema,
    semantic_key: Type.String({ minLength: 1, maxLength: 256 }),
    conflict_type: Type.Union([
      Type.Literal("value_contradiction"),
      Type.Literal("source_contradiction"),
    ]),
    source_priority_snapshot: Type.Record(
      Type.String(),
      KnowThatJsonValueV1Schema,
    ),
    confidence_delta: Type.Number({ minimum: 0, maximum: 1 }),
    status: Type.Union([
      Type.Literal("open"),
      Type.Literal("auto_resolved"),
      Type.Literal("feedback_requested"),
      Type.Literal("resolved"),
      Type.Literal("ignored"),
    ]),
    proposed_resolution: Type.Record(
      Type.String(),
      KnowThatJsonValueV1Schema,
    ),
  },
  { additionalProperties: false },
);

export const KnowThatLinkageCheckRequestedPayloadV1Schema = Type.Object(
  {
    ...basePayload,
    linkage_check_id: KnowThatIdV1Schema,
    source_service: Type.Literal("knowthat"),
    source_ref: KnowThatLinkageCheckRefV1Schema,
    source_fact_id: KnowThatIdV1Schema,
    source_linkage_check_id: KnowThatIdV1Schema,
    source_memory_point_id: Type.Optional(KnowThatIdV1Schema),
    check_type: Type.String({ minLength: 1, maxLength: 256 }),
    operation: Type.Union([
      Type.Literal("downgrade"),
      Type.Literal("mark_historical"),
      Type.Literal("append_version"),
      Type.Literal("feedback_required"),
      Type.Literal("no_op"),
    ]),
    linked_memory_point_ids: Type.Array(KnowThatIdV1Schema, {
      maxItems: 256,
      uniqueItems: true,
    }),
    relationship_edge_changes: Type.Optional(
      Type.Array(
        Type.Record(Type.String(), KnowThatJsonValueV1Schema),
        { maxItems: 256 },
      ),
    ),
    historical_payload: Type.Optional(
      Type.Record(Type.String(), KnowThatJsonValueV1Schema),
    ),
    reason: Type.String({ minLength: 1, maxLength: 4_096 }),
    evidence_refs: Type.Array(TypedEvidenceRefV1Schema, {
      maxItems: 64,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

export const KNOWTHAT_EVENT_PAYLOAD_SCHEMAS_V1 = Object.freeze({
  "knowthat.fact.created": KnowThatFactEventPayloadV1Schema,
  "knowthat.fact.updated": KnowThatFactEventPayloadV1Schema,
  "knowthat.candidate.promoted": KnowThatCandidateEventPayloadV1Schema,
  "knowthat.candidate.rejected": KnowThatCandidateEventPayloadV1Schema,
  "knowthat.fact.expired": KnowThatFactEventPayloadV1Schema,
  "knowthat.conflict.detected": KnowThatConflictDetectedPayloadV1Schema,
  "knowthat.linkage_check.requested":
    KnowThatLinkageCheckRequestedPayloadV1Schema,
} as const satisfies Readonly<Record<string, TSchema>>);

export const KNOWTHAT_EVENT_CONSUMERS_V1 = Object.freeze({
  "knowthat.fact.created": Object.freeze(["knowthat"]),
  "knowthat.fact.updated": Object.freeze(["knowthat"]),
  "knowthat.candidate.promoted": Object.freeze(["knowthat"]),
  "knowthat.candidate.rejected": Object.freeze(["knowthat"]),
  "knowthat.fact.expired": Object.freeze(["knowthat"]),
  "knowthat.conflict.detected": Object.freeze(["knowthat"]),
  "knowthat.linkage_check.requested": Object.freeze(["memory"]),
} as const);

const eventBranches = Object.entries(
  KNOWTHAT_EVENT_PAYLOAD_SCHEMAS_V1,
).map(([eventType, payloadSchema]) =>
  Type.Object(
    {
      event_id: DurableEventEnvelopeV1Schema.properties.event_id,
      event_type: Type.Literal(eventType),
      schema_version: Type.Literal("knowthat_event.v1"),
      producer: Type.Literal("knowthat"),
      occurred_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
      idempotency_key:
        DurableEventEnvelopeV1Schema.properties.idempotency_key,
      trace_id: DurableEventEnvelopeV1Schema.properties.trace_id,
      payload: payloadSchema,
    },
    { additionalProperties: false },
  ),
);

export const KnowThatEventEnvelopeV1Schema = Type.Union(eventBranches, {
  $id: "urn:pai:knowthat:event-envelope:v1",
});

export type KnowThatEventEnvelopeV1 = Static<
  typeof KnowThatEventEnvelopeV1Schema
>;

export function assertKnowThatEventEnvelopeV1(
  value: unknown,
): asserts value is KnowThatEventEnvelopeV1 {
  assertKnowThatSchemaV1(
    KnowThatEventEnvelopeV1Schema,
    value,
    "KnowThat durable event envelope",
  );
}
