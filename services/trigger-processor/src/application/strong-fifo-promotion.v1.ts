import { createHash } from "node:crypto";

import { canonicalJsonV1 } from "@pai/eventing";

import type { TriggerProcessorOwnerDatabaseV1 } from "./trigger-admission.v1.js";

export interface StrongFifoPromotionCandidateV1 {
  readonly bot_id: string;
  readonly slot_process_id: string | null;
  readonly slot_generation: number;
  readonly strong_fifo_revision: number;
  readonly head_process_id: string;
  readonly head_admission_time: string;
  readonly head_phase: "admission";
  readonly head_status: "waiting";
  readonly head_state_version: number;
  readonly head_updated_at: string;
  readonly preempt_commit_result: null;
  readonly accepted_trace_id: string;
}

export interface StrongFifoPromotionRepositoryV1 {
  listEligible(
    limit: number,
    signal: AbortSignal,
  ): Promise<readonly StrongFifoPromotionCandidateV1[]>;
}

export interface StrongFifoPromotionRunResultV1 {
  readonly claimed: number;
  readonly completed: number;
  readonly retried: number;
  readonly failed: number;
  readonly lease_expired: number;
  readonly promoted: number;
  readonly raced: number;
}

export interface StrongFifoPromotionWorkerV1 {
  runOnce(): Promise<StrongFifoPromotionRunResultV1>;
}

function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJsonV1(value)).digest("hex")}`;
}

function isIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\r\n]/u.test(value)
  );
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validCandidate(
  candidate: StrongFifoPromotionCandidateV1,
): boolean {
  return (
    isIdentity(candidate.bot_id) &&
    (candidate.slot_process_id === null || isIdentity(candidate.slot_process_id)) &&
    Number.isSafeInteger(candidate.slot_generation) &&
    candidate.slot_generation >= 0 &&
    Number.isSafeInteger(candidate.strong_fifo_revision) &&
    candidate.strong_fifo_revision >= 1 &&
    isIdentity(candidate.head_process_id) &&
    isTimestamp(candidate.head_admission_time) &&
    candidate.head_phase === "admission" &&
    candidate.head_status === "waiting" &&
    Number.isSafeInteger(candidate.head_state_version) &&
    candidate.head_state_version >= 1 &&
    isTimestamp(candidate.head_updated_at) &&
    candidate.preempt_commit_result === null &&
    isIdentity(candidate.accepted_trace_id)
  );
}

function isPromotionRace(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as Readonly<{ code?: unknown }>).code === "40001"
  );
}

function assertPromotionResponse(
  value: unknown,
  candidate: StrongFifoPromotionCandidateV1,
): void {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as Readonly<Record<string, unknown>>).applied !== true ||
    (value as Readonly<Record<string, unknown>>).writer !==
      "promote_strong_fifo_head_v1" ||
    (value as Readonly<Record<string, unknown>>).process_id !==
      candidate.head_process_id
  ) {
    throw new Error("Strong FIFO promotion writer violated its response contract");
  }
}

/**
 * Promotions deliberately have no lease or claim row.  The repository read is
 * advisory; the owner writer locks the slot and FIFO head then rechecks every
 * observed fence in one transaction.  A race therefore means another worker
 * safely won, rather than a retryable side effect.
 */
export function createStrongFifoPromotionWorkerV1(
  repository: StrongFifoPromotionRepositoryV1,
  database: TriggerProcessorOwnerDatabaseV1,
  config: Readonly<{ batch_size?: number }>,
): StrongFifoPromotionWorkerV1 {
  const batchSize = config.batch_size ?? 16;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 16) {
    throw new Error("Strong FIFO promotion worker configuration is invalid");
  }

  return Object.freeze({
    async runOnce() {
      const candidates = await repository.listEligible(
        batchSize,
        new AbortController().signal,
      );
      if (candidates.length > batchSize) {
        throw new Error("Strong FIFO promotion repository exceeded its limit");
      }
      const outcomes = await Promise.allSettled(
        candidates.map(async (candidate) => {
          if (!validCandidate(candidate)) {
            throw new Error("Strong FIFO promotion candidate is invalid");
          }
          const nextSlotGeneration = candidate.slot_generation + 1;
          if (!Number.isSafeInteger(nextSlotGeneration)) {
            throw new Error("Strong FIFO promotion slot generation is exhausted");
          }
          const requestHash = sha256({
            writer: "promote_strong_fifo_head_v1",
            bot_id: candidate.bot_id,
            expected_slot_fence: {
              process_id: candidate.slot_process_id,
              slot_generation: candidate.slot_generation,
            },
            expected_strong_fifo_revision: candidate.strong_fifo_revision,
            expected_head_process_id: candidate.head_process_id,
            expected_head_admission_time: candidate.head_admission_time,
            expected_head_updated_at: candidate.head_updated_at,
            next_slot_generation: nextSlotGeneration,
            trace_id: candidate.accepted_trace_id,
          });
          try {
            const response = await database.unit_of_work.withTransaction(
              {
                operation: "promote_strong_fifo_head",
                idempotency_key:
                  `${candidate.head_process_id}:${candidate.head_state_version}:strong-fifo`,
                trace_id: candidate.accepted_trace_id,
                isolation: "serializable",
                retry: "serialization_failures",
              },
              async (transaction, { owner }) =>
                owner.executeWriter(transaction, {
                  writer: "promote_strong_fifo_head_v1",
                  arguments: {
                    p_bot_id: candidate.bot_id,
                    p_expected_slot_fence: {
                      process_id: candidate.slot_process_id,
                      slot_generation: candidate.slot_generation,
                    },
                    p_expected_strong_fifo_revision:
                      String(candidate.strong_fifo_revision),
                    p_expected_head_process_id: candidate.head_process_id,
                    p_expected_head_admission_time: candidate.head_admission_time,
                    p_strong_fifo_head_lock_ref:
                      `strong-fifo-head:${candidate.bot_id}:${candidate.head_process_id}:${candidate.head_state_version}`,
                    p_expected_preempt_commit_fence: {
                      process_id: candidate.head_process_id,
                      phase: candidate.head_phase,
                      status: candidate.head_status,
                      preempt_commit_result: null,
                      state_version: candidate.head_state_version,
                      updated_at: candidate.head_updated_at,
                    },
                    p_expected_head_phase: candidate.head_phase,
                    p_expected_head_status: candidate.head_status,
                    p_expected_head_updated_at: candidate.head_updated_at,
                    p_next_slot_generation: String(nextSlotGeneration),
                    p_evidence: {},
                    p_command: {},
                    p_request_hash: requestHash,
                    p_trace_id: candidate.accepted_trace_id,
                  },
                  expected_rows: 1,
                }),
            );
            assertPromotionResponse(response, candidate);
            return "promoted" as const;
          } catch (error) {
            if (isPromotionRace(error)) return "raced" as const;
            throw error;
          }
        }),
      );
      const rejected = outcomes.find(
        (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
      );
      if (rejected !== undefined) throw rejected.reason;
      const values = outcomes.map(
        (outcome) =>
          (outcome as PromiseFulfilledResult<"promoted" | "raced">).value,
      );
      return Object.freeze({
        claimed: candidates.length,
        completed: values.filter((value) => value === "promoted").length,
        retried: 0,
        failed: 0,
        lease_expired: 0,
        promoted: values.filter((value) => value === "promoted").length,
        raced: values.filter((value) => value === "raced").length,
      });
    },
  });
}
