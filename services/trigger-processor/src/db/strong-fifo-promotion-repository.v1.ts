import type { PostgresQueryPortV1 } from "@pai/persistence";

import type {
  StrongFifoPromotionCandidateV1,
  StrongFifoPromotionRepositoryV1,
} from "../application/strong-fifo-promotion.v1.js";

interface StrongFifoPromotionRowV1 extends Record<string, unknown> {
  readonly bot_id: string;
  readonly slot_process_id: string | null;
  readonly slot_generation: string;
  readonly strong_fifo_revision: string;
  readonly head_process_id: string;
  readonly head_admission_time: string;
  readonly head_phase: "admission";
  readonly head_status: "waiting";
  readonly head_state_version: string;
  readonly head_updated_at: string;
  readonly accepted_trace_id: string;
}

function safeInteger(value: unknown, label: string): number {
  if (
    typeof value !== "string" ||
    !/^(?:0|[1-9][0-9]*)$/u.test(value) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw new Error(`${label} is invalid`);
  }
  return Number(value);
}

function timestamp(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

/**
 * This read never claims or updates a queue row.  The owner writer takes the
 * real locks and fences all of these values before promotion.
 */
export function createStrongFifoPromotionRepositoryV1(
  postgres: PostgresQueryPortV1,
): StrongFifoPromotionRepositoryV1 {
  return Object.freeze({
    async listEligible(limit: number, signal: AbortSignal) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 16) {
        throw new Error("Strong FIFO promotion limit is invalid");
      }
      signal.throwIfAborted();
      const result = await postgres.query<StrongFifoPromotionRowV1>(
        `WITH queued AS (
           SELECT process.id,
                  process.trigger_id,
                  process.bot_id,
                  process.admission_time,
                  process.phase,
                  process.status,
                  process.updated_at,
                  process.state_version,
                  process.preempt_commit_result,
                  process.priority,
                  row_number() OVER (
                    PARTITION BY process.bot_id
                    ORDER BY process.admission_time ASC, process.id ASC
                  ) AS fifo_position,
                  max(process.state_version) OVER (
                    PARTITION BY process.bot_id
                  ) AS fifo_revision
             FROM trigger_processor.trigger_processes AS process
            WHERE process.phase = 'admission'
              AND process.status = 'waiting'
              AND process.wait_reason = 'deferred_strong_queue'
              AND process.priority = 'strong'
              AND process.preempt_commit_result IS NULL
         )
         SELECT head.bot_id,
                slot.process_id AS slot_process_id,
                slot.slot_generation::text AS slot_generation,
                head.fifo_revision::text AS strong_fifo_revision,
                head.id AS head_process_id,
                pg_catalog.to_char(
                  head.admission_time AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) AS head_admission_time,
                head.phase AS head_phase,
                head.status AS head_status,
                head.state_version::text AS head_state_version,
                pg_catalog.to_char(
                  head.updated_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) AS head_updated_at,
                accepted.trace_id AS accepted_trace_id
           FROM queued AS head
           JOIN trigger_processor.bot_foreground_slots AS slot
             ON slot.bot_id = head.bot_id
           LEFT JOIN trigger_processor.trigger_processes AS holder
             ON holder.id = slot.process_id
           JOIN LATERAL (
             SELECT event.trace_id
               FROM trigger_processor.trigger_event_outbox AS event
              WHERE event.aggregate_id = head.trigger_id
                AND event.event_type = 'trigger.accepted'
                AND event.payload ->> 'trigger_process_id' = head.id
              ORDER BY event.created_at ASC, event.id ASC
              LIMIT 1
           ) AS accepted ON true
          WHERE head.fifo_position = 1
            AND (holder.id IS NULL OR holder.phase = 'closed')
          ORDER BY head.admission_time ASC, head.id ASC
          LIMIT $1::integer`,
        [limit],
      );
      signal.throwIfAborted();
      return Object.freeze(
        result.rows.map((row): StrongFifoPromotionCandidateV1 => {
          if (
            typeof row.bot_id !== "string" ||
            row.bot_id.length === 0 ||
            (row.slot_process_id !== null &&
              (typeof row.slot_process_id !== "string" ||
                row.slot_process_id.length === 0)) ||
            typeof row.head_process_id !== "string" ||
            row.head_process_id.length === 0 ||
            row.head_phase !== "admission" ||
            row.head_status !== "waiting" ||
            typeof row.accepted_trace_id !== "string" ||
            row.accepted_trace_id.length === 0
          ) {
            throw new Error("Strong FIFO promotion row is invalid");
          }
          return Object.freeze({
            bot_id: row.bot_id,
            slot_process_id: row.slot_process_id,
            slot_generation: safeInteger(row.slot_generation, "slot generation"),
            strong_fifo_revision: safeInteger(
              row.strong_fifo_revision,
              "Strong FIFO revision",
            ),
            head_process_id: row.head_process_id,
            head_admission_time: timestamp(
              row.head_admission_time,
              "head admission time",
            ),
            head_phase: "admission",
            head_status: "waiting",
            head_state_version: safeInteger(
              row.head_state_version,
              "head state version",
            ),
            head_updated_at: timestamp(row.head_updated_at, "head updated at"),
            preempt_commit_result: null,
            accepted_trace_id: row.accepted_trace_id,
          });
        }),
      );
    },
  });
}
