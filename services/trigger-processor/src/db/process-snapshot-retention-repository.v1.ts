import type { PostgresQueryPortV1 } from "@pai/persistence";

import type { TriggerProcessSnapshotRetentionRepositoryV1 } from "../application/trigger-lifecycle.v1.js";

interface ProcessRetentionRowV1 extends Record<string, unknown> {
  readonly snapshot_retention_until: string;
}

function timestamp(value: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error("Process snapshot retention timestamp is invalid");
  }
  return value;
}

/**
 * Reads only the owner Process row and binds the complete bot scope. The
 * callback writer must compare the returned timestamp again while holding the
 * Process row lock; this read exists to reject invalid callbacks before any
 * transactional side effect is attempted.
 */
export function createTriggerProcessSnapshotRetentionRepositoryV1(
  postgres: PostgresQueryPortV1,
): TriggerProcessSnapshotRetentionRepositoryV1 {
  type ReadRequestV1 = Parameters<
    TriggerProcessSnapshotRetentionRepositoryV1["readCurrent"]
  >[0];

  return Object.freeze({
    async readCurrent(request: ReadRequestV1, signal: AbortSignal) {
      if (signal.aborted) throw new Error("Process retention read was aborted");
      const result = await postgres.query<ProcessRetentionRowV1>(
        `SELECT pg_catalog.to_char(
                  p.snapshot_retention_until AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) AS snapshot_retention_until
           FROM trigger_processor.trigger_processes AS p
          WHERE p.id = $1::text
            AND p.workspace_id = $2::text
            AND p.bot_id = $3::text
            AND p.owner_agent_id = $4::text
            AND p.deployment_environment = $5::text
            AND p.release_channel = $6::text
          LIMIT 2`,
        [
          request.trigger_process_id,
          request.workspace_id,
          request.bot_id,
          request.owner_agent_id,
          request.deployment_environment,
          request.release_channel,
        ],
      );
      if (signal.aborted) throw new Error("Process retention read was aborted");
      if (result.rows.length === 0) {
        throw new Error("Trigger Process retention owner row was not found");
      }
      if (result.rows.length !== 1) {
        throw new Error("Trigger Process retention resolved to multiple owner rows");
      }
      return timestamp(result.rows[0]!.snapshot_retention_until);
    },
  });
}
