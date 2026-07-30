import { Type, type Static } from "@sinclair/typebox";

import { MemoryIdV1Schema } from "./write-batch.v1.js";

const edgeTypeSchema = Type.Union([
  Type.Literal("co_occurs"),
  Type.Literal("relates_to"),
  Type.Literal("supports"),
  Type.Literal("contradicts"),
  Type.Literal("supersedes"),
]);

export const MemoryGraphBuildRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.association_graph.v1"),
    bot_id: MemoryIdV1Schema,
    seed_memory_point_ids: Type.Array(MemoryIdV1Schema, {
      minItems: 1,
      maxItems: 1_000,
      uniqueItems: true,
    }),
    seed_series_ids: Type.Optional(
      Type.Array(MemoryIdV1Schema, {
        maxItems: 1_000,
        uniqueItems: true,
      }),
    ),
    seed_subject_keys: Type.Optional(
      Type.Array(MemoryIdV1Schema, {
        maxItems: 1_000,
        uniqueItems: true,
      }),
    ),
    edge_types: Type.Optional(
      Type.Array(edgeTypeSchema, {
        minItems: 1,
        maxItems: 5,
        uniqueItems: true,
      }),
    ),
    max_hops: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
    max_nodes: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000 })),
    max_edges: Type.Optional(Type.Integer({ minimum: 1, maximum: 50_000 })),
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    policy_snapshot_id: MemoryIdV1Schema,
    capability_token: Type.String({
      minLength: 1,
      maxUtf8Bytes: 16_384,
    }),
  },
  {
    $id: "urn:pai:memory:graph-build-request:v1",
    additionalProperties: false,
    maxCanonicalJsonBytes: 65_536,
  },
);

export const MemoryGraphBuildResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.association_graph.v1"),
    graph_id: MemoryIdV1Schema,
    graph_revision: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    nodes: Type.Array(
      Type.Object(
        {
          type: Type.Union([
            Type.Literal("memory_point"),
            Type.Literal("memory_series"),
            Type.Literal("subject"),
          ]),
          id: MemoryIdV1Schema,
          redaction_status: Type.Union([
            Type.Literal("redacted"),
            Type.Literal("not_required"),
          ]),
        },
        { additionalProperties: false },
      ),
      { maxItems: 10_000 },
    ),
    edges: Type.Array(
      Type.Object(
        {
          edge_id: MemoryIdV1Schema,
          type: edgeTypeSchema,
          from: MemoryIdV1Schema,
          to: MemoryIdV1Schema,
          confidence: Type.Number({ minimum: 0, maximum: 1 }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 50_000 },
    ),
    paths: Type.Array(
      Type.Object(
        {
          node_ids: Type.Array(MemoryIdV1Schema, {
            minItems: 1,
            maxItems: 3,
          }),
          edge_ids: Type.Array(MemoryIdV1Schema, { maxItems: 2 }),
          hop_count: Type.Integer({ minimum: 0, maximum: 2 }),
          path_score: Type.Number({ minimum: 0, maximum: 1 }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 10_000 },
    ),
    actual_budget: Type.Object(
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
    truncated: Type.Boolean(),
    partial_reason: Type.Optional(
      Type.Union([
        Type.Literal("graph_budget_exceeded"),
        Type.Literal("graph_timeout"),
      ]),
    ),
    duplicate_replayed: Type.Boolean(),
  },
  {
    $id: "urn:pai:memory:graph-build-response:v1",
    additionalProperties: false,
  },
);

export const MemoryGraphBuildV1Schema = Type.Union(
  [MemoryGraphBuildRequestV1Schema, MemoryGraphBuildResponseV1Schema],
  { $id: "urn:pai:memory:graph-build:v1" },
);

export type MemoryGraphBuildRequestV1 = Static<
  typeof MemoryGraphBuildRequestV1Schema
>;
export type MemoryGraphBuildResponseV1 = Static<
  typeof MemoryGraphBuildResponseV1Schema
>;

export function assertMemoryGraphBuildRequestSemanticBindingsV1(
  _request: MemoryGraphBuildRequestV1,
): void {}

export function assertMemoryGraphBuildResponseSemanticBindingsV1(
  response: MemoryGraphBuildResponseV1,
): void {
  if (response.truncated !== (response.partial_reason !== undefined)) {
    throw new Error("graph partial reason binding mismatch");
  }
  const nodeIds = new Set(response.nodes.map((node) => node.id));
  const edgeIds = new Set(response.edges.map((edge) => edge.edge_id));
  const edgeById = new Map(
    response.edges.map((edge) => [edge.edge_id, edge] as const),
  );
  if (
    nodeIds.size !== response.nodes.length ||
    edgeIds.size !== response.edges.length ||
    response.edges.some(
      (edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to),
    )
  ) {
    throw new Error("graph node/edge identity binding mismatch");
  }
  for (const path of response.paths) {
    if (
      path.node_ids.length !== path.hop_count + 1 ||
      path.edge_ids.length !== path.hop_count ||
      path.node_ids.some((id) => !nodeIds.has(id)) ||
      path.edge_ids.some((id) => !edgeIds.has(id))
    ) {
      throw new Error("graph path binding mismatch");
    }
    for (let index = 0; index < path.edge_ids.length; index += 1) {
      const edge = edgeById.get(path.edge_ids[index]!);
      if (
        edge === undefined ||
        edge.from !== path.node_ids[index] ||
        edge.to !== path.node_ids[index + 1]
      ) {
        throw new Error("graph path edge continuity mismatch");
      }
    }
  }
}
