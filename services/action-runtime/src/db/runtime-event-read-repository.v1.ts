import type { PostgresQueryPortV1 } from "@pai/persistence";

import type {
  RuntimeEventOwnerRepositoryV1,
  RuntimeEventOwnerRowV1,
} from "../runtime-event-read.v1.js";

const RUNTIME_EVENT_OWNER_READ_SQL_V1 = `
SELECT
  e.id AS source_event_id,
  e.payload_ref,
  e.payload_hash,
  e.runtime_run_id,
  e.trigger_process_id,
  e.sequence_no AS source_sequence_no,
  r.workspace_id,
  r.bot_id,
  r.owner_agent_id,
  r.deployment_environment,
  r.release_channel,
  r.start_attempt_no AS owner_start_attempt_no,
  r.start_fence_generation AS owner_start_fence_generation,
  e.envelope AS runtime_event,
  pg_catalog.replace(
    pg_catalog.encode(e.envelope_canonical_bytes, 'base64'),
    E'\\n',
    ''
  ) AS envelope_canonical_base64,
  pg_catalog.to_char(
    e.retention_until AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) AS retention_until,
  e.redaction_state
FROM action_runtime.runtime_events AS e
JOIN action_runtime.runtime_runs AS r
  ON r.id = e.runtime_run_id
 AND r.trigger_process_id = e.trigger_process_id
WHERE e.id = $1::text
  AND e.payload_ref = $2::text
LIMIT 2`;

export function createPostgresRuntimeEventOwnerRepositoryV1(
  postgres: PostgresQueryPortV1,
): RuntimeEventOwnerRepositoryV1 {
  return Object.freeze({
    async findByOwnerIdentity(
      sourceEventId: string,
      payloadRef: string,
      signal: AbortSignal,
    ): Promise<RuntimeEventOwnerRowV1 | undefined> {
      if (signal.aborted) throw signal.reason;
      const result = await postgres.query<RuntimeEventOwnerRowV1>(
        RUNTIME_EVENT_OWNER_READ_SQL_V1,
        [sourceEventId, payloadRef],
      );
      if (signal.aborted) throw signal.reason;
      if (result.rows.length > 1) {
        throw new Error("Runtime event owner identity is not unique");
      }
      return result.rows[0];
    },
  });
}
