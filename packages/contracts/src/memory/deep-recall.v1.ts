import { Type, type Static } from "@sinclair/typebox";

import {
  MemorySha256V1Schema,
  assertUniqueIdsV1,
} from "./common.v1.js";
import { MemoryIdV1Schema } from "./write-batch.v1.js";

export const MEMORY_DEEP_RECALL_CHANNELS_V1 = [
  "semantic",
  "timeline",
  "relationship",
] as const;

const channelSchema = Type.Union(
  MEMORY_DEEP_RECALL_CHANNELS_V1.map((channel) => Type.Literal(channel)),
);

export const MemoryDeepRecallRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.deep_recall.v1"),
    bot_id: MemoryIdV1Schema,
    owner_agent_id: MemoryIdV1Schema,
    runtime_run_id: MemoryIdV1Schema,
    trigger_process_id: MemoryIdV1Schema,
    query: Type.String({ minLength: 1, maxUtf8Bytes: 16_384 }),
    scope: Type.Object(
      {
        channels: Type.Array(channelSchema, {
          minItems: 1,
          maxItems: 3,
          uniqueItems: true,
        }),
      },
      { additionalProperties: false },
    ),
    limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
    ),
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    policy_snapshot_id: MemoryIdV1Schema,
    policy_snapshot_hash: MemorySha256V1Schema,
    capability_token: Type.String({
      minLength: 1,
      maxUtf8Bytes: 16_384,
    }),
    capability_token_id: MemoryIdV1Schema,
    graph_profile_version: Type.Literal("memory.deep_recall_graph.v1"),
  },
  {
    $id: "urn:pai:memory:deep-recall-request:v1",
    additionalProperties: false,
    maxCanonicalJsonBytes: 65_536,
  },
);

const relationshipStepSchema = Type.Object(
  {
    edge_id: MemoryIdV1Schema,
    edge_type: Type.Union([
      Type.Literal("co_occurs"),
      Type.Literal("relates_to"),
      Type.Literal("supports"),
      Type.Literal("contradicts"),
      Type.Literal("supersedes"),
    ]),
    from_id: MemoryIdV1Schema,
    to_id: MemoryIdV1Schema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
  },
  { additionalProperties: false },
);

export const MemoryDeepRecallItemV1Schema = Type.Object(
  {
    memory_point_id: MemoryIdV1Schema,
    series_id: MemoryIdV1Schema,
    topic_family_key: MemoryIdV1Schema,
    content_summary: Type.String({
      minLength: 1,
      maxUtf8Bytes: 16_384,
    }),
    matched_channels: Type.Array(channelSchema, {
      minItems: 1,
      maxItems: 3,
      uniqueItems: true,
    }),
    channel_ranks: Type.Object(
      {
        semantic: Type.Optional(
          Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
        ),
        timeline: Type.Optional(
          Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
        ),
        relationship: Type.Optional(
          Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
        ),
      },
      { additionalProperties: false },
    ),
    raw_rrf_score: Type.Number({ minimum: 0 }),
    normalized_rrf_score: Type.Number({ minimum: 0, maximum: 1 }),
    importance_score: Type.Number({ minimum: 0, maximum: 1 }),
    recency_score: Type.Number({ minimum: 0, maximum: 1 }),
    final_score: Type.Number({ minimum: 0, maximum: 1 }),
    relationship_path: Type.Array(relationshipStepSchema, {
      maxItems: 64,
    }),
    redaction_status: Type.Union([
      Type.Literal("redacted"),
      Type.Literal("not_required"),
    ]),
  },
  { additionalProperties: false },
);

export const MemoryDeepRecallResponseV1Schema = Type.Object(
  {
    code: Type.Literal("memory_deep_recall_completed"),
    message: Type.String({ minLength: 1, maxUtf8Bytes: 1_024 }),
    retryable: Type.Literal(false),
    details: Type.Object(
      {
        request_id: MemoryIdV1Schema,
        ranking_profile_version: Type.Literal("memory.deep_recall.rrf.v1"),
        graph_profile_version: Type.Literal("memory.deep_recall_graph.v1"),
        items: Type.Array(MemoryDeepRecallItemV1Schema, {
          maxItems: 100,
        }),
        actual_graph_budget: Type.Object(
          {
            max_hops: Type.Integer({ minimum: 0, maximum: 2 }),
            nodes_visited: Type.Integer({
              minimum: 0,
              maximum: Number.MAX_SAFE_INTEGER,
            }),
            edges_visited: Type.Integer({
              minimum: 0,
              maximum: Number.MAX_SAFE_INTEGER,
            }),
          },
          { additionalProperties: false },
        ),
        is_partial: Type.Boolean(),
        completed_channels: Type.Array(channelSchema, {
          maxItems: 3,
          uniqueItems: true,
        }),
        missing_channels: Type.Array(channelSchema, {
          maxItems: 3,
          uniqueItems: true,
        }),
        second_query_executed: Type.Boolean(),
        partial_reason: Type.Union([
          Type.String({ minLength: 1, maxUtf8Bytes: 1_024 }),
          Type.Null(),
        ]),
      },
      { additionalProperties: false },
    ),
    trace_id: MemoryIdV1Schema,
  },
  {
    $id: "urn:pai:memory:deep-recall-response:v1",
    additionalProperties: false,
  },
);

export const MemoryDeepRecallV1Schema = Type.Union(
  [MemoryDeepRecallRequestV1Schema, MemoryDeepRecallResponseV1Schema],
  { $id: "urn:pai:memory:deep-recall:v1" },
);

export type MemoryDeepRecallRequestV1 = Static<
  typeof MemoryDeepRecallRequestV1Schema
>;
export type MemoryDeepRecallItemV1 = Static<
  typeof MemoryDeepRecallItemV1Schema
>;
export type MemoryDeepRecallResponseV1 = Static<
  typeof MemoryDeepRecallResponseV1Schema
>;

export function assertMemoryDeepRecallRequestSemanticBindingsV1(
  request: MemoryDeepRecallRequestV1,
): void {
  assertUniqueIdsV1(request.scope.channels, "scope.channels");
}

export function assertMemoryDeepRecallResponseSemanticBindingsV1(
  response: MemoryDeepRecallResponseV1,
): void {
  const details = response.details;
  const partial =
    details.missing_channels.length > 0 ||
    details.partial_reason !== null;
  if (details.is_partial !== partial) {
    throw new Error("deep recall partial result binding mismatch");
  }
  const completed = new Set(details.completed_channels);
  if (details.missing_channels.some((channel) => completed.has(channel))) {
    throw new Error("deep recall channel sets must be disjoint");
  }
  if (
    new Set(details.items.map((item) => item.memory_point_id)).size !==
    details.items.length
  ) {
    throw new Error("deep recall items contain duplicate points");
  }
  for (const item of details.items) {
    const matched = [...item.matched_channels].sort();
    const ranked = Object.keys(item.channel_ranks).sort();
    if (
      matched.length !== ranked.length ||
      matched.some((channel, index) => channel !== ranked[index])
    ) {
      throw new Error("deep recall channel rank binding mismatch");
    }
  }
}
