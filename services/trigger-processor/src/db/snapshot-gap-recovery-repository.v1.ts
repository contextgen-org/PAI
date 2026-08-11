import type { PostgresQueryPortV1 } from "@pai/persistence";

import type {
  TriggerSnapshotGapRecoveryCandidateV1,
  TriggerSnapshotGapRecoveryRepositoryV1,
} from "../application/trigger-recovery.v1.js";

interface SnapshotGapRecoveryRowV1 extends Record<string, unknown> {
  readonly pending_event_id: string;
  readonly status: "pending";
  readonly updated_at: string;
}

function canonicalTimestampV1(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error("Trigger snapshot-gap recovery timestamp is invalid");
  }
  return value;
}

/**
 * Reads only due pending callbacks.  This is deliberately not a claim: the
 * matching owner transition writer takes the row lock and rechecks its exact
 * status/timestamp before it appends a gap marker.
 */
export function createTriggerSnapshotGapRecoveryRepositoryV1(
  postgres: PostgresQueryPortV1,
): TriggerSnapshotGapRecoveryRepositoryV1 {
  return Object.freeze({
    async listEligible(limit: number, signal: AbortSignal) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 16) {
        throw new Error("Trigger snapshot-gap recovery limit is invalid");
      }
      signal.throwIfAborted();
      const result = await postgres.query<SnapshotGapRecoveryRowV1>(
        `SELECT pending.id AS pending_event_id,
                pending.status,
                pg_catalog.to_char(
                  pending.updated_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) AS updated_at
           FROM trigger_processor.trigger_snapshot_pending_events AS pending
          WHERE pending.status = 'pending'
            AND pending.next_retry_at IS NOT NULL
            AND pending.next_retry_at <= pg_catalog.clock_timestamp()
          ORDER BY pending.next_retry_at ASC, pending.created_at ASC, pending.id ASC
          LIMIT $1::integer`,
        [limit],
      );
      signal.throwIfAborted();
      return Object.freeze(result.rows.map((row): TriggerSnapshotGapRecoveryCandidateV1 => {
        if (
          typeof row.pending_event_id !== "string" ||
          row.pending_event_id.length === 0 ||
          row.status !== "pending"
        ) {
          throw new Error("Trigger snapshot-gap recovery row is invalid");
        }
        return Object.freeze({
          pending_event_id: row.pending_event_id,
          status: "pending",
          updated_at: canonicalTimestampV1(row.updated_at),
        });
      }));
    },
  });
}
