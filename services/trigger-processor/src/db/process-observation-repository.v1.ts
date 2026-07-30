import type {
  PostgresQueryPortV1,
} from "@pai/persistence";
import type {
  TriggerProcessQueryDetailsV1,
  TriggerProcessSseEventV1,
} from "@pai/contracts";

import type {
  DelegatedProcessReadPrincipalV1,
  TriggerProcessEventReplayPageV1,
  TriggerProcessObservationRepositoryV1,
} from "../application/process-observation.v1.js";
import { delegatedSnapshotIdentityAccessV1 } from "../application/process-observation.v1.js";

interface ProcessReadRowV1 extends Record<string, unknown> {
  readonly authorization_state: "found" | "denied" | "not_found";
  readonly details: TriggerProcessQueryDetailsV1 | null;
  readonly replay_cutoff: string | number;
  readonly observation_closed: boolean;
  readonly current_snapshot_identity_consistent: boolean;
}

interface EventPageRowV1 extends Record<string, unknown> {
  readonly authorization_state: "found" | "denied" | "not_found";
  readonly current_watermark: string | number;
  readonly replay_cutoff: string | number;
  readonly observation_closed: boolean;
  readonly details: TriggerProcessQueryDetailsV1 | null;
  readonly events: readonly TriggerProcessSseEventV1[] | null;
  readonly current_snapshot_identity_consistent: boolean;
}

function databasePrincipalType(
  principal: DelegatedProcessReadPrincipalV1,
): string {
  return principal.principal_type === "agent" ? "agent" : principal.principal_type;
}

function scopeJson(principal: DelegatedProcessReadPrincipalV1): string | null {
  return principal.signed_bot_scope === undefined
    ? null
    : JSON.stringify(principal.signed_bot_scope);
}

function safeSequence(value: string | number): number {
  const number = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error("Trigger Process projection sequence is outside JavaScript bounds");
  }
  return number;
}

const OBSERVATION_CLOSE_PREDICATE = `
  a.terminal_outcome_finalized_at IS NOT NULL
  AND a.observation_finalized = true
  AND a.snapshot_retention_until <= transaction_timestamp()
  AND COALESCE(m.active_compensation_count, 0) = 0
  AND COALESCE(m.active_repair_count, 0) = 0
  AND NOT EXISTS (
    SELECT 1
    FROM trigger_processor.trigger_snapshot_repair_jobs AS r
    WHERE r.trigger_process_id = a.id
      AND r.status IN ('pending', 'running', 'retry_wait', 'awaiting_meta_ack')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM trigger_processor.trigger_process_work_items AS w
    WHERE w.trigger_process_id = a.id
      AND w.work_kind = 'snapshot_repair'
      AND w.status IN ('pending', 'leased', 'retry_wait')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM trigger_processor.trigger_process_snapshots AS ps
    JOIN trigger_processor.trigger_snapshot_overflow_refs AS o
      ON o.snapshot_id = ps.id
    WHERE ps.trigger_process_id = a.id
      AND o.store_type = 'tp_event_projection'
      AND o.retention_until > transaction_timestamp()
  )`;

const AUTHORIZED_PROCESS_CTE = `
WITH target AS MATERIALIZED (
  SELECT
    p.id,
    p.trigger_id,
    p.workspace_id,
    p.bot_id,
    p.owner_agent_id,
    p.deployment_environment,
    p.release_channel,
    p.phase,
    p.status,
    p.current_runtime_run_id,
    p.terminal_reason,
    p.terminal_outcome,
    p.terminal_outcome_finalized_at,
    p.successor_process_id,
    p.snapshot_transfer_ref,
    p.boundary_system_event_ref,
    p.canonical_reason_code,
    p.current_reason_code,
    p.cooldown_until,
    p.snapshot_retention_until,
    p.context_snapshot_ref,
    p.current_snapshot_id,
    p.context_snapshot_version,
    p.context_snapshot_hash,
    p.context_snapshot_retention_until,
    p.observation_finalized,
    p.meta_enqueue_reason
  FROM trigger_processor.trigger_processes AS p
  WHERE p.id = $1::text
), authorized AS MATERIALIZED (
  SELECT t.*
  FROM target AS t
  JOIN trigger_processor.bot_permission_bindings AS b
    ON b.workspace_id = t.workspace_id
   AND b.bot_id = t.bot_id
   AND b.owner_agent_id = t.owner_agent_id
   AND b.deployment_environment = t.deployment_environment
   AND b.release_channel = t.release_channel
   AND b.principal_type = $2::text
   AND b.principal_id = $3::text
   AND b.permission_scope = $4::text
   AND b.status = 'active'
  WHERE $5::jsonb IS NULL OR (
    t.workspace_id = $5::jsonb->>'workspace_id'
    AND t.bot_id = $5::jsonb->>'bot_id'
    AND t.owner_agent_id = $5::jsonb->>'owner_agent_id'
    AND t.deployment_environment = $5::jsonb->>'deployment_environment'
    AND t.release_channel = $5::jsonb->>'release_channel'
  )
), authority AS MATERIALIZED (
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM authorized) THEN 'found'
    WHEN EXISTS (SELECT 1 FROM target) THEN 'denied'
    WHEN EXISTS (
      SELECT 1 FROM trigger_processor.bot_permission_bindings AS b
      WHERE b.principal_type = $2::text
        AND b.principal_id = $3::text
        AND b.permission_scope = $4::text
        AND b.status = 'active'
        AND ($5::jsonb IS NULL OR (
          b.workspace_id = $5::jsonb->>'workspace_id'
          AND b.bot_id = $5::jsonb->>'bot_id'
          AND b.owner_agent_id = $5::jsonb->>'owner_agent_id'
          AND b.deployment_environment = $5::jsonb->>'deployment_environment'
          AND b.release_channel = $5::jsonb->>'release_channel'
        ))
    ) THEN 'not_found'
    ELSE 'denied'
  END AS authorization_state
), snapshot AS MATERIALIZED (
  SELECT
    a.*,
    ps.snapshot_ref AS process_snapshot_ref,
    ps.snapshot_version AS process_snapshot_version,
    ps.snapshot_hash AS process_snapshot_hash,
    ps.status AS process_snapshot_status,
    ps.retention_until AS process_snapshot_retention_until,
    (
      a.current_snapshot_id IS NULL
      OR ps.id IS NOT NULL
    ) AS current_snapshot_identity_consistent,
    COALESCE(c.last_append_sequence_no, 0) AS snapshot_watermark,
    m.meta_job_id,
    CASE
      WHEN m.meta_status = 'leased' THEN 'running'
      WHEN m.meta_status IS NOT NULL THEN m.meta_status
      WHEN a.phase = 'closed' AND a.meta_enqueue_reason IS NULL
        THEN 'not_applicable'
      WHEN a.phase = 'meta_enqueued' THEN 'enqueue_pending'
      ELSE 'not_enqueued'
    END AS meta_status,
    m.meta_summary_ref,
    (${OBSERVATION_CLOSE_PREDICATE}) AS observation_closed,
    CASE
      WHEN ${OBSERVATION_CLOSE_PREDICATE}
      THEN CASE
        WHEN MIN(ep.append_sequence_no) OVER () IS NULL
          THEN COALESCE(c.last_append_sequence_no, 0)
        ELSE GREATEST(MIN(ep.append_sequence_no) OVER () - 1, 0)
      END
      ELSE 0
    END AS replay_cutoff
  FROM authorized AS a
  LEFT JOIN trigger_processor.trigger_process_snapshots AS ps
    ON ps.id = a.current_snapshot_id
   AND ps.trigger_process_id = a.id
   AND ps.workspace_id = a.workspace_id
   AND ps.bot_id = a.bot_id
   AND ps.owner_agent_id = a.owner_agent_id
   AND ps.deployment_environment = a.deployment_environment
   AND ps.release_channel = a.release_channel
  LEFT JOIN trigger_processor.trigger_snapshot_append_cursors AS c
    ON c.trigger_process_id = a.id
  LEFT JOIN trigger_processor.trigger_process_meta_projections AS m
    ON m.trigger_process_id = a.id
  LEFT JOIN trigger_processor.trigger_process_event_projections AS ep
    ON ep.trigger_process_id = a.id
  LIMIT 1
)`;

const DETAILS_JSON = `jsonb_build_object(
  'id', s.id,
  'trigger_id', s.trigger_id,
  'workspace_id', s.workspace_id,
  'bot_id', s.bot_id,
  'owner_agent_id', s.owner_agent_id,
  'deployment_environment', s.deployment_environment,
  'release_channel', s.release_channel,
  'runtime_run_id', s.current_runtime_run_id,
  'phase', s.phase,
  'status', s.status,
  'terminal_reason', s.terminal_reason,
  'terminal_outcome', s.terminal_outcome,
  'terminal_outcome_finalized_at', s.terminal_outcome_finalized_at,
  'successor_process_id', s.successor_process_id,
  'snapshot_transfer_ref', s.snapshot_transfer_ref,
  'boundary_system_event_ref', s.boundary_system_event_ref,
  'canonical_reason_code', s.canonical_reason_code,
  'reason_code', s.current_reason_code,
  'cooldown_until', s.cooldown_until,
  'snapshot_retention_until', s.snapshot_retention_until,
  'process_snapshot_identity', CASE
    WHEN NOT $6::boolean
      OR s.current_snapshot_id IS NULL
      OR s.process_snapshot_ref IS NULL
      OR s.process_snapshot_version IS NULL
      OR s.process_snapshot_hash IS NULL
      OR s.process_snapshot_status <> 'current'
      OR s.process_snapshot_retention_until <= transaction_timestamp()
    THEN NULL
    ELSE jsonb_build_object(
      'snapshot_ref', s.process_snapshot_ref,
      'snapshot_version', s.process_snapshot_version,
      'snapshot_hash', s.process_snapshot_hash
    )
  END,
  'context_snapshot_identity', CASE
    WHEN NOT $7::boolean
      OR s.context_snapshot_ref IS NULL
      OR s.context_snapshot_version IS NULL
      OR s.context_snapshot_hash IS NULL
      OR s.context_snapshot_retention_until IS NULL
      OR s.context_snapshot_retention_until <= transaction_timestamp()
    THEN NULL
    ELSE jsonb_build_object(
      'context_snapshot_ref', s.context_snapshot_ref,
      'context_snapshot_version', s.context_snapshot_version,
      'context_snapshot_hash', s.context_snapshot_hash
    )
  END,
  'snapshot_watermark', s.snapshot_watermark,
  'meta_job_id', s.meta_job_id,
  'meta_status', s.meta_status,
  'meta_summary_ref', s.meta_summary_ref,
  'observation_finalized', s.observation_finalized
)`;

export function createTriggerProcessObservationRepositoryV1(
  postgres: PostgresQueryPortV1,
): TriggerProcessObservationRepositoryV1 {
  type ReadRequestV1 = Parameters<
    TriggerProcessObservationRepositoryV1["readAuthorizedProcess"]
  >[0];
  type EventPageRequestV1 = Parameters<
    TriggerProcessObservationRepositoryV1["readAuthorizedEventPage"]
  >[0];
  return Object.freeze({
    async readAuthorizedProcess(request: ReadRequestV1) {
      const identityAccess =
        delegatedSnapshotIdentityAccessV1(request.principal);
      const values = [
        request.process_id,
        databasePrincipalType(request.principal),
        request.principal.principal_id,
        request.permission_scope,
        scopeJson(request.principal),
        identityAccess.process_snapshot,
        identityAccess.context_snapshot,
      ] as const;
      const result = await postgres.query<ProcessReadRowV1>(
        `${AUTHORIZED_PROCESS_CTE}
         SELECT authority.authorization_state,
                COALESCE((SELECT replay_cutoff FROM snapshot), 0) AS replay_cutoff,
                COALESCE((SELECT observation_closed FROM snapshot), false)
                  AS observation_closed,
                COALESCE(
                  (SELECT current_snapshot_identity_consistent FROM snapshot),
                  true
                ) AS current_snapshot_identity_consistent,
                (SELECT ${DETAILS_JSON} FROM snapshot AS s) AS details
         FROM authority`,
        values,
      );
      const row = result.rows[0];
      if (result.rows.length !== 1 || row === undefined) {
        throw new Error("Trigger Process authorized read returned no authority row");
      }
      if (row.authorization_state !== "found") {
        return Object.freeze({ outcome: row.authorization_state });
      }
      if (row.current_snapshot_identity_consistent !== true) {
        throw new Error(
          "Trigger Process current snapshot identity is inconsistent",
        );
      }
      if (row.details === null) {
        throw new Error("Trigger Process authorized read omitted details");
      }
      return Object.freeze({
        outcome: "found" as const,
        details: row.details,
        replay_cutoff: safeSequence(row.replay_cutoff),
        observation_closed: row.observation_closed,
      });
    },

    async readAuthorizedEventPage(
      request: EventPageRequestV1,
    ): Promise<TriggerProcessEventReplayPageV1> {
      const identityAccess =
        delegatedSnapshotIdentityAccessV1(request.principal);
      const values = [
        request.process_id,
        databasePrincipalType(request.principal),
        request.principal.principal_id,
        request.permission_scope,
        scopeJson(request.principal),
        identityAccess.process_snapshot,
        identityAccess.context_snapshot,
        request.after_append_sequence_no,
        request.limit,
      ] as const;
      const result = await postgres.query<EventPageRowV1>(
         `${AUTHORIZED_PROCESS_CTE}, page AS MATERIALIZED (
           SELECT jsonb_build_object(
             'schema_version', 'trigger_process_sse_event.v1',
             'trigger_process_id', ep.trigger_process_id,
             'append_sequence_no', ep.append_sequence_no,
             'event_type', ep.event_type,
             'occurred_at', ep.occurred_at,
             'trace_id', ep.trace_id,
             'observation_summary', ep.observation_summary
           ) AS event,
           ep.append_sequence_no
           FROM trigger_processor.trigger_process_event_projections AS ep
           JOIN authorized AS a ON a.id = ep.trigger_process_id
           WHERE ep.append_sequence_no > $8::bigint
           ORDER BY ep.append_sequence_no
           LIMIT $9::integer
         )
         SELECT authority.authorization_state,
                COALESCE((SELECT snapshot_watermark FROM snapshot), 0) AS current_watermark,
                COALESCE((SELECT replay_cutoff FROM snapshot), 0) AS replay_cutoff,
                COALESCE((SELECT observation_closed FROM snapshot), false)
                  AS observation_closed,
                COALESCE(
                  (SELECT current_snapshot_identity_consistent FROM snapshot),
                  true
                ) AS current_snapshot_identity_consistent,
                (SELECT ${DETAILS_JSON} FROM snapshot AS s) AS details,
                COALESCE(
                  (SELECT jsonb_agg(event ORDER BY append_sequence_no) FROM page),
                  '[]'::jsonb
                ) AS events
         FROM authority`,
        values,
      );
      const row = result.rows[0];
      if (result.rows.length !== 1 || row === undefined) {
        throw new Error("Trigger Process event page returned no authority row");
      }
      if (
        row.authorization_state === "found" &&
        row.current_snapshot_identity_consistent !== true
      ) {
        throw new Error(
          "Trigger Process current snapshot identity is inconsistent",
        );
      }
      return Object.freeze({
        outcome: row.authorization_state,
        current_watermark: safeSequence(row.current_watermark),
        replay_cutoff: safeSequence(row.replay_cutoff),
        events: Object.freeze([...(row.events ?? [])]),
        observation_closed: row.observation_closed,
        details: row.details,
      });
    },
  });
}
