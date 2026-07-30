import { Type, type Static, type TSchema } from "@sinclair/typebox";

import { DurableEventEnvelopeV1Schema } from "../shared/durable-event-envelope.v1.js";
import { ServiceIdV1Schema } from "../shared/service-id.v1.js";

const identifier = Type.String({ minLength: 1, maxLength: 512 });
const nullableIdentifier = Type.Union([identifier, Type.Null()]);

export const QUALITY_SIGNAL_TYPES_V1 = [
  "snapshot_missing",
  "snapshot_incomplete",
  "snapshot_schema_incompatible",
  "snapshot_hash_mismatch",
  "artifact_unreadable",
  "redaction_incomplete",
  "llm_parse_failed",
  "schema_validation_failed",
  "memory_write_partial_failed",
  "knowthat_conflict_detected",
  "tool_execution_failed",
  "user_dissatisfied",
  "low_confidence_extraction",
  "feedback_required",
  "downstream_operation_failed",
] as const;

export const QualitySignalTypeV1Schema = Type.Union(
  QUALITY_SIGNAL_TYPES_V1.map((signalType) => Type.Literal(signalType)),
);
export const QualitySignalSeverityV1Schema = Type.Union([
  Type.Literal("info"),
  Type.Literal("warning"),
  Type.Literal("error"),
  Type.Literal("critical"),
]);

const safeJsonScalar = Type.Union([
  Type.String({ maxLength: 16_384 }),
  Type.Number(),
  Type.Boolean(),
  Type.Null(),
]);
const safeJsonArray = Type.Array(safeJsonScalar, { maxItems: 256 });
const safeJsonValue = Type.Union([safeJsonScalar, safeJsonArray]);
const safeSummary = Type.Record(
  Type.String({ minLength: 1, maxLength: 128 }),
  safeJsonValue,
  { maxProperties: 128 },
);

function signalBase<T extends Record<string, TSchema>>(source: T) {
  return Type.Object(
    {
      id: identifier,
      signal_type: QualitySignalTypeV1Schema,
      severity: QualitySignalSeverityV1Schema,
      ...source,
      source_ref: identifier,
      evidence_refs: Type.Array(identifier, {
        maxItems: 10_000,
        uniqueItems: true,
      }),
      recommended_action: Type.Union([
        Type.String({ minLength: 1, maxLength: 4_096 }),
        Type.Null(),
      ]),
      payload_summary: safeSummary,
      created_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
    },
    { additionalProperties: false },
  );
}

export const QualitySignalQueryItemV1Schema = Type.Union([
  signalBase({
    source_kind: Type.Literal("service"),
    source_service: ServiceIdV1Schema,
    actor_principal: Type.Null(),
    actor_role: Type.Null(),
  }),
  signalBase({
    source_kind: Type.Union([
      Type.Literal("manual"),
      Type.Literal("operator"),
      Type.Literal("offline_repair"),
    ]),
    source_service: Type.Null(),
    actor_principal: nullableIdentifier,
    actor_role: nullableIdentifier,
  }),
]);

export const QualitySignalListDetailsV1Schema = Type.Object(
  {
    trigger_process_id: identifier,
    bot_id: identifier,
    items: Type.Array(QualitySignalQueryItemV1Schema, { maxItems: 200 }),
    next_cursor: nullableIdentifier,
    has_more: Type.Boolean(),
    trace_id: identifier,
  },
  {
    $id: "urn:pai:meta:quality-signal-list-details:v1",
    additionalProperties: false,
  },
);

export type QualitySignalQueryItemV1 = Static<
  typeof QualitySignalQueryItemV1Schema
>;
export type QualitySignalListDetailsV1 = Static<
  typeof QualitySignalListDetailsV1Schema
>;

export function assertQualitySignalListDetailsSemanticBindingsV1(
  details: QualitySignalListDetailsV1,
): void {
  if (details.has_more !== (details.next_cursor !== null)) {
    throw new Error("QualitySignalListDetailsV1 cursor binding mismatch");
  }
  let previous: QualitySignalQueryItemV1 | undefined;
  for (const item of details.items) {
    if (
      item.source_kind !== "service" &&
      item.actor_principal === null &&
      item.actor_role === null
    ) {
      throw new Error("QualitySignalListDetailsV1 source binding mismatch");
    }
    if (previous !== undefined) {
      const previousCreated = Date.parse(previous.created_at);
      const currentCreated = Date.parse(item.created_at);
      if (
        previousCreated < currentCreated ||
        (previousCreated === currentCreated &&
          previous.id.localeCompare(item.id) <= 0)
      ) {
        throw new Error("QualitySignalListDetailsV1 ordering mismatch");
      }
    }
    previous = item;
  }
}
