import { Type, type Static } from "@sinclair/typebox";

import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  KnowThatCategoryV1Schema,
  KnowThatExplicitnessV1Schema,
  KnowThatIdV1Schema,
  KnowThatRiskLevelV1Schema,
  KnowThatScopeV1Schema,
  KnowThatSourceV1Schema,
  KnowThatTimestampV1Schema,
  KnowThatTraceIdV1Schema,
  assertKnowThatSchemaV1,
} from "./primitives.v1.js";

export const KnowThatWriteItemV1Schema = Type.Object(
  {
    client_item_id: KnowThatIdV1Schema,
    text: Type.String({ minLength: 1, maxLength: 16_384 }),
    subject: Type.String({ minLength: 1, maxLength: 4_096 }),
    predicate: Type.String({ minLength: 1, maxLength: 4_096 }),
    object: Type.String({ minLength: 1, maxLength: 4_096 }),
    category: KnowThatCategoryV1Schema,
    semantic_key_candidate: Type.Optional(
      Type.String({ minLength: 1, maxLength: 4_096 }),
    ),
    proposed_status: Type.Union([
      Type.Literal("candidate"),
      Type.Literal("active"),
    ]),
    direct_active_hint: Type.Boolean(),
    direct_active_reason: Type.Optional(
      Type.Union([
        Type.Literal("user_explicit"),
        Type.Literal("low_risk"),
        Type.Literal("multi_source"),
        Type.Literal("system_event"),
      ]),
    ),
    risk_level: KnowThatRiskLevelV1Schema,
    explicitness: KnowThatExplicitnessV1Schema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    source: KnowThatSourceV1Schema,
    source_ref: TypedEvidenceRefV1Schema,
    evidence_refs: Type.Array(TypedEvidenceRefV1Schema, {
      minItems: 1,
      maxItems: 64,
      uniqueItems: true,
    }),
    valid_from: Type.Optional(KnowThatTimestampV1Schema),
    valid_until: Type.Optional(KnowThatTimestampV1Schema),
    evidence_pending: Type.Boolean(),
    evidence_pending_reason: Type.Optional(
      Type.String({ minLength: 1, maxLength: 4_096 }),
    ),
  },
  {
    additionalProperties: false,
    maxCanonicalJsonBytes: 65_536,
  },
);

export const KnowThatWriteBatchRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("knowthat.write_batch.v1"),
    ...KnowThatScopeV1Schema.properties,
    trigger_process_id: KnowThatIdV1Schema,
    source_meta_job_id: KnowThatIdV1Schema,
    idempotency_key: Type.String({ minLength: 1, maxLength: 128 }),
    trace_id: KnowThatTraceIdV1Schema,
    items: Type.Array(KnowThatWriteItemV1Schema, {
      minItems: 1,
      maxItems: 100,
      uniqueByCanonicalIdentity: "client_item_id",
    }),
  },
  {
    $id: "urn:pai:knowthat:write-batch-request:v1",
    additionalProperties: false,
    maxCanonicalJsonBytes: 2_097_152,
  },
);

export const KnowThatAcceptedItemV1Schema = Type.Object(
  {
    client_item_id: KnowThatIdV1Schema,
    status: Type.Literal("succeeded"),
    semantic_key: Type.String({ minLength: 1, maxLength: 256 }),
    final_status: Type.Union([
      Type.Literal("active"),
      Type.Literal("candidate"),
    ]),
    fact_id: KnowThatIdV1Schema,
    decision_reason: Type.String({ minLength: 1, maxLength: 256 }),
    representative_client_item_id: KnowThatIdV1Schema,
    group_role: Type.Union([
      Type.Literal("representative"),
      Type.Literal("merged"),
      Type.Literal("conflict"),
    ]),
    conflict_id: Type.Optional(KnowThatIdV1Schema),
    linkage_check_ids: Type.Array(KnowThatIdV1Schema, {
      maxItems: 256,
      uniqueItems: true,
    }),
    duplicate_replayed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const KnowThatRejectedItemV1Schema = Type.Object(
  {
    client_item_id: KnowThatIdV1Schema,
    status: Type.Literal("rejected"),
    code: Type.String({ minLength: 1, maxLength: 128 }),
    message: Type.String({ minLength: 1, maxLength: 4_096 }),
    field_path: Type.Optional(
      Type.String({ minLength: 1, maxLength: 2_048 }),
    ),
  },
  { additionalProperties: false },
);

export const KnowThatWriteBatchResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("knowthat.write_batch.v1"),
    write_batch_id: KnowThatIdV1Schema,
    batch_status: Type.Union([
      Type.Literal("completed"),
      Type.Literal("partial_failed"),
    ]),
    item_results: Type.Array(
      Type.Union([
        KnowThatAcceptedItemV1Schema,
        KnowThatRejectedItemV1Schema,
      ]),
      { minItems: 1, maxItems: 100 },
    ),
    active_fact_ids: Type.Array(KnowThatIdV1Schema, {
      maxItems: 100,
      uniqueItems: true,
    }),
    candidate_fact_ids: Type.Array(KnowThatIdV1Schema, {
      maxItems: 100,
      uniqueItems: true,
    }),
    rejected_items: Type.Array(KnowThatRejectedItemV1Schema, {
      maxItems: 100,
    }),
    conflict_ids: Type.Array(KnowThatIdV1Schema, {
      maxItems: 100,
      uniqueItems: true,
    }),
    linkage_check_ids: Type.Array(KnowThatIdV1Schema, {
      maxItems: 256,
      uniqueItems: true,
    }),
    duplicate_replayed: Type.Boolean(),
  },
  {
    $id: "urn:pai:knowthat:write-batch-response:v1",
    additionalProperties: false,
  },
);

export const KnowThatWriteBatchV1Schema = Type.Union(
  [KnowThatWriteBatchRequestV1Schema, KnowThatWriteBatchResponseV1Schema],
  { $id: "urn:pai:knowthat:write-batch:v1" },
);

export type KnowThatWriteItemV1 = Static<
  typeof KnowThatWriteItemV1Schema
>;
export type KnowThatWriteBatchRequestV1 = Static<
  typeof KnowThatWriteBatchRequestV1Schema
>;
export type KnowThatAcceptedItemV1 = Static<
  typeof KnowThatAcceptedItemV1Schema
>;
export type KnowThatRejectedItemV1 = Static<
  typeof KnowThatRejectedItemV1Schema
>;
export type KnowThatWriteBatchResponseV1 = Static<
  typeof KnowThatWriteBatchResponseV1Schema
>;

export function assertKnowThatWriteBatchSemanticBindingsV1(
  request: KnowThatWriteBatchRequestV1,
): void {
  const clientItemIds = new Set<string>();
  for (const item of request.items) {
    if (clientItemIds.has(item.client_item_id)) {
      throw new Error("KnowThat client_item_id values must be unique");
    }
    clientItemIds.add(item.client_item_id);
    if (
      !item.evidence_refs.includes(item.source_ref) ||
      (item.direct_active_hint &&
        item.direct_active_reason === undefined) ||
      (item.proposed_status === "candidate" && item.direct_active_hint) ||
      (item.evidence_pending &&
        (item.evidence_pending_reason === undefined ||
          item.proposed_status !== "candidate" ||
          item.direct_active_hint)) ||
      (!item.evidence_pending &&
        item.evidence_pending_reason !== undefined) ||
      (item.valid_from !== undefined &&
        item.valid_until !== undefined &&
        Date.parse(item.valid_from) >= Date.parse(item.valid_until))
    ) {
      throw new Error("KnowThat write item semantic binding mismatch");
    }
  }
}

export function assertKnowThatWriteBatchRequestV1(
  value: unknown,
): asserts value is KnowThatWriteBatchRequestV1 {
  assertKnowThatSchemaV1(
    KnowThatWriteBatchRequestV1Schema,
    value,
    "KnowThat write batch request",
  );
  assertKnowThatWriteBatchSemanticBindingsV1(value);
}

export function assertKnowThatWriteBatchResponseSemanticBindingsV1(
  response: KnowThatWriteBatchResponseV1,
): void {
  const accepted = response.item_results.filter(
    (item): item is KnowThatAcceptedItemV1 => item.status === "succeeded",
  );
  const rejected = response.item_results.filter(
    (item): item is KnowThatRejectedItemV1 => item.status === "rejected",
  );
  const exactSet = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length &&
    left.every((value) => right.includes(value));
  if (
    response.batch_status !==
      (rejected.length === 0 ? "completed" : "partial_failed") ||
    !exactSet(
      response.active_fact_ids,
      accepted
        .filter((item) => item.final_status === "active")
        .map((item) => item.fact_id),
    ) ||
    !exactSet(
      response.candidate_fact_ids,
      accepted
        .filter((item) => item.final_status === "candidate")
        .map((item) => item.fact_id),
    ) ||
    rejected.length !== response.rejected_items.length ||
    rejected.some(
      (item) =>
        !response.rejected_items.some(
          (entry) =>
            entry.client_item_id === item.client_item_id &&
            entry.code === item.code,
        ),
    )
  ) {
    throw new Error("KnowThat write batch response projection mismatch");
  }
}

export function assertKnowThatWriteBatchResponseV1(
  value: unknown,
): asserts value is KnowThatWriteBatchResponseV1 {
  assertKnowThatSchemaV1(
    KnowThatWriteBatchResponseV1Schema,
    value,
    "KnowThat write batch response",
  );
  assertKnowThatWriteBatchResponseSemanticBindingsV1(value);
}
