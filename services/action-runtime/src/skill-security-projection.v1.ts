import { createHash } from "node:crypto";

import type {
  DurableEventConsumerDeadLetterPortV1,
  DurableInboxApplyResultV1,
  TransactionalInboxApplyPortV1,
} from "@pai/eventing";
import type { PostgresQueryPortV1 } from "@pai/persistence";

import type { RuntimePolicyCheckpointPortV1 } from "./runtime-execution.v1.js";

export interface RuntimeSkillSecurityProjectionOptionsV1 {
  readonly postgres: PostgresQueryPortV1;
  readonly stream_epoch: string;
  readonly stream_generation: number;
  readonly maximum_staleness_seconds?: number;
}

export interface RuntimeSkillSecurityProjectionV1 {
  readonly inbox: TransactionalInboxApplyPortV1;
  readonly dead_letter: DurableEventConsumerDeadLetterPortV1;
  readonly policy_checkpoints: RuntimePolicyCheckpointPortV1;
  markSynchronized(traceId: string, signal?: AbortSignal): Promise<void>;
  checkReadiness(signal: AbortSignal): Promise<void>;
}

interface ProjectionRowV1 extends Record<string, unknown> {
  readonly security_revocation_epoch: string | number;
  readonly stream_epoch: string | null;
  readonly stream_generation: string | number | null;
  readonly synchronized_at: Date | string | null;
  readonly database_now: Date | string;
}

const identifierPatternV1 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;
const MAX_SAFE_BIGINT_V1 = BigInt(Number.MAX_SAFE_INTEGER);

function safeIntegerV1(value: unknown, label: string): number {
  let parsed: bigint;
  try {
    parsed = typeof value === "bigint" ? value : BigInt(String(value));
  } catch {
    throw new Error(`${label} is not an integer`);
  }
  if (parsed < 0n || parsed > MAX_SAFE_BIGINT_V1) {
    throw new Error(`${label} is outside the safe-integer boundary`);
  }
  return Number(parsed);
}

function isoV1(value: unknown, label: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid`);
  return date.toISOString();
}

function applyResultV1(value: unknown): DurableInboxApplyResultV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    typeof (value as { status?: unknown }).status !== "string"
  ) {
    throw new Error("Runtime skill projection writer returned an invalid result");
  }
  const result = value as Readonly<Record<string, unknown>>;
  if (
    (result.status === "processed" || result.status === "replayed") &&
    Object.keys(result).length === 1
  ) {
    return Object.freeze({ status: result.status });
  }
  if (
    result.status === "isolated" &&
    result.isolation_code === "durable_inbox_identity_conflict" &&
    typeof result.isolation_ref === "string" &&
    result.isolation_ref.length > 0 &&
    Object.keys(result).length === 3
  ) {
    return Object.freeze({
      status: "isolated" as const,
      isolation_code: "durable_inbox_identity_conflict" as const,
      isolation_ref: result.isolation_ref,
    });
  }
  throw new Error("Runtime skill projection writer returned an invalid result");
}

function deadLetterIdV1(deliveryRef: string): string {
  return `runtime-consumer-dlq:${createHash("sha256").update(deliveryRef).digest("hex")}`;
}

export function createPostgresRuntimeSkillSecurityProjectionV1(
  options: RuntimeSkillSecurityProjectionOptionsV1,
): RuntimeSkillSecurityProjectionV1 {
  const maximumStalenessSeconds = options.maximum_staleness_seconds ?? 30;
  if (
    !identifierPatternV1.test(options.stream_epoch) ||
    !Number.isSafeInteger(options.stream_generation) ||
    options.stream_generation < 1 ||
    !Number.isSafeInteger(maximumStalenessSeconds) ||
    maximumStalenessSeconds < 1 ||
    maximumStalenessSeconds > 300
  ) {
    throw new Error("Runtime skill projection configuration is invalid");
  }

  async function currentRowV1(signal?: AbortSignal): Promise<Readonly<{
    epoch: number;
    synchronizedAt: string;
    databaseNow: string;
  }>> {
    signal?.throwIfAborted();
    const result = await options.postgres.query<ProjectionRowV1>(
      `SELECT security_revocation_epoch::text AS security_revocation_epoch,
              stream_epoch,
              stream_generation::text AS stream_generation,
              synchronized_at,
              pg_catalog.clock_timestamp() AS database_now
         FROM action_runtime.runtime_skill_security_projection
        WHERE singleton_key = 'global'`,
    );
    signal?.throwIfAborted();
    const row = result.rows[0];
    if (
      result.rows.length !== 1 ||
      row === undefined ||
      row.stream_epoch !== options.stream_epoch ||
      row.stream_generation === null ||
      safeIntegerV1(row.stream_generation, "stream_generation") !==
        options.stream_generation ||
      row.synchronized_at === null
    ) {
      throw new Error("Runtime skill security projection is not synchronized");
    }
    const synchronizedAt = isoV1(row.synchronized_at, "synchronized_at");
    const databaseNow = isoV1(row.database_now, "database_now");
    const ageMs = Date.parse(databaseNow) - Date.parse(synchronizedAt);
    if (ageMs < 0 || ageMs > maximumStalenessSeconds * 1_000) {
      throw new Error("Runtime skill security projection is stale");
    }
    return Object.freeze({
      epoch: safeIntegerV1(
        row.security_revocation_epoch,
        "security_revocation_epoch",
      ),
      synchronizedAt,
      databaseNow,
    });
  }

  const inbox: TransactionalInboxApplyPortV1 = Object.freeze({
    async apply(
      request: Parameters<TransactionalInboxApplyPortV1["apply"]>[0],
    ) {
      const result = await options.postgres.query<{ result: unknown }>(
        `SELECT action_runtime.record_runtime_event_inbox_v1(
           $1::jsonb,$2::text,$3::text,$4::text,$5::text,$6::text
         ) AS result`,
        [
          request.envelope,
          request.idempotency_key,
          request.payload_hash,
          request.semantic_hash,
          request.scope_fingerprint,
          request.envelope.trace_id,
        ],
      );
      if (result.rows.length !== 1 || result.rows[0] === undefined) {
        throw new Error("Runtime skill projection writer returned no result");
      }
      return applyResultV1(result.rows[0].result);
    },
  });

  const deadLetter: DurableEventConsumerDeadLetterPortV1 = Object.freeze({
    async recordPermanentFailure(
      request: Parameters<
        DurableEventConsumerDeadLetterPortV1["recordPermanentFailure"]
      >[0],
    ) {
      const dlqId = deadLetterIdV1(request.delivery_ref);
      const traceId = request.envelope?.trace_id ?? dlqId;
      const payload = Object.freeze({
        schema_version: "runtime_consumer_dead_letter.v1",
        consumer_service: request.consumer_service,
        delivery_id: request.delivery_id,
        delivery_ref: request.delivery_ref,
        raw_fields: request.raw_fields,
        envelope: request.envelope,
        trace_id: traceId,
      });
      const lastError = Object.freeze({
        code: request.failure_code,
        message: request.failure_message,
      });
      const result = await options.postgres.query<{ result: unknown }>(
        `SELECT action_runtime.record_runtime_consumer_dead_letter_v1(
           $1::text,$2::text,$3::text,$4::jsonb,$5::jsonb,
           pg_catalog.clock_timestamp(),$6::text,$7::text
         ) AS result`,
        [
          dlqId,
          request.envelope?.event_id ?? request.delivery_ref,
          request.envelope?.event_type ?? "invalid_delivery",
          payload,
          lastError,
          request.delivery_ref,
          traceId,
        ],
      );
      const value = result.rows[0]?.result;
      if (
        result.rows.length !== 1 ||
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        Object.keys(value).length !== 1 ||
        ((value as { status?: unknown }).status !== "recorded" &&
          (value as { status?: unknown }).status !== "replayed")
      ) {
        throw new Error("Runtime consumer dead-letter writer returned an invalid result");
      }
      return Object.freeze({
        status: (value as { status: "recorded" | "replayed" }).status,
      });
    },
  });

  const policyCheckpoints: RuntimePolicyCheckpointPortV1 = Object.freeze({
    async check(
      request: Parameters<RuntimePolicyCheckpointPortV1["check"]>[0],
      signal?: AbortSignal,
    ) {
      signal?.throwIfAborted();
      const projection = await currentRowV1(signal);
      if (projection.epoch < request.expected_security_revocation_epoch) {
        throw new Error("Runtime skill security projection regressed");
      }
      const status =
        projection.epoch > request.expected_security_revocation_epoch
          ? ("security_revocation_epoch_advanced" as const)
          : Date.parse(request.policy_expires_at) <= Date.parse(request.checked_at)
            ? ("runtime_policy_expired" as const)
            : ("valid" as const);
      return Object.freeze({
        schema_version: "runtime_policy_checkpoint_result.v1" as const,
        checkpoint: request.checkpoint,
        runtime_run_id: request.runtime_run_id,
        policy_snapshot_id: request.policy_snapshot_id,
        status,
        expected_security_revocation_epoch:
          request.expected_security_revocation_epoch,
        current_security_revocation_epoch: projection.epoch,
        checked_at: request.checked_at,
      });
    },
  });

  return Object.freeze({
    inbox,
    dead_letter: deadLetter,
    policy_checkpoints: policyCheckpoints,
    async markSynchronized(traceId: string, signal?: AbortSignal) {
      if (!identifierPatternV1.test(traceId)) {
        throw new Error("Runtime skill projection synchronization trace_id is invalid");
      }
      signal?.throwIfAborted();
      const result = await options.postgres.query<{ result: unknown }>(
        `SELECT action_runtime.touch_runtime_skill_security_projection_v1(
           'global',$1::text,$2::bigint,$3::text
         ) AS result`,
        [options.stream_epoch, String(options.stream_generation), traceId],
      );
      signal?.throwIfAborted();
      const value = result.rows[0]?.result;
      if (
        result.rows.length !== 1 ||
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        (value as { status?: unknown }).status !== "synchronized" ||
        (value as { stream_epoch?: unknown }).stream_epoch !==
          options.stream_epoch ||
        safeIntegerV1(
          (value as { stream_generation?: unknown }).stream_generation,
          "stream_generation",
        ) !== options.stream_generation
      ) {
        throw new Error("Runtime skill projection synchronization was not committed");
      }
    },
    async checkReadiness(signal: AbortSignal) {
      await currentRowV1(signal);
    },
  });
}
