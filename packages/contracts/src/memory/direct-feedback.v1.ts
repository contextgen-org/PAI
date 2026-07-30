import { Type, type Static } from "@sinclair/typebox";

import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  MemoryPointStatusV1Schema,
  MemoryRevisionRefV1Schema,
  MemorySeriesStatusV1Schema,
  MemoryTimestampV1Schema,
  assertSortedUniqueStringsV1,
  assertUniqueIdsV1,
} from "./common.v1.js";
import { MemoryIdV1Schema } from "./write-batch.v1.js";

export const MemoryDirectFeedbackRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.direct_feedback.v1"),
    bot_id: MemoryIdV1Schema,
    target_type: Type.Union([
      Type.Literal("memory_point"),
      Type.Literal("series"),
    ]),
    target_id: MemoryIdV1Schema,
    action: Type.Union([
      Type.Literal("confirm"),
      Type.Literal("correct"),
      Type.Literal("reject"),
      Type.Literal("merge"),
      Type.Literal("suppress"),
    ]),
    expected_state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    reason: Type.String({ minLength: 1, maxUtf8Bytes: 4_096 }),
    correction: Type.Optional(
      Type.Object(
        {
          content_summary: Type.String({
            minLength: 1,
            maxUtf8Bytes: 16_384,
          }),
          occurred_at: Type.Optional(MemoryTimestampV1Schema),
        },
        { additionalProperties: false },
      ),
    ),
    merge_target_series_id: Type.Optional(MemoryIdV1Schema),
    conflict_id: Type.Optional(MemoryIdV1Schema),
    evidence_ref: TypedEvidenceRefV1Schema,
  },
  {
    $id: "urn:pai:memory:direct-feedback-request:v1",
    additionalProperties: false,
    maxCanonicalJsonBytes: 65_536,
  },
);

const feedbackResponseBase = {
  schema_version: Type.Literal("memory.direct_feedback.v1"),
  feedback_id: MemoryIdV1Schema,
  target_id: MemoryIdV1Schema,
  previous_state_version: Type.Integer({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  }),
  state_version: Type.Integer({
    minimum: 2,
    maximum: Number.MAX_SAFE_INTEGER,
  }),
  revision_refs: Type.Array(MemoryRevisionRefV1Schema, {
    minItems: 1,
    maxItems: 64,
  }),
  audit_ids: Type.Array(MemoryIdV1Schema, {
    minItems: 1,
    maxItems: 64,
    uniqueItems: true,
  }),
  event_ids: Type.Array(MemoryIdV1Schema, {
    minItems: 1,
    maxItems: 64,
    uniqueItems: true,
  }),
  duplicate_replayed: Type.Boolean(),
} as const;

export const MemoryDirectFeedbackResponseV1Schema = Type.Union([
  Type.Object(
    {
      ...feedbackResponseBase,
      target_type: Type.Literal("memory_point"),
      resulting_status: MemoryPointStatusV1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...feedbackResponseBase,
      target_type: Type.Literal("series"),
      resulting_status: MemorySeriesStatusV1Schema,
    },
    { additionalProperties: false },
  ),
]);

export const MemoryDirectFeedbackV1Schema = Type.Union(
  [MemoryDirectFeedbackRequestV1Schema, MemoryDirectFeedbackResponseV1Schema],
  { $id: "urn:pai:memory:direct-feedback:v1" },
);

export type MemoryDirectFeedbackRequestV1 = Static<
  typeof MemoryDirectFeedbackRequestV1Schema
>;
export type MemoryDirectFeedbackResponseV1 = Static<
  typeof MemoryDirectFeedbackResponseV1Schema
>;

export function assertMemoryDirectFeedbackRequestSemanticBindingsV1(
  request: MemoryDirectFeedbackRequestV1,
): void {
  if (
    (request.action === "correct") !== (request.correction !== undefined) ||
    (request.action === "merge") !==
      (request.merge_target_series_id !== undefined)
  ) {
    throw new Error("direct feedback action payload binding mismatch");
  }
  if (
    request.merge_target_series_id !== undefined &&
    request.merge_target_series_id === request.target_id
  ) {
    throw new Error("direct feedback cannot merge a series into itself");
  }
}

export function assertMemoryDirectFeedbackResponseSemanticBindingsV1(
  response: MemoryDirectFeedbackResponseV1,
): void {
  if (response.state_version !== response.previous_state_version + 1) {
    throw new Error("direct feedback state version must increment by one");
  }
  assertUniqueIdsV1(
    response.revision_refs.map(
      (revision) =>
        `${revision.aggregate_type}:${revision.aggregate_id}:${revision.revision_id}`,
    ),
    "revision_refs",
  );
  assertSortedUniqueStringsV1(
    response.revision_refs.map(
      (revision) =>
        `${revision.aggregate_type}:${revision.aggregate_id}:${revision.revision_id}`,
    ),
    "revision_refs",
  );
  assertSortedUniqueStringsV1(response.audit_ids, "audit_ids");
  assertSortedUniqueStringsV1(response.event_ids, "event_ids");
  if (
    !response.revision_refs.some(
      (revision) =>
        revision.aggregate_id === response.target_id &&
        revision.aggregate_type ===
          (response.target_type === "memory_point"
            ? "memory_point"
            : "memory_series"),
    )
  ) {
    throw new Error("direct feedback response omits target revision");
  }
}
