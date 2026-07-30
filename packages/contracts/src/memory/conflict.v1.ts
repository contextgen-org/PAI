import { Type, type Static } from "@sinclair/typebox";

import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  MemoryPointStatusV1Schema,
  MemorySeriesStatusV1Schema,
  assertUniqueIdsV1,
} from "./common.v1.js";
import { MemoryIdV1Schema } from "./write-batch.v1.js";

const decisionSchema = Type.Union([
  Type.Literal("prefer_old"),
  Type.Literal("prefer_new"),
  Type.Literal("merge"),
  Type.Literal("keep_both"),
  Type.Literal("suppress_both"),
  Type.Literal("request_feedback"),
]);

export const MemoryConflictExpectedVersionsV1Schema = Type.Object(
  {
    old_series_state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    old_point_state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    new_series_state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    new_point_state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
  },
  { additionalProperties: false },
);

export const MemoryConflictResolveRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.conflict_resolve.v1"),
    bot_id: MemoryIdV1Schema,
    decision: decisionSchema,
    reason: Type.String({ minLength: 1, maxUtf8Bytes: 4_096 }),
    evidence_refs: Type.Array(TypedEvidenceRefV1Schema, {
      minItems: 1,
      maxItems: 64,
      uniqueByCanonicalIdentity: true,
    }),
    expected_conflict_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    expected_versions: MemoryConflictExpectedVersionsV1Schema,
    merge_target_series_id: Type.Optional(MemoryIdV1Schema),
    keep_both_plan: Type.Optional(
      Type.Union([
        Type.Object(
          {
            mode: Type.Literal("split_scope_dual_active"),
            old_scope_key: MemoryIdV1Schema,
            new_scope_key: MemoryIdV1Schema,
          },
          { additionalProperties: false },
        ),
        Type.Object(
          { mode: Type.Literal("keep_old_active_new_downgraded") },
          { additionalProperties: false },
        ),
      ]),
    ),
    dry_run: Type.Optional(Type.Boolean()),
    idempotency_key: Type.String({
      minLength: 1,
      maxUtf8Bytes: 128,
    }),
    trace_id: MemoryIdV1Schema,
  },
  {
    $id: "urn:pai:memory:conflict-resolve-request:v1",
    additionalProperties: false,
    maxCanonicalJsonBytes: 65_536,
  },
);

export const MemorySeriesTransitionV1Schema = Type.Object(
  {
    role: Type.Union([
      Type.Literal("old_series"),
      Type.Literal("new_series"),
    ]),
    series_id: MemoryIdV1Schema,
    from_status: MemorySeriesStatusV1Schema,
    to_status: MemorySeriesStatusV1Schema,
    previous_state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    previous_topic_key: MemoryIdV1Schema,
    topic_key: MemoryIdV1Schema,
  },
  { additionalProperties: false },
);

export const MemoryPointTransitionV1Schema = Type.Object(
  {
    role: Type.Union([
      Type.Literal("old_point"),
      Type.Literal("new_point"),
    ]),
    memory_point_id: MemoryIdV1Schema,
    from_status: MemoryPointStatusV1Schema,
    to_status: MemoryPointStatusV1Schema,
    previous_state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    state_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
  },
  { additionalProperties: false },
);

export const MemoryConflictResolveResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("memory.conflict_resolve.v1"),
    conflict_id: MemoryIdV1Schema,
    previous_conflict_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    conflict_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    previous_status: Type.Union([
      Type.Literal("open"),
      Type.Literal("feedback_requested"),
    ]),
    status: Type.Union([
      Type.Literal("feedback_requested"),
      Type.Literal("resolved"),
    ]),
    resolution_code: Type.Optional(
      Type.Union([
        Type.Literal("prefer_old"),
        Type.Literal("prefer_new"),
        Type.Literal("merged_into_old"),
        Type.Literal("suppress_both"),
        Type.Literal("keep_both_split_scope"),
        Type.Literal("keep_both_downgraded"),
      ]),
    ),
    series_transitions: Type.Array(MemorySeriesTransitionV1Schema, {
      maxItems: 2,
    }),
    point_transitions: Type.Array(MemoryPointTransitionV1Schema, {
      maxItems: 2,
    }),
    feedback_suggestion_outbox_id: Type.Optional(MemoryIdV1Schema),
    event_ids: Type.Array(MemoryIdV1Schema, {
      maxItems: 5,
      uniqueItems: true,
    }),
    dry_run: Type.Boolean(),
    duplicate_replayed: Type.Boolean(),
  },
  {
    $id: "urn:pai:memory:conflict-resolve-response:v1",
    additionalProperties: false,
  },
);

export const MemoryConflictV1Schema = Type.Union(
  [MemoryConflictResolveRequestV1Schema, MemoryConflictResolveResponseV1Schema],
  { $id: "urn:pai:memory:conflict:v1" },
);

export type MemoryConflictResolveRequestV1 = Static<
  typeof MemoryConflictResolveRequestV1Schema
>;
export type MemoryConflictResolveResponseV1 = Static<
  typeof MemoryConflictResolveResponseV1Schema
>;

export function assertMemoryConflictResolveRequestSemanticBindingsV1(
  request: MemoryConflictResolveRequestV1,
): void {
  assertUniqueIdsV1(request.evidence_refs, "evidence_refs");
  if (
    (request.decision === "merge") !==
      (request.merge_target_series_id !== undefined) ||
    (request.decision === "keep_both") !==
      (request.keep_both_plan !== undefined)
  ) {
    throw new Error("conflict decision payload binding mismatch");
  }
  if (
    request.keep_both_plan?.mode === "split_scope_dual_active" &&
    request.keep_both_plan.old_scope_key ===
      request.keep_both_plan.new_scope_key
  ) {
    throw new Error("keep-both split requires different canonical scope keys");
  }
}

export function assertMemoryConflictResolveResponseSemanticBindingsV1(
  response: MemoryConflictResolveResponseV1,
): void {
  const expectedVersion = response.dry_run
    ? response.previous_conflict_version
    : response.previous_conflict_version + 1;
  if (response.conflict_version !== expectedVersion) {
    throw new Error("conflict response version binding mismatch");
  }
  const feedback = response.status === "feedback_requested";
  if (
    (!response.dry_run &&
      feedback !==
        (response.feedback_suggestion_outbox_id !== undefined)) ||
    (response.dry_run &&
      response.feedback_suggestion_outbox_id !== undefined) ||
    feedback === (response.resolution_code !== undefined)
  ) {
    throw new Error("conflict response status/output binding mismatch");
  }
  if (response.dry_run && response.event_ids.length !== 0) {
    throw new Error("dry-run conflict response cannot contain event ids");
  }
  for (const transition of [
    ...response.series_transitions,
    ...response.point_transitions,
  ]) {
    const expected = response.dry_run
      ? transition.previous_state_version
      : transition.previous_state_version + 1;
    if (transition.state_version !== expected) {
      throw new Error("conflict aggregate transition version mismatch");
    }
  }
  assertUniqueIdsV1(
    response.series_transitions.map((entry) => entry.role),
    "series transition roles",
  );
  assertUniqueIdsV1(
    response.point_transitions.map((entry) => entry.role),
    "point transition roles",
  );
}
