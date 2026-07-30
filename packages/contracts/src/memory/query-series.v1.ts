import { Type, type Static } from "@sinclair/typebox";

import {
  MemoryConflictStatusV1Schema,
  MemoryJsonSummaryV1Schema,
  MemoryPointStatusV1Schema,
  MemorySeriesStatusV1Schema,
  MemoryTimestampV1Schema,
} from "./common.v1.js";
import { MemoryIdV1Schema } from "./write-batch.v1.js";

const includeSchema = Type.Union([
  Type.Literal("points"),
  Type.Literal("conflicts"),
  Type.Literal("edges"),
]);

export const MemoryQuerySeriesRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.series.query.v1"),
    bot_id: MemoryIdV1Schema,
    series_id: MemoryIdV1Schema,
    include: Type.Optional(
      Type.Array(includeSchema, {
        minItems: 1,
        maxItems: 3,
        uniqueItems: true,
      }),
    ),
    points_limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 200, default: 50 }),
    ),
    conflicts_limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 200, default: 50 }),
    ),
    edges_limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 200, default: 50 }),
    ),
    points_cursor: Type.Optional(MemoryIdV1Schema),
    conflicts_cursor: Type.Optional(MemoryIdV1Schema),
    edges_cursor: Type.Optional(MemoryIdV1Schema),
    snapshot_token: Type.Optional(MemoryIdV1Schema),
  },
  {
    $id: "urn:pai:memory:query-series-request:v1",
    additionalProperties: false,
  },
);

export const MemoryConflictSummaryV1Schema = Type.Object(
  {
    conflict_id: MemoryIdV1Schema,
    conflict_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    conflict_type: MemoryIdV1Schema,
    status: MemoryConflictStatusV1Schema,
    left_memory_point_id: MemoryIdV1Schema,
    right_memory_point_id: MemoryIdV1Schema,
    proposed_resolution: Type.Optional(MemoryJsonSummaryV1Schema),
    resolution: Type.Optional(MemoryJsonSummaryV1Schema),
  },
  { additionalProperties: false },
);

export const MemorySeriesEdgeV1Schema = Type.Object(
  {
    edge_id: MemoryIdV1Schema,
    edge_type: Type.Union([
      Type.Literal("co_occurs"),
      Type.Literal("relates_to"),
      Type.Literal("supports"),
      Type.Literal("contradicts"),
      Type.Literal("supersedes"),
    ]),
    source_type: Type.Union([
      Type.Literal("memory_point"),
      Type.Literal("memory_series"),
    ]),
    source_id: MemoryIdV1Schema,
    target_type: Type.Union([
      Type.Literal("memory_point"),
      Type.Literal("memory_series"),
    ]),
    target_id: MemoryIdV1Schema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    evidence_memory_point_ids: Type.Array(MemoryIdV1Schema, {
      maxItems: 1_000,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

const pageStateSchema = Type.Object(
  {
    next_cursor: Type.Optional(MemoryIdV1Schema),
    returned: Type.Integer({ minimum: 0, maximum: 200 }),
  },
  { additionalProperties: false },
);

export const MemoryQuerySeriesResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.series.query.v1"),
    series: Type.Object(
      {
        id: MemoryIdV1Schema,
        bot_id: MemoryIdV1Schema,
        topic_key: MemoryIdV1Schema,
        topic_family_key: MemoryIdV1Schema,
        status: MemorySeriesStatusV1Schema,
        state_version: Type.Integer({
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        merged_into_series_id: Type.Optional(MemoryIdV1Schema),
      },
      { additionalProperties: false },
    ),
    points: Type.Array(
      Type.Object(
        {
          memory_point_id: MemoryIdV1Schema,
          version_no: Type.Integer({
            minimum: 1,
            maximum: Number.MAX_SAFE_INTEGER,
          }),
          state_version: Type.Integer({
            minimum: 1,
            maximum: Number.MAX_SAFE_INTEGER,
          }),
          status: MemoryPointStatusV1Schema,
          content_summary: Type.String({
            minLength: 1,
            maxUtf8Bytes: 16_384,
          }),
          occurred_at: MemoryTimestampV1Schema,
          source_refs: Type.Array(MemoryIdV1Schema, {
            maxItems: 64,
            uniqueItems: true,
          }),
          redaction_status: Type.Union([
            Type.Literal("redacted"),
            Type.Literal("not_required"),
          ]),
        },
        { additionalProperties: false },
      ),
      { maxItems: 200 },
    ),
    conflicts: Type.Optional(
      Type.Array(MemoryConflictSummaryV1Schema, { maxItems: 200 }),
    ),
    edges: Type.Optional(
      Type.Array(MemorySeriesEdgeV1Schema, { maxItems: 200 }),
    ),
    page: Type.Object(
      {
        points: pageStateSchema,
        conflicts: Type.Optional(pageStateSchema),
        edges: Type.Optional(pageStateSchema),
      },
      { additionalProperties: false },
    ),
    snapshot_token: MemoryIdV1Schema,
  },
  {
    $id: "urn:pai:memory:query-series-response:v1",
    additionalProperties: false,
  },
);

export const MemoryQuerySeriesV1Schema = Type.Union(
  [MemoryQuerySeriesRequestV1Schema, MemoryQuerySeriesResponseV1Schema],
  { $id: "urn:pai:memory:query-series:v1" },
);

export type MemoryQuerySeriesRequestV1 = Static<
  typeof MemoryQuerySeriesRequestV1Schema
>;
export type MemoryQuerySeriesResponseV1 = Static<
  typeof MemoryQuerySeriesResponseV1Schema
>;

export function assertMemoryQuerySeriesRequestSemanticBindingsV1(
  request: MemoryQuerySeriesRequestV1,
): void {
  const include = new Set(request.include ?? ["points"]);
  const cursorEntries = [
    ["points", request.points_cursor],
    ["conflicts", request.conflicts_cursor],
    ["edges", request.edges_cursor],
  ] as const;
  const cursors = cursorEntries.flatMap(([, cursor]) =>
    cursor === undefined ? [] : [cursor],
  );
  if (cursors.length > 0 && request.snapshot_token === undefined) {
    throw new Error("series query continuation requires snapshot_token");
  }
  if (
    cursorEntries.some(
      ([collection, cursor]) =>
        cursor !== undefined && !include.has(collection),
    )
  ) {
    throw new Error("series query cursor requires included collection");
  }
}

export function assertMemoryQuerySeriesResponseSemanticBindingsV1(
  response: MemoryQuerySeriesResponseV1,
): void {
  if (
    (response.series.status === "merged") !==
    (response.series.merged_into_series_id !== undefined)
  ) {
    throw new Error("series merge target binding mismatch");
  }
  if (
    response.page.points.returned !== response.points.length ||
    (response.conflicts === undefined) !==
      (response.page.conflicts === undefined) ||
    (response.edges === undefined) !== (response.page.edges === undefined) ||
    (response.conflicts !== undefined &&
      response.page.conflicts?.returned !== response.conflicts.length) ||
    (response.edges !== undefined &&
      response.page.edges?.returned !== response.edges.length)
  ) {
    throw new Error("series query page count binding mismatch");
  }
  for (let index = 1; index < response.points.length; index += 1) {
    const previous = response.points[index - 1]!;
    const current = response.points[index]!;
    if (
      previous.version_no < current.version_no ||
      (previous.version_no === current.version_no &&
        previous.memory_point_id.localeCompare(current.memory_point_id) >= 0)
    ) {
      throw new Error("series query point ordering mismatch");
    }
  }
  for (let index = 1; index < (response.conflicts?.length ?? 0); index += 1) {
    const previous = response.conflicts![index - 1]!;
    const current = response.conflicts![index]!;
    if (
      previous.conflict_version < current.conflict_version ||
      (previous.conflict_version === current.conflict_version &&
        previous.conflict_id.localeCompare(current.conflict_id) >= 0)
    ) {
      throw new Error("series query conflict ordering mismatch");
    }
  }
  for (let index = 1; index < (response.edges?.length ?? 0); index += 1) {
    const previous = response.edges![index - 1]!;
    const current = response.edges![index]!;
    if (
      previous.edge_type.localeCompare(current.edge_type) > 0 ||
      (previous.edge_type === current.edge_type &&
        previous.edge_id.localeCompare(current.edge_id) >= 0)
    ) {
      throw new Error("series query edge ordering mismatch");
    }
  }
}
