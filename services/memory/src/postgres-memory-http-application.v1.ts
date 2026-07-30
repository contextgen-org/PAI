import { createHash, createHmac } from "node:crypto";

import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { canonicalJsonV1 } from "@pai/contracts";
import {
  MemoryDeepRecallRequestV1Schema,
  MemoryDeepRecallResponseV1Schema,
  assertMemoryDeepRecallRequestSemanticBindingsV1,
  assertMemoryDeepRecallResponseSemanticBindingsV1,
  type MemoryDeepRecallRequestV1,
  type MemoryDeepRecallResponseV1,
} from "@pai/contracts/memory/deep-recall.v1";
import {
  MEMORY_PRE_PROMOTION_POLICY_VERSION_V1,
  MemoryPrePromotionCheckRequestV1Schema,
  MemoryPrePromotionCheckResponseV1Schema,
  MemoryPrePromotionValidateRequestV1Schema,
  MemoryPromotionReservationV1Schema,
  MemoryPromotionReservationAckRequestV1Schema,
  MemoryPromotionReservationAckResponseV1Schema,
  MemoryPromotionReservationReleaseRequestV1Schema,
  MemoryPromotionReservationReleaseResponseV1Schema,
  assertMemoryPrePromotionCheckRequestSemanticBindingsV1,
  assertMemoryPrePromotionCheckResponseSemanticBindingsV1,
  assertMemoryPrePromotionValidateRequestSemanticBindingsV1,
  assertMemoryPromotionReservationSemanticBindingsV1,
  assertMemoryPromotionReservationAckRequestSemanticBindingsV1,
  assertMemoryPromotionReservationAckResponseSemanticBindingsV1,
  assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1,
  assertMemoryPromotionReservationReleaseResponseSemanticBindingsV1,
  type MemoryPrePromotionCheckRequestV1,
  type MemoryPrePromotionCheckResponseV1,
  type MemoryPrePromotionValidateRequestV1,
  type MemoryPromotionReservationV1,
  type MemoryPromotionReservationAckRequestV1,
  type MemoryPromotionReservationAckResponseV1,
  type MemoryPromotionReservationReleaseRequestV1,
  type MemoryPromotionReservationReleaseResponseV1,
} from "@pai/contracts/memory/pre-promotion-check.v1";
import {
  MemoryGraphBuildRequestV1Schema,
  MemoryGraphBuildResponseV1Schema,
  assertMemoryGraphBuildRequestSemanticBindingsV1,
  assertMemoryGraphBuildResponseSemanticBindingsV1,
  type MemoryGraphBuildRequestV1,
  type MemoryGraphBuildResponseV1,
} from "@pai/contracts/memory/graph-build.v1";
import {
  MemoryDirectFeedbackRequestV1Schema,
  MemoryDirectFeedbackResponseV1Schema,
  assertMemoryDirectFeedbackRequestSemanticBindingsV1,
  assertMemoryDirectFeedbackResponseSemanticBindingsV1,
  type MemoryDirectFeedbackRequestV1,
  type MemoryDirectFeedbackResponseV1,
} from "@pai/contracts/memory/direct-feedback.v1";
import {
  MemoryConflictResolveRequestV1Schema,
  MemoryConflictResolveResponseV1Schema,
  assertMemoryConflictResolveRequestSemanticBindingsV1,
  assertMemoryConflictResolveResponseSemanticBindingsV1,
  type MemoryConflictResolveRequestV1,
  type MemoryConflictResolveResponseV1,
} from "@pai/contracts/memory/conflict.v1";
import {
  MetaFeedbackRequestSuggestionRequestV1Schema,
  type MetaFeedbackRequestSuggestionRequestV1,
} from "@pai/contracts/meta/feedback-request-suggestion.v1";
import {
  MemoryQuerySeriesRequestV1Schema,
  MemoryQuerySeriesResponseV1Schema,
  assertMemoryQuerySeriesRequestSemanticBindingsV1,
  assertMemoryQuerySeriesResponseSemanticBindingsV1,
  type MemoryQuerySeriesRequestV1,
  type MemoryQuerySeriesResponseV1,
} from "@pai/contracts/memory/query-series.v1";
import {
  MemoryIntegrationCheckpointRequestV1Schema,
  MemoryIntegrationClaimRequestV1Schema,
  MemoryIntegrationClaimV1Schema,
  MemoryIntegrationFinishRequestV1Schema,
  MemoryIntegrationJobDetailsV1Schema,
  MemoryIntegrationRunRequestV1Schema,
  MemoryIntegrationRunResponseV1Schema,
  assertMemoryIntegrationCheckpointRequestSemanticBindingsV1,
  assertMemoryIntegrationFinishRequestSemanticBindingsV1,
  assertMemoryIntegrationJobSemanticBindingsV1,
  assertMemoryIntegrationRunRequestSemanticBindingsV1,
  assertMemoryIntegrationRunResponseSemanticBindingsV1,
  type MemoryIntegrationCheckpointRequestV1,
  type MemoryIntegrationClaimRequestV1,
  type MemoryIntegrationClaimV1,
  type MemoryIntegrationFinishRequestV1,
  type MemoryIntegrationJobV1,
  type MemoryIntegrationRunRequestV1,
  type MemoryIntegrationRunResponseV1,
} from "@pai/contracts/memory/integration-job.v1";
import { Value } from "@sinclair/typebox/value";

import type { MEMORY_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import {
  MEMORY_EMBEDDING_PROFILE_V1,
  MEMORY_INTEGRATION_POLICY_VERSION_V1,
  MemoryApplicationErrorV1,
  memoryCanonicalTopicKeysV1,
  type MemoryApplicationV1,
  type MemoryEmbeddingPortV1,
  type MemoryPrincipalV1,
  type MemoryScopeV1,
} from "./memory-application.v1.js";

type CompositionV1 = VerifiedOwnerPostgresCompositionV1<
  typeof MEMORY_REPOSITORY_CONTRACT_V1
>;
type JsonRowV1 = Readonly<Record<string, unknown>>;

const canonicalOptionsV1 = Object.freeze({
  max_bytes: 2_097_152,
  max_depth: 64,
  max_nodes: 100_000,
  max_container_entries: 10_000,
});

function canonicalV1(value: unknown): string {
  return canonicalJsonV1(value, canonicalOptionsV1);
}

function sha256V1(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalV1(value), "utf8").digest("hex")}`;
}

function stableIdV1(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256").update(canonicalV1(value), "utf8").digest("base64url").slice(0, 32)}`;
}

function failV1(
  code: ConstructorParameters<typeof MemoryApplicationErrorV1>[0],
  message: string,
  retryable = false,
  details?: Readonly<Record<string, unknown>>,
): never {
  throw new MemoryApplicationErrorV1(code, message, retryable, undefined, details);
}

function recordV1(value: unknown, label: string): JsonRowV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Memory PostgreSQL ${label} is invalid`);
  }
  return value as JsonRowV1;
}

function textV1(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Memory PostgreSQL ${label} is invalid`);
  }
  return value;
}

function integerV1(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Memory PostgreSQL ${label} is invalid`);
  return parsed;
}

function numberV1(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Memory PostgreSQL ${label} is invalid`);
  return parsed;
}

function instantV1(value: unknown, label: string): string {
  const date = value instanceof Date || typeof value === "string" ? new Date(value) : null;
  if (date === null || !Number.isFinite(date.getTime())) {
    throw new Error(`Memory PostgreSQL ${label} is invalid`);
  }
  return date.toISOString();
}

function stringArrayV1(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("Memory PostgreSQL string array is invalid");
  }
  return Object.freeze([...value]);
}

function validateV1<T>(
  schema: Parameters<typeof Value.Check>[0],
  value: unknown,
  semantic: (input: T) => void,
  label: string,
): T {
  canonicalV1(value);
  if (!Value.Check(schema, value)) failV1("schema_validation_failed", `${label} violates its owner schema`);
  try {
    semantic(value as T);
  } catch (error) {
    failV1(
      "schema_validation_failed",
      `${label} semantic binding failed: ${error instanceof Error ? error.message : "invalid binding"}`,
    );
  }
  return structuredClone(value) as T;
}

function scopeV1(
  principal: MemoryPrincipalV1,
  callers: readonly MemoryPrincipalV1["caller"][],
  capability: string,
  botId: string,
): MemoryScopeV1 {
  if (!callers.includes(principal.caller) || !principal.capabilities.includes(capability)) {
    failV1("forbidden", `caller lacks ${capability}`);
  }
  if (principal.scope.bot_id !== botId) failV1("bot_scope_mismatch", "bot scope mismatch");
  return Object.freeze(structuredClone(principal.scope));
}

function scopeKeyV1(scope: MemoryScopeV1): string {
  return canonicalV1([
    scope.workspace_id,
    scope.bot_id,
    scope.owner_agent_id,
    scope.deployment_environment,
    scope.release_channel,
  ]);
}

function promotionRequestHashV1(request: Readonly<Record<string, unknown>>): string {
  return sha256V1(
    Object.fromEntries(Object.entries(request).filter(([key]) => key !== "trace_id")),
  );
}

function promotionCheckTokenV1(
  secret: string,
  checkId: string,
  generation: number,
  requestHash: string,
  checkedAt: string,
): string {
  return `mct_${createHmac("sha256", secret)
    .update(canonicalV1([
      "memory.pre_promotion_check_token.v1",
      checkId,
      generation,
      requestHash,
      checkedAt,
    ]), "utf8")
    .digest("base64url")}`;
}

function reservationTokenV1(reservationId: string, requestHash: string, checkToken: string): string {
  return stableIdV1("mrt", [
    "memory.promotion_reservation_token.v1",
    reservationId,
    requestHash,
    checkToken,
  ]);
}

function vectorSqlV1(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

function eventRowV1(input: Readonly<{
  id: string;
  event_type: string;
  bot_id: string;
  aggregate_id: string;
  aggregate_type: string;
  aggregate_version: number;
  occurred_at: string;
  idempotency_key: string;
  trace_id: string;
  target: string;
  payload: JsonRowV1;
}>): JsonRowV1 {
  return {
    ...input,
    schema_version: "memory.event.v1",
    producer: "memory",
    payload_hash: sha256V1(input.payload),
    status: "pending",
    attempt_count: 0,
    next_retry_at: null,
    created_at: input.occurred_at,
    updated_at: input.occurred_at,
  };
}

async function executeWriterV1(
  composition: CompositionV1,
  operation: string,
  idempotencyKey: string,
  traceId: string,
  writer: string,
  argumentsValue: Readonly<Record<string, unknown>>,
): Promise<JsonRowV1> {
  return composition.unit_of_work.withTransaction(
    {
      operation,
      idempotency_key: idempotencyKey,
      trace_id: traceId,
      isolation: "serializable",
      retry: "none",
    },
    async (transaction, { owner }) =>
      owner.executeWriter(transaction, {
        writer: writer as never,
        arguments: argumentsValue as never,
        expected_rows: 1,
      }) as Promise<JsonRowV1>,
  );
}

function pointStateHashV1(point: JsonRowV1, series: JsonRowV1 | undefined): string {
  return sha256V1({
    id: point.id,
    series_id: point.series_id,
    status: point.status,
    state_version: Number(point.state_version),
    content_hash: point.content_hash,
    source_trigger_process_id: point.source_trigger_process_id,
    confidence_score: Number(point.confidence_score),
    occurred_at: instantV1(point.occurred_at, "point.occurred_at"),
    evidence_valid_until:
      point.evidence_valid_until === null
        ? null
        : instantV1(point.evidence_valid_until, "point.evidence_valid_until"),
    series_state:
      series === undefined
        ? null
        : {
            id: series.id,
            status: series.status,
            state_version: Number(series.state_version),
            current_version: Number(series.current_version),
          },
  });
}

function seriesStateHashV1(series: JsonRowV1): string {
  return sha256V1({
    id: series.id,
    status: series.status,
    state_version: Number(series.state_version),
    current_version: Number(series.current_version),
    topic_key: series.topic_key,
    topic_family_key: series.topic_family_key,
    last_mentioned_at: instantV1(series.last_mentioned_at, "series.last_mentioned_at"),
  });
}

function conflictStateHashV1(conflict: JsonRowV1): string {
  const payload = recordV1(conflict.conflict_payload, "conflict.payload");
  return sha256V1({
    id: conflict.id,
    status: conflict.status,
    state_version: Number(conflict.state_version),
    old_series_id: payload.old_series_id,
    new_series_id: payload.new_series_id,
    left_memory_point_id: conflict.left_memory_point_id,
    right_memory_point_id: conflict.right_memory_point_id,
    incoming_content_hash: payload.incoming_content_hash,
  });
}

function integrationJobV1(row: JsonRowV1): MemoryIntegrationJobV1 {
  const storedScope = recordV1(row.scope, "integration.scope");
  const result = row.result_payload === null ? {} : recordV1(row.result_payload, "integration.result");
  const error =
    row.error === null ? undefined : recordV1(row.error, "integration.error");
  const status = textV1(row.status, "integration.status");
  const job = {
    id: textV1(row.id, "integration.id"),
    scope: structuredClone(
      recordV1(storedScope.owner_scope_v1, "integration.owner_scope"),
    ),
    mode: textV1(row.mode, "integration.mode"),
    request_scope: structuredClone(
      recordV1(storedScope.request_scope, "integration.request_scope"),
    ),
    dry_run: row.dry_run === true,
    idempotency_key: textV1(
      row.idempotency_key,
      "integration.idempotency_key",
    ),
    request_hash: textV1(row.request_hash, "integration.request_hash"),
    expected_policy_version: textV1(row.expected_policy_version, "integration.policy"),
    state_version: integerV1(row.state_version, "integration.state_version"),
    status,
    checkpoint_ref:
      row.checkpoint_ref === null
        ? null
        : textV1(row.checkpoint_ref, "integration.checkpoint"),
    proposed_changes: Array.isArray(result.proposed_changes) ? structuredClone(result.proposed_changes) : [],
    applied_counts: recordV1(result.applied_counts ?? {}, "integration.applied_counts"),
    failure_refs: stringArrayV1(result.failure_refs ?? []),
    error:
      status === "failed"
        ? textV1(error?.message ?? error?.code, "integration.error_message")
        : null,
    created_at: instantV1(row.created_at, "integration.created_at"),
    updated_at: instantV1(row.updated_at, "integration.updated_at"),
  } as unknown as MemoryIntegrationJobV1;
  if (!Value.Check(MemoryIntegrationJobDetailsV1Schema, job)) {
    throw new Error("Memory persisted integration job violates its owner schema");
  }
  assertMemoryIntegrationJobSemanticBindingsV1(job);
  return Object.freeze(job);
}

function integrationResponseV1(job: MemoryIntegrationJobV1, replayed: boolean): MemoryIntegrationRunResponseV1 {
  const response = {
    schema_version: "memory.integration_run.v1",
    integration_job_id: job.id,
    state_version: job.state_version,
    status: job.status,
    ...(job.checkpoint_ref === null ? {} : { checkpoint_ref: job.checkpoint_ref }),
    ...(job.proposed_changes.length === 0 ? {} : { proposed_changes: job.proposed_changes }),
    ...(Object.keys(job.applied_counts).length === 0 ? {} : { applied_counts: job.applied_counts }),
    ...(job.failure_refs.length === 0 ? {} : { failure_refs: job.failure_refs }),
    duplicate_replayed: replayed,
  } as MemoryIntegrationRunResponseV1;
  if (!Value.Check(MemoryIntegrationRunResponseV1Schema, response)) {
    throw new Error("Memory integration response violates its owner schema");
  }
  assertMemoryIntegrationRunResponseSemanticBindingsV1(response);
  return Object.freeze(response);
}

export class PostgresMemoryHttpApplicationV1 {
  public constructor(
    private readonly core: MemoryApplicationV1,
    private readonly composition: CompositionV1,
    private readonly embedding: MemoryEmbeddingPortV1,
    private readonly promotionSecret: string,
  ) {
    if (Buffer.byteLength(promotionSecret, "utf8") < 32) {
      throw new Error("PAI_MEMORY_PROMOTION_TOKEN_HMAC_SECRET must be at least 32 UTF-8 bytes");
    }
  }

  public checkReadiness = (): Promise<void> => this.core.checkReadiness();
  public writeBatch: MemoryApplicationV1["writeBatch"] = (...args) => this.core.writeBatch(...args);
  public fastRecall: MemoryApplicationV1["fastRecall"] = (...args) => this.core.fastRecall(...args);

  public async deepRecall(
    principal: MemoryPrincipalV1,
    requestValue: MemoryDeepRecallRequestV1,
  ): Promise<MemoryDeepRecallResponseV1> {
    const request = validateV1(
      MemoryDeepRecallRequestV1Schema,
      requestValue,
      assertMemoryDeepRecallRequestSemanticBindingsV1,
      "deep recall request",
    );
    const scope = scopeV1(principal, ["action_runtime"], "memory.deep_recall", request.bot_id);
    if (request.owner_agent_id !== scope.owner_agent_id) failV1("bot_scope_mismatch", "owner agent scope mismatch");
    const [queryVector] = await this.embedding.embed([request.query], MEMORY_EMBEDDING_PROFILE_V1);
    if (queryVector === undefined) throw new Error("Memory embedding provider returned no query vector");
    const limit = request.limit ?? 20;
    const channelRows = await this.composition.read_committed_postgres.withReadCommittedTransaction(
      async (transaction) => {
        const result = new Map<string, readonly JsonRowV1[]>();
        if (request.scope.channels.includes("semantic")) {
          const rows = await transaction.query<JsonRowV1>(
            `SELECT memory_point_id,series_id,topic_family_key,content_summary,
                    importance_score,occurred_at,
                    (summary_embedding <=> $2::extensions.halfvec) AS distance
               FROM memory.memory_point_search_index
              WHERE bot_id=$1 AND status IN ('active','downgraded')
                AND summary_embedding IS NOT NULL
                AND (evidence_valid_until IS NULL OR evidence_valid_until > clock_timestamp())
              ORDER BY summary_embedding <=> $2::extensions.halfvec, memory_point_id
              LIMIT $3`,
            [scope.bot_id, vectorSqlV1(queryVector), limit * 4],
          );
          result.set("semantic", rows.rows);
        }
        if (request.scope.channels.includes("timeline")) {
          const rows = await transaction.query<JsonRowV1>(
            `SELECT memory_point_id,series_id,topic_family_key,content_summary,
                    importance_score,occurred_at,0::double precision AS distance
               FROM memory.memory_point_search_index
              WHERE bot_id=$1 AND status IN ('active','downgraded')
                AND content_tsv @@ websearch_to_tsquery('simple',$2)
                AND (evidence_valid_until IS NULL OR evidence_valid_until > clock_timestamp())
              ORDER BY occurred_at DESC,memory_point_id
              LIMIT $3`,
            [scope.bot_id, request.query, limit * 4],
          );
          result.set("timeline", rows.rows);
        }
        if (request.scope.channels.includes("relationship")) {
          const rows = await transaction.query<JsonRowV1>(
            `SELECT DISTINCT ON (projection.memory_point_id)
                    projection.memory_point_id,projection.series_id,
                    projection.topic_family_key,projection.content_summary,
                    projection.importance_score,projection.occurred_at,
                    edge.id AS edge_id,edge.relation_type,edge.subject_role_id,
                    edge.object_role_id,edge.confidence
               FROM memory.relationship_edges AS edge
               JOIN memory.memory_point_search_index AS projection
                 ON projection.memory_point_id = ANY(edge.evidence_memory_point_ids)
              WHERE edge.bot_id=$1 AND projection.bot_id=$1
                AND projection.status IN ('active','downgraded')
                AND (projection.evidence_valid_until IS NULL OR projection.evidence_valid_until > clock_timestamp())
              ORDER BY projection.memory_point_id,edge.confidence DESC,edge.id
              LIMIT $2`,
            [scope.bot_id, limit * 4],
          );
          result.set("relationship", rows.rows);
        }
        return result;
      },
    );
    const fused = new Map<string, { row: JsonRowV1; ranks: Record<string, number>; raw: number; path: JsonRowV1[] }>();
    for (const channel of request.scope.channels) {
      const rows = channelRows.get(channel) ?? [];
      rows.forEach((row, index) => {
        const id = textV1(row.memory_point_id, "deep recall point");
        const entry = fused.get(id) ?? { row, ranks: {}, raw: 0, path: [] };
        entry.ranks[channel] = index + 1;
        entry.raw += 1 / (60 + index + 1);
        if (channel === "relationship" && row.edge_id !== undefined) {
          entry.path = [{
            edge_id: row.edge_id,
            edge_type: row.relation_type,
            from_id: row.subject_role_id,
            to_id: row.object_role_id,
            confidence: Number(row.confidence),
          }];
        }
        fused.set(id, entry);
      });
    }
    const maxRaw = Math.max(0, ...[...fused.values()].map((entry) => entry.raw));
    const now = Date.now();
    const items = [...fused.values()]
      .map((entry) => {
        const normalized = maxRaw === 0 ? 0 : entry.raw / maxRaw;
        const ageDays = Math.max(0, (now - Date.parse(instantV1(entry.row.occurred_at, "deep recall occurred_at"))) / 86_400_000);
        const recency = Math.exp(-ageDays / 30);
        const importance = Math.max(0, Math.min(1, numberV1(entry.row.importance_score, "deep recall importance")));
        return {
          memory_point_id: textV1(entry.row.memory_point_id, "deep recall point"),
          series_id: textV1(entry.row.series_id, "deep recall series"),
          topic_family_key: textV1(entry.row.topic_family_key, "deep recall topic family"),
          content_summary: textV1(entry.row.content_summary, "deep recall summary"),
          matched_channels: Object.keys(entry.ranks).sort(),
          channel_ranks: entry.ranks,
          raw_rrf_score: entry.raw,
          normalized_rrf_score: normalized,
          importance_score: importance,
          recency_score: recency,
          final_score: Math.max(0, Math.min(1, normalized * 0.6 + importance * 0.2 + recency * 0.2)),
          relationship_path: entry.path,
          redaction_status: "not_required",
        };
      })
      .sort((left, right) => right.final_score - left.final_score || left.memory_point_id.localeCompare(right.memory_point_id))
      .slice(0, limit);
    const response = {
      code: "memory_deep_recall_completed",
      message: "Memory deep recall completed",
      retryable: false,
      details: {
        request_id: stableIdV1("mdr", [scopeKeyV1(scope), request.idempotency_key]),
        ranking_profile_version: "memory.deep_recall.rrf.v1",
        graph_profile_version: "memory.deep_recall_graph.v1",
        items,
        actual_graph_budget: {
          max_hops: request.scope.channels.includes("relationship") ? 1 : 0,
          nodes_visited: items.length,
          edges_visited: items.reduce((sum, item) => sum + item.relationship_path.length, 0),
        },
        is_partial: false,
        completed_channels: [...request.scope.channels],
        missing_channels: [],
        second_query_executed: request.scope.channels.length > 1,
        partial_reason: null,
      },
      trace_id: request.runtime_run_id,
    } as unknown as MemoryDeepRecallResponseV1;
    if (!Value.Check(MemoryDeepRecallResponseV1Schema, response)) throw new Error("Memory deep recall response is invalid");
    assertMemoryDeepRecallResponseSemanticBindingsV1(response);
    return Object.freeze(response);
  }

  public async checkPrePromotion(
    principal: MemoryPrincipalV1,
    requestValue: MemoryPrePromotionCheckRequestV1,
  ): Promise<MemoryPrePromotionCheckResponseV1> {
    const request = validateV1(
      MemoryPrePromotionCheckRequestV1Schema,
      requestValue,
      assertMemoryPrePromotionCheckRequestSemanticBindingsV1,
      "pre-promotion check request",
    );
    const scope = scopeV1(principal, ["knowthat"], "memory.pre_promotion_check", request.bot_id);
    const requestHash = promotionRequestHashV1(request as unknown as Readonly<Record<string, unknown>>);
    const snapshot = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const current = await transaction.query<JsonRowV1>(
        `SELECT identity.current_check_generation,check_row.*
           FROM memory.memory_pre_promotion_check_identities AS identity
           JOIN memory.memory_pre_promotion_checks AS check_row
             ON check_row.id=identity.current_check_id
          WHERE identity.bot_id=$1 AND identity.idempotency_key=$2`,
        [scope.bot_id, request.idempotency_key],
      );
      const points = await transaction.query<JsonRowV1>(
        `SELECT point.*,to_jsonb(series) AS series_row
           FROM memory.memory_points AS point
           JOIN memory.memory_series AS series ON series.id=point.series_id
          WHERE point.bot_id=$1 AND point.id=ANY($2::text[])`,
        [scope.bot_id, request.memory_point_ids],
      );
      const conflicts = await transaction.query<JsonRowV1>(
        `SELECT * FROM memory.memory_conflicts
          WHERE bot_id=$1 AND status='open'
            AND (left_memory_point_id=ANY($2::text[]) OR right_memory_point_id=ANY($2::text[]))`,
        [scope.bot_id, request.memory_point_ids],
      );
      return { current: current.rows[0], points: points.rows, conflicts: conflicts.rows };
    });
    if (snapshot.current !== undefined && snapshot.current.request_hash !== requestHash) {
      failV1("idempotency_conflict", "pre-promotion check idempotency key drifted");
    }
    const now = new Date();
    const required = request.required_checks ?? [
      "point_exists", "state_allowed", "no_unresolved_conflict", "not_expired", "provenance_integrity",
    ];
    const pointById = new Map(snapshot.points.map((point) => [textV1(point.id, "point.id"), point]));
    const pointChecks = request.memory_point_ids.map((pointId) => {
      const point = pointById.get(pointId);
      if (point === undefined) {
        return {
          memory_point_id: pointId, exists: false, state_version: null, state_hash: null,
          status: null, evidence_valid_until: null, unresolved_conflicts: [], expired: false,
          provenance_valid: false, source_trigger_process_id: null, confidence_score: null,
          user_explicit_confirmation: false, blocking_reasons: ["point_missing"],
        } as const;
      }
      const series = recordV1(point.series_row, "point.series");
      const unresolved = snapshot.conflicts
        .filter((conflict) => conflict.left_memory_point_id === pointId || conflict.right_memory_point_id === pointId)
        .map((conflict) => ({
          conflict_id: textV1(conflict.id, "conflict.id"),
          conflict_version: integerV1(conflict.state_version, "conflict.version"),
        }))
        .sort((left, right) => left.conflict_id.localeCompare(right.conflict_id));
      const validUntil = point.evidence_valid_until === null ? null : instantV1(point.evidence_valid_until, "point.valid_until");
      const expired = validUntil !== null && Date.parse(validUntil) <= now.getTime();
      const source = recordV1(point.source_info, "point.source_info");
      const provenance = typeof source.source_ref === "string" && source.source_ref.length > 0 && typeof point.source_trigger_process_id === "string" && point.source_trigger_process_id.length > 0;
      const reasons: string[] = [];
      if (required.includes("state_allowed") && (point.status !== "active" || series.status !== "active")) {
        reasons.push(point.status === "downgraded" ? "point_downgraded" : point.status === "archived" ? "point_archived" : "point_not_active");
      }
      if (required.includes("no_unresolved_conflict") && unresolved.length > 0) reasons.push("unresolved_conflict");
      if (required.includes("not_expired") && expired) reasons.push("evidence_expired");
      if (required.includes("provenance_integrity") && !provenance) reasons.push("provenance_invalid");
      return {
        memory_point_id: pointId,
        exists: true,
        state_version: integerV1(point.state_version, "point.version"),
        state_hash: pointStateHashV1(point, series),
        status: point.status,
        evidence_valid_until: validUntil,
        unresolved_conflicts: unresolved,
        expired,
        provenance_valid: provenance,
        source_trigger_process_id: textV1(point.source_trigger_process_id, "point.process"),
        confidence_score: numberV1(point.confidence_score, "point.confidence"),
        user_explicit_confirmation: source.source_type === "user_explicit" && source.actor_type === "user",
        blocking_reasons: reasons,
      };
    });
    const existingPoints = pointChecks.filter((point) => point.exists);
    const independent = new Set(existingPoints.map((point) => point.source_trigger_process_id)).size;
    const userConfirmed = existingPoints.some((point) => point.user_explicit_confirmation);
    const reasons = new Set(pointChecks.flatMap((point) => point.blocking_reasons));
    if (required.includes("independent_sources") && independent < 2) reasons.add("insufficient_independent_sources");
    if (required.includes("user_confirmation") && !userConfirmed) reasons.add("user_confirmation_missing");
    const responseWithoutTokenCurrent = snapshot.current === undefined ? undefined : recordV1(snapshot.current.response_payload, "check.response");
    const currentStillValid =
      responseWithoutTokenCurrent !== undefined &&
      Date.parse(textV1(responseWithoutTokenCurrent.expires_at, "check.expires_at")) > now.getTime() &&
      canonicalV1(responseWithoutTokenCurrent.points) === canonicalV1(pointChecks);
    if (currentStillValid) {
      const generation = integerV1(responseWithoutTokenCurrent.check_generation, "check.generation");
      const checkedAt = textV1(responseWithoutTokenCurrent.checked_at, "check.checked_at");
      const token = promotionCheckTokenV1(this.promotionSecret, textV1(responseWithoutTokenCurrent.check_id, "check.id"), generation, requestHash, checkedAt);
      return Object.freeze({ ...structuredClone(responseWithoutTokenCurrent), check_token: token, duplicate_replayed: true } as MemoryPrePromotionCheckResponseV1);
    }
    const generation = (snapshot.current === undefined ? 0 : integerV1(snapshot.current.current_check_generation, "check.current_generation")) + 1;
    const checkedAt = now.toISOString();
    const checkId = stableIdV1("mpc", [scopeKeyV1(scope), request.idempotency_key, generation, requestHash, checkedAt]);
    const token = promotionCheckTokenV1(this.promotionSecret, checkId, generation, requestHash, checkedAt);
    const reviewOnly = new Set(["insufficient_independent_sources", "user_confirmation_missing"]);
    const overall = reasons.size === 0 ? "passed" : [...reasons].every((reason) => reviewOnly.has(reason)) ? "needs_review" : "blocked";
    const response = {
      schema_version: "memory.pre_promotion_check.v1",
      check_id: checkId,
      check_generation: generation,
      candidate_fact_id: request.candidate_fact_id,
      overall_result: overall,
      checked_at: checkedAt,
      expires_at: new Date(now.getTime() + 30_000).toISOString(),
      check_token: token,
      check_policy_version: MEMORY_PRE_PROMOTION_POLICY_VERSION_V1,
      required_checks: required,
      points: pointChecks,
      summary: {
        active_count: existingPoints.filter((point) => point.status === "active").length,
        independent_trigger_process_count: independent,
        has_user_explicit_confirmation: userConfirmed,
        blocking_reasons: [...reasons].sort(),
      },
      duplicate_replayed: false,
    } as MemoryPrePromotionCheckResponseV1;
    if (!Value.Check(MemoryPrePromotionCheckResponseV1Schema, response)) throw new Error("Memory pre-promotion response is invalid");
    assertMemoryPrePromotionCheckResponseSemanticBindingsV1(response);
    const { check_token: _token, ...storedResponse } = response;
    await executeWriterV1(
      this.composition,
      "memory_pre_promotion_check",
      request.idempotency_key,
      request.trace_id,
      "append_memory_pre_promotion_check_v1",
      {
        p_check_id: checkId,
        p_candidate_fact_id: request.candidate_fact_id,
        p_check: {
          memory_pre_promotion_checks: {
            id: checkId,
            bot_id: scope.bot_id,
            candidate_fact_id: request.candidate_fact_id,
            idempotency_key: request.idempotency_key,
            request_hash: requestHash,
            required_checks: required,
            point_state_snapshot: { owner_scope_v1: scope, points: pointChecks },
            overall_result: overall,
            blocking_reasons: [...reasons].sort(),
            check_policy_version: MEMORY_PRE_PROMOTION_POLICY_VERSION_V1,
            check_token_hash: sha256V1(token),
            checked_at: checkedAt,
            expires_at: response.expires_at,
            response_payload: storedResponse,
            check_generation: generation,
            generation_status: "current",
          },
          memory_audit_logs: [{
            id: stableIdV1("mpca", [checkId, generation]), bot_id: scope.bot_id,
            revision_id: null, feedback_event_id: null, target_type: "pre_promotion_check",
            target_id: checkId, actor_ref: principal.caller, action: "check",
            reason_code: overall, capability_snapshot: {}, payload: { candidate_fact_id: request.candidate_fact_id },
            trace_id: request.trace_id, created_at: checkedAt,
          }],
        },
        p_idempotency_key: request.idempotency_key,
        p_request_hash: requestHash,
        p_trace_id: request.trace_id,
      },
    );
    return Object.freeze(response);
  }

  public async validatePrePromotion(
    principal: MemoryPrincipalV1,
    requestValue: MemoryPrePromotionValidateRequestV1,
  ): Promise<MemoryPromotionReservationV1> {
    const request = validateV1(
      MemoryPrePromotionValidateRequestV1Schema,
      requestValue,
      assertMemoryPrePromotionValidateRequestSemanticBindingsV1,
      "pre-promotion validation request",
    );
    const scope = scopeV1(principal, ["knowthat"], "memory.pre_promotion_check", request.bot_id);
    const requestHash = sha256V1(request);
    const reservationId = stableIdV1("mpr", [scopeKeyV1(scope), request.idempotency_key]);
    const existing = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const result = await transaction.query<JsonRowV1>(
        `SELECT * FROM memory.memory_promotion_reservations
          WHERE id=$1 OR idempotency_key=$2
          ORDER BY CASE WHEN id=$1 THEN 0 ELSE 1 END LIMIT 1`,
        [reservationId, request.idempotency_key],
      );
      return result.rows[0];
    });
    const reservationToken = reservationTokenV1(reservationId, requestHash, request.check_token);
    if (existing !== undefined) {
      if (existing.id !== reservationId || existing.request_hash !== requestHash || existing.status !== "active") {
        failV1("idempotency_conflict", "promotion reservation idempotency key drifted");
      }
      const response = {
        schema_version: "memory.promotion_reservation.v1",
        reservation_id: reservationId,
        check_id: textV1(existing.check_id, "reservation.check_id"),
        check_generation: integerV1(existing.check_generation, "reservation.check_generation"),
        candidate_fact_id: textV1(existing.candidate_fact_id, "reservation.candidate"),
        fencing_generation: integerV1(existing.fencing_generation, "reservation.generation"),
        reserved_points: request.expected_point_versions,
        reserved_conflicts: request.expected_conflict_versions,
        reservation_token: reservationToken,
        reserved_at: instantV1(existing.created_at, "reservation.created_at"),
        expires_at: instantV1(existing.expires_at, "reservation.expires_at"),
        status: "active",
      } as MemoryPromotionReservationV1;
      if (sha256V1(reservationToken) !== existing.reservation_token_hash) failV1("promotion_stale_fence", "promotion reservation token drift");
      return Object.freeze(response);
    }
    const check = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const checkResult = await transaction.query<JsonRowV1>(
        `SELECT check_row.* FROM memory.memory_pre_promotion_checks AS check_row
          JOIN memory.memory_pre_promotion_check_identities AS identity
            ON identity.bot_id=check_row.bot_id
           AND identity.idempotency_key=check_row.idempotency_key
           AND identity.current_check_id=check_row.id
           AND identity.current_check_generation=check_row.check_generation
          WHERE check_row.id=$1 AND check_row.bot_id=$2 AND check_row.check_generation=$3`,
        [request.check_id, scope.bot_id, request.check_generation],
      );
      const points = await transaction.query<JsonRowV1>(
        `SELECT point.*,to_jsonb(series) AS series_row FROM memory.memory_points AS point
          JOIN memory.memory_series AS series ON series.id=point.series_id
          WHERE point.bot_id=$1 AND point.id=ANY($2::text[])`,
        [scope.bot_id, request.expected_point_versions.map((entry) => entry.memory_point_id)],
      );
      const conflicts = await transaction.query<JsonRowV1>(
        `SELECT * FROM memory.memory_conflicts WHERE bot_id=$1 AND id=ANY($2::text[])`,
        [scope.bot_id, request.expected_conflict_versions.map((entry) => entry.conflict_id)],
      );
      return { row: checkResult.rows[0], points: points.rows, conflicts: conflicts.rows };
    });
    if (
      check.row === undefined ||
      check.row.candidate_fact_id !== request.candidate_fact_id ||
      check.row.overall_result !== "passed" ||
      check.row.check_token_hash !== sha256V1(request.check_token) ||
      Date.parse(instantV1(check.row.expires_at, "check.expires_at")) <= Date.now()
    ) {
      failV1("stale_memory_check", "pre-promotion check is stale, blocked, or expired", true);
    }
    const pointById = new Map(check.points.map((point) => [textV1(point.id, "point.id"), point]));
    const targets: JsonRowV1[] = [];
    for (const expected of request.expected_point_versions) {
      const point = pointById.get(expected.memory_point_id);
      if (point === undefined || integerV1(point.state_version, "point.version") !== expected.state_version) {
        failV1("promotion_version_drift", `memory point ${expected.memory_point_id} changed`, true);
      }
      const series = recordV1(point.series_row, "point.series");
      if (pointStateHashV1(point, series) !== expected.state_hash) failV1("promotion_version_drift", `memory point ${expected.memory_point_id} hash changed`, true);
      targets.push({ aggregate_type: "memory_point", aggregate_id: expected.memory_point_id, expected_state_version: expected.state_version, expected_state_hash: expected.state_hash });
      if (!targets.some((target) => target.aggregate_type === "memory_series" && target.aggregate_id === point.series_id)) {
        targets.push({ aggregate_type: "memory_series", aggregate_id: point.series_id, expected_state_version: Number(series.state_version), expected_state_hash: seriesStateHashV1(series) });
      }
    }
    const conflictById = new Map(check.conflicts.map((conflict) => [textV1(conflict.id, "conflict.id"), conflict]));
    for (const expected of request.expected_conflict_versions) {
      const conflict = conflictById.get(expected.conflict_id);
      if (conflict === undefined || integerV1(conflict.state_version, "conflict.version") !== expected.conflict_version) {
        failV1("promotion_version_drift", `memory conflict ${expected.conflict_id} changed`, true);
      }
      targets.push({ aggregate_type: "memory_conflict", aggregate_id: expected.conflict_id, expected_state_version: expected.conflict_version, expected_state_hash: conflictStateHashV1(conflict) });
    }
    const expiresAt = new Date(Date.now() + 5_000).toISOString();
    const persisted = await executeWriterV1(
      this.composition,
      "memory_promotion_reservation",
      request.idempotency_key,
      request.check_id,
      "record_memory_promotion_reservation_v1",
      {
        p_reservation_id: reservationId,
        p_expected_candidate_state: { candidate_fact_id: request.candidate_fact_id },
        p_pre_promotion_check: { check_id: request.check_id, check_generation: request.check_generation },
        p_reservation: {
          memory_promotion_reservations: {
            id: reservationId, check_id: request.check_id, bot_id: scope.bot_id,
            candidate_fact_id: request.candidate_fact_id, idempotency_key: request.idempotency_key,
            request_hash: requestHash, reservation_token_hash: sha256V1(reservationToken),
            status: "active", expires_at: expiresAt, check_generation: request.check_generation,
          },
        },
        p_targets: { memory_promotion_reservation_targets: targets },
        p_idempotency_key: request.idempotency_key,
        p_request_hash: requestHash,
        p_trace_id: request.check_id,
      },
    );
    const response = {
      schema_version: "memory.promotion_reservation.v1",
      reservation_id: reservationId,
      check_id: request.check_id,
      check_generation: request.check_generation,
      candidate_fact_id: request.candidate_fact_id,
      fencing_generation: integerV1(persisted.fencing_generation, "reservation.generation"),
      reserved_points: request.expected_point_versions,
      reserved_conflicts: request.expected_conflict_versions,
      reservation_token: reservationToken,
      reserved_at: instantV1(persisted.created_at, "reservation.created_at"),
      expires_at: instantV1(persisted.expires_at, "reservation.expires_at"),
      status: "active",
    } as MemoryPromotionReservationV1;
    if (!Value.Check(MemoryPromotionReservationV1Schema, response)) throw new Error("Memory promotion reservation response is invalid");
    assertMemoryPromotionReservationSemanticBindingsV1(response);
    return Object.freeze(response);
  }

  public async ackPromotionReservation(
    principal: MemoryPrincipalV1,
    requestValue: MemoryPromotionReservationAckRequestV1,
  ): Promise<MemoryPromotionReservationAckResponseV1> {
    const request = validateV1(MemoryPromotionReservationAckRequestV1Schema, requestValue, assertMemoryPromotionReservationAckRequestSemanticBindingsV1, "promotion ack request");
    scopeV1(principal, ["knowthat"], "memory.promotion_reservation.ack", request.bot_id);
    const requestHash = promotionRequestHashV1(request as unknown as Readonly<Record<string, unknown>>);
    const response = {
      schema_version: "memory.promotion_reservation_ack.v1",
      reservation_id: request.reservation_id,
      candidate_fact_id: request.candidate_fact_id,
      fencing_generation: request.fencing_generation,
      status: "committed",
      promotion_revision_id: request.promotion_revision_id,
      committed_at: request.committed_at,
      duplicate_replayed: false,
    } as MemoryPromotionReservationAckResponseV1;
    const result = await executeWriterV1(this.composition, "memory_promotion_ack", request.idempotency_key, request.trace_id, "transition_memory_promotion_v1", {
      p_reservation_id: request.reservation_id,
      p_expected_status: "active",
      p_next_status: "acked",
      p_expected_fencing_generation: String(request.fencing_generation),
      p_promotion: { memory_promotion_reservations: { status: "acked", committed_at: request.committed_at, promotion_revision_id: request.promotion_revision_id, ack_payload: { request_hash: requestHash, response }, reservation_token_hash: request.reservation_token_hash } },
      p_idempotency_key: request.idempotency_key,
      p_request_hash: requestHash,
      p_trace_id: request.trace_id,
    });
    response.duplicate_replayed = result.duplicate_replayed === true;
    if (!Value.Check(MemoryPromotionReservationAckResponseV1Schema, response)) throw new Error("Memory promotion ack response is invalid");
    assertMemoryPromotionReservationAckResponseSemanticBindingsV1(response);
    return Object.freeze(response);
  }

  public async releasePromotionReservation(
    principal: MemoryPrincipalV1,
    requestValue: MemoryPromotionReservationReleaseRequestV1,
  ): Promise<MemoryPromotionReservationReleaseResponseV1> {
    const request = validateV1(MemoryPromotionReservationReleaseRequestV1Schema, requestValue, assertMemoryPromotionReservationReleaseRequestSemanticBindingsV1, "promotion release request");
    scopeV1(principal, ["knowthat"], "memory.promotion_reservation.release", request.bot_id);
    const requestHash = promotionRequestHashV1(request as unknown as Readonly<Record<string, unknown>>);
    const response = {
      schema_version: "memory.promotion_reservation_release.v1",
      reservation_id: request.reservation_id,
      candidate_fact_id: request.candidate_fact_id,
      fencing_generation: request.fencing_generation,
      status: "released",
      release_reason: request.release_reason,
      released_at: request.released_at,
      duplicate_replayed: false,
    } as MemoryPromotionReservationReleaseResponseV1;
    const result = await executeWriterV1(this.composition, "memory_promotion_release", request.idempotency_key, request.trace_id, "transition_memory_promotion_v1", {
      p_reservation_id: request.reservation_id,
      p_expected_status: "active",
      p_next_status: "released",
      p_expected_fencing_generation: String(request.fencing_generation),
      p_promotion: { memory_promotion_reservations: { status: "released", release_reason: request.release_reason, ack_payload: { request_hash: requestHash, response }, reservation_token_hash: request.reservation_token_hash } },
      p_idempotency_key: request.idempotency_key,
      p_request_hash: requestHash,
      p_trace_id: request.trace_id,
    });
    response.duplicate_replayed = result.duplicate_replayed === true;
    if (!Value.Check(MemoryPromotionReservationReleaseResponseV1Schema, response)) throw new Error("Memory promotion release response is invalid");
    assertMemoryPromotionReservationReleaseResponseSemanticBindingsV1(response);
    return Object.freeze(response);
  }

  public async buildAssociationGraph(
    principal: MemoryPrincipalV1,
    requestValue: MemoryGraphBuildRequestV1,
  ): Promise<MemoryGraphBuildResponseV1> {
    const request = validateV1(MemoryGraphBuildRequestV1Schema, requestValue, assertMemoryGraphBuildRequestSemanticBindingsV1, "graph build request");
    const scope = scopeV1(principal, ["memory"], "memory.association_graph.build", request.bot_id);
    const requestHash = sha256V1(request);
    const graphId = stableIdV1("mgb", [scopeKeyV1(scope), request.idempotency_key]);
    const existing = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const result = await transaction.query<JsonRowV1>(`SELECT * FROM memory.memory_graph_builds WHERE bot_id=$1 AND idempotency_key=$2`, [scope.bot_id, request.idempotency_key]);
      return result.rows[0];
    });
    if (existing !== undefined) {
      if (existing.request_hash !== requestHash) failV1("idempotency_conflict", "graph build idempotency drift");
      return Object.freeze({ ...structuredClone(recordV1(existing.response_payload, "graph.response")), duplicate_replayed: true } as MemoryGraphBuildResponseV1);
    }
    const maxNodes = request.max_nodes ?? 1_000;
    const maxEdges = request.max_edges ?? 5_000;
    const maxHops = request.max_hops ?? 2;
    const graph = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const pointResult = await transaction.query<JsonRowV1>(`SELECT id,series_id FROM memory.memory_points WHERE bot_id=$1 AND id=ANY($2::text[])`, [scope.bot_id, request.seed_memory_point_ids]);
      const seriesIds = [...new Set([...pointResult.rows.map((row) => textV1(row.series_id, "graph.series")), ...(request.seed_series_ids ?? [])])];
      const edgeResult = await transaction.query<JsonRowV1>(
        `SELECT id,relation_type,subject_role_id,object_role_id,confidence,evidence_memory_point_ids
           FROM memory.relationship_edges WHERE bot_id=$1
            AND ($2::text[]='{}'::text[] OR evidence_memory_point_ids && $2::text[])
            AND ($3::text[]='{}'::text[] OR relation_type=ANY($3::text[]))
          ORDER BY confidence DESC,id LIMIT $4`,
        [scope.bot_id, request.seed_memory_point_ids, request.edge_types ?? [], maxEdges + 1],
      );
      return { points: pointResult.rows, seriesIds, edges: edgeResult.rows };
    });
    const nodes = new Map<string, { type: "memory_point" | "memory_series" | "subject"; id: string; redaction_status: "not_required" }>();
    graph.points.forEach((row) => nodes.set(textV1(row.id, "graph.point"), { type: "memory_point", id: textV1(row.id, "graph.point"), redaction_status: "not_required" }));
    graph.seriesIds.forEach((id) => nodes.set(id, { type: "memory_series", id, redaction_status: "not_required" }));
    for (const edge of graph.edges.slice(0, maxEdges)) {
      for (const id of [textV1(edge.subject_role_id, "graph.subject"), textV1(edge.object_role_id, "graph.object")]) {
        if (nodes.size < maxNodes || nodes.has(id)) nodes.set(id, { type: "subject", id, redaction_status: "not_required" });
      }
    }
    const edges = graph.edges.slice(0, maxEdges).flatMap((row) => {
      const from = textV1(row.subject_role_id, "graph.from");
      const to = textV1(row.object_role_id, "graph.to");
      return nodes.has(from) && nodes.has(to) ? [{ edge_id: textV1(row.id, "graph.edge"), type: row.relation_type, from, to, confidence: numberV1(row.confidence, "graph.confidence") }] : [];
    });
    const paths = [
      ...[...nodes.values()].filter((node) => node.type !== "subject").map((node) => ({ node_ids: [node.id], edge_ids: [], hop_count: 0, path_score: 1 })),
      ...(maxHops === 0 ? [] : edges.map((edge) => ({ node_ids: [edge.from, edge.to], edge_ids: [edge.edge_id], hop_count: 1, path_score: edge.confidence }))),
    ].slice(0, 10_000);
    const truncated = graph.edges.length > maxEdges || nodes.size >= maxNodes;
    const response = {
      schema_version: "memory.association_graph.v1",
      graph_id: graphId,
      graph_revision: 1,
      nodes: [...nodes.values()],
      edges,
      paths,
      actual_budget: { max_hops: maxHops, nodes_visited: nodes.size, edges_visited: edges.length },
      truncated,
      ...(truncated ? { partial_reason: "graph_budget_exceeded" } : {}),
      duplicate_replayed: false,
    } as MemoryGraphBuildResponseV1;
    if (!Value.Check(MemoryGraphBuildResponseV1Schema, response)) throw new Error("Memory graph response is invalid");
    assertMemoryGraphBuildResponseSemanticBindingsV1(response);
    await executeWriterV1(this.composition, "memory_graph_build", request.idempotency_key, graphId, "append_memory_graph_build_v1", {
      p_build_id: graphId,
      p_build_result: {
        memory_graph_builds: { id: graphId, bot_id: scope.bot_id, idempotency_key: request.idempotency_key, request_hash: requestHash, graph_profile_version: "memory.deep_recall_graph.v1", graph_revision: 1, response_payload: response, expires_at: new Date(Date.now() + 30_000).toISOString() },
        memory_audit_logs: [], memory_event_outbox: [],
      },
      p_idempotency_key: request.idempotency_key,
      p_request_hash: requestHash,
      p_trace_id: graphId,
    });
    return Object.freeze(response);
  }

  public async querySeries(
    principal: MemoryPrincipalV1,
    requestValue: MemoryQuerySeriesRequestV1,
  ): Promise<MemoryQuerySeriesResponseV1> {
    const request = validateV1(MemoryQuerySeriesRequestV1Schema, requestValue, assertMemoryQuerySeriesRequestSemanticBindingsV1, "series query request");
    const scope = scopeV1(principal, ["trigger_processor", "action_runtime", "meta_cognition", "knowthat", "memory"], "memory.series.read", request.bot_id);
    const include = new Set(request.include ?? ["points"]);
    const snapshot = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const seriesResult = await transaction.query<JsonRowV1>(`SELECT * FROM memory.memory_series WHERE bot_id=$1 AND id=$2`, [scope.bot_id, request.series_id]);
      const series = seriesResult.rows[0];
      if (series === undefined) failV1("invalid_request", "memory series was not found");
      const token = stableIdV1("mss", [scopeKeyV1(scope), series.id, series.state_version, series.updated_at]);
      if (request.snapshot_token !== undefined && request.snapshot_token !== token) failV1("snapshot_expired", "series query snapshot is stale", true);
      const points = include.has("points") ? await transaction.query<JsonRowV1>(
        `SELECT * FROM memory.memory_points WHERE bot_id=$1 AND series_id=$2
          AND ($3::text IS NULL OR (version_no,id) < (SELECT version_no,id FROM memory.memory_points WHERE id=$3))
          ORDER BY version_no DESC,id LIMIT $4`,
        [scope.bot_id, request.series_id, request.points_cursor ?? null, (request.points_limit ?? 50) + 1],
      ) : { rows: [] as JsonRowV1[] };
      const conflicts = include.has("conflicts") ? await transaction.query<JsonRowV1>(
        `SELECT * FROM memory.memory_conflicts WHERE bot_id=$1 AND series_id=$2
          AND ($3::text IS NULL OR (state_version,id) < (SELECT state_version,id FROM memory.memory_conflicts WHERE id=$3))
          ORDER BY state_version DESC,id LIMIT $4`,
        [scope.bot_id, request.series_id, request.conflicts_cursor ?? null, (request.conflicts_limit ?? 50) + 1],
      ) : { rows: [] as JsonRowV1[] };
      const pointIds = points.rows.map((row) => textV1(row.id, "series.point"));
      const edges = include.has("edges") ? await transaction.query<JsonRowV1>(
        `SELECT * FROM memory.relationship_edges WHERE bot_id=$1
          AND evidence_memory_point_ids && $2::text[]
          AND ($3::text IS NULL OR (relation_type,id) > (SELECT relation_type,id FROM memory.relationship_edges WHERE id=$3))
          ORDER BY relation_type,id LIMIT $4`,
        [scope.bot_id, pointIds, request.edges_cursor ?? null, (request.edges_limit ?? 50) + 1],
      ) : { rows: [] as JsonRowV1[] };
      return { series, token, points: points.rows, conflicts: conflicts.rows, edges: edges.rows };
    });
    const pointLimit = request.points_limit ?? 50;
    const conflictLimit = request.conflicts_limit ?? 50;
    const edgeLimit = request.edges_limit ?? 50;
    const points = snapshot.points.slice(0, pointLimit).map((row) => {
      const source = recordV1(row.source_info, "series.source_info");
      return {
        memory_point_id: textV1(row.id, "series.point_id"), version_no: integerV1(row.version_no, "series.point_version"),
        state_version: integerV1(row.state_version, "series.point_state"), status: row.status,
        content_summary: textV1(row.content_summary, "series.summary"), occurred_at: instantV1(row.occurred_at, "series.occurred_at"),
        source_refs: [textV1(source.source_ref, "series.source_ref")], redaction_status: "not_required",
      };
    });
    const conflicts = include.has("conflicts") ? snapshot.conflicts.slice(0, conflictLimit).map((row) => ({
      conflict_id: textV1(row.id, "series.conflict_id"), conflict_version: integerV1(row.state_version, "series.conflict_version"),
      conflict_type: textV1(row.conflict_type, "series.conflict_type"), status: row.status,
      left_memory_point_id: textV1(row.left_memory_point_id, "series.left_point"), right_memory_point_id: textV1(row.right_memory_point_id, "series.right_point"),
      ...(row.proposed_resolution === null ? {} : { proposed_resolution: row.proposed_resolution }),
      ...(row.resolution === null ? {} : { resolution: row.resolution }),
    })) : undefined;
    const edges = include.has("edges") ? snapshot.edges.slice(0, edgeLimit).flatMap((row) => {
      const evidence = stringArrayV1(row.evidence_memory_point_ids);
      const sourceId = evidence[0];
      if (sourceId === undefined) return [];
      return [{ edge_id: textV1(row.id, "series.edge_id"), edge_type: row.relation_type, source_type: "memory_point", source_id: sourceId, target_type: "memory_series", target_id: request.series_id, confidence: numberV1(row.confidence, "series.edge_confidence"), evidence_memory_point_ids: evidence }];
    }) : undefined;
    const response = {
      schema_version: "memory.series.query.v1",
      series: {
        id: textV1(snapshot.series.id, "series.id"), bot_id: scope.bot_id,
        topic_key: textV1(snapshot.series.topic_key, "series.topic_key"), topic_family_key: textV1(snapshot.series.topic_family_key, "series.topic_family"),
        status: snapshot.series.status, state_version: integerV1(snapshot.series.state_version, "series.state_version"),
        ...(snapshot.series.merged_into_series_id === null ? {} : { merged_into_series_id: textV1(snapshot.series.merged_into_series_id, "series.merge_target") }),
      },
      points,
      ...(conflicts === undefined ? {} : { conflicts }),
      ...(edges === undefined ? {} : { edges }),
      page: {
        points: { returned: points.length, ...(snapshot.points.length > pointLimit ? { next_cursor: textV1(snapshot.points[pointLimit - 1]?.id, "points.next") } : {}) },
        ...(conflicts === undefined ? {} : { conflicts: { returned: conflicts.length, ...(snapshot.conflicts.length > conflictLimit ? { next_cursor: textV1(snapshot.conflicts[conflictLimit - 1]?.id, "conflicts.next") } : {}) } }),
        ...(edges === undefined ? {} : { edges: { returned: edges.length, ...(snapshot.edges.length > edgeLimit ? { next_cursor: textV1(snapshot.edges[edgeLimit - 1]?.id, "edges.next") } : {}) } }),
      },
      snapshot_token: snapshot.token,
    } as MemoryQuerySeriesResponseV1;
    if (!Value.Check(MemoryQuerySeriesResponseV1Schema, response)) throw new Error("Memory series response is invalid");
    assertMemoryQuerySeriesResponseSemanticBindingsV1(response);
    return Object.freeze(response);
  }

  public async createIntegrationJob(principal: MemoryPrincipalV1, requestValue: MemoryIntegrationRunRequestV1): Promise<MemoryIntegrationRunResponseV1> {
    const request = validateV1(MemoryIntegrationRunRequestV1Schema, requestValue, assertMemoryIntegrationRunRequestSemanticBindingsV1, "integration run request");
    const scope = scopeV1(principal, ["memory"], "memory.integration.run", request.bot_id);
    if (request.expected_policy_version !== MEMORY_INTEGRATION_POLICY_VERSION_V1) {
      failV1(
        "invalid_request",
        `expected_policy_version must be ${MEMORY_INTEGRATION_POLICY_VERSION_V1}`,
      );
    }
    if (["rekey", "full"].includes(request.mode) && !principal.capabilities.includes("memory.integration.operator")) failV1("forbidden", "operator capability is required for rekey/full");
    const requestHash = sha256V1(request);
    const jobId = stableIdV1("mij", [scopeKeyV1(scope), request.idempotency_key]);
    const existing = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const result = await transaction.query<JsonRowV1>(`SELECT * FROM memory.memory_integration_jobs WHERE bot_id=$1 AND idempotency_key=$2`, [scope.bot_id, request.idempotency_key]);
      return result.rows[0];
    });
    if (existing !== undefined) {
      if (existing.request_hash !== requestHash) failV1("idempotency_conflict", "integration request body drift");
      return integrationResponseV1(integrationJobV1(existing), true);
    }
    const now = new Date().toISOString();
    await executeWriterV1(this.composition, "memory_integration_create", request.idempotency_key, jobId, "create_memory_integration_job_v1", {
      p_job_id: jobId,
      p_job: {
        memory_integration_jobs: { id: jobId, bot_id: scope.bot_id, mode: request.mode, scope: { owner_scope_v1: scope, request_scope: request.scope }, dry_run: request.dry_run, idempotency_key: request.idempotency_key, request_hash: requestHash, expected_policy_version: request.expected_policy_version, state_version: 1, status: "queued", checkpoint_ref: null, result_payload: { proposed_changes: [], applied_counts: {}, failure_refs: [] }, error: null, created_at: now, updated_at: now },
        memory_audit_logs: [], memory_event_outbox: [], memory_command_outbox: [],
      },
      p_idempotency_key: request.idempotency_key, p_request_hash: requestHash, p_trace_id: jobId,
    });
    const row = await this.getIntegrationRowV1(scope, jobId);
    return integrationResponseV1(integrationJobV1(row), false);
  }

  public async claimIntegrationJob(principal: MemoryPrincipalV1, inputValue: MemoryIntegrationClaimRequestV1): Promise<MemoryIntegrationClaimV1> {
    const input = validateV1<MemoryIntegrationClaimRequestV1>(MemoryIntegrationClaimRequestV1Schema, inputValue, () => undefined, "integration claim request");
    const scope = scopeV1(principal, ["memory"], "memory.integration.run", input.bot_id);
    const row = await this.getIntegrationRowV1(scope, input.integration_job_id);
    const previousVersion = integerV1(row.state_version, "integration.version");
    const previousStatus = textV1(row.status, "integration.status");
    if (!(["queued", "leased", "running"].includes(previousStatus))) failV1("lease_conflict", "integration job is not claimable");
    const lease = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const result = await transaction.query<JsonRowV1>(`SELECT lease.* FROM memory.memory_integration_job_leases AS lease JOIN memory.memory_integration_jobs AS job ON job.id=lease.integration_job_id WHERE job.bot_id=$1 AND lease.integration_job_id=$2`, [scope.bot_id, input.integration_job_id]);
      return result.rows[0];
    });
    const expectedGeneration = lease === undefined ? 0 : integerV1(lease.lease_generation, "lease.generation");
    const now = input.now === undefined ? new Date() : new Date(input.now);
    if (
      lease !== undefined &&
      Date.parse(instantV1(lease.lease_expires_at, "lease.expires")) >
        now.getTime()
    ) {
      if (
        lease.owner_id === input.owner_id &&
        (previousStatus === "leased" || previousStatus === "running")
      ) {
        const job = integrationJobV1(row);
        const response = {
          job,
          lease_id: textV1(lease.lease_id, "lease.id"),
          lease_generation: integerV1(
            lease.lease_generation,
            "lease.generation",
          ),
          lease_expires_at: instantV1(
            lease.lease_expires_at,
            "lease.expires",
          ),
        } as MemoryIntegrationClaimV1;
        if (!Value.Check(MemoryIntegrationClaimV1Schema, response)) {
          throw new Error("Memory integration claim replay is invalid");
        }
        return Object.freeze(response);
      }
      failV1("lease_conflict", "integration job lease is active");
    }
    const leaseUntil = new Date(now.getTime() + 30_000).toISOString();
    const persistedLease = await executeWriterV1(this.composition, "memory_integration_claim_lease", `${input.integration_job_id}:${expectedGeneration + 1}`, input.integration_job_id, "cas_memory_integration_job_lease_v1", {
      p_job_id: input.integration_job_id,
      p_expected_job_status: previousStatus,
      p_expected_job_state_version: String(previousVersion),
      p_expected_fence_generation: String(expectedGeneration),
      p_holder_id: input.owner_id,
      p_lease_until: leaseUntil,
      p_trace_id: input.integration_job_id,
    });
    const job = integrationJobV1(await this.getIntegrationRowV1(scope, input.integration_job_id));
    const response = { job, lease_id: textV1(persistedLease.lease_id, "lease.id"), lease_generation: integerV1(persistedLease.lease_generation, "lease.generation"), lease_expires_at: instantV1(persistedLease.lease_expires_at, "lease.expires") } as MemoryIntegrationClaimV1;
    if (!Value.Check(MemoryIntegrationClaimV1Schema, response)) throw new Error("Memory integration claim response is invalid");
    return Object.freeze(response);
  }

  public async checkpointIntegrationJob(principal: MemoryPrincipalV1, inputValue: MemoryIntegrationCheckpointRequestV1): Promise<MemoryIntegrationJobV1> {
    const input = validateV1(MemoryIntegrationCheckpointRequestV1Schema, inputValue, assertMemoryIntegrationCheckpointRequestSemanticBindingsV1, "integration checkpoint request");
    const scope = scopeV1(principal, ["memory"], "memory.integration.run", input.bot_id);
    const row = await this.getIntegrationRowV1(scope, input.integration_job_id);
    const lease = await this.getIntegrationLeaseV1(scope, input.integration_job_id);
    this.assertLeaseV1(lease, input.lease_id, input.lease_generation);
    const now = input.now === undefined ? new Date() : new Date(input.now);
    await executeWriterV1(this.composition, "memory_integration_renew", `${input.integration_job_id}:${input.lease_generation}:${now.toISOString()}`, input.integration_job_id, "renew_memory_integration_job_lease_v1", {
      p_job_id: input.integration_job_id, p_lease_id: input.lease_id, p_expected_fence_generation: String(input.lease_generation),
      p_holder_id: textV1(lease.owner_id, "lease.owner"), p_lease_until: new Date(now.getTime() + 30_000).toISOString(), p_trace_id: input.integration_job_id,
    });
    const previousVersion = integerV1(row.state_version, "integration.version");
    const currentResult = row.result_payload === null ? {} : recordV1(row.result_payload, "integration.result");
    const nextResult = {
      proposed_changes: input.proposed_changes ?? currentResult.proposed_changes ?? [],
      applied_counts: { ...recordV1(currentResult.applied_counts ?? {}, "integration.counts"), ...(input.applied_counts ?? {}) },
      failure_refs: currentResult.failure_refs ?? [],
    };
    const requestHash = sha256V1({ checkpoint_ref: input.checkpoint_ref, result: nextResult });
    await executeWriterV1(this.composition, "memory_integration_checkpoint", `${input.integration_job_id}:v${previousVersion + 1}`, input.integration_job_id, "transition_memory_integration_job_v1", {
      p_job_id: input.integration_job_id, p_expected_status: row.status, p_expected_state_version: String(previousVersion), p_next_status: "running",
      p_job_result: { memory_integration_jobs: { status: "running", state_version: previousVersion + 1, checkpoint_ref: input.checkpoint_ref, result_payload: nextResult, updated_at: now.toISOString() }, memory_audit_logs: [], memory_event_outbox: [], memory_command_outbox: [] },
      p_request_hash: requestHash, p_trace_id: input.integration_job_id,
    });
    return integrationJobV1(await this.getIntegrationRowV1(scope, input.integration_job_id));
  }

  public async finishIntegrationJob(principal: MemoryPrincipalV1, inputValue: MemoryIntegrationFinishRequestV1): Promise<MemoryIntegrationJobV1> {
    const input = validateV1(MemoryIntegrationFinishRequestV1Schema, inputValue, assertMemoryIntegrationFinishRequestSemanticBindingsV1, "integration finish request");
    const scope = scopeV1(principal, ["memory"], "memory.integration.run", input.bot_id);
    const row = await this.getIntegrationRowV1(scope, input.integration_job_id);
    const error = row.error === null ? undefined : recordV1(row.error, "integration.error");
    const finishHash = sha256V1({ status: input.status, failure_refs: [...new Set(input.failure_refs ?? [])].sort(), error: input.error ?? null });
    const receipt = error?.finish_receipt;
    if (typeof receipt === "object" && receipt !== null && !Array.isArray(receipt)) {
      const stored = receipt as JsonRowV1;
      if (stored.lease_id === input.lease_id && Number(stored.lease_generation) === input.lease_generation) {
        if (stored.request_hash !== finishHash) failV1("idempotency_conflict", "integration finish retry body drift");
        return integrationJobV1(row);
      }
    }
    const lease = await this.getIntegrationLeaseV1(scope, input.integration_job_id);
    this.assertLeaseV1(lease, input.lease_id, input.lease_generation);
    const now = input.now === undefined ? new Date() : new Date(input.now);
    const previousVersion = integerV1(row.state_version, "integration.version");
    const result = row.result_payload === null ? {} : recordV1(row.result_payload, "integration.result");
    const nextResult = { proposed_changes: result.proposed_changes ?? [], applied_counts: result.applied_counts ?? {}, failure_refs: [...new Set(input.failure_refs ?? [])].sort() };
    const payload = { workspace_id: scope.workspace_id, bot_id: scope.bot_id, owner_agent_id: scope.owner_agent_id, deployment_environment: scope.deployment_environment, release_channel: scope.release_channel, aggregate_id: input.integration_job_id, aggregate_version: previousVersion + 1, aggregate_type: "integration_job", integration_job_id: input.integration_job_id, mode: row.mode, status: input.status, ...(row.checkpoint_ref === null ? {} : { checkpoint_ref: row.checkpoint_ref }), applied_counts: nextResult.applied_counts, failure_refs: nextResult.failure_refs };
    const eventId = stableIdV1("mev", [`integration:${input.integration_job_id}:v${previousVersion + 1}`]);
    await executeWriterV1(this.composition, "memory_integration_finish", `integration:${input.integration_job_id}:v${previousVersion + 1}`, input.integration_job_id, "transition_memory_integration_job_v1", {
      p_job_id: input.integration_job_id, p_expected_status: row.status, p_expected_state_version: String(previousVersion), p_next_status: input.status,
      p_job_result: { memory_integration_jobs: { status: input.status, state_version: previousVersion + 1, result_payload: nextResult, error: { ...(input.status === "failed" ? { code: "memory_integration_failed", message: input.error ?? "integration failed" } : {}), finish_receipt: { lease_id: input.lease_id, lease_generation: input.lease_generation, request_hash: finishHash } }, updated_at: now.toISOString() }, memory_audit_logs: [], memory_event_outbox: [eventRowV1({ id: eventId, event_type: "memory.integration.finished", bot_id: scope.bot_id, aggregate_id: input.integration_job_id, aggregate_type: "integration_job", aggregate_version: previousVersion + 1, occurred_at: now.toISOString(), idempotency_key: `integration:${input.integration_job_id}:v${previousVersion + 1}`, trace_id: input.integration_job_id, target: "operator_projection", payload })], memory_command_outbox: [] },
      p_request_hash: finishHash, p_trace_id: input.integration_job_id,
    });
    return integrationJobV1(await this.getIntegrationRowV1(scope, input.integration_job_id));
  }

  public async getIntegrationJob(principal: MemoryPrincipalV1, botId: string, jobId: string): Promise<MemoryIntegrationJobV1> {
    const scope = scopeV1(principal, ["memory"], "memory.integration.run", botId);
    return integrationJobV1(await this.getIntegrationRowV1(scope, jobId));
  }

  private async getIntegrationRowV1(scope: MemoryScopeV1, jobId: string): Promise<JsonRowV1> {
    const row = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const result = await transaction.query<JsonRowV1>(`SELECT * FROM memory.memory_integration_jobs WHERE bot_id=$1 AND id=$2`, [scope.bot_id, jobId]);
      return result.rows[0];
    });
    if (row === undefined) failV1("integration_job_not_found", "integration job was not found");
    const storedScope = recordV1(recordV1(row.scope, "integration.scope").owner_scope_v1, "integration.owner_scope");
    if (canonicalV1(storedScope) !== canonicalV1(scope)) failV1("integration_job_not_found", "integration job was not found");
    return row;
  }

  private async getIntegrationLeaseV1(scope: MemoryScopeV1, jobId: string): Promise<JsonRowV1> {
    const row = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const result = await transaction.query<JsonRowV1>(`SELECT lease.* FROM memory.memory_integration_job_leases AS lease JOIN memory.memory_integration_jobs AS job ON job.id=lease.integration_job_id WHERE job.bot_id=$1 AND lease.integration_job_id=$2`, [scope.bot_id, jobId]);
      return result.rows[0];
    });
    if (row === undefined) failV1("lease_conflict", "integration lease was not found");
    return row;
  }

  private assertLeaseV1(lease: JsonRowV1, leaseId: string, generation: number): void {
    if (lease.lease_id !== leaseId || Number(lease.lease_generation) !== generation || Date.parse(instantV1(lease.lease_expires_at, "lease.expires")) <= Date.now()) {
      failV1("lease_conflict", "integration lease is stale or expired");
    }
  }

  public async submitDirectFeedback(
    principal: MemoryPrincipalV1,
    requestValue: MemoryDirectFeedbackRequestV1,
  ): Promise<MemoryDirectFeedbackResponseV1> {
    const request = validateV1(
      MemoryDirectFeedbackRequestV1Schema,
      requestValue,
      assertMemoryDirectFeedbackRequestSemanticBindingsV1,
      "direct feedback request",
    );
    const scope = scopeV1(
      principal,
      ["meta_cognition", "action_runtime"],
      "memory.feedback.write",
      request.bot_id,
    );
    if (request.action === "correct" && request.target_type !== "memory_point") {
      failV1("invalid_request", "correct feedback requires a memory point target");
    }
    if (request.action === "merge" && request.target_type !== "series") {
      failV1("invalid_request", "merge feedback requires a series target");
    }
    const requestHash = sha256V1(request);
    const feedbackId = stableIdV1("mfb", [scopeKeyV1(scope), request.idempotency_key]);
    const existing = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const result = await transaction.query<JsonRowV1>(
        `SELECT * FROM memory.memory_feedback_events
          WHERE bot_id=$1 AND (id=$2 OR idempotency_key=$3)
          ORDER BY CASE WHEN id=$2 THEN 0 ELSE 1 END LIMIT 1`,
        [scope.bot_id, feedbackId, request.idempotency_key],
      );
      return result.rows[0];
    });
    if (existing !== undefined) {
      if (existing.id !== feedbackId || existing.request_hash !== requestHash) {
        failV1("idempotency_conflict", "direct feedback idempotency key drifted");
      }
      const response = {
        ...structuredClone(recordV1(existing.response_payload, "feedback.response")),
        feedback_id: feedbackId,
        duplicate_replayed: true,
      } as MemoryDirectFeedbackResponseV1;
      if (!Value.Check(MemoryDirectFeedbackResponseV1Schema, response)) {
        throw new Error("Memory persisted feedback response is invalid");
      }
      assertMemoryDirectFeedbackResponseSemanticBindingsV1(response);
      return Object.freeze(response);
    }
    const target = await this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
      const table = request.target_type === "memory_point" ? "memory_points" : "memory_series";
      const result = await transaction.query<JsonRowV1>(
        `SELECT to_jsonb(target) AS row FROM memory.${table} AS target WHERE target.bot_id=$1 AND target.id=$2`,
        [scope.bot_id, request.target_id],
      );
      if (request.target_type === "memory_point") {
        const projection = await transaction.query<JsonRowV1>(
          `SELECT to_jsonb(projection) AS row FROM memory.memory_point_search_index AS projection WHERE projection.bot_id=$1 AND projection.memory_point_id=$2`,
          [scope.bot_id, request.target_id],
        );
        return { row: result.rows[0]?.row as JsonRowV1 | undefined, projection: projection.rows[0]?.row as JsonRowV1 | undefined };
      }
      return { row: result.rows[0]?.row as JsonRowV1 | undefined, projection: undefined };
    });
    if (target.row === undefined) failV1("invalid_request", "direct feedback target was not found");
    const previousVersion = integerV1(target.row.state_version, "feedback.target_version");
    if (previousVersion !== request.expected_state_version) {
      failV1("idempotency_conflict", "direct feedback target version is stale", true);
    }
    const nextVersion = previousVersion + 1;
    const now = new Date().toISOString();
    const revisionId = stableIdV1("mrev", [feedbackId, request.target_type, request.target_id, nextVersion]);
    const auditId = stableIdV1("maud", [feedbackId, revisionId]);
    const eventId = stableIdV1("mev", [feedbackId, nextVersion]);
    const resultingStatus = request.target_type === "memory_point"
      ? request.action === "reject"
        ? "rejected"
        : request.action === "suppress"
          ? "archived"
          : "active"
      : request.action === "merge"
        ? "merged"
        : request.action === "reject" || request.action === "suppress"
          ? "suppressed"
          : "active";
    const revisionRefs = [{
      aggregate_type: request.target_type === "memory_point" ? "memory_point" : "memory_series",
      aggregate_id: request.target_id,
      revision_id: revisionId,
    }];
    const response = {
      schema_version: "memory.direct_feedback.v1",
      feedback_id: feedbackId,
      target_type: request.target_type,
      target_id: request.target_id,
      previous_state_version: previousVersion,
      state_version: nextVersion,
      resulting_status: resultingStatus,
      revision_refs: revisionRefs,
      audit_ids: [auditId],
      event_ids: [eventId],
      duplicate_replayed: false,
    } as MemoryDirectFeedbackResponseV1;
    if (!Value.Check(MemoryDirectFeedbackResponseV1Schema, response)) {
      throw new Error("Memory direct feedback response is invalid");
    }
    assertMemoryDirectFeedbackResponseSemanticBindingsV1(response);
    const actorRef = `${principal.caller}:${scope.owner_agent_id}`;
    const targetMutation: JsonRowV1 = {
      id: request.target_id,
      status: resultingStatus,
      state_version: nextVersion,
      updated_at: now,
      ...(request.target_type === "series" && request.action === "merge"
        ? { merged_into_series_id: request.merge_target_series_id }
        : {}),
    };
    let projectionMutation: JsonRowV1 | undefined;
    if (request.target_type === "memory_point" && target.projection !== undefined) {
      projectionMutation = {
        ...structuredClone(target.projection),
        memory_point_id: request.target_id,
        status: resultingStatus,
        state_version: nextVersion,
        updated_at: now,
      };
      if (request.action === "correct" && request.correction !== undefined) {
        const [embedding] = await this.embedding.embed(
          [request.correction.content_summary],
          MEMORY_EMBEDDING_PROFILE_V1,
        );
        if (embedding === undefined) throw new Error("Memory embedding provider returned no correction vector");
        Object.assign(targetMutation, {
          content_summary: request.correction.content_summary,
          content_hash: sha256V1(request.correction.content_summary),
          ...(request.correction.occurred_at === undefined ? {} : { occurred_at: request.correction.occurred_at }),
          summary_embedding: vectorSqlV1(embedding),
          embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
          embedding_backfill_status: "ready",
        });
        Object.assign(projectionMutation, {
          content_summary: request.correction.content_summary,
          ...(request.correction.occurred_at === undefined ? {} : { occurred_at: request.correction.occurred_at }),
          summary_embedding: vectorSqlV1(embedding),
          embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
          embedding_backfill_status: "ready",
        });
      }
    }
    const aggregateType = request.target_type === "memory_point" ? "memory_point" : "memory_series";
    const eventPayload = request.target_type === "memory_point"
      ? {
          ...scope,
          aggregate_id: request.target_id,
          aggregate_type: "memory_point",
          aggregate_version: nextVersion,
          memory_point_id: request.target_id,
          previous_status: textV1(target.row.status, "feedback.previous_status"),
          status: resultingStatus,
          state_version: nextVersion,
          reason_code: `direct_feedback_${request.action}`,
          revision_refs: revisionRefs,
        }
      : {
          ...scope,
          aggregate_id: request.target_id,
          aggregate_type: "memory_series",
          aggregate_version: nextVersion,
          series_id: request.target_id,
          previous_status: textV1(target.row.status, "feedback.previous_status"),
          status: resultingStatus,
          state_version: nextVersion,
          reason_code: `direct_feedback_${request.action}`,
          changed_point_ids: [],
        };
    const payload: Record<string, unknown> = {
      memory_feedback_events: {
        id: feedbackId,
        bot_id: scope.bot_id,
        target_type: request.target_type,
        target_id: request.target_id,
        action: request.action,
        expected_state_version: previousVersion,
        resulting_state_version: nextVersion,
        idempotency_key: request.idempotency_key,
        request_hash: requestHash,
        request_payload: request,
        response_payload: response,
        authenticated_actor_ref: actorRef,
        trace_id: feedbackId,
        created_at: now,
      },
      [request.target_type === "memory_point" ? "memory_points" : "memory_series"]: targetMutation,
      memory_state_revisions: [{
        id: revisionId,
        bot_id: scope.bot_id,
        aggregate_type: aggregateType,
        aggregate_id: request.target_id,
        previous_state_version: previousVersion,
        resulting_state_version: nextVersion,
        operation: `direct_feedback_${request.action}`,
        before_payload: { status: target.row.status, state_version: previousVersion },
        after_payload: { status: resultingStatus, state_version: nextVersion },
        actor_ref: actorRef,
        reason: request.reason,
        evidence_refs: [request.evidence_ref],
        trace_id: feedbackId,
        created_at: now,
      }],
      ...(projectionMutation === undefined ? {} : { memory_point_search_index: projectionMutation }),
      memory_audit_logs: [{
        id: auditId,
        bot_id: scope.bot_id,
        revision_id: revisionId,
        feedback_event_id: feedbackId,
        target_type: request.target_type,
        target_id: request.target_id,
        actor_ref: actorRef,
        action: `direct_feedback_${request.action}`,
        reason_code: request.reason,
        capability_snapshot: { capabilities: [...principal.capabilities] },
        payload: { evidence_ref: request.evidence_ref },
        trace_id: feedbackId,
        created_at: now,
      }],
      memory_event_outbox: [eventRowV1({
        id: eventId,
        event_type: request.target_type === "memory_point" ? "memory.point.updated" : "memory.series.updated",
        bot_id: scope.bot_id,
        aggregate_id: request.target_id,
        aggregate_type: aggregateType,
        aggregate_version: nextVersion,
        occurred_at: now,
        idempotency_key: `feedback:${feedbackId}:v${nextVersion}`,
        trace_id: feedbackId,
        target: "meta",
        payload: eventPayload,
      })],
      memory_feedback_revision_refs: revisionRefs.map((entry) => ({ feedback_event_id: feedbackId, revision_id: entry.revision_id })),
      memory_feedback_audit_refs: [{ feedback_event_id: feedbackId, audit_id: auditId }],
      memory_feedback_event_refs: [{ feedback_event_id: feedbackId, event_id: eventId }],
    };
    const persisted = await executeWriterV1(
      this.composition,
      "memory_direct_feedback",
      request.idempotency_key,
      feedbackId,
      "append_memory_feedback_v1",
      {
        p_feedback_id: feedbackId,
        p_target_type: request.target_type,
        p_target_id: request.target_id,
        p_expected_state_version: String(previousVersion),
        p_feedback: payload,
        p_request_hash: requestHash,
        p_trace_id: feedbackId,
      },
    );
    const finalResponse = persisted as unknown as MemoryDirectFeedbackResponseV1;
    if (!Value.Check(MemoryDirectFeedbackResponseV1Schema, finalResponse)) {
      throw new Error("Memory feedback writer response is invalid");
    }
    assertMemoryDirectFeedbackResponseSemanticBindingsV1(finalResponse);
    return Object.freeze(finalResponse);
  }

  public async resolveConflict(
    principal: MemoryPrincipalV1,
    conflictId: string,
    requestValue: MemoryConflictResolveRequestV1,
  ): Promise<MemoryConflictResolveResponseV1> {
    const request = validateV1(
      MemoryConflictResolveRequestV1Schema,
      requestValue,
      assertMemoryConflictResolveRequestSemanticBindingsV1,
      "conflict resolve request",
    );
    if (
      conflictId.length === 0 ||
      Buffer.byteLength(conflictId, "utf8") > 512 ||
      /[\u0000-\u001f\u007f]/u.test(conflictId)
    ) {
      failV1("schema_validation_failed", "conflict path id is invalid");
    }
    const scope = scopeV1(
      principal,
      ["meta_cognition"],
      "memory.conflict.resolve",
      request.bot_id,
    );
    const requestHash = sha256V1(request);
    const readReplayV1 = async (): Promise<MemoryConflictResolveResponseV1 | undefined> =>
      this.composition.read_committed_postgres.withReadCommittedTransaction(async (transaction) => {
        const result = await transaction.query<JsonRowV1>(
          `SELECT payload
             FROM memory.memory_audit_logs
            WHERE bot_id=$1 AND target_type='memory_conflict' AND target_id=$2
              AND payload->>'idempotency_key'=$3
            ORDER BY created_at,id
            LIMIT 1`,
          [scope.bot_id, conflictId, request.idempotency_key],
        );
        const payload = result.rows[0]?.payload;
        if (payload === undefined) return undefined;
        const replay = recordV1(payload, "conflict replay audit");
        if (textV1(replay.request_hash, "conflict replay request_hash") !== requestHash) {
          failV1("idempotency_conflict", "conflict resolution idempotency body drifted");
        }
        const response = {
          ...structuredClone(recordV1(replay.response_payload, "conflict replay response")),
          duplicate_replayed: true,
        } as MemoryConflictResolveResponseV1;
        if (!Value.Check(MemoryConflictResolveResponseV1Schema, response)) {
          throw new Error("Memory persisted conflict replay response is invalid");
        }
        assertMemoryConflictResolveResponseSemanticBindingsV1(response);
        return Object.freeze(response);
      });
    const replay = await readReplayV1();
    if (replay !== undefined) return replay;

    const snapshot = await this.composition.read_committed_postgres.withReadCommittedTransaction(
      async (transaction) => {
        const result = await transaction.query<JsonRowV1>(
          `SELECT to_jsonb(conflict) AS conflict,
                  to_jsonb(old_series) AS old_series,
                  to_jsonb(old_point) AS old_point,
                  to_jsonb(new_series) AS new_series,
                  to_jsonb(new_point) AS new_point,
                  to_jsonb(old_projection) AS old_projection,
                  to_jsonb(new_projection) AS new_projection
             FROM memory.memory_conflicts AS conflict
             JOIN memory.memory_points AS old_point
               ON old_point.id=conflict.left_memory_point_id
             JOIN memory.memory_points AS new_point
               ON new_point.id=conflict.right_memory_point_id
             JOIN memory.memory_series AS old_series
               ON old_series.id=old_point.series_id
             JOIN memory.memory_series AS new_series
               ON new_series.id=new_point.series_id
             LEFT JOIN memory.memory_point_search_index AS old_projection
               ON old_projection.memory_point_id=old_point.id
             LEFT JOIN memory.memory_point_search_index AS new_projection
               ON new_projection.memory_point_id=new_point.id
            WHERE conflict.id=$1 AND conflict.bot_id=$2`,
          [conflictId, scope.bot_id],
        );
        const row = result.rows[0];
        if (row === undefined) failV1("invalid_request", "memory conflict was not found");
        return {
          conflict: recordV1(row.conflict, "conflict"),
          oldSeries: recordV1(row.old_series, "old series"),
          oldPoint: recordV1(row.old_point, "old point"),
          newSeries: recordV1(row.new_series, "new series"),
          newPoint: recordV1(row.new_point, "new point"),
          oldProjection:
            row.old_projection === null
              ? undefined
              : recordV1(row.old_projection, "old projection"),
          newProjection:
            row.new_projection === null
              ? undefined
              : recordV1(row.new_projection, "new projection"),
        };
      },
    );
    const previousStatus = textV1(snapshot.conflict.status, "conflict.status");
    const previousConflictVersion = integerV1(
      snapshot.conflict.state_version,
      "conflict.state_version",
    );
    if (!(["open", "feedback_requested"] as const).includes(previousStatus as never)) {
      failV1("stale_conflict_version", "memory conflict is already terminal", false, {
        observed_status: previousStatus,
        observed_conflict_version: previousConflictVersion,
      });
    }
    const observedVersions = {
      old_series_state_version: integerV1(snapshot.oldSeries.state_version, "old series version"),
      old_point_state_version: integerV1(snapshot.oldPoint.state_version, "old point version"),
      new_series_state_version: integerV1(snapshot.newSeries.state_version, "new series version"),
      new_point_state_version: integerV1(snapshot.newPoint.state_version, "new point version"),
    };
    if (
      previousConflictVersion !== request.expected_conflict_version ||
      canonicalV1(observedVersions) !== canonicalV1(request.expected_versions)
    ) {
      failV1("stale_conflict_version", "memory conflict aggregate version fence drifted", false, {
        observed_conflict_version: previousConflictVersion,
        observed_versions: observedVersions,
      });
    }
    if (request.decision === "request_feedback" && previousStatus !== "open") {
      failV1("stale_conflict_version", "feedback was already requested for this conflict");
    }
    const expectedStatuses = {
      oldSeries: "active",
      oldPoint: "active",
      newSeries: "pending_conflict",
      newPoint: "pending_conflict",
    } as const;
    for (const [name, row] of [
      ["oldSeries", snapshot.oldSeries],
      ["oldPoint", snapshot.oldPoint],
      ["newSeries", snapshot.newSeries],
      ["newPoint", snapshot.newPoint],
    ] as const) {
      if (row.status !== expectedStatuses[name]) {
        failV1("stale_conflict_version", `${name} conflict status drifted`, false, {
          observed_status: row.status,
          expected_status: expectedStatuses[name],
        });
      }
    }
    if (snapshot.oldProjection === undefined || snapshot.newProjection === undefined) {
      failV1(
        "dependency_unavailable",
        "memory conflict search projection is incomplete",
        true,
      );
    }
    const dryRun = request.dry_run ?? false;
    const terminal = request.decision !== "request_feedback";
    const toStatuses = (() => {
      switch (request.decision) {
        case "prefer_new":
          return { oldSeries: "archived", oldPoint: "superseded", newSeries: "active", newPoint: "active" } as const;
        case "prefer_old":
          return { oldSeries: "active", oldPoint: "active", newSeries: "archived", newPoint: "rejected" } as const;
        case "merge":
          return { oldSeries: "active", oldPoint: "active", newSeries: "merged", newPoint: "superseded" } as const;
        case "suppress_both":
          return { oldSeries: "suppressed", oldPoint: "archived", newSeries: "suppressed", newPoint: "archived" } as const;
        case "keep_both":
          return request.keep_both_plan?.mode === "split_scope_dual_active"
            ? { oldSeries: "active", oldPoint: "active", newSeries: "active", newPoint: "active" } as const
            : { oldSeries: "active", oldPoint: "active", newSeries: "archived", newPoint: "downgraded" } as const;
        case "request_feedback":
          return { oldSeries: "active", oldPoint: "active", newSeries: "pending_conflict", newPoint: "pending_conflict" } as const;
      }
    })();
    const oldSeriesId = textV1(snapshot.oldSeries.id, "old series id");
    const newSeriesId = textV1(snapshot.newSeries.id, "new series id");
    const oldPointId = textV1(snapshot.oldPoint.id, "old point id");
    const newPointId = textV1(snapshot.newPoint.id, "new point id");
    if (request.decision === "merge" && request.merge_target_series_id !== oldSeriesId) {
      failV1("invalid_request", "Memory conflict merge v1 target must be the old series");
    }
    let oldTopicKey = textV1(snapshot.oldSeries.topic_key, "old topic key");
    let newTopicKey = textV1(snapshot.newSeries.topic_key, "new topic key");
    let oldScopeKey = textV1(snapshot.oldSeries.scope_key, "old scope key");
    let newScopeKey = textV1(snapshot.newSeries.scope_key, "new scope key");
    const topicAliases: JsonRowV1[] = [];
    if (request.keep_both_plan?.mode === "split_scope_dual_active") {
      const oldCanonical = memoryCanonicalTopicKeysV1(
        scope.bot_id,
        textV1(snapshot.oldSeries.subject_key, "old subject key"),
        textV1(snapshot.oldSeries.aspect_key, "old aspect key"),
        request.keep_both_plan.old_scope_key,
      );
      const newCanonical = memoryCanonicalTopicKeysV1(
        scope.bot_id,
        textV1(snapshot.newSeries.subject_key, "new subject key"),
        textV1(snapshot.newSeries.aspect_key, "new aspect key"),
        request.keep_both_plan.new_scope_key,
      );
      if (oldCanonical.topic_key === newCanonical.topic_key) {
        failV1(
          "invalid_request",
          "split-scope keep-both did not produce distinct canonical topic keys; use downgraded mode",
        );
      }
      const aliasCandidates = [
        {
          seriesId: oldSeriesId,
          previous: oldTopicKey,
          next: oldCanonical.topic_key,
          version: textV1(snapshot.oldSeries.canonicalization_version, "old canonicalization version"),
        },
        {
          seriesId: newSeriesId,
          previous: newTopicKey,
          next: newCanonical.topic_key,
          version: textV1(snapshot.newSeries.canonicalization_version, "new canonicalization version"),
        },
      ].filter(({ previous, next }) => previous !== next);
      const aliasesByPrevious = new Map<string, string>();
      for (const candidate of aliasCandidates) {
        const existingTarget = aliasesByPrevious.get(candidate.previous);
        if (existingTarget !== undefined && existingTarget !== candidate.next) {
          failV1(
            "invalid_request",
            "split-scope aliases are ambiguous; use downgraded mode",
          );
        }
        aliasesByPrevious.set(candidate.previous, candidate.next);
        topicAliases.push({
          id: stableIdV1("mta", [conflictId, candidate.seriesId, candidate.previous, candidate.next]),
          bot_id: scope.bot_id,
          old_canonicalization_version: candidate.version,
          old_topic_key: candidate.previous,
          new_canonicalization_version: "memory.topic_key.v1",
          new_topic_key: candidate.next,
          actor_ref: `${principal.caller}:${scope.owner_agent_id}`,
          reason: request.reason,
          evidence_refs: request.evidence_refs,
        });
      }
      oldTopicKey = oldCanonical.topic_key;
      newTopicKey = newCanonical.topic_key;
      oldScopeKey = oldCanonical.scope_key;
      newScopeKey = newCanonical.scope_key;
    }
    const nextVersionV1 = (previous: number): number => dryRun ? previous : previous + 1;
    const seriesTransitions: MemoryConflictResolveResponseV1["series_transitions"] = terminal
      ? [
          {
            role: "old_series",
            series_id: oldSeriesId,
            from_status: "active",
            to_status: toStatuses.oldSeries,
            previous_state_version: observedVersions.old_series_state_version,
            state_version: nextVersionV1(observedVersions.old_series_state_version),
            previous_topic_key: textV1(snapshot.oldSeries.topic_key, "old previous topic key"),
            topic_key: oldTopicKey,
          },
          {
            role: "new_series",
            series_id: newSeriesId,
            from_status: "pending_conflict",
            to_status: toStatuses.newSeries,
            previous_state_version: observedVersions.new_series_state_version,
            state_version: nextVersionV1(observedVersions.new_series_state_version),
            previous_topic_key: textV1(snapshot.newSeries.topic_key, "new previous topic key"),
            topic_key: newTopicKey,
          },
        ]
      : [];
    const pointTransitions: MemoryConflictResolveResponseV1["point_transitions"] = terminal
      ? [
          {
            role: "old_point",
            memory_point_id: oldPointId,
            from_status: "active",
            to_status: toStatuses.oldPoint,
            previous_state_version: observedVersions.old_point_state_version,
            state_version: nextVersionV1(observedVersions.old_point_state_version),
          },
          {
            role: "new_point",
            memory_point_id: newPointId,
            from_status: "pending_conflict",
            to_status: toStatuses.newPoint,
            previous_state_version: observedVersions.new_point_state_version,
            state_version: nextVersionV1(observedVersions.new_point_state_version),
          },
        ]
      : [];
    const resolutionCode = request.decision === "merge"
      ? "merged_into_old"
      : request.decision === "keep_both"
        ? request.keep_both_plan?.mode === "split_scope_dual_active"
          ? "keep_both_split_scope"
          : "keep_both_downgraded"
        : request.decision === "request_feedback"
          ? undefined
          : request.decision;
    const commandId = stableIdV1("mcmd", [scopeKeyV1(scope), conflictId, request.idempotency_key]);
    const commandOutboxId = stableIdV1("mco", commandId);
    const conflictEventId = stableIdV1("mev", [conflictId, request.idempotency_key, "conflict"]);
    const aggregateEventIds = terminal
      ? [
          stableIdV1("mev", [conflictId, request.idempotency_key, "old_series"]),
          stableIdV1("mev", [conflictId, request.idempotency_key, "old_point"]),
          stableIdV1("mev", [conflictId, request.idempotency_key, "new_series"]),
          stableIdV1("mev", [conflictId, request.idempotency_key, "new_point"]),
        ]
      : [];
    const response = {
      schema_version: "memory.conflict_resolve.v1",
      conflict_id: conflictId,
      previous_conflict_version: previousConflictVersion,
      conflict_version: nextVersionV1(previousConflictVersion),
      previous_status: previousStatus as "open" | "feedback_requested",
      status: terminal ? "resolved" : "feedback_requested",
      ...(resolutionCode === undefined ? {} : { resolution_code: resolutionCode }),
      series_transitions: seriesTransitions,
      point_transitions: pointTransitions,
      ...(!dryRun && !terminal ? { feedback_suggestion_outbox_id: commandOutboxId } : {}),
      event_ids: dryRun ? [] : [conflictEventId, ...aggregateEventIds],
      dry_run: dryRun,
      duplicate_replayed: false,
    } as MemoryConflictResolveResponseV1;
    if (!Value.Check(MemoryConflictResolveResponseV1Schema, response)) {
      throw new Error("Memory conflict resolution response is invalid");
    }
    assertMemoryConflictResolveResponseSemanticBindingsV1(response);
    if (dryRun) return Object.freeze(response);

    const now = new Date().toISOString();
    const actorRef = `${principal.caller}:${scope.owner_agent_id}`;
    const revisionInputs = [
      {
        role: "conflict",
        aggregate_type: "memory_conflict",
        aggregate_id: conflictId,
        previous_state_version: previousConflictVersion,
        resulting_state_version: previousConflictVersion + 1,
        before_payload: { status: previousStatus, state_version: previousConflictVersion },
        after_payload: { status: response.status, state_version: previousConflictVersion + 1 },
      },
      ...seriesTransitions.map((transition) => ({
        role: transition.role,
        aggregate_type: "memory_series",
        aggregate_id: transition.series_id,
        previous_state_version: transition.previous_state_version,
        resulting_state_version: transition.state_version,
        before_payload: { status: transition.from_status, state_version: transition.previous_state_version, topic_key: transition.previous_topic_key },
        after_payload: { status: transition.to_status, state_version: transition.state_version, topic_key: transition.topic_key },
      })),
      ...pointTransitions.map((transition) => ({
        role: transition.role,
        aggregate_type: "memory_point",
        aggregate_id: transition.memory_point_id,
        previous_state_version: transition.previous_state_version,
        resulting_state_version: transition.state_version,
        before_payload: { status: transition.from_status, state_version: transition.previous_state_version },
        after_payload: { status: transition.to_status, state_version: transition.state_version },
      })),
    ];
    const revisions = revisionInputs.map((entry) => ({
      id: stableIdV1("mrev", [conflictId, request.idempotency_key, entry.role]),
      bot_id: scope.bot_id,
      aggregate_type: entry.aggregate_type,
      aggregate_id: entry.aggregate_id,
      previous_state_version: entry.previous_state_version,
      resulting_state_version: entry.resulting_state_version,
      operation: `resolve_conflict_${request.decision}`,
      before_payload: entry.before_payload,
      after_payload: entry.after_payload,
      actor_ref: actorRef,
      reason: request.reason,
      evidence_refs: request.evidence_refs,
      trace_id: request.trace_id,
      created_at: now,
    }));
    const revisionRefs = revisions.map((revision) => ({
      aggregate_type: revision.aggregate_type,
      aggregate_id: revision.aggregate_id,
      revision_id: revision.id,
    }));
    const replayPayload = {
      idempotency_key: request.idempotency_key,
      request_hash: requestHash,
      response_payload: response,
    };
    const audits = revisions.map((revision) => ({
      id: stableIdV1("maud", [conflictId, request.idempotency_key, revision.id]),
      bot_id: scope.bot_id,
      revision_id: revision.id,
      feedback_event_id: null,
      target_type: revision.aggregate_type,
      target_id: revision.aggregate_id,
      actor_ref: actorRef,
      action: `resolve_conflict_${request.decision}`,
      reason_code: request.decision,
      capability_snapshot: { capabilities: [...principal.capabilities] },
      payload: replayPayload,
      trace_id: request.trace_id,
      created_at: now,
    }));
    const eventRows: JsonRowV1[] = [
      eventRowV1({
        id: conflictEventId,
        event_type: "memory.conflict.updated",
        bot_id: scope.bot_id,
        aggregate_id: conflictId,
        aggregate_type: "memory_conflict",
        aggregate_version: previousConflictVersion + 1,
        occurred_at: now,
        idempotency_key: `conflict:${conflictId}:v${previousConflictVersion + 1}`,
        trace_id: request.trace_id,
        target: "meta",
        payload: {
          ...scope,
          aggregate_id: conflictId,
          aggregate_type: "memory_conflict",
          aggregate_version: previousConflictVersion + 1,
          conflict_id: conflictId,
          previous_status: previousStatus,
          status: response.status,
          conflict_version: previousConflictVersion + 1,
          reason_code: request.decision,
          revision_refs: revisionRefs,
        },
      }),
    ];
    for (const [index, transition] of seriesTransitions.entries()) {
      const pointId = transition.role === "old_series" ? oldPointId : newPointId;
      eventRows.push(eventRowV1({
        id: aggregateEventIds[index * 2]!,
        event_type: "memory.series.updated",
        bot_id: scope.bot_id,
        aggregate_id: transition.series_id,
        aggregate_type: "memory_series",
        aggregate_version: transition.state_version,
        occurred_at: now,
        idempotency_key: `conflict:${conflictId}:${transition.role}:v${transition.state_version}`,
        trace_id: request.trace_id,
        target: "meta",
        payload: {
          ...scope,
          aggregate_id: transition.series_id,
          aggregate_type: "memory_series",
          aggregate_version: transition.state_version,
          series_id: transition.series_id,
          previous_status: transition.from_status,
          status: transition.to_status,
          state_version: transition.state_version,
          reason_code: `conflict_${request.decision}`,
          changed_point_ids: [pointId],
        },
      }));
    }
    for (const [index, transition] of pointTransitions.entries()) {
      const revision = revisions.find((entry) => entry.aggregate_id === transition.memory_point_id)!;
      eventRows.push(eventRowV1({
        id: aggregateEventIds[index * 2 + 1]!,
        event_type: "memory.point.updated",
        bot_id: scope.bot_id,
        aggregate_id: transition.memory_point_id,
        aggregate_type: "memory_point",
        aggregate_version: transition.state_version,
        occurred_at: now,
        idempotency_key: `conflict:${conflictId}:${transition.role}:v${transition.state_version}`,
        trace_id: request.trace_id,
        target: "meta",
        payload: {
          ...scope,
          aggregate_id: transition.memory_point_id,
          aggregate_type: "memory_point",
          aggregate_version: transition.state_version,
          memory_point_id: transition.memory_point_id,
          previous_status: transition.from_status,
          status: transition.to_status,
          state_version: transition.state_version,
          reason_code: `conflict_${request.decision}`,
          revision_refs: [{
            aggregate_type: "memory_point",
            aggregate_id: transition.memory_point_id,
            revision_id: revision.id,
          }],
        },
      }));
    }
    const commandRows: JsonRowV1[] = [];
    if (!terminal) {
      const questionRef = `memory_conflict:${conflictId}:v${previousConflictVersion + 1}`;
      const questionKey = "memory_conflict_resolution_v1";
      const commandWithoutHash = {
        schema_version: "meta.feedback_request_suggestion.v1",
        source_kind: "service_command",
        source_service: "memory_service",
        source_ref: `memory_conflict:${conflictId}`,
        command_id: commandId,
        ...scope,
        dedupe_scope_ref: { kind: "conflict", ref: `conflict:${conflictId}` },
        question_key: questionKey,
        question_ref: questionRef,
        question_hash: sha256V1({ question_key: questionKey, question_ref: questionRef, reason: request.reason, evidence_refs: request.evidence_refs }),
        trace_id: request.trace_id,
      };
      const commandRequest = {
        ...commandWithoutHash,
        request_hash: sha256V1(commandWithoutHash),
      } as MetaFeedbackRequestSuggestionRequestV1;
      if (!Value.Check(MetaFeedbackRequestSuggestionRequestV1Schema, commandRequest)) {
        throw new Error("Memory feedback suggestion command violates the Meta owner contract");
      }
      commandRows.push({
        id: commandOutboxId,
        command_id: commandId,
        contract_name: "MetaFeedbackRequestSuggestionContractV1",
        source_service: "memory_service",
        source_ref: `memory_conflict:${conflictId}`,
        ...scope,
        dedupe_scope_ref: `conflict:${conflictId}`,
        request_payload: commandRequest,
        request_hash: commandRequest.request_hash,
        trace_id: request.trace_id,
        status: "pending",
        attempt_count: 0,
        next_retry_at: null,
        last_error: null,
        created_at: now,
        updated_at: now,
      });
    }
    const seriesRows = seriesTransitions.map((transition) => ({
      id: transition.series_id,
      status: transition.to_status,
      state_version: transition.state_version,
      topic_key: transition.topic_key,
      scope_key: transition.role === "old_series" ? oldScopeKey : newScopeKey,
      ...(request.decision === "merge" && transition.role === "new_series"
        ? { merged_into_series_id: oldSeriesId }
        : {}),
      updated_at: now,
    }));
    const pointRows = pointTransitions.map((transition) => ({
      id: transition.memory_point_id,
      status: transition.to_status,
      state_version: transition.state_version,
    }));
    const projectionRows = pointTransitions.map((transition) => {
      const series = transition.role === "old_point" ? seriesTransitions[0]! : seriesTransitions[1]!;
      const projection = transition.role === "old_point"
        ? snapshot.oldProjection!
        : snapshot.newProjection!;
      return {
        ...structuredClone(projection),
        memory_point_id: transition.memory_point_id,
        status: transition.to_status,
        state_version: transition.state_version,
        series_state_version: series.state_version,
        topic_key: series.topic_key,
        updated_at: now,
      };
    });
    try {
      await executeWriterV1(
        this.composition,
        "memory_conflict_resolve",
        request.idempotency_key,
        request.trace_id,
        "transition_memory_conflict_v1",
        {
          p_conflict_id: conflictId,
          p_expected_status: previousStatus,
          p_expected_conflict_version: String(previousConflictVersion),
          p_expected_versions: request.expected_versions,
          p_next_status: response.status,
          p_resolution: {
            memory_conflicts: {
              status: response.status,
              state_version: previousConflictVersion + 1,
              resolution: {
                decision: request.decision,
                ...(resolutionCode === undefined ? {} : { resolution_code: resolutionCode }),
                reason: request.reason,
                evidence_refs: request.evidence_refs,
                idempotency_key: request.idempotency_key,
                request_hash: requestHash,
                response_payload: response,
              },
              updated_at: now,
            },
            memory_series: seriesRows,
            memory_points: pointRows,
            memory_state_revisions: revisions,
            memory_point_search_index: projectionRows,
            topic_key_aliases: topicAliases,
            memory_audit_logs: audits,
            memory_event_outbox: eventRows,
            memory_command_outbox: commandRows,
          },
          p_request_hash: requestHash,
          p_trace_id: request.trace_id,
        },
      );
    } catch (error) {
      const concurrentReplay = await readReplayV1();
      if (concurrentReplay !== undefined) return concurrentReplay;
      if (
        error instanceof Error &&
        /fence conflict|aggregate version fence|40001/u.test(error.message)
      ) {
        failV1("stale_conflict_version", "memory conflict changed concurrently", true);
      }
      throw error;
    }
    return Object.freeze(response);
  }
}
