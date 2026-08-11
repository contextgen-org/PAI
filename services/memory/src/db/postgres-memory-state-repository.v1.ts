import { createHash } from "node:crypto";

import { CONFLICT_POLICY_VERSION_V1 } from "@pai/contracts/policy/conflict-policy.v1";
import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import type { MEMORY_REPOSITORY_CONTRACT_V1 } from "./permission-manifest.v1.js";
import {
  MEMORY_EMBEDDING_PROFILE_V1,
  MemoryApplicationErrorV1,
  MEMORY_RANKING_PROFILE_V1,
  type MemoryScopeV1,
  type MemoryStateRepositoryPortV1,
  type MemoryStateV1,
} from "../memory-application.v1.js";

type MemoryPostgresCompositionV1 = VerifiedOwnerPostgresCompositionV1<
  typeof MEMORY_REPOSITORY_CONTRACT_V1
>;
type SeriesV1 = MemoryStateV1["series"] extends Map<string, infer T> ? T : never;
type PointV1 = MemoryStateV1["points"] extends Map<string, infer T> ? T : never;
type ProjectionV1 = MemoryStateV1["projections"] extends Map<string, infer T> ? T : never;
type ConflictV1 = MemoryStateV1["conflicts"] extends Map<string, infer T> ? T : never;
type DecisionV1 = MemoryStateV1["decisions"] extends Map<string, infer T> ? T : never;
type RevisionV1 = MemoryStateV1["revisions"] extends Map<string, infer T> ? T : never;
type StoredBatchV1 = MemoryStateV1["batches"] extends Map<string, infer T> ? T : never;

interface JsonRowV1 {
  readonly row: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

const OWNER_SCOPE_METADATA_KEY_V1 = "__pai_owner_scope_v1";

function canonicalJsonV1(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Map) {
    return canonicalJsonV1(
      [...value.entries()].sort(([left], [right]) =>
        canonicalJsonV1(left).localeCompare(canonicalJsonV1(right))),
    );
  }
  if (value instanceof Set) {
    return canonicalJsonV1(
      [...value.values()].sort((left, right) =>
        canonicalJsonV1(left).localeCompare(canonicalJsonV1(right))),
    );
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJsonV1).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJsonV1((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function digestV1(value: unknown): string {
  return createHash("sha256").update(canonicalJsonV1(value), "utf8").digest("hex");
}

function textV1(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Memory PostgreSQL ${label} is invalid`);
  }
  return value;
}

function nullableTextV1(value: unknown, label: string): string | null {
  return value === null ? null : textV1(value, label);
}

function numberV1(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Memory PostgreSQL ${label} is invalid`);
  return parsed;
}

function scoreV1(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Memory PostgreSQL ${label} is invalid`);
  return parsed;
}

function recordV1(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Memory PostgreSQL ${label} is invalid`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function stringArrayV1(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Memory PostgreSQL ${label} is invalid`);
  }
  return Object.freeze([...value] as string[]);
}

function instantV1(value: unknown, label: string): string {
  const parsed = typeof value === "string" || value instanceof Date ? new Date(value) : null;
  if (parsed === null || !Number.isFinite(parsed.getTime())) {
    throw new Error(`Memory PostgreSQL ${label} is invalid`);
  }
  return parsed.toISOString();
}

function vectorV1(value: unknown, label: string): readonly number[] {
  const candidate =
    typeof value === "string"
      ? value.startsWith("[") && value.endsWith("]")
        ? value.slice(1, -1).split(",").map(Number)
        : []
      : Array.isArray(value)
        ? value.map(Number)
        : [];
  if (
    candidate.length !== MEMORY_EMBEDDING_PROFILE_V1.dimensions ||
    candidate.some((entry) => !Number.isFinite(entry))
  ) {
    throw new Error(`Memory PostgreSQL ${label} is invalid`);
  }
  return Object.freeze(candidate);
}

function scopeKeyV1(scope: MemoryScopeV1): string {
  return canonicalJsonV1([
    scope.workspace_id,
    scope.bot_id,
    scope.owner_agent_id,
    scope.deployment_environment,
    scope.release_channel,
  ]);
}

function mapIdentityV1(scope: MemoryScopeV1, value: string): string {
  return canonicalJsonV1([scopeKeyV1(scope), value]);
}

function exactScopeV1(value: unknown, expected: MemoryScopeV1, label: string): MemoryScopeV1 {
  const row = recordV1(value, label);
  const scope = {
    workspace_id: textV1(row.workspace_id, `${label}.workspace_id`),
    bot_id: textV1(row.bot_id, `${label}.bot_id`),
    owner_agent_id: textV1(row.owner_agent_id, `${label}.owner_agent_id`),
    deployment_environment: textV1(
      row.deployment_environment,
      `${label}.deployment_environment`,
    ),
    release_channel: textV1(row.release_channel, `${label}.release_channel`),
  } as MemoryScopeV1;
  if (scopeKeyV1(scope) !== scopeKeyV1(expected)) {
    // A row with the requested bot id but a different full owner scope must
    // never be interpreted as an empty result. That would mask a durable
    // ownership-integrity violation and may invite unsafe retries. Surface a
    // typed, non-retryable authorization denial so the HTTP boundary returns
    // 403 rather than an unclassified 500.
    throw new MemoryApplicationErrorV1(
      "forbidden",
      "Memory PostgreSQL durable owner scope does not match the workload scope",
    );
  }
  return Object.freeze(scope);
}

function seriesFromRowV1(row: Readonly<Record<string, unknown>>, expected: MemoryScopeV1): SeriesV1 {
  const raw = recordV1(row.topic_components_raw, "series.topic_components_raw");
  const serializedScope = textV1(raw[OWNER_SCOPE_METADATA_KEY_V1], "series.owner_scope");
  const scope = exactScopeV1(JSON.parse(serializedScope), expected, "series.owner_scope");
  const cleanRaw = Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== OWNER_SCOPE_METADATA_KEY_V1),
  );
  return {
    id: textV1(row.id, "series.id"),
    scope,
    topic_key: textV1(row.topic_key, "series.topic_key"),
    topic_family_key: textV1(row.topic_family_key, "series.topic_family_key"),
    subject_key: textV1(row.subject_key, "series.subject_key"),
    aspect_key: textV1(row.aspect_key, "series.aspect_key"),
    scope_key: textV1(row.scope_key, "series.scope_key"),
    status: textV1(row.status, "series.status") as SeriesV1["status"],
    state_version: numberV1(row.state_version, "series.state_version"),
    current_version: numberV1(row.current_version, "series.current_version"),
    canonicalization_version: "memory.topic_key.v1",
    topic_components_raw: cleanRaw as Record<string, string>,
    topic_components_normalized: recordV1(
      row.topic_components_normalized,
      "series.topic_components_normalized",
    ) as Record<string, string>,
    importance_score: scoreV1(row.importance_score, "series.importance_score"),
    last_mentioned_at: instantV1(row.last_mentioned_at, "series.last_mentioned_at"),
    created_at: instantV1(row.created_at, "series.created_at"),
    updated_at: instantV1(row.updated_at, "series.updated_at"),
  };
}

function pointFromRowV1(row: Readonly<Record<string, unknown>>, scope: MemoryScopeV1): PointV1 {
  return {
    id: textV1(row.id, "point.id"),
    scope,
    series_id: textV1(row.series_id, "point.series_id"),
    version_no: numberV1(row.version_no, "point.version_no"),
    content_summary: textV1(row.content_summary, "point.content_summary"),
    human_agent_relation: row.human_agent_relation as PointV1["human_agent_relation"],
    keyword_tags: stringArrayV1(row.keyword_tags, "point.keyword_tags"),
    scene_tags: stringArrayV1(row.scene_tags, "point.scene_tags"),
    emotion_tags: stringArrayV1(row.emotion_tags, "point.emotion_tags"),
    source_info: recordV1(row.source_info, "point.source_info") as PointV1["source_info"],
    source_trigger_process_id: textV1(
      row.source_trigger_process_id,
      "point.source_trigger_process_id",
    ),
    content_hash: textV1(row.content_hash, "point.content_hash"),
    series_decision: textV1(row.series_decision, "point.series_decision") as PointV1["series_decision"],
    confidence_score: scoreV1(row.confidence_score, "point.confidence_score"),
    occurred_at: instantV1(row.occurred_at, "point.occurred_at"),
    evidence_valid_until:
      row.evidence_valid_until === null
        ? null
        : instantV1(row.evidence_valid_until, "point.evidence_valid_until"),
    status: textV1(row.status, "point.status") as PointV1["status"],
    state_version: numberV1(row.state_version, "point.state_version"),
    embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
    summary_embedding: vectorV1(row.summary_embedding, "point.summary_embedding"),
    created_at: instantV1(row.created_at, "point.created_at"),
  };
}

function projectionFromRowV1(
  row: Readonly<Record<string, unknown>>,
  scope: MemoryScopeV1,
): ProjectionV1 {
  return {
    memory_point_id: textV1(row.memory_point_id, "projection.memory_point_id"),
    scope,
    series_id: textV1(row.series_id, "projection.series_id"),
    topic_family_key: textV1(row.topic_family_key, "projection.topic_family_key"),
    topic_key: textV1(row.topic_key, "projection.topic_key"),
    status: textV1(row.status, "projection.status") as ProjectionV1["status"],
    state_version: numberV1(row.state_version, "projection.state_version"),
    series_state_version: numberV1(
      row.series_state_version,
      "projection.series_state_version",
    ),
    ranking_profile_version: MEMORY_RANKING_PROFILE_V1,
    content_summary: textV1(row.content_summary, "projection.content_summary"),
    keyword_tags: stringArrayV1(row.keyword_tags, "projection.keyword_tags"),
    scene_tags: stringArrayV1(row.scene_tags, "projection.scene_tags"),
    emotion_tags: stringArrayV1(row.emotion_tags, "projection.emotion_tags"),
    occurred_at: instantV1(row.occurred_at, "projection.occurred_at"),
    evidence_valid_until:
      row.evidence_valid_until === null
        ? null
        : instantV1(row.evidence_valid_until, "projection.evidence_valid_until"),
    importance_score: scoreV1(row.importance_score, "projection.importance_score"),
    last_mentioned_at: instantV1(row.last_mentioned_at, "projection.last_mentioned_at"),
    embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
    summary_embedding: vectorV1(row.summary_embedding, "projection.summary_embedding"),
    updated_at: instantV1(row.updated_at, "projection.updated_at"),
  };
}

function decisionFromRowV1(
  row: Readonly<Record<string, unknown>>,
  scope: MemoryScopeV1,
): DecisionV1 {
  const reason = recordV1(row.decision_reason, "decision.decision_reason");
  const common = {
    id: textV1(row.id, "decision.id"),
    scope,
    batch_id: textV1(row.batch_id, "decision.batch_id"),
    client_item_id: textV1(row.client_item_id, "decision.client_item_id"),
    source_item_id: nullableTextV1(row.source_item_id, "decision.source_item_id"),
    source_trigger_process_id: textV1(
      row.source_trigger_process_id,
      "decision.source_trigger_process_id",
    ),
    content_hash: textV1(row.content_hash, "decision.content_hash"),
    created_at: instantV1(row.created_at, "decision.created_at"),
  };
  if (row.decision === "rejected") {
    return {
      ...common,
      decision: "rejected",
      rejection_code: textV1(reason.code, "decision.rejection_code"),
      rejection_message: textV1(reason.message, "decision.rejection_message"),
      field_path: nullableTextV1(reason.field_path ?? null, "decision.field_path"),
    } as DecisionV1;
  }
  return {
    ...common,
    decision: textV1(row.decision, "decision.decision") as Exclude<DecisionV1, { decision: "rejected" }>["decision"],
    target_series_id: textV1(row.target_series_id, "decision.target_series_id"),
    target_memory_point_id: nullableTextV1(
      row.target_memory_point_id,
      "decision.target_memory_point_id",
    ),
    conflict_id: nullableTextV1(row.conflict_id, "decision.conflict_id"),
    candidate_refs: stringArrayV1(row.candidate_refs, "decision.candidate_refs"),
    decision_reason: textV1(reason.code, "decision.reason_code"),
  } as DecisionV1;
}

function changedEntriesV1<T>(before: Map<string, T>, after: Map<string, T>) {
  return [...after.entries()]
    .filter(([key, value]) => canonicalJsonV1(before.get(key)) !== canonicalJsonV1(value))
    .map(([key, value]) => ({ key, before: before.get(key), after: value }));
}

function seriesRowV1(series: SeriesV1) {
  return {
    id: series.id,
    bot_id: series.scope.bot_id,
    topic_key: series.topic_key,
    topic_family_key: series.topic_family_key,
    subject_key: series.subject_key,
    aspect_key: series.aspect_key,
    scope_key: series.scope_key,
    merged_into_series_id: null,
    title: series.topic_key,
    status: series.status,
    current_version: series.current_version,
    state_version: series.state_version,
    canonicalization_version: series.canonicalization_version,
    topic_components_raw: {
      ...series.topic_components_raw,
      [OWNER_SCOPE_METADATA_KEY_V1]: canonicalJsonV1(series.scope),
    },
    topic_components_normalized: series.topic_components_normalized,
    importance_score: series.importance_score,
    last_recalled_at: null,
    last_mentioned_at: series.last_mentioned_at,
    created_at: series.created_at,
    updated_at: series.updated_at,
  };
}

function vectorSqlV1(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

function pointRowV1(point: PointV1) {
  return {
    id: point.id,
    bot_id: point.scope.bot_id,
    series_id: point.series_id,
    version_no: point.version_no,
    content_summary: point.content_summary,
    human_agent_relation: point.human_agent_relation,
    keyword_tags: point.keyword_tags,
    scene_tags: point.scene_tags,
    emotion_tags: point.emotion_tags,
    source_info: point.source_info,
    source_trigger_process_id: point.source_trigger_process_id,
    content_hash: point.content_hash,
    series_decision: point.series_decision,
    decision_reason: { code: point.series_decision },
    previous_memory_point_id: null,
    confidence_score: point.confidence_score,
    occurred_at: point.occurred_at,
    status: point.status,
    payload_schema_version: "memory_point.v1",
    state_version: point.state_version,
    created_at: point.created_at,
    evidence_valid_until: point.evidence_valid_until,
    embedding_profile_id: point.embedding_profile_id,
    summary_embedding: vectorSqlV1(point.summary_embedding),
    embedding_backfill_status: "ready",
  };
}

function projectionRowV1(projection: ProjectionV1, revisions: readonly RevisionV1[]) {
  return {
    memory_point_id: projection.memory_point_id,
    bot_id: projection.scope.bot_id,
    series_id: projection.series_id,
    topic_family_key: projection.topic_family_key,
    topic_key: projection.topic_key,
    status: projection.status,
    state_version: projection.state_version,
    series_state_version: projection.series_state_version,
    source_revision_ids: revisions
      .filter((revision) => revision.aggregate_id === projection.memory_point_id)
      .map((revision) => revision.id),
    ranking_profile_version: projection.ranking_profile_version,
    content_summary: projection.content_summary,
    keyword_tags: projection.keyword_tags,
    scene_tags: projection.scene_tags,
    emotion_tags: projection.emotion_tags,
    occurred_at: projection.occurred_at,
    importance_score: projection.importance_score,
    last_mentioned_at: projection.last_mentioned_at,
    updated_at: projection.updated_at,
    evidence_valid_until: projection.evidence_valid_until,
    embedding_profile_id: projection.embedding_profile_id,
    summary_embedding: vectorSqlV1(projection.summary_embedding),
    embedding_backfill_status: "ready",
  };
}

function decisionRowV1(decision: DecisionV1) {
  const rejected = decision.decision === "rejected";
  return {
    id: decision.id,
    bot_id: decision.scope.bot_id,
    batch_id: decision.batch_id,
    client_item_id: decision.client_item_id,
    source_item_id: decision.source_item_id,
    source_trigger_process_id: decision.source_trigger_process_id,
    content_hash: decision.content_hash,
    decision: decision.decision,
    target_series_id: rejected ? null : decision.target_series_id,
    target_memory_point_id: rejected ? null : decision.target_memory_point_id,
    conflict_id: rejected ? null : decision.conflict_id,
    candidate_refs: rejected ? [] : decision.candidate_refs,
    decision_reason: rejected
      ? {
          code: decision.rejection_code,
          message: decision.rejection_message,
          field_path: decision.field_path,
        }
      : { code: decision.decision_reason },
    created_at: decision.created_at,
  };
}

function conflictRowV1(conflict: ConflictV1) {
  return {
    id: conflict.id,
    bot_id: conflict.scope.bot_id,
    series_id: conflict.old_series_id,
    conflict_type: conflict.conflict_type,
    conflict_key: `${conflict.source_item_id}:${conflict.incoming_content_hash}`,
    conflict_domain: "unclassified",
    source_priority_policy_version: CONFLICT_POLICY_VERSION_V1,
    left_memory_point_id: conflict.left_memory_point_id,
    right_memory_point_id: conflict.right_memory_point_id,
    confidence_delta: null,
    evidence_refs: conflict.evidence_refs,
    conflict_payload: {
      owner_scope_v1: conflict.scope,
      old_series_id: conflict.old_series_id,
      new_series_id: conflict.new_series_id,
      source_item_id: conflict.source_item_id,
      incoming_content_hash: conflict.incoming_content_hash,
      conflict_domain: "unclassified",
      source_priority_policy_version: CONFLICT_POLICY_VERSION_V1,
    },
    proposed_resolution: null,
    status: conflict.status,
    state_version: conflict.state_version,
    resolution: null,
    payload_schema_version: "memory_conflict.v1",
    created_at: conflict.created_at,
    updated_at: conflict.created_at,
  };
}

function revisionRowV1(revision: RevisionV1, botId: string) {
  return {
    id: revision.id,
    bot_id: botId,
    aggregate_type: revision.aggregate_type,
    aggregate_id: revision.aggregate_id,
    previous_state_version: revision.previous_state_version,
    resulting_state_version: revision.state_version,
    operation: revision.reason_code,
    before_payload: { status: revision.previous_status },
    after_payload: { status: revision.status },
    actor_ref: "memory",
    reason: revision.reason_code,
    evidence_refs: [],
    trace_id: revision.aggregate_id,
    created_at: revision.created_at,
  };
}

function eventTargetV1(eventType: string): string {
  if (eventType.startsWith("memory.conflict.")) return "feedback_router";
  if (eventType === "memory.integration.finished") return "operator_projection";
  return "meta";
}

function eventRowV1(event: MemoryStateV1["outbox"][number]) {
  return {
    id: event.event_id,
    event_type: event.event_type,
    schema_version: event.schema_version,
    producer: event.producer,
    bot_id: event.payload.bot_id,
    aggregate_id: event.payload.aggregate_id,
    aggregate_type: event.payload.aggregate_type,
    aggregate_version: event.payload.aggregate_version,
    occurred_at: event.occurred_at,
    idempotency_key: event.idempotency_key,
    trace_id: event.trace_id,
    target: eventTargetV1(event.event_type),
    payload: event.payload,
    payload_hash: `sha256:${digestV1(event.payload)}`,
    status: "pending",
    attempt_count: 0,
    next_retry_at: null,
    created_at: event.occurred_at,
    updated_at: event.occurred_at,
    claimed_by: null,
    claim_token: null,
    locked_until: null,
    last_error: null,
    transport_ref: null,
    transport_epoch: null,
    transport_generation: null,
    sent_at: null,
  };
}

async function loadStateV1(
  composition: MemoryPostgresCompositionV1,
  scope: MemoryScopeV1,
  transient: Pick<MemoryStateV1, "batchReservations" | "recallSnapshots">,
): Promise<MemoryStateV1> {
  return composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
    const query = (table: string, idColumn = "id") =>
      transaction.query<JsonRowV1>(
        `SELECT to_jsonb(owner_row) AS row FROM memory.${table} AS owner_row WHERE owner_row.bot_id = $1 ORDER BY owner_row.${idColumn}`,
        [scope.bot_id],
      );
    // A transaction owns one pg client. Keep its reads sequential so the
    // repository remains compatible with pg@9, which rejects overlapping
    // client.query calls.
    const seriesResult = await query("memory_series");
    const pointsResult = await query("memory_points");
    const projectionResult = await query("memory_point_search_index", "memory_point_id");
    const batchResult = await query("memory_write_batches");
    const decisionResult = await query("memory_write_item_decisions");
    const conflictResult = await query("memory_conflicts");
    const revisionResult = await query("memory_state_revisions");
    const series = new Map<string, SeriesV1>();
    const seriesIdByTopic = new Map<string, string>();
    for (const { row } of seriesResult.rows) {
      const value = seriesFromRowV1(row, scope);
      series.set(value.id, value);
      seriesIdByTopic.set(`${scopeKeyV1(scope)}\u001f${value.topic_key}`, value.id);
    }
    const points = new Map<string, PointV1>();
    for (const { row } of pointsResult.rows) {
      const value = pointFromRowV1(row, scope);
      if (!series.has(value.series_id)) throw new Error("Memory PostgreSQL point owner scope is orphaned");
      points.set(value.id, value);
    }
    const projections = new Map<string, ProjectionV1>();
    for (const { row } of projectionResult.rows) {
      const value = projectionFromRowV1(row, scope);
      projections.set(value.memory_point_id, value);
    }
    const batches = new Map<string, StoredBatchV1>();
    for (const { row } of batchResult.rows) {
      const requestPayload = recordV1(row.request_payload, "batch.request_payload");
      exactScopeV1(requestPayload.owner_scope_v1, scope, "batch.owner_scope");
      batches.set(mapIdentityV1(scope, textV1(row.idempotency_key, "batch.idempotency_key")), {
        request_hash: textV1(row.request_hash, "batch.request_hash"),
        response: recordV1(row.response_payload, "batch.response_payload") as StoredBatchV1["response"],
      });
    }
    const decisions = new Map<string, DecisionV1>();
    const decisionKeyBySourceItem = new Map<string, string>();
    for (const { row } of decisionResult.rows) {
      const value = decisionFromRowV1(row, scope);
      const key = canonicalJsonV1([value.batch_id, value.client_item_id]);
      decisions.set(key, value);
      if (value.source_item_id !== null) {
        decisionKeyBySourceItem.set(
          canonicalJsonV1([scopeKeyV1(scope), value.source_item_id]),
          key,
        );
      }
    }
    const conflicts = new Map<string, ConflictV1>();
    for (const { row } of conflictResult.rows) {
      if (row.status !== "open") continue;
      const payload = recordV1(row.conflict_payload, "conflict.payload");
      if (
        row.conflict_domain !== "unclassified" ||
        row.source_priority_policy_version !== CONFLICT_POLICY_VERSION_V1
      ) {
        throw new Error("Memory open conflict policy provenance is unsupported");
      }
      const conflictScope = exactScopeV1(payload.owner_scope_v1, scope, "conflict.owner_scope");
      const value = {
        id: textV1(row.id, "conflict.id"),
        scope: conflictScope,
        old_series_id: textV1(payload.old_series_id, "conflict.old_series_id"),
        new_series_id: textV1(payload.new_series_id, "conflict.new_series_id"),
        conflict_type: "source_item_identity_drift" as const,
        source_item_id: textV1(payload.source_item_id, "conflict.source_item_id"),
        left_memory_point_id: textV1(row.left_memory_point_id, "conflict.left_point"),
        right_memory_point_id: textV1(row.right_memory_point_id, "conflict.right_point"),
        evidence_refs: stringArrayV1(row.evidence_refs, "conflict.evidence_refs"),
        incoming_content_hash: textV1(payload.incoming_content_hash, "conflict.incoming_hash"),
        status: "open" as const,
        state_version: numberV1(row.state_version, "conflict.state_version") as 1,
        created_at: instantV1(row.created_at, "conflict.created_at"),
      };
      conflicts.set(value.id, value);
    }
    const revisions = new Map<string, RevisionV1>();
    for (const { row } of revisionResult.rows) {
      const beforePayload = recordV1(row.before_payload, "revision.before_payload");
      const afterPayload = recordV1(row.after_payload, "revision.after_payload");
      const value = {
        id: textV1(row.id, "revision.id"),
        aggregate_type: "memory_point" as const,
        aggregate_id: textV1(row.aggregate_id, "revision.aggregate_id"),
        previous_state_version: numberV1(row.previous_state_version, "revision.previous_version"),
        state_version: numberV1(row.resulting_state_version, "revision.resulting_version"),
        previous_status: textV1(beforePayload.status, "revision.previous_status") as RevisionV1["previous_status"],
        status: textV1(afterPayload.status, "revision.status") as RevisionV1["status"],
        reason_code: textV1(row.reason, "revision.reason"),
        created_at: instantV1(row.created_at, "revision.created_at"),
      };
      revisions.set(value.id, value);
    }
    return {
      batches,
      batchReservations: structuredClone(transient.batchReservations),
      decisions,
      decisionKeyBySourceItem,
      series,
      seriesIdByTopic,
      points,
      projections,
      conflicts,
      revisions,
      recallSnapshots: structuredClone(transient.recallSnapshots),
      integrationJobs: new Map(),
      integrationJobIdByKey: new Map(),
      integrationLeases: new Map(),
      integrationFinishReceipts: new Map(),
      promotionChecksByIdempotency: new Map(),
      promotionChecksByTokenHash: new Map(),
      promotionReservations: new Map(),
      promotionReservationIdByIdempotency: new Map(),
      promotionGenerationByCandidate: new Map(),
      activePromotionReservationByCandidate: new Map(),
      activePromotionReservationByTarget: new Map(),
      audit: [],
      outbox: [],
      queryRevision: 1 + batchResult.rows.length,
    };
  });
}

function onlyTransientChangedV1(before: MemoryStateV1, after: MemoryStateV1): boolean {
  const durableKeys = [
    "batches", "decisions", "decisionKeyBySourceItem", "series", "seriesIdByTopic",
    "points", "projections", "conflicts", "revisions", "integrationJobs",
    "integrationJobIdByKey", "integrationLeases", "integrationFinishReceipts",
    "promotionChecksByIdempotency", "promotionChecksByTokenHash", "promotionReservations",
    "promotionReservationIdByIdempotency", "promotionGenerationByCandidate",
    "activePromotionReservationByCandidate", "activePromotionReservationByTarget", "audit",
    "outbox", "queryRevision",
  ] as const;
  return durableKeys.every((key) => canonicalJsonV1(before[key]) === canonicalJsonV1(after[key]));
}

export function createPostgresMemoryStateRepositoryV1(
  composition: MemoryPostgresCompositionV1,
): MemoryStateRepositoryPortV1 {
  let tail: Promise<void> = Promise.resolve();
  const transientByScope = new Map<
    string,
    Pick<MemoryStateV1, "batchReservations" | "recallSnapshots">
  >();
  return {
    async checkReadiness(): Promise<void> {
      await composition.checkReadiness(AbortSignal.timeout(5_000));
      await composition.read_committed_postgres.withReadCommittedTransaction(
        async (transaction) => {
          const profile = await transaction.query<{
            id: string;
            model_id: string;
            model_revision: string;
            dimensions: number;
            normalized: boolean;
            distance_metric: string;
          }>(
            `SELECT id, model_id, model_revision, dimensions, normalized, distance_metric
               FROM memory.memory_embedding_profiles
              WHERE id = $1`,
            [MEMORY_EMBEDDING_PROFILE_V1.profile_id],
          );
          const actual = profile.rows[0];
          if (
            profile.rows.length !== 1 ||
            actual?.model_id !== MEMORY_EMBEDDING_PROFILE_V1.model_id ||
            actual.model_revision !== MEMORY_EMBEDDING_PROFILE_V1.model_revision ||
            Number(actual.dimensions) !== MEMORY_EMBEDDING_PROFILE_V1.dimensions ||
            actual.normalized !== MEMORY_EMBEDDING_PROFILE_V1.normalized ||
            actual.distance_metric !== MEMORY_EMBEDDING_PROFILE_V1.distance_metric
          ) {
            throw new Error("Memory PostgreSQL pinned embedding profile drift");
          }
        },
      );
    },
    async transact<T>(
      operation: (state: MemoryStateV1) => T | Promise<T>,
      scope?: MemoryScopeV1,
    ): Promise<T> {
      if (scope === undefined) throw new Error("Memory PostgreSQL transaction requires owner scope");
      let release: (() => void) | undefined;
      const turn = new Promise<void>((resolve) => { release = resolve; });
      const previous = tail;
      tail = previous.then(() => turn);
      await previous;
      try {
        const transient = transientByScope.get(scopeKeyV1(scope)) ?? {
          batchReservations: new Map(),
          recallSnapshots: new Map(),
        };
        const before = await loadStateV1(composition, scope, transient);
        const after = structuredClone(before);
        const result = await operation(after);
        const newBatches = [...after.batches.entries()].filter(([key]) => !before.batches.has(key));
        if (newBatches.length === 0) {
          if (!onlyTransientChangedV1(before, after)) {
            throw new Error("Memory PostgreSQL repository does not yet map this owner transition");
          }
          transientByScope.set(scopeKeyV1(scope), {
            batchReservations: structuredClone(after.batchReservations),
            recallSnapshots: structuredClone(after.recallSnapshots),
          });
          return result;
        }
        if (newBatches.length !== 1) throw new Error("Memory write changed multiple batches");
        const batchSeries = changedEntriesV1(before.series, after.series)[0]?.after;
        const [batchIdentity, storedBatch] = newBatches[0]!;
        const batchId = storedBatch.response.write_batch_id;
        const decisionChanges = changedEntriesV1(before.decisions, after.decisions);
        const seriesChanges = changedEntriesV1(before.series, after.series);
        const pointChanges = changedEntriesV1(before.points, after.points);
        const conflictChanges = changedEntriesV1(before.conflicts, after.conflicts);
        const projectionChanges = changedEntriesV1(before.projections, after.projections);
        const revisionChanges = changedEntriesV1(before.revisions, after.revisions);
        if (conflictChanges.some(({ before: value }) => value !== undefined)) {
          throw new Error("Memory batch cannot transition an existing conflict");
        }
        const idempotencyKey = JSON.parse(batchIdentity) as readonly [string, string];
        const sourceTriggerProcessId = decisionChanges[0]?.after.source_trigger_process_id;
        if (sourceTriggerProcessId === undefined) {
          throw new Error("Memory write batch has no durable item decision");
        }
        const occurredAt = batchSeries?.updated_at ?? new Date().toISOString();
        const operationId = `memory_batch_${digestV1([batchId, storedBatch.request_hash]).slice(0, 40)}`;
        await composition.unit_of_work.withTransaction(
          {
            operation: "memory_write_batch_commit",
            idempotency_key: idempotencyKey[1],
            trace_id: operationId,
            isolation: "serializable",
            retry: "none",
          },
          async (transaction, { owner }) => {
            await owner.executeWriter(transaction, {
              writer: "commit_memory_write_batch_v1",
              arguments: {
                p_batch_id: batchId,
                p_bot_id: scope.bot_id,
                p_batch_count_fence: String(before.batches.size),
                p_series_fences: seriesChanges.flatMap(({ before: value }) =>
                  value === undefined ? [] : [{
                    id: value.id,
                    expected_state_version: value.state_version,
                    expected_status: value.status,
                  }],
                ),
                p_point_fences: pointChanges.flatMap(({ before: value }) =>
                  value === undefined ? [] : [{
                    id: value.id,
                    expected_state_version: value.state_version,
                    expected_status: value.status,
                  }],
                ),
                p_batch: {
                  id: batchId,
                  bot_id: scope.bot_id,
                  trigger_process_id: sourceTriggerProcessId,
                  source_meta_job_id: null,
                  idempotency_key: idempotencyKey[1],
                  request_hash: storedBatch.request_hash,
                  trace_id: operationId,
                  request_payload: { owner_scope_v1: scope },
                  response_payload: storedBatch.response,
                  status: storedBatch.response.batch_status,
                  payload_schema_version: "memory.write_batch.v1",
                  created_at: occurredAt,
                  updated_at: occurredAt,
                },
                p_series: seriesChanges.map(({ after: value }) => seriesRowV1(value)),
                p_points: pointChanges.map(({ after: value }) => pointRowV1(value)),
                p_conflicts: conflictChanges.map(({ after: value }) => conflictRowV1(value)),
                p_item_decisions: decisionChanges.map(({ after: value }) => decisionRowV1(value)),
                p_search_index: projectionChanges.map(({ after: value }) =>
                  projectionRowV1(
                    value,
                    revisionChanges.map(({ after: revision }) => revision),
                  ),
                ),
                p_state_revisions: revisionChanges.map(({ after: value }) =>
                  revisionRowV1(value, scope.bot_id)),
                p_audit_logs: [{
                  id: `memory_batch_audit_${digestV1(operationId).slice(0, 40)}`,
                  bot_id: scope.bot_id,
                  revision_id: null,
                  feedback_event_id: null,
                  target_type: "write_batch",
                  target_id: batchId,
                  actor_ref: "meta_cognition",
                  action: "commit",
                  reason_code: storedBatch.response.batch_status,
                  capability_snapshot: {},
                  payload: { operation_id: operationId },
                  trace_id: operationId,
                  created_at: occurredAt,
                }],
                p_event_outbox: after.outbox.map(eventRowV1),
                p_idempotency_key: idempotencyKey[1],
                p_request_hash: storedBatch.request_hash,
                p_trace_id: operationId,
              },
              expected_rows: 1,
            });
          },
        );
        transientByScope.set(scopeKeyV1(scope), {
          batchReservations: structuredClone(after.batchReservations),
          recallSnapshots: structuredClone(after.recallSnapshots),
        });
        return result;
      } finally {
        release?.();
      }
    },
  };
}
