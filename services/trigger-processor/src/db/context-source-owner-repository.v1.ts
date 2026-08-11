import { canonicalJsonV1 } from "@pai/eventing";
import type { PostgresQueryPortV1 } from "@pai/persistence";

import type {
  ContextSourceAdaptersV1,
} from "../application/trigger-lifecycle.v1.js";
import type {
  ContextComposeRequestV1,
  IntentSynthesizeRequestV1,
} from "@pai/contracts";

interface ContextOwnerRowV1 extends Record<string, unknown> {
  readonly trigger_id: string;
  readonly trigger_source: string;
  readonly trigger_payload: unknown;
  readonly trigger_received_at: Date | string;
  readonly process_state_version: string | number;
  readonly process_updated_at: Date | string;
  readonly bot_timezone: string;
  readonly bot_updated_at: Date | string;
}

interface HistoryOwnerRowV1 extends Record<string, unknown> {
  readonly event_id: string;
  readonly append_sequence_no: string | number;
  readonly observation_summary: unknown;
  readonly occurred_at: Date | string;
}

export interface TriggerContextOwnerSourcePortV1 {
  readQuery(
    request: ContextComposeRequestV1,
    signal: AbortSignal,
  ): Promise<string>;
  readIntentInput(
    request: IntentSynthesizeRequestV1,
    signal: AbortSignal,
  ): Promise<Readonly<{
    trigger_ref: string;
    source: "chat" | "notification" | "timer";
    received_at: string;
    payload: unknown;
  }>>;
  readonly local_sources: Pick<ContextSourceAdaptersV1, "environment" | "history">;
}

function timestampV1(value: Date | string, label: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} timestamp is invalid`);
  return date.toISOString();
}

function positiveSafeIntegerV1(value: string | number, label: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} is outside JavaScript bounds`);
  }
  return parsed;
}

function textV1(value: unknown, label: string, maximum = 512): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    /[\r\n]/u.test(value)
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function triggerSourceV1(value: unknown): "chat" | "notification" | "timer" {
  const source = textV1(value, "Trigger intent source");
  if (source !== "chat" && source !== "notification" && source !== "timer") {
    throw new Error("Trigger intent source is invalid");
  }
  return source;
}

function contextQueryV1(payload: unknown): string {
  const canonical = canonicalJsonV1(payload, {
    max_bytes: 16_384,
    max_depth: 32,
    max_nodes: 10_000,
    max_container_entries: 2_000,
  });
  if (Buffer.byteLength(canonical, "utf8") < 1) {
    throw new Error("Trigger payload query is empty");
  }
  return canonical;
}

function intentPayloadV1(payload: unknown): unknown {
  const canonical = canonicalJsonV1(payload, {
    max_bytes: 524_288,
    max_depth: 64,
    max_nodes: 100_000,
    max_container_entries: 10_000,
  });
  return JSON.parse(canonical) as unknown;
}

function summaryV1(value: unknown): string {
  const canonical = canonicalJsonV1(value, {
    max_bytes: 16_384,
    max_depth: 32,
    max_nodes: 10_000,
    max_container_entries: 2_000,
  });
  if (Buffer.byteLength(canonical, "utf8") < 1) {
    throw new Error("Trigger history summary is empty");
  }
  return canonical;
}

/**
 * The Trigger owner is the only component permitted to read Trigger payloads,
 * Bot settings, and durable projection history.  External context adapters
 * receive a bounded query string rather than a database port.
 */
export function createTriggerContextOwnerSourcePortV1(
  postgres: PostgresQueryPortV1,
): TriggerContextOwnerSourcePortV1 {
  const readOwner = async (
    request: ContextComposeRequestV1,
    signal: AbortSignal,
  ): Promise<ContextOwnerRowV1> => {
    signal.throwIfAborted();
    const result = await postgres.query<ContextOwnerRowV1>(
      `SELECT p.trigger_id,
              t.source AS trigger_source,
              t.payload AS trigger_payload,
              t.received_at AS trigger_received_at,
              p.state_version AS process_state_version,
              p.updated_at AS process_updated_at,
              b.timezone AS bot_timezone,
              b.updated_at AS bot_updated_at
         FROM trigger_processor.trigger_processes AS p
         JOIN trigger_processor.triggers AS t
           ON t.id = p.trigger_id
         JOIN trigger_processor.bots AS b
           ON b.id = p.bot_id
          AND b.workspace_id = p.workspace_id
          AND b.owner_agent_id = p.owner_agent_id
          AND b.deployment_environment = p.deployment_environment
          AND b.release_channel = p.release_channel
        WHERE p.id = $1::text
          AND p.trigger_id = $2::text
          AND p.workspace_id = $3::text
          AND p.bot_id = $4::text
          AND p.owner_agent_id = $5::text
          AND p.deployment_environment = $6::text
          AND p.release_channel = $7::text
        LIMIT 2`,
      [
        request.trigger_process_id,
        request.trigger.trigger_id,
        request.workspace_id,
        request.bot_id,
        request.owner_agent_id,
        request.deployment_environment,
        request.release_channel,
      ],
    );
    signal.throwIfAborted();
    if (result.rows.length !== 1) {
      throw new Error("Trigger context owner identity was not found exactly once");
    }
    const row = result.rows[0]!;
    if (
      textV1(row.trigger_id, "Trigger context trigger id") !== request.trigger.trigger_id ||
      textV1(row.trigger_source, "Trigger context source") !== request.trigger.source ||
      !Number.isSafeInteger(Number(row.process_state_version)) ||
      Number(row.process_state_version) < 1
    ) {
      throw new Error("Trigger context owner row is invalid");
    }
    timestampV1(row.trigger_received_at, "Trigger received");
    timestampV1(row.process_updated_at, "Trigger process updated");
    timestampV1(row.bot_updated_at, "Trigger bot updated");
    textV1(row.bot_timezone, "Trigger bot timezone", 128);
    return row;
  };

  return Object.freeze({
    async readQuery(request: ContextComposeRequestV1, signal: AbortSignal) {
      return contextQueryV1((await readOwner(request, signal)).trigger_payload);
    },
    async readIntentInput(request: IntentSynthesizeRequestV1, signal: AbortSignal) {
      signal.throwIfAborted();
      const result = await postgres.query<ContextOwnerRowV1>(
        `SELECT p.trigger_id,
                t.source AS trigger_source,
                t.payload AS trigger_payload,
                t.received_at AS trigger_received_at,
                p.state_version AS process_state_version,
                p.updated_at AS process_updated_at,
                b.timezone AS bot_timezone,
                b.updated_at AS bot_updated_at
           FROM trigger_processor.trigger_processes AS p
           JOIN trigger_processor.triggers AS t ON t.id = p.trigger_id
           JOIN trigger_processor.bots AS b
             ON b.id = p.bot_id
            AND b.workspace_id = p.workspace_id
            AND b.owner_agent_id = p.owner_agent_id
            AND b.deployment_environment = p.deployment_environment
            AND b.release_channel = p.release_channel
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
      signal.throwIfAborted();
      if (result.rows.length !== 1) {
        throw new Error("Trigger intent input owner identity was not found exactly once");
      }
      const row = result.rows[0]!;
      const triggerId = textV1(row.trigger_id, "Trigger intent trigger id");
      const ownerRef = `trigger:${triggerId}`;
      if (request.trigger_ref !== ownerRef) {
        throw new Error("Trigger intent input trigger_ref does not match owner process");
      }
      return Object.freeze({
        trigger_ref: ownerRef,
        source: triggerSourceV1(row.trigger_source),
        received_at: timestampV1(row.trigger_received_at, "Trigger received"),
        payload: intentPayloadV1(row.trigger_payload),
      });
    },
    local_sources: Object.freeze({
      environment: Object.freeze({
        async fetch(request: ContextComposeRequestV1, signal: AbortSignal) {
          const row = await readOwner(request, signal);
          const asOf = timestampV1(row.bot_updated_at, "Trigger bot updated");
          const stateVersion = positiveSafeIntegerV1(
            row.process_state_version,
            "Trigger process state version",
          );
          return {
            source_as_of: asOf,
            source_version: `bot:${request.bot_id}:process:${stateVersion}`,
            environment: {
              captured_at: asOf,
              channel: textV1(row.trigger_source, "Trigger source"),
              timezone: textV1(row.bot_timezone, "Trigger bot timezone", 128),
              capability_summary_ref: `bot-capability-summary:${request.bot_id}:${stateVersion}`,
            },
          };
        },
      }),
      history: Object.freeze({
        async fetch(request: ContextComposeRequestV1, signal: AbortSignal) {
          const row = await readOwner(request, signal);
          signal.throwIfAborted();
          const result = await postgres.query<HistoryOwnerRowV1>(
            `SELECT event_id, append_sequence_no, observation_summary, occurred_at
               FROM trigger_processor.trigger_process_event_projections
              WHERE trigger_process_id = $1::text
              ORDER BY append_sequence_no DESC
              LIMIT 100`,
            [request.trigger_process_id],
          );
          signal.throwIfAborted();
          const stateVersion = positiveSafeIntegerV1(
            row.process_state_version,
            "Trigger process state version",
          );
          const history = result.rows
            .map((entry) => {
              const eventId = textV1(entry.event_id, "Trigger history event id");
              const sequence = positiveSafeIntegerV1(
                entry.append_sequence_no,
                "Trigger history append sequence",
              );
              timestampV1(entry.occurred_at, "Trigger history occurrence");
              return {
                ref: `trigger-event:${eventId}`,
                version: `trigger-projection:${sequence}`,
                summary: summaryV1(entry.observation_summary),
              };
            })
            .reverse();
          return {
            source_as_of: timestampV1(
              row.process_updated_at,
              "Trigger process updated",
            ),
            source_version: `trigger-process:${request.trigger_process_id}:${stateVersion}`,
            history,
          };
        },
      }),
    }),
  });
}
