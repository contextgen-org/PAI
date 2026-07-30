import { Type, type Static } from "@sinclair/typebox";

import { MemoryTimestampV1Schema } from "./common.v1.js";
import { MemoryIdV1Schema } from "./write-batch.v1.js";

export const MEMORY_FAST_RECALL_PRIORITY_DIMENSIONS_V1 = [
  "recent",
  "keyword",
  "scene",
  "emotion",
  "summary_vector",
  "importance",
] as const;

export const MemoryFastRecallRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.fast_recall.v1"),
    bot_id: MemoryIdV1Schema,
    query: Type.String({ minLength: 1, maxUtf8Bytes: 16_384 }),
    query_purpose: Type.Union([
      Type.Literal("context_injection"),
      Type.Literal("user_search"),
      Type.Literal("agent_planning"),
    ]),
    topic_family_key: Type.Optional(MemoryIdV1Schema),
    subject_key: Type.Optional(MemoryIdV1Schema),
    priority_dimensions: Type.Optional(
      Type.Array(
        Type.Union(
          MEMORY_FAST_RECALL_PRIORITY_DIMENSIONS_V1.map((dimension) =>
            Type.Literal(dimension),
          ),
        ),
        { maxItems: 6, uniqueItems: true },
      ),
    ),
    include_downgraded: Type.Optional(Type.Boolean()),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 50,
        default: 8,
      }),
    ),
    snapshot_token: Type.Optional(MemoryIdV1Schema),
    cursor: Type.Optional(MemoryIdV1Schema),
  },
  {
    $id: "urn:pai:memory:fast-recall-request:v1",
    additionalProperties: false,
  },
);

export const MemoryFastRecallScoreBreakdownV1Schema = Type.Object(
  {
    vector: Type.Number({ minimum: 0, maximum: 1 }),
    keyword: Type.Number({ minimum: 0, maximum: 1 }),
    importance: Type.Number({ minimum: 0, maximum: 1 }),
    recency: Type.Number({ minimum: 0, maximum: 1 }),
    tag_boost: Type.Number({ minimum: 0, maximum: 0.05 }),
    status_decay: Type.Union([Type.Literal(0.5), Type.Literal(1)]),
    final_score: Type.Number({ minimum: 0, maximum: 1 }),
  },
  { additionalProperties: false },
);

export const MemoryFastRecallItemV1Schema = Type.Object(
  {
    memory_point_id: MemoryIdV1Schema,
    series_id: MemoryIdV1Schema,
    topic_family_key: MemoryIdV1Schema,
    topic_key: MemoryIdV1Schema,
    content_summary: Type.String({
      minLength: 1,
      maxUtf8Bytes: 16_384,
    }),
    occurred_at: MemoryTimestampV1Schema,
    status: Type.Union([
      Type.Literal("active"),
      Type.Literal("downgraded"),
    ]),
    score_breakdown: MemoryFastRecallScoreBreakdownV1Schema,
    redaction_status: Type.Union([
      Type.Literal("redacted"),
      Type.Literal("not_required"),
    ]),
  },
  { additionalProperties: false },
);

export const MemoryFastRecallResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.fast_recall.v1"),
    snapshot_token: MemoryIdV1Schema,
    query_revision: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    ranking_profile_version: Type.Literal("memory.fast_recall.ranking.v1"),
    items: Type.Array(MemoryFastRecallItemV1Schema, { maxItems: 50 }),
    next_cursor: Type.Optional(MemoryIdV1Schema),
    is_partial: Type.Boolean(),
    partial_reason: Type.Optional(
      Type.String({ minLength: 1, maxUtf8Bytes: 1_024 }),
    ),
  },
  {
    $id: "urn:pai:memory:fast-recall-response:v1",
    additionalProperties: false,
  },
);

export const MemoryFastRecallV1Schema = Type.Union(
  [MemoryFastRecallRequestV1Schema, MemoryFastRecallResponseV1Schema],
  { $id: "urn:pai:memory:fast-recall:v1" },
);

export type MemoryFastRecallRequestV1 = Static<
  typeof MemoryFastRecallRequestV1Schema
>;
export type MemoryFastRecallScoreBreakdownV1 = Static<
  typeof MemoryFastRecallScoreBreakdownV1Schema
>;
export type MemoryFastRecallItemV1 = Static<
  typeof MemoryFastRecallItemV1Schema
>;
export type MemoryFastRecallResponseV1 = Static<
  typeof MemoryFastRecallResponseV1Schema
>;

export function assertMemoryFastRecallRequestSemanticBindingsV1(
  request: MemoryFastRecallRequestV1,
): void {
  if (
    (request.cursor === undefined) !==
    (request.snapshot_token === undefined)
  ) {
    throw new Error(
      "memory fast recall snapshot_token and cursor must be provided together",
    );
  }
}

export function assertMemoryFastRecallResponseSemanticBindingsV1(
  response: MemoryFastRecallResponseV1,
): void {
  if (
    response.is_partial !== (response.partial_reason !== undefined) ||
    new Set(response.items.map((item) => item.memory_point_id)).size !==
      response.items.length
  ) {
    throw new Error("memory fast recall response semantic binding mismatch");
  }
}
