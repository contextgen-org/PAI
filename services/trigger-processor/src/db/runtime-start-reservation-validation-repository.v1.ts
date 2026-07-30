import { types as nodeUtilTypes } from "node:util";

import type {
  PostgresReadCommittedTransactionPortV1,
  PostgresReadCommittedTransactionV1,
} from "@pai/persistence";

import type {
  RuntimeStartReservationStatusV1,
  RuntimeStartReservationValidationRepositoryV1,
  RuntimeStartReservationValidationRowV1,
} from "../application/runtime-start-reservation-validation.v1.js";

interface ReservationRowV1 extends Record<string, unknown> {
  readonly trigger_process_id: string;
  readonly reserved_runtime_run_id: string;
  readonly start_attempt_no: string | number;
  readonly start_fence_generation: string | number;
  readonly start_fence_token_hash: string;
  readonly request_hash: string;
  readonly status: RuntimeStartReservationStatusV1;
  readonly current_runtime_run_id: string | null;
  readonly process_phase: string;
  readonly process_status: string;
  readonly is_current_fence: boolean;
  readonly has_tombstone: boolean;
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
}

export interface RuntimeStartReservationValidationPostgresPortV1
  extends PostgresReadCommittedTransactionPortV1 {
  /**
   * Uses one checked-out client. READ COMMITTED gives the owner read a new
   * statement snapshot after the shared owner-writer fences have been won.
   * The process lock serializes cancellation with every attempt; the second
   * lock preserves exact process/attempt ordering for competing starts and
   * validators. Every participant takes them coarse-to-exact.
   */
  withReadCommittedTransaction<TResult>(
    work: (
      transaction: PostgresReadCommittedTransactionV1,
    ) => Promise<TResult>,
  ): Promise<TResult>;
}

const statuses = new Set<RuntimeStartReservationStatusV1>([
  "reserved",
  "dispatching",
  "queued",
  "started",
  "failed",
  "cancel_requested",
  "cancelled_before_dispatch",
  "cancelled_after_dispatch",
  "completed",
]);

export const RUNTIME_START_RESERVATION_PROCESS_LOCK_SQL_V1 =
  `SELECT pg_catalog.pg_advisory_xact_lock(
     pg_catalog.hashtextextended(
       'trigger_processor:runtime_start_reservation_process:'::pg_catalog.text
         || $1::pg_catalog.text,
       0
     )
   ) AS acquired`;

export const RUNTIME_START_RESERVATION_ATTEMPT_LOCK_SQL_V1 =
  `SELECT pg_catalog.pg_advisory_xact_lock(
     pg_catalog.hashtextextended(
       'trigger_processor:runtime_start_reservation:'::pg_catalog.text
         || $1::pg_catalog.text
         || ':'::pg_catalog.text
         || $2::pg_catalog.text,
       0
     )
   ) AS acquired`;

function positiveSafeInteger(value: string | number, field: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${field} exceeds the Runtime Start wire integer range`);
  }
  return parsed;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 512;
}

function captureReadCommittedTransactionV1(
  postgres: RuntimeStartReservationValidationPostgresPortV1,
): PostgresReadCommittedTransactionPortV1["withReadCommittedTransaction"] {
  if (
    typeof postgres !== "object" ||
    postgres === null ||
    nodeUtilTypes.isProxy(postgres)
  ) {
    throw new Error(
      "Runtime Start validation PostgreSQL port must be a non-Proxy object",
    );
  }
  let current: object | null = postgres;
  for (let depth = 0; current !== null && depth < 16; depth += 1) {
    if (nodeUtilTypes.isProxy(current)) {
      throw new Error(
        "Runtime Start validation PostgreSQL port has a Proxy prototype boundary",
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      current,
      "withReadCommittedTransaction",
    );
    if (descriptor !== undefined) {
      if (
        !("value" in descriptor) ||
        typeof descriptor.value !== "function" ||
        nodeUtilTypes.isProxy(descriptor.value)
      ) {
        throw new Error(
          "Runtime Start validation PostgreSQL port must expose withReadCommittedTransaction as a data method",
        );
      }
      const method =
        descriptor.value as PostgresReadCommittedTransactionPortV1["withReadCommittedTransaction"];
      return <TResult>(
        work: (
          transaction: PostgresReadCommittedTransactionV1,
        ) => Promise<TResult>,
      ): Promise<TResult> => Reflect.apply(method, postgres, [work]);
    }
    current = Object.getPrototypeOf(current);
  }
  throw new Error(
    "Runtime Start validation PostgreSQL port is missing withReadCommittedTransaction",
  );
}

function snapshotReadRequestV1(
  request: Readonly<{
    trigger_process_id: string;
    start_attempt_no: number;
  }>,
): Readonly<{
  trigger_process_id: string;
  start_attempt_no: number;
}> {
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    if (nodeUtilTypes.isProxy(request)) {
      throw new Error("Proxy request");
    }
    prototype = Object.getPrototypeOf(request);
    descriptors = Object.getOwnPropertyDescriptors(request);
  } catch {
    throw new Error("Runtime Start validation read request is invalid");
  }
  const keys = Reflect.ownKeys(descriptors);
  const processDescriptor = descriptors.trigger_process_id;
  const attemptDescriptor = descriptors.start_attempt_no;
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.length !== 2 ||
    keys.some(
      (key) => key !== "trigger_process_id" && key !== "start_attempt_no",
    ) ||
    processDescriptor === undefined ||
    !("value" in processDescriptor) ||
    processDescriptor.enumerable !== true ||
    attemptDescriptor === undefined ||
    !("value" in attemptDescriptor) ||
    attemptDescriptor.enumerable !== true ||
    !nonBlank(processDescriptor.value) ||
    !Number.isSafeInteger(attemptDescriptor.value) ||
    (attemptDescriptor.value as number) < 1
  ) {
    throw new Error("Runtime Start validation read request is invalid");
  }
  return Object.freeze({
    trigger_process_id: processDescriptor.value,
    start_attempt_no: attemptDescriptor.value as number,
  });
}

export function createRuntimeStartReservationValidationRepositoryV1(
  postgres: RuntimeStartReservationValidationPostgresPortV1,
): RuntimeStartReservationValidationRepositoryV1 {
  const withReadCommittedTransaction =
    captureReadCommittedTransactionV1(postgres);
  return Object.freeze({
    async withLockedExactReservation(
      request: Parameters<
        RuntimeStartReservationValidationRepositoryV1["withLockedExactReservation"]
      >[0],
      inspect: Parameters<
        RuntimeStartReservationValidationRepositoryV1["withLockedExactReservation"]
      >[1],
    ) {
      if (
        typeof inspect !== "function" ||
        nodeUtilTypes.isProxy(inspect)
      ) {
        throw new Error(
          "Runtime Start validation inspector must be a non-Proxy function",
        );
      }
      const requestSnapshot = snapshotReadRequestV1(request);
      return withReadCommittedTransaction(
        async (transaction) => {
          await transaction.query(
            RUNTIME_START_RESERVATION_PROCESS_LOCK_SQL_V1,
            [requestSnapshot.trigger_process_id],
          );
          await transaction.query(
            RUNTIME_START_RESERVATION_ATTEMPT_LOCK_SQL_V1,
            [
              requestSnapshot.trigger_process_id,
              requestSnapshot.start_attempt_no,
            ],
          );
          const result = await transaction.query<ReservationRowV1>(
            `SELECT
           r.trigger_process_id,
           r.reserved_runtime_run_id,
           r.start_attempt_no,
           r.start_fence_generation,
           r.start_fence_token_hash,
           r.request_hash,
           r.status,
           p.current_runtime_run_id,
           p.phase AS process_phase,
           p.status AS process_status,
           (
             NOT EXISTS (
               SELECT 1
               FROM trigger_processor.runtime_start_reservations AS newer
               WHERE newer.trigger_process_id = r.trigger_process_id
                 AND (
                   newer.start_fence_generation > r.start_fence_generation
                   OR (
                     newer.start_fence_generation = r.start_fence_generation
                     AND newer.start_attempt_no > r.start_attempt_no
                   )
                 )
             )
           ) AS is_current_fence,
           (
             r.cancel_requested_at IS NOT NULL
             OR r.cancelled_at IS NOT NULL
             OR p.cancel_requested_at IS NOT NULL
             OR p.cancellation_status <> 'none'
             OR p.runtime_cancel_signal_id IS NOT NULL
           ) AS has_tombstone,
           p.workspace_id,
           p.bot_id,
           p.owner_agent_id,
           p.deployment_environment,
           p.release_channel
         FROM trigger_processor.runtime_start_reservations AS r
         JOIN trigger_processor.trigger_processes AS p
           ON p.id = r.trigger_process_id
         WHERE r.trigger_process_id = $1::text
           AND r.start_attempt_no = $2::bigint
         `,
            [
              requestSnapshot.trigger_process_id,
              requestSnapshot.start_attempt_no,
            ],
          );
          if (result.rows.length === 0) {
            return inspect(
              Object.freeze({ outcome: "not_found" as const }),
            );
          }
          if (result.rows.length !== 1) {
            throw new Error("Runtime Start reservation selector is not unique");
          }
          const row = result.rows[0]!;
          if (
            !nonBlank(row.trigger_process_id) ||
            !nonBlank(row.reserved_runtime_run_id) ||
            !nonBlank(row.start_fence_token_hash) ||
            !nonBlank(row.request_hash) ||
            (row.current_runtime_run_id !== null &&
              !nonBlank(row.current_runtime_run_id)) ||
            !nonBlank(row.process_phase) ||
            !nonBlank(row.process_status) ||
            typeof row.is_current_fence !== "boolean" ||
            typeof row.has_tombstone !== "boolean" ||
            !nonBlank(row.workspace_id) ||
            !nonBlank(row.bot_id) ||
            !nonBlank(row.owner_agent_id) ||
            !statuses.has(row.status) ||
            !["local", "dev", "staging", "prod"].includes(
              row.deployment_environment,
            ) ||
            !["stable", "canary"].includes(row.release_channel)
          ) {
            throw new Error("Runtime Start reservation owner row is invalid");
          }
          const reservation: RuntimeStartReservationValidationRowV1 =
            Object.freeze({
              trigger_process_id: row.trigger_process_id,
              runtime_run_id: row.reserved_runtime_run_id,
              start_attempt_no: positiveSafeInteger(
                row.start_attempt_no,
                "start_attempt_no",
              ),
              start_fence_generation: positiveSafeInteger(
                row.start_fence_generation,
                "start_fence_generation",
              ),
              start_fence_token_hash: row.start_fence_token_hash,
              request_hash: row.request_hash,
              status: row.status,
              current_runtime_run_id: row.current_runtime_run_id,
              process_phase: row.process_phase,
              process_status: row.process_status,
              is_current_fence: row.is_current_fence,
              has_tombstone: row.has_tombstone,
              workspace_id: row.workspace_id,
              bot_id: row.bot_id,
              owner_agent_id: row.owner_agent_id,
              deployment_environment: row.deployment_environment,
              release_channel: row.release_channel,
            });
          return inspect(
            Object.freeze({
              outcome: "found" as const,
              reservation,
            }),
          );
        },
      );
    },
  });
}
