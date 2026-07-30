import { createHash } from "node:crypto";

import { canonicalJsonV1 } from "@pai/contracts";
import type {
  MemoryIntegrationJobV1,
  MemoryIntegrationModeV1,
} from "@pai/contracts/memory/integration-job.v1";
import type {
  PostgresQueryPortV1,
  VerifiedOwnerPostgresCompositionV1,
} from "@pai/persistence";

import type { MEMORY_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import {
  MEMORY_EMBEDDING_PROFILE_V1,
  MEMORY_INTEGRATION_POLICY_VERSION_V1,
  MEMORY_RANKING_PROFILE_V1,
  memoryCanonicalTopicKeysV1,
  type MemoryEmbeddingPortV1,
  type MemoryPrincipalV1,
  type MemoryScopeV1,
} from "./memory-application.v1.js";
import type { PostgresMemoryHttpApplicationV1 } from "./postgres-memory-http-application.v1.js";

type CompositionV1 = VerifiedOwnerPostgresCompositionV1<
  typeof MEMORY_REPOSITORY_CONTRACT_V1
>;
type JsonRowV1 = Readonly<Record<string, unknown>>;
type ChangeKindV1 =
  | "decay_point"
  | "deduplicate_point"
  | "rekey_series"
  | "rebuild_projection";

interface IntegrationChangeV1 {
  readonly kind: ChangeKindV1;
  readonly target_type: "memory_point" | "memory_series";
  readonly target_id: string;
  readonly payload: JsonRowV1;
  readonly summary: JsonRowV1;
}

interface ClaimableJobV1 {
  readonly integration_job_id: string;
  readonly scope: MemoryScopeV1;
}

export interface MemoryIntegrationQueuePortV1 {
  listClaimable(
    limit: number,
    signal?: AbortSignal,
  ): Promise<readonly ClaimableJobV1[]>;
  checkReadiness(signal: AbortSignal): Promise<void>;
}

export interface MemoryIntegrationWorkerV1 {
  start(): void;
  runOnce(signal?: AbortSignal): Promise<void>;
  checkReadiness(signal: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

const canonicalOptionsV1 = Object.freeze({
  max_bytes: 2_097_152,
  max_depth: 64,
  max_nodes: 100_000,
  max_container_entries: 10_000,
});
const workerIdPatternV1 = /^[A-Za-z0-9._:-]{1,128}$/u;
const phaseOrderV1 = Object.freeze([
  "rekey",
  "deduplicate",
  "decay",
  "rebuild_projection",
] as const);

function canonicalV1(value: unknown): string {
  return canonicalJsonV1(value, canonicalOptionsV1);
}

function sha256V1(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalV1(value), "utf8")
    .digest("hex")}`;
}

function stableIdV1(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256")
    .update(canonicalV1(value), "utf8")
    .digest("base64url")
    .slice(0, 32)}`;
}

function textV1(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\u0000")
  ) {
    throw new Error(`Memory integration ${label} is invalid`);
  }
  return value;
}

function integerV1(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Memory integration ${label} is invalid`);
  }
  return parsed;
}

function numberV1(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Memory integration ${label} is invalid`);
  }
  return parsed;
}

function instantV1(value: unknown, label: string): string {
  const parsed =
    value instanceof Date || typeof value === "string"
      ? new Date(value)
      : undefined;
  if (parsed === undefined || !Number.isFinite(parsed.getTime())) {
    throw new Error(`Memory integration ${label} is invalid`);
  }
  return parsed.toISOString();
}

function objectV1(value: unknown, label: string): JsonRowV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Memory integration ${label} is invalid`);
  }
  return value as JsonRowV1;
}

function stringArrayV1(value: unknown, label: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`Memory integration ${label} is invalid`);
  }
  return Object.freeze([...value]);
}

function boundedIntegerV1(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be an integer from ${minimum} to ${maximum}`,
    );
  }
  return value;
}

function vectorSqlV1(vector: readonly number[]): string {
  if (
    vector.length !== MEMORY_EMBEDDING_PROFILE_V1.dimensions ||
    vector.some((entry) => !Number.isFinite(entry))
  ) {
    throw new Error("Memory integration embedding vector is invalid");
  }
  return `[${vector.join(",")}]`;
}

function phasesV1(
  mode: MemoryIntegrationModeV1,
): readonly (typeof phaseOrderV1)[number][] {
  if (mode === "full") return phaseOrderV1;
  return [mode];
}

function scopeFiltersV1(job: MemoryIntegrationJobV1): readonly unknown[] {
  return [
    job.scope.bot_id,
    job.request_scope.topic_family_keys ?? null,
    job.request_scope.series_ids ?? null,
    job.request_scope.before ?? null,
  ];
}

function pointEvidenceRefV1(id: string): string {
  return `memory_point:${id}`;
}

function seriesEvidenceRefV1(id: string): string {
  return `system_event:memory_series:${id}`;
}

export function createPostgresMemoryIntegrationQueueV1(
  postgres: PostgresQueryPortV1,
): MemoryIntegrationQueuePortV1 {
  return Object.freeze({
    async listClaimable(limit: number, signal?: AbortSignal) {
      signal?.throwIfAborted();
      boundedIntegerV1(limit, 1, 100, "integration queued batch size");
      const result = await postgres.query<{
        id: string;
        scope: unknown;
      }>(
        `SELECT job.id,job.scope
           FROM memory.memory_integration_jobs AS job
           LEFT JOIN memory.memory_integration_job_leases AS lease
             ON lease.integration_job_id=job.id
          WHERE (
            job.status='queued'
            AND (
              lease.integration_job_id IS NULL
              OR lease.lease_expires_at <= pg_catalog.clock_timestamp()
            )
          ) OR (
            job.status IN ('leased','running')
            AND lease.lease_expires_at <= pg_catalog.clock_timestamp()
          )
          ORDER BY job.created_at,job.id
          LIMIT $1`,
        [limit],
      );
      signal?.throwIfAborted();
      return Object.freeze(
        result.rows.map((row) => {
          const stored = objectV1(row.scope, "queue scope");
          const scope = objectV1(
            stored.owner_scope_v1,
            "queue owner scope",
          ) as unknown as MemoryScopeV1;
          if (
            textV1(scope.workspace_id, "queue workspace_id").length === 0 ||
            textV1(scope.bot_id, "queue bot_id").length === 0 ||
            textV1(scope.owner_agent_id, "queue owner_agent_id").length ===
              0 ||
            !["local", "dev", "staging", "prod"].includes(
              scope.deployment_environment,
            ) ||
            !["stable", "canary"].includes(scope.release_channel)
          ) {
            throw new Error("Memory integration queued owner scope is invalid");
          }
          return Object.freeze({
            integration_job_id: textV1(row.id, "queue job id"),
            scope: Object.freeze(structuredClone(scope)),
          });
        }),
      );
    },

    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      await postgres.query(
        `SELECT 1
           FROM memory.memory_integration_jobs AS job
           LEFT JOIN memory.memory_integration_job_leases AS lease
             ON lease.integration_job_id=job.id
          WHERE FALSE`,
      );
      signal.throwIfAborted();
    },
  });
}

async function loadRekeyChangesV1(
  composition: CompositionV1,
  job: MemoryIntegrationJobV1,
  excluded: readonly string[],
  limit: number,
): Promise<readonly IntegrationChangeV1[]> {
  const result = await composition.postgres.query<JsonRowV1>(
    `SELECT series.id,series.status,series.state_version,
            series.canonicalization_version,series.topic_key,
            series.topic_family_key,series.subject_key,series.aspect_key,
            series.scope_key,series.topic_components_raw
       FROM memory.memory_series AS series
      WHERE series.bot_id=$1
        AND series.status='active'
        AND series.canonicalization_version <> $5
        AND ($2::text[] IS NULL OR series.topic_family_key=ANY($2::text[]))
        AND ($3::text[] IS NULL OR series.id=ANY($3::text[]))
        AND ($4::timestamptz IS NULL OR series.created_at <= $4::timestamptz)
        AND NOT (series.id=ANY($6::text[]))
        AND NOT EXISTS (
          SELECT 1
            FROM memory.memory_promotion_reservations AS reservation
            JOIN memory.memory_promotion_reservation_targets AS target
              ON target.reservation_id=reservation.id
           WHERE reservation.bot_id=series.bot_id
             AND reservation.status='active'
             AND reservation.expires_at > pg_catalog.clock_timestamp()
             AND target.aggregate_type='memory_series'
             AND target.aggregate_id=series.id
        )
      ORDER BY series.id
      LIMIT $7`,
    [
      ...scopeFiltersV1(job),
      "memory.topic_key.v1",
      excluded,
      limit,
    ],
  );
  return Object.freeze(
    result.rows.map((row) => {
      const seriesId = textV1(row.id, "rekey series_id");
      const canonical = memoryCanonicalTopicKeysV1(
        job.scope.bot_id,
        textV1(row.subject_key, "rekey subject_key"),
        textV1(row.aspect_key, "rekey aspect_key"),
        textV1(row.scope_key, "rekey scope_key"),
      );
      const payload = Object.freeze({
        integration_job_id: job.id,
        series_id: seriesId,
        expected_status: textV1(row.status, "rekey status"),
        expected_state_version: integerV1(
          row.state_version,
          "rekey state_version",
        ),
        old_canonicalization_version: textV1(
          row.canonicalization_version,
          "rekey old canonicalization version",
        ),
        old_topic_key: textV1(row.topic_key, "rekey old topic key"),
        old_topic_family_key: textV1(
          row.topic_family_key,
          "rekey old topic family key",
        ),
        new_canonicalization_version: "memory.topic_key.v1",
        new_topic_key: canonical.topic_key,
        new_topic_family_key: canonical.topic_family_key,
        topic_components_normalized: {
          bot_id: canonical.bot_id,
          subject_key: canonical.subject_key,
          aspect_key: canonical.aspect_key,
          scope_key: canonical.scope_key,
        },
      });
      return Object.freeze({
        kind: "rekey_series" as const,
        target_type: "memory_series" as const,
        target_id: seriesId,
        payload,
        summary: Object.freeze({
          operation: "rekey_series",
          series_id: seriesId,
          previous_topic_key: payload.old_topic_key,
          topic_key: payload.new_topic_key,
          previous_topic_family_key: payload.old_topic_family_key,
          topic_family_key: payload.new_topic_family_key,
          evidence_ref: seriesEvidenceRefV1(seriesId),
        }),
      });
    }),
  );
}

async function loadDeduplicateChangesV1(
  composition: CompositionV1,
  job: MemoryIntegrationJobV1,
  excluded: readonly string[],
  limit: number,
): Promise<readonly IntegrationChangeV1[]> {
  const result = await composition.postgres.query<JsonRowV1>(
    `WITH ranked AS (
       SELECT point.id,point.series_id,point.status,point.state_version,
              point.content_hash,point.version_no,
              pg_catalog.first_value(point.id) OVER (
                PARTITION BY point.series_id,point.content_hash
                ORDER BY point.version_no,point.created_at,point.id
              ) AS canonical_point_id,
              pg_catalog.row_number() OVER (
                PARTITION BY point.series_id,point.content_hash
                ORDER BY point.version_no,point.created_at,point.id
              ) AS duplicate_ordinal
         FROM memory.memory_points AS point
         JOIN memory.memory_series AS series ON series.id=point.series_id
        WHERE point.bot_id=$1
          AND point.status='active'
          AND series.status='active'
          AND ($2::text[] IS NULL OR series.topic_family_key=ANY($2::text[]))
          AND ($3::text[] IS NULL OR series.id=ANY($3::text[]))
          AND ($4::timestamptz IS NULL OR point.occurred_at <= $4::timestamptz)
     )
     SELECT ranked.*
       FROM ranked
      WHERE ranked.duplicate_ordinal > 1
        AND NOT (ranked.id=ANY($5::text[]))
      ORDER BY ranked.series_id,ranked.content_hash,
               ranked.version_no,ranked.id
      LIMIT $6`,
    [...scopeFiltersV1(job), excluded, limit],
  );
  return Object.freeze(
    result.rows.map((row) => {
      const pointId = textV1(row.id, "duplicate point_id");
      const seriesId = textV1(row.series_id, "duplicate series_id");
      const canonicalPointId = textV1(
        row.canonical_point_id,
        "duplicate canonical point_id",
      );
      const payload = Object.freeze({
        integration_job_id: job.id,
        memory_point_id: pointId,
        series_id: seriesId,
        expected_status: textV1(row.status, "duplicate status"),
        expected_state_version: integerV1(
          row.state_version,
          "duplicate state_version",
        ),
        canonical_memory_point_id: canonicalPointId,
        content_hash: textV1(row.content_hash, "duplicate content_hash"),
        reason: "exact_content_hash_duplicate_within_series",
      });
      return Object.freeze({
        kind: "deduplicate_point" as const,
        target_type: "memory_point" as const,
        target_id: pointId,
        payload,
        summary: Object.freeze({
          operation: "deduplicate_point",
          memory_point_id: pointId,
          canonical_memory_point_id: canonicalPointId,
          series_id: seriesId,
          evidence_ref: pointEvidenceRefV1(pointId),
        }),
      });
    }),
  );
}

async function loadDecayChangesV1(
  composition: CompositionV1,
  job: MemoryIntegrationJobV1,
  excluded: readonly string[],
  limit: number,
  now: Date,
): Promise<readonly IntegrationChangeV1[]> {
  const policyCutoff = new Date(now.getTime() - 180 * 86_400_000);
  const requestedBefore =
    job.request_scope.before === undefined
      ? undefined
      : new Date(job.request_scope.before);
  const decayCutoff =
    requestedBefore !== undefined &&
    requestedBefore.getTime() < policyCutoff.getTime()
      ? requestedBefore
      : policyCutoff;
  const result = await composition.postgres.query<JsonRowV1>(
    `SELECT point.id,point.series_id,point.status,point.state_version,
            point.evidence_valid_until,point.occurred_at,
            series.importance_score,series.last_recalled_at,
            series.last_mentioned_at
       FROM memory.memory_points AS point
       JOIN memory.memory_series AS series ON series.id=point.series_id
      WHERE point.bot_id=$1
        AND point.status='active'
        AND series.status='active'
        AND ($2::text[] IS NULL OR series.topic_family_key=ANY($2::text[]))
        AND ($3::text[] IS NULL OR series.id=ANY($3::text[]))
        AND ($4::timestamptz IS NULL OR point.occurred_at <= $4::timestamptz)
        AND NOT (point.id=ANY($5::text[]))
        AND (
          (
            point.evidence_valid_until IS NOT NULL
            AND point.evidence_valid_until <= $6::timestamptz
          ) OR (
            series.importance_score <= 0.25
            AND GREATEST(
              point.occurred_at,
              COALESCE(series.last_recalled_at,point.occurred_at),
              COALESCE(series.last_mentioned_at,point.occurred_at)
            ) <= $7::timestamptz
          )
        )
        AND NOT EXISTS (
          SELECT 1
            FROM memory.memory_promotion_reservations AS reservation
            JOIN memory.memory_promotion_reservation_targets AS target
              ON target.reservation_id=reservation.id
           WHERE reservation.bot_id=point.bot_id
             AND reservation.status='active'
             AND reservation.expires_at > pg_catalog.clock_timestamp()
             AND (
               (target.aggregate_type='memory_point'
                AND target.aggregate_id=point.id)
               OR
               (target.aggregate_type='memory_series'
                AND target.aggregate_id=series.id)
             )
        )
      ORDER BY point.occurred_at,point.id
      LIMIT $8`,
    [
      ...scopeFiltersV1(job),
      excluded,
      now.toISOString(),
      decayCutoff.toISOString(),
      limit,
    ],
  );
  return Object.freeze(
    result.rows.map((row) => {
      const pointId = textV1(row.id, "decay point_id");
      const seriesId = textV1(row.series_id, "decay series_id");
      const evidenceExpired =
        row.evidence_valid_until !== null &&
        Date.parse(instantV1(row.evidence_valid_until, "evidence expiry")) <=
          now.getTime();
      const payload = Object.freeze({
        integration_job_id: job.id,
        memory_point_id: pointId,
        series_id: seriesId,
        expected_status: textV1(row.status, "decay status"),
        expected_state_version: integerV1(
          row.state_version,
          "decay state_version",
        ),
        reason: evidenceExpired
          ? "evidence_retention_expired"
          : "low_importance_inactive_180_days",
        policy_cutoff: decayCutoff.toISOString(),
      });
      return Object.freeze({
        kind: "decay_point" as const,
        target_type: "memory_point" as const,
        target_id: pointId,
        payload,
        summary: Object.freeze({
          operation: "decay_point",
          memory_point_id: pointId,
          series_id: seriesId,
          reason: payload.reason,
          evidence_ref: pointEvidenceRefV1(pointId),
        }),
      });
    }),
  );
}

async function loadProjectionChangesV1(
  composition: CompositionV1,
  embedding: MemoryEmbeddingPortV1,
  job: MemoryIntegrationJobV1,
  excluded: readonly string[],
  limit: number,
): Promise<readonly IntegrationChangeV1[]> {
  const result = await composition.postgres.query<JsonRowV1>(
    `SELECT point.id,point.series_id,point.status,point.state_version,
            point.content_summary,point.keyword_tags,point.scene_tags,
            point.emotion_tags,point.occurred_at,point.evidence_valid_until,
            point.embedding_profile_id,
            point.summary_embedding::text AS summary_embedding,
            point.embedding_backfill_status,
            series.state_version AS series_state_version,
            series.topic_key,series.topic_family_key,
            series.importance_score,series.last_mentioned_at,
            ARRAY(
              SELECT revision.id
                FROM memory.memory_state_revisions AS revision
               WHERE revision.bot_id=point.bot_id
                 AND revision.aggregate_type='memory_point'
                 AND revision.aggregate_id=point.id
               ORDER BY revision.resulting_state_version,revision.id
            ) AS source_revision_ids
       FROM memory.memory_points AS point
       JOIN memory.memory_series AS series ON series.id=point.series_id
       LEFT JOIN memory.memory_point_search_index AS projection
         ON projection.memory_point_id=point.id
      WHERE point.bot_id=$1
        AND point.status IN (
          'active','superseded','downgraded','archived','rejected',
          'pending_conflict'
        )
        AND ($2::text[] IS NULL OR series.topic_family_key=ANY($2::text[]))
        AND ($3::text[] IS NULL OR series.id=ANY($3::text[]))
        AND ($4::timestamptz IS NULL OR point.occurred_at <= $4::timestamptz)
        AND NOT (point.id=ANY($5::text[]))
        AND (
          projection.memory_point_id IS NULL
          OR projection.bot_id IS DISTINCT FROM point.bot_id
          OR projection.series_id IS DISTINCT FROM point.series_id
          OR projection.topic_key IS DISTINCT FROM series.topic_key
          OR projection.topic_family_key IS DISTINCT FROM
               series.topic_family_key
          OR projection.status IS DISTINCT FROM point.status
          OR projection.state_version IS DISTINCT FROM point.state_version
          OR projection.series_state_version IS DISTINCT FROM
               series.state_version
          OR projection.content_summary IS DISTINCT FROM point.content_summary
          OR projection.keyword_tags IS DISTINCT FROM point.keyword_tags
          OR projection.scene_tags IS DISTINCT FROM point.scene_tags
          OR projection.emotion_tags IS DISTINCT FROM point.emotion_tags
          OR projection.occurred_at IS DISTINCT FROM point.occurred_at
          OR projection.importance_score IS DISTINCT FROM
               series.importance_score
          OR projection.last_mentioned_at IS DISTINCT FROM
               series.last_mentioned_at
          OR projection.evidence_valid_until IS DISTINCT FROM
               point.evidence_valid_until
          OR point.embedding_backfill_status <> 'ready'
          OR point.embedding_profile_id IS DISTINCT FROM $6
          OR point.summary_embedding IS NULL
          OR projection.embedding_backfill_status <> 'ready'
          OR projection.embedding_profile_id IS DISTINCT FROM $6
          OR projection.summary_embedding::text IS DISTINCT FROM
               point.summary_embedding::text
        )
      ORDER BY point.id
      LIMIT $7`,
    [
      ...scopeFiltersV1(job),
      excluded,
      MEMORY_EMBEDDING_PROFILE_V1.profile_id,
      limit,
    ],
  );
  const missingEmbeddingRows = result.rows.filter(
    (row) =>
      row.embedding_backfill_status !== "ready" ||
      row.embedding_profile_id !== MEMORY_EMBEDDING_PROFILE_V1.profile_id ||
      row.summary_embedding === null,
  );
  const generated =
    missingEmbeddingRows.length === 0
      ? []
      : await embedding.embed(
          missingEmbeddingRows.map((row) =>
            textV1(row.content_summary, "projection content_summary"),
          ),
          MEMORY_EMBEDDING_PROFILE_V1,
        );
  if (generated.length !== missingEmbeddingRows.length) {
    throw new Error("Memory integration embedding batch cardinality drifted");
  }
  const generatedByPoint = new Map<string, string>();
  missingEmbeddingRows.forEach((row, index) => {
    generatedByPoint.set(
      textV1(row.id, "projection generated point_id"),
      vectorSqlV1(generated[index]!),
    );
  });
  return Object.freeze(
    result.rows.map((row) => {
      const pointId = textV1(row.id, "projection point_id");
      const seriesId = textV1(row.series_id, "projection series_id");
      const summaryEmbedding =
        generatedByPoint.get(pointId) ??
        textV1(row.summary_embedding, "projection summary_embedding");
      const projection = Object.freeze({
        memory_point_id: pointId,
        bot_id: job.scope.bot_id,
        series_id: seriesId,
        topic_family_key: textV1(
          row.topic_family_key,
          "projection topic_family_key",
        ),
        topic_key: textV1(row.topic_key, "projection topic_key"),
        status: textV1(row.status, "projection status"),
        state_version: integerV1(
          row.state_version,
          "projection state_version",
        ),
        series_state_version: integerV1(
          row.series_state_version,
          "projection series_state_version",
        ),
        source_revision_ids: stringArrayV1(
          row.source_revision_ids,
          "projection source_revision_ids",
        ),
        ranking_profile_version: MEMORY_RANKING_PROFILE_V1,
        content_summary: textV1(
          row.content_summary,
          "projection content_summary",
        ),
        keyword_tags: stringArrayV1(
          row.keyword_tags,
          "projection keyword_tags",
        ),
        scene_tags: stringArrayV1(row.scene_tags, "projection scene_tags"),
        emotion_tags: stringArrayV1(
          row.emotion_tags,
          "projection emotion_tags",
        ),
        occurred_at: instantV1(row.occurred_at, "projection occurred_at"),
        importance_score: numberV1(
          row.importance_score,
          "projection importance_score",
        ),
        last_mentioned_at:
          row.last_mentioned_at === null
            ? null
            : instantV1(
                row.last_mentioned_at,
                "projection last_mentioned_at",
              ),
        evidence_valid_until:
          row.evidence_valid_until === null
            ? null
            : instantV1(
                row.evidence_valid_until,
                "projection evidence_valid_until",
              ),
        embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
        summary_embedding: summaryEmbedding,
        embedding_backfill_status: "ready",
      });
      const payload = Object.freeze({
        integration_job_id: job.id,
        memory_point_id: pointId,
        series_id: seriesId,
        expected_state_version: projection.state_version,
        expected_series_state_version: projection.series_state_version,
        projection,
      });
      return Object.freeze({
        kind: "rebuild_projection" as const,
        target_type: "memory_point" as const,
        target_id: pointId,
        payload,
        summary: Object.freeze({
          operation: "rebuild_projection",
          memory_point_id: pointId,
          series_id: seriesId,
          embedding_profile_id: MEMORY_EMBEDDING_PROFILE_V1.profile_id,
          evidence_ref: pointEvidenceRefV1(pointId),
        }),
      });
    }),
  );
}

async function loadPhaseChangesV1(
  composition: CompositionV1,
  embedding: MemoryEmbeddingPortV1,
  job: MemoryIntegrationJobV1,
  phase: (typeof phaseOrderV1)[number],
  excluded: readonly string[],
  limit: number,
  now: Date,
): Promise<readonly IntegrationChangeV1[]> {
  switch (phase) {
    case "rekey":
      return loadRekeyChangesV1(composition, job, excluded, limit);
    case "deduplicate":
      return loadDeduplicateChangesV1(
        composition,
        job,
        excluded,
        limit,
      );
    case "decay":
      return loadDecayChangesV1(
        composition,
        job,
        excluded,
        limit,
        now,
      );
    case "rebuild_projection":
      return loadProjectionChangesV1(
        composition,
        embedding,
        job,
        excluded,
        limit,
      );
  }
}

async function applyChangeV1(
  composition: CompositionV1,
  job: MemoryIntegrationJobV1,
  lease: Readonly<{ lease_id: string; lease_generation: number }>,
  change: IntegrationChangeV1,
): Promise<void> {
  const changeId = stableIdV1("mic", [
    job.id,
    change.kind,
    change.target_id,
    change.payload,
  ]);
  const requestHash = sha256V1(change.payload);
  await composition.unit_of_work.withTransaction(
    {
      operation: "memory_integration_apply_change",
      idempotency_key: changeId,
      trace_id: job.id,
      isolation: "serializable",
      retry: "none",
    },
    async (transaction, { owner }) => {
      await owner.executeWriter(transaction, {
        writer: "apply_memory_integration_change_v1",
        arguments: {
          p_job_id: job.id,
          p_lease_id: lease.lease_id,
          p_expected_lease_generation: String(lease.lease_generation),
          p_policy_version: MEMORY_INTEGRATION_POLICY_VERSION_V1,
          p_change_id: changeId,
          p_change_kind: change.kind,
          p_target_type: change.target_type,
          p_target_id: change.target_id,
          p_change: change.payload,
          p_request_hash: requestHash,
          p_trace_id: job.id,
        },
        expected_rows: 1,
      });
    },
  );
}

async function receiptCountsV1(
  composition: CompositionV1,
  jobId: string,
): Promise<Record<string, number>> {
  const result = await composition.postgres.query<{
    change_kind: string;
    count: string | number;
  }>(
    `SELECT change_kind,pg_catalog.count(*) AS count
       FROM memory.memory_integration_change_receipts
      WHERE integration_job_id=$1
      GROUP BY change_kind
      ORDER BY change_kind`,
    [jobId],
  );
  return Object.fromEntries(
    result.rows.map((row) => [
      textV1(row.change_kind, "receipt change_kind"),
      integerV1(row.count, "receipt count"),
    ]),
  );
}

function checkpointRefV1(
  jobId: string,
  phase: string,
  counts: Readonly<Record<string, number>>,
): string {
  return stableIdV1("micp", [jobId, phase, counts]);
}

export function createMemoryIntegrationWorkerV1(
  options: Readonly<{
    application: PostgresMemoryHttpApplicationV1;
    composition: CompositionV1;
    embedding: MemoryEmbeddingPortV1;
    queue: MemoryIntegrationQueuePortV1;
    worker_id: string;
    poll_interval_ms?: number;
    queued_batch_size?: number;
    change_batch_size?: number;
  }>,
): MemoryIntegrationWorkerV1 {
  if (!workerIdPatternV1.test(options.worker_id)) {
    throw new Error("Memory integration worker_id is invalid");
  }
  const pollIntervalMs = boundedIntegerV1(
    options.poll_interval_ms ?? 1_000,
    50,
    60_000,
    "Memory integration poll_interval_ms",
  );
  const queuedBatchSize = boundedIntegerV1(
    options.queued_batch_size ?? 4,
    1,
    100,
    "Memory integration queued_batch_size",
  );
  const changeBatchSize = boundedIntegerV1(
    options.change_batch_size ?? 10,
    1,
    100,
    "Memory integration change_batch_size",
  );
  const lifecycle = new AbortController();
  let started = false;
  let closed = false;
  let active: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;
  let lastCycleCompletedAt = 0;

  const processJob = async (
    queued: ClaimableJobV1,
    signal: AbortSignal,
  ): Promise<void> => {
    const principal: MemoryPrincipalV1 = Object.freeze({
      caller: "memory",
      capabilities: Object.freeze([
        "memory.integration.run",
        "memory.integration.operator",
      ]),
      scope: queued.scope,
    });
    const claim = await options.application.claimIntegrationJob(principal, {
      bot_id: queued.scope.bot_id,
      integration_job_id: queued.integration_job_id,
      owner_id: options.worker_id,
    });
    let job = claim.job;
    const lease = Object.freeze({
      lease_id: claim.lease_id,
      lease_generation: claim.lease_generation,
    });
    const counts = await receiptCountsV1(options.composition, job.id);
    const failures = new Set<string>(job.failure_refs);
    try {
      if (job.expected_policy_version !== MEMORY_INTEGRATION_POLICY_VERSION_V1) {
        throw new Error(
          `unsupported Memory integration policy ${job.expected_policy_version}`,
        );
      }
      if (job.dry_run) {
        const proposed: JsonRowV1[] = [];
        const excludedByPhase = new Set<string>();
        for (const phase of phasesV1(job.mode)) {
          signal.throwIfAborted();
          const remaining = 10_001 - proposed.length;
          const changes = await loadPhaseChangesV1(
            options.composition,
            options.embedding,
            job,
            phase,
            [...excludedByPhase],
            remaining,
            new Date(),
          );
          for (const change of changes) {
            proposed.push(change.summary);
            if (
              change.kind === "decay_point" ||
              change.kind === "deduplicate_point"
            ) {
              excludedByPhase.add(change.target_id);
            }
          }
          if (proposed.length > 10_000) {
            throw new Error(
              "Memory integration dry-run exceeds 10000 proposed changes; narrow the scope",
            );
          }
        }
        job = await options.application.checkpointIntegrationJob(principal, {
          bot_id: queued.scope.bot_id,
          integration_job_id: job.id,
          lease_id: lease.lease_id,
          lease_generation: lease.lease_generation,
          checkpoint_ref: checkpointRefV1(job.id, "dry_run", counts),
          applied_counts: counts,
          proposed_changes: proposed,
        });
      } else {
        for (const phase of phasesV1(job.mode)) {
          const excluded = new Set<string>();
          while (true) {
            signal.throwIfAborted();
            const changes = await loadPhaseChangesV1(
              options.composition,
              options.embedding,
              job,
              phase,
              [...excluded],
              changeBatchSize,
              new Date(),
            );
            if (changes.length === 0) break;
            for (const change of changes) {
              signal.throwIfAborted();
              try {
                await applyChangeV1(
                  options.composition,
                  job,
                  lease,
                  change,
                );
                counts[change.kind] = (counts[change.kind] ?? 0) + 1;
              } catch (error) {
                if (signal.aborted) throw error;
                excluded.add(change.target_id);
                failures.add(
                  change.target_type === "memory_point"
                    ? pointEvidenceRefV1(change.target_id)
                    : seriesEvidenceRefV1(change.target_id),
                );
              }
            }
            job = await options.application.checkpointIntegrationJob(
              principal,
              {
                bot_id: queued.scope.bot_id,
                integration_job_id: job.id,
                lease_id: lease.lease_id,
                lease_generation: lease.lease_generation,
                checkpoint_ref: checkpointRefV1(job.id, phase, counts),
                applied_counts: counts,
              },
            );
          }
        }
      }
      await options.application.finishIntegrationJob(principal, {
        bot_id: queued.scope.bot_id,
        integration_job_id: job.id,
        lease_id: lease.lease_id,
        lease_generation: lease.lease_generation,
        status: failures.size === 0 ? "completed" : "partial_failed",
        failure_refs: [...failures].sort(),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      await options.application
        .finishIntegrationJob(principal, {
          bot_id: queued.scope.bot_id,
          integration_job_id: job.id,
          lease_id: lease.lease_id,
          lease_generation: lease.lease_generation,
          status: "failed",
          failure_refs: [...failures].sort(),
          error:
            error instanceof Error
              ? error.message.slice(0, 4_096)
              : "Memory integration failed",
        })
        .catch(() => undefined);
    }
  };

  const runOnce = async (
    signal = lifecycle.signal,
  ): Promise<void> => {
    signal.throwIfAborted();
    const queued = await options.queue.listClaimable(
      queuedBatchSize,
      signal,
    );
    for (const job of queued) {
      signal.throwIfAborted();
      await processJob(job, signal).catch((error) => {
        if (signal.aborted) throw error;
      });
    }
    lastCycleCompletedAt = Date.now();
  };

  const schedule = (): void => {
    if (closed || lifecycle.signal.aborted) return;
    timer = setTimeout(() => {
      if (active !== undefined) {
        schedule();
        return;
      }
      active = runOnce()
        .catch(() => undefined)
        .finally(() => {
          active = undefined;
          schedule();
        });
    }, pollIntervalMs);
    timer.unref?.();
  };

  return Object.freeze({
    start() {
      if (started || closed) return;
      started = true;
      active = runOnce()
        .catch(() => undefined)
        .finally(() => {
          active = undefined;
          schedule();
        });
    },

    runOnce,

    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      if (closed) throw new Error("Memory integration worker is closed");
      await options.queue.checkReadiness(signal);
      if (
        started &&
        lastCycleCompletedAt !== 0 &&
        Date.now() - lastCycleCompletedAt > pollIntervalMs * 10
      ) {
        throw new Error(
          "Memory integration worker has stopped making progress",
        );
      }
    },

    async close() {
      if (closed) return;
      closed = true;
      lifecycle.abort();
      if (timer !== undefined) clearTimeout(timer);
      await active?.catch(() => undefined);
    },
  });
}
