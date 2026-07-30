import type {
  RuntimeRunQueryDetailsV1,
  ToolInvocationListDetailsV1,
} from "@pai/contracts";
import type { PostgresQueryPortV1 } from "@pai/persistence";

import {
  RuntimeQueryErrorV1,
  type RuntimeQueryPrincipalV1,
  type RuntimeQueryRepositoryV1,
} from "../runtime-query.v1.js";

interface RuntimeRunQueryRowV1 extends Record<string, unknown> {
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
  readonly status:
    | "queued"
    | "running"
    | "preempt_requested"
    | "cancelling"
    | "cancelled"
    | "completed"
    | "failed";
  readonly start_attempt_no: number;
  readonly policy_snapshot_id: string;
  readonly requested_catalog_version: string | null;
  readonly effective_catalog_version: string | null;
  readonly created_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly terminal_reason: string | null;
}

interface ToolInvocationQueryRowV1 extends Record<string, unknown> {
  readonly tool_invocation_id: string;
  readonly tool_name: string;
  readonly status:
    | "requested"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";
  readonly side_effect_status: "none" | "produced" | "unknown";
  readonly input_ref: string | null;
  readonly output_ref: string | null;
  readonly failure_class: string | null;
  readonly started_at: string;
  readonly completed_at: string | null;
}

interface ToolInvocationCursorV1 {
  readonly v: 1;
  readonly runtime_run_id: string;
  readonly status: ToolInvocationQueryRowV1["status"] | null;
  readonly started_at: string;
  readonly tool_invocation_id: string;
}

const RUNTIME_RUN_QUERY_SQL_V1 = `
SELECT
  r.id AS runtime_run_id,
  r.trigger_process_id,
  r.workspace_id,
  r.bot_id,
  r.owner_agent_id,
  r.deployment_environment,
  r.release_channel,
  r.status,
  r.start_attempt_no,
  r.policy_snapshot_id,
  a.requested_catalog_version,
  a.effective_catalog_version,
  pg_catalog.to_char(
    r.created_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) AS created_at,
  CASE WHEN r.started_at IS NULL THEN NULL ELSE pg_catalog.to_char(
    r.started_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) END AS started_at,
  CASE WHEN r.completed_at IS NULL THEN NULL ELSE pg_catalog.to_char(
    r.completed_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) END AS completed_at,
  r.terminal_reason
FROM action_runtime.runtime_runs AS r
LEFT JOIN action_runtime.runtime_start_attempts AS a
  ON a.runtime_run_id = r.id
 AND a.trigger_process_id = r.trigger_process_id
 AND a.start_attempt_no = r.start_attempt_no
WHERE r.id = $1::text
LIMIT 2`;

const TOOL_INVOCATION_QUERY_SQL_V1 = `
SELECT
  i.id AS tool_invocation_id,
  i.tool_name,
  i.status,
  i.side_effect_status,
  NULLIF(requested.envelope -> 'payload' ->> 'input_ref', '') AS input_ref,
  CASE
    WHEN i.status IN ('completed', 'failed')
      THEN NULLIF(terminal.envelope -> 'payload' ->> 'output_ref', '')
    ELSE NULL
  END AS output_ref,
  CASE
    WHEN i.status = 'failed'
      THEN NULLIF(terminal.envelope -> 'payload' -> 'error' ->> 'failure_class', '')
    ELSE NULL
  END AS failure_class,
  pg_catalog.to_char(
    i.started_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) AS started_at,
  CASE WHEN i.completed_at IS NULL THEN NULL ELSE pg_catalog.to_char(
    i.completed_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) END AS completed_at
FROM action_runtime.tool_invocations AS i
LEFT JOIN LATERAL (
  SELECT e.envelope
  FROM action_runtime.runtime_events AS e
  WHERE e.runtime_run_id = i.runtime_run_id
    AND e.event_type = 'runtime.tool.requested'
    AND e.envelope -> 'payload' ->> 'tool_invocation_id' = i.id
  ORDER BY e.sequence_no ASC
  LIMIT 1
) AS requested ON true
LEFT JOIN LATERAL (
  SELECT e.envelope
  FROM action_runtime.runtime_events AS e
  WHERE e.runtime_run_id = i.runtime_run_id
    AND e.event_type = CASE i.status
      WHEN 'completed' THEN 'runtime.tool.completed'
      WHEN 'failed' THEN 'runtime.tool.failed'
      WHEN 'cancelled' THEN 'runtime.tool.cancelled'
      ELSE '__non_terminal__'
    END
    AND e.envelope -> 'payload' ->> 'tool_invocation_id' = i.id
  ORDER BY e.sequence_no DESC
  LIMIT 1
) AS terminal ON true
WHERE i.runtime_run_id = $1::text
  AND ($2::text IS NULL OR i.status = $2::text)
  AND (
    $3::boolean = false
    OR i.started_at < $4::timestamptz
    OR (
      i.started_at = $4::timestamptz
      AND i.id COLLATE "C" < $5::text COLLATE "C"
    )
  )
ORDER BY i.started_at DESC, i.id COLLATE "C" DESC
LIMIT $6::integer`;

function scopeMatchesV1(
  row: RuntimeRunQueryRowV1,
  principal: RuntimeQueryPrincipalV1,
): boolean {
  return (
    row.workspace_id === principal.scope.workspace_id &&
    row.bot_id === principal.scope.bot_id &&
    row.owner_agent_id === principal.scope.owner_agent_id &&
    row.deployment_environment ===
      principal.scope.deployment_environment &&
    row.release_channel === principal.scope.release_channel
  );
}

function runDetailsV1(row: RuntimeRunQueryRowV1): RuntimeRunQueryDetailsV1 {
  return Object.freeze({
    runtime_run: Object.freeze({
      runtime_run_id: row.runtime_run_id,
      trigger_process_id: row.trigger_process_id,
      workspace_id: row.workspace_id,
      bot_id: row.bot_id,
      owner_agent_id: row.owner_agent_id,
      deployment_environment: row.deployment_environment,
      release_channel: row.release_channel,
      status: row.status,
      start_attempt_no: row.start_attempt_no,
      policy_snapshot_id: row.policy_snapshot_id,
      requested_catalog_version:
        row.requested_catalog_version as unknown as string,
      effective_catalog_version: row.effective_catalog_version,
      created_at: row.created_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      terminal_reason: row.terminal_reason,
    }),
  });
}

function assertCursorStringV1(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 512 ||
    !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new RuntimeQueryErrorV1("invalid_cursor");
  }
}

function decodeCursorV1(
  value: string | null,
  runtimeRunId: string,
  status: ToolInvocationQueryRowV1["status"] | null,
): ToolInvocationCursorV1 | null {
  if (value === null) return null;
  assertCursorStringV1(value);
  let decoded: unknown;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value || bytes.byteLength > 1_024) {
      throw new Error("non-canonical cursor encoding");
    }
    decoded = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new RuntimeQueryErrorV1("invalid_cursor");
  }
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    Array.isArray(decoded) ||
    Object.keys(decoded).sort().join(",") !==
      "runtime_run_id,started_at,status,tool_invocation_id,v"
  ) {
    throw new RuntimeQueryErrorV1("invalid_cursor");
  }
  const cursor = decoded as Readonly<Record<string, unknown>>;
  if (
    cursor.v !== 1 ||
    cursor.runtime_run_id !== runtimeRunId ||
    cursor.status !== status ||
    typeof cursor.started_at !== "string" ||
    !Number.isFinite(Date.parse(cursor.started_at)) ||
    typeof cursor.tool_invocation_id !== "string" ||
    cursor.tool_invocation_id.length < 1 ||
    cursor.tool_invocation_id.length > 512
  ) {
    throw new RuntimeQueryErrorV1("invalid_cursor");
  }
  return cursor as unknown as ToolInvocationCursorV1;
}

function encodeCursorV1(cursor: ToolInvocationCursorV1): string {
  const encoded = Buffer.from(JSON.stringify(cursor), "utf8").toString(
    "base64url",
  );
  assertCursorStringV1(encoded);
  return encoded;
}

export function createPostgresRuntimeQueryRepositoryV1(
  postgres: PostgresQueryPortV1,
): RuntimeQueryRepositoryV1 {
  const readRun = async (
    runtimeRunId: string,
    principal: RuntimeQueryPrincipalV1,
  ) => {
    const result = await postgres.query<RuntimeRunQueryRowV1>(
      RUNTIME_RUN_QUERY_SQL_V1,
      [runtimeRunId],
    );
    if (result.rows.length > 1) {
      throw new Error("Runtime owner identity is not unique");
    }
    const row = result.rows[0];
    if (row === undefined) return { outcome: "not_found" as const };
    if (!scopeMatchesV1(row, principal)) {
      return { outcome: "denied" as const };
    }
    return {
      outcome: "found" as const,
      details: runDetailsV1(row),
    };
  };

  const repository: RuntimeQueryRepositoryV1 = {
    async readAuthorizedRun(request) {
      return readRun(request.runtime_run_id, request.principal);
    },

    async listAuthorizedToolInvocations(request) {
      const run = await readRun(
        request.runtime_run_id,
        request.principal,
      );
      if (run.outcome !== "found") return run;
      const cursor = decodeCursorV1(
        request.cursor,
        request.runtime_run_id,
        request.status,
      );
      const result = await postgres.query<ToolInvocationQueryRowV1>(
        TOOL_INVOCATION_QUERY_SQL_V1,
        [
          request.runtime_run_id,
          request.status,
          cursor !== null,
          cursor?.started_at ?? null,
          cursor?.tool_invocation_id ?? null,
          request.limit + 1,
        ],
      );
      const hasMore = result.rows.length > request.limit;
      const selected = result.rows.slice(0, request.limit);
      const last = selected.at(-1);
      const page: ToolInvocationListDetailsV1 = {
        runtime_run_id: request.runtime_run_id,
        items: selected.map((row) => ({
          tool_invocation_id: row.tool_invocation_id,
          tool_name: row.tool_name,
          status: row.status,
          side_effect_status: row.side_effect_status,
          input_ref: row.input_ref,
          output_ref: row.output_ref,
          failure_class: row.failure_class,
          started_at: row.started_at,
          completed_at: row.completed_at,
        })),
        next_cursor:
          hasMore && last !== undefined
            ? encodeCursorV1(Object.freeze({
                v: 1,
                runtime_run_id: request.runtime_run_id,
                status: request.status,
                started_at: last.started_at,
                tool_invocation_id: last.tool_invocation_id,
              }))
            : null,
        has_more: hasMore,
      };
      return {
        outcome: "found" as const,
        details: Object.freeze({ run: run.details, page }),
      };
    },

    async checkReadiness(signal?: AbortSignal) {
      const throwIfAborted = (): void => {
        if (signal?.aborted === true) throw signal.reason;
      };
      throwIfAborted();
      await postgres.query(
        "SELECT 1 AS runtime_query_ready FROM action_runtime.runtime_runs WHERE false",
      );
      throwIfAborted();
    },
  };
  return Object.freeze(repository);
}
