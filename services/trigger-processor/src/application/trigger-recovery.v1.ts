import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  TRIGGER_PROCESS_WORK_KINDS_V1,
  TriggerProcessWorkPayloadV1Schema,
  TriggerSnapshotRepairWorkV1Schema,
  assertTriggerProcessWorkPayloadBindingsV1,
  type ContextComposeRequestV1,
  type IntentSynthesizeRequestV1,
  type MetaJobCreateRequestV1,
  type RuntimeStartRequestV1,
  type TriggerProcessWorkKindV1,
  type TriggerProcessWorkPayloadV1,
  type TriggerSnapshotRepairWorkV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";

import type { TriggerProcessorOwnerDatabaseV1 } from "./trigger-admission.v1.js";
import type {
  TriggerLifecycleApplicationV1,
  TriggerProcessWorkClaimV1,
} from "./trigger-lifecycle.v1.js";

export const TRIGGER_PROCESS_RECOVERY_WORK_KINDS_V1 =
  TRIGGER_PROCESS_WORK_KINDS_V1;

export type TriggerProcessRecoveryWorkKindV1 = TriggerProcessWorkKindV1;

export interface TriggerProcessSnapshotRepairHandlerV1 {
  repair(
    claim: TriggerProcessRecoveryClaimV1,
    payload: TriggerSnapshotRepairWorkV1,
    signal: AbortSignal,
  ): Promise<void>;
}

export interface TriggerProcessRecoveryClaimV1 {
  readonly work_item_id: string;
  readonly trigger_process_id: string;
  readonly work_kind: TriggerProcessRecoveryWorkKindV1;
  readonly claim_token: string;
  readonly lease_owner: string;
  readonly lease_generation: number;
  readonly expected_process_state_version: number;
  readonly payload_hash: `sha256:${string}`;
  readonly database_now: string;
  readonly lease_until: string;
  readonly attempt_count: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface TriggerProcessRecoveryHandlerV1 {
  handle(
    claim: TriggerProcessRecoveryClaimV1,
    signal: AbortSignal,
  ): Promise<"owner_writer_committed">;
}

export interface TriggerProcessRecoveryRunResultV1 {
  readonly claimed: number;
  readonly completed: number;
  readonly retried: number;
  readonly failed: number;
  readonly lease_expired: number;
}

export interface TriggerProcessRecoveryWorkerV1 {
  runOnce(): Promise<TriggerProcessRecoveryRunResultV1>;
}

/**
 * A source-gap callback is intentionally retained by the producer until this
 * worker writes the owner-authoritative gap marker.  The read is advisory;
 * the pending row's status and updated_at remain the transition fence.
 */
export interface TriggerSnapshotGapRecoveryRepositoryV1 {
  listEligible(
    limit: number,
    signal: AbortSignal,
  ): Promise<readonly TriggerSnapshotGapRecoveryCandidateV1[]>;
}

export interface TriggerSnapshotGapRecoveryCandidateV1 {
  readonly pending_event_id: string;
  readonly status: "pending";
  readonly updated_at: string;
}

export interface TriggerSnapshotGapRecoveryRunResultV1
  extends TriggerProcessRecoveryRunResultV1 {
  readonly transitioned: number;
  readonly raced: number;
}

export interface TriggerSnapshotGapRecoveryWorkerV1 {
  runOnce(): Promise<TriggerSnapshotGapRecoveryRunResultV1>;
}

export interface TriggerProcessRecoveryRunnerV1 {
  start(): void;
  stop(): Promise<void>;
  readonly state: "idle" | "running" | "stopping" | "stopped";
}

function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJsonV1(value)).digest("hex")}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 512 &&
    !/[\r\n]/u.test(value)
  );
}

function canonicalRecoverySnapshotV1<T>(
  value: unknown,
  message: string,
): T {
  let snapshot: T;
  try {
    snapshot = JSON.parse(canonicalJsonV1(value)) as T;
  } catch (error) {
    throw new Error(message, { cause: error });
  }
  const pending: object[] = [];
  if (typeof snapshot === "object" && snapshot !== null) {
    pending.push(snapshot);
  }
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of Object.values(current)) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        !Object.isFrozen(entry)
      ) {
        pending.push(entry);
      }
    }
    Object.freeze(current);
  }
  return snapshot;
}

type ValidatedRecoveryClaimV1 =
  | Readonly<{
      kind: "processable";
      claim: TriggerProcessRecoveryClaimV1;
    }>
  | Readonly<{
      kind: "invalid_payload";
      claim: TriggerProcessRecoveryClaimV1;
    }>;

function validateClaims(
  value: unknown,
  limit: number,
): readonly ValidatedRecoveryClaimV1[] {
  const snapshot = canonicalRecoverySnapshotV1<unknown>(
    value,
    "Trigger Process recovery claim batch is invalid",
  );
  if (!Array.isArray(snapshot) || snapshot.length > limit) {
    throw new Error("Trigger Process recovery claim batch is invalid");
  }
  const identities = new Set<string>();
  const claims = snapshot.map((candidate): ValidatedRecoveryClaimV1 => {
    if (!isRecord(candidate)) {
      throw new Error("Trigger Process recovery claim is invalid");
    }
    const claim = candidate as unknown as TriggerProcessRecoveryClaimV1;
    if (
      !boundedIdentity(claim.work_item_id) ||
      !boundedIdentity(claim.trigger_process_id) ||
      !TRIGGER_PROCESS_RECOVERY_WORK_KINDS_V1.includes(claim.work_kind) ||
      !boundedIdentity(claim.claim_token) ||
      !boundedIdentity(claim.lease_owner) ||
      !Number.isSafeInteger(claim.lease_generation) ||
      claim.lease_generation < 1 ||
      !Number.isSafeInteger(claim.expected_process_state_version) ||
      claim.expected_process_state_version < 1 ||
      !/^sha256:[0-9a-f]{64}$/u.test(claim.payload_hash) ||
      !Number.isSafeInteger(claim.attempt_count) ||
      claim.attempt_count < 1 ||
      !isRecord(claim.payload) ||
      !Number.isFinite(Date.parse(claim.database_now)) ||
      !Number.isFinite(Date.parse(claim.lease_until)) ||
      Date.parse(claim.lease_until) <= Date.parse(claim.database_now) ||
      Object.keys(candidate).sort().join(",") !==
        "attempt_count,claim_token,database_now,expected_process_state_version,lease_generation,lease_owner,lease_until,payload,payload_hash,trigger_process_id,work_item_id,work_kind"
    ) {
      throw new Error("Trigger Process recovery claim is invalid");
    }
    const identity = `${claim.work_item_id}:${claim.claim_token}:${claim.lease_generation}`;
    if (identities.has(identity)) {
      throw new Error("Trigger Process recovery claim batch contains duplicates");
    }
    identities.add(identity);
    try {
      if (!Value.Check(TriggerProcessWorkPayloadV1Schema, claim.payload)) {
        throw new Error("invalid_recovery_payload");
      }
      const payload = claim.payload as TriggerProcessWorkPayloadV1;
      assertTriggerProcessWorkPayloadBindingsV1(claim.work_kind, payload);
      if (
        payload.trigger_process_id !== claim.trigger_process_id ||
        payload.expected_process_state_version !==
          claim.expected_process_state_version ||
        sha256(payload) !== claim.payload_hash
      ) {
        throw new Error("invalid_recovery_payload");
      }
      return Object.freeze({ kind: "processable", claim });
    } catch {
      // The claim fence was verified above, so the owner can terminally mark
      // this immutable legacy payload without running it. Keeping it in the
      // batch would otherwise starve valid work behind a permanently invalid
      // record on every recovery pass.
      return Object.freeze({ kind: "invalid_payload", claim });
    }
  });
  return Object.freeze(claims);
}

function safeError(error: unknown): Readonly<Record<string, unknown>> {
  // Lifecycle stages deliberately wrap provider/owner failures in a typed,
  // allowlisted reason. Persist that code so the recovery record remains safe
  // to expose while still distinguishing a provider timeout from an owner or
  // binding failure. Never persist the wrapped message or cause: either may
  // contain credentials or remote-provider diagnostics.
  const lifecycleReason =
    error instanceof Error &&
    "reason_code" in error &&
    typeof error.reason_code === "string" &&
    /^[a-z][a-z0-9_.-]{0,127}$/u.test(error.reason_code)
      ? error.reason_code
      : undefined;
  return Object.freeze({
    reason_code:
      lifecycleReason ??
      (error instanceof Error && /^[a-z][a-z0-9_.-]{0,127}$/u.test(error.message)
        ? error.message
        : "recovery_handler_failed"),
  });
}

function ownerCommitCompleted(error: unknown): boolean {
  return (
    error instanceof Error &&
    "owner_commit_completed" in error &&
    error.owner_commit_completed === true
  );
}

function assertRecoveryProcessBinding(
  claim: TriggerProcessRecoveryClaimV1,
  request: Readonly<{ trigger_process_id: string }>,
): void {
  if (request.trigger_process_id !== claim.trigger_process_id) {
    throw new Error("recovery_process_binding_mismatch");
  }
}

function workClaimFenceV1(
  claim: TriggerProcessRecoveryClaimV1,
): TriggerProcessWorkClaimV1 {
  return Object.freeze({
    work_item_id: claim.work_item_id,
    claim_token: claim.claim_token,
    lease_generation: claim.lease_generation,
    lease_owner: claim.lease_owner,
    expected_process_state_version: claim.expected_process_state_version,
    payload_hash: claim.payload_hash,
  });
}

export function createTriggerProcessSnapshotRepairHandlerV1(
  database: TriggerProcessorOwnerDatabaseV1,
): TriggerProcessSnapshotRepairHandlerV1 {
  return Object.freeze({
    async repair(
      claim: TriggerProcessRecoveryClaimV1,
      payload: TriggerSnapshotRepairWorkV1,
      signal: AbortSignal,
    ) {
      if (signal.aborted) throw new Error("recovery_lease_expired");
      const resultHash = sha256({
        work_item_id: claim.work_item_id,
        payload_hash: claim.payload_hash,
        repair_job_id: payload.repair_job_id,
        disposition: "meta_snapshot_repair_dispatched",
      });
      const responseValue = await database.unit_of_work.withTransaction(
        {
          operation: "dispatch_trigger_snapshot_repair",
          idempotency_key: `${payload.repair_job_id}:dispatch`,
          trace_id: payload.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) =>
          owner.executeWriter(transaction, {
            writer: "dispatch_trigger_snapshot_repair_v1",
            arguments: {
              p_repair_job_id: payload.repair_job_id,
              p_process_id: payload.trigger_process_id,
              p_expected_repair_status: "pending",
              p_repair_work: payload,
              p_work_item_id: claim.work_item_id,
              p_claim_token: claim.claim_token,
              p_lease_generation: String(claim.lease_generation),
              p_lease_owner: claim.lease_owner,
              p_expected_process_state_version: String(
                claim.expected_process_state_version,
              ),
              p_result_hash: resultHash,
              p_request_hash: claim.payload_hash,
              p_trace_id: payload.trace_id,
            },
            expected_rows: 1,
          }),
      );
      const response = canonicalRecoverySnapshotV1<
        Readonly<Record<string, unknown>>
      >(
        responseValue,
        "snapshot_repair_owner_response_invalid",
      );
      if (
        !isRecord(response) ||
        response.dispatched !== true ||
        response.repair_job_id !== payload.repair_job_id ||
        response.work_item_id !== claim.work_item_id ||
        response.result_hash !== resultHash
      ) {
        throw new Error("snapshot_repair_owner_response_invalid");
      }
      if (signal.aborted) throw new Error("recovery_lease_expired");
    },
  });
}

/**
 * Converts each durable owner work kind into exactly one executable lifecycle
 * action. The owner row carries the already-frozen request. A Runtime Start
 * recompose work item is deliberately a fresh Context Compose request; the
 * old Runtime Start request is evidence only and must never be replayed.
 */
export function createTriggerProcessLifecycleRecoveryHandlerV1(
  lifecycle: TriggerLifecycleApplicationV1,
  snapshotRepair: TriggerProcessSnapshotRepairHandlerV1,
): TriggerProcessRecoveryHandlerV1 {
  return Object.freeze({
    async handle(
      claim: TriggerProcessRecoveryClaimV1,
      signal: AbortSignal,
    ) {
      if (signal.aborted) throw new Error("recovery_lease_expired");
      const payload = claim.payload as TriggerProcessWorkPayloadV1;
      const workClaim = workClaimFenceV1(claim);
      switch (claim.work_kind) {
        case "stage_execute":
        case "stage_retry": {
          if (!("target_stage" in payload)) {
            throw new Error("invalid_recovery_payload");
          }
          assertRecoveryProcessBinding(claim, payload.request);
          switch (payload.target_stage) {
            case "context":
              await lifecycle.composeContext(
                payload.request as ContextComposeRequestV1,
                workClaim,
              );
              break;
            case "intent":
              await lifecycle.synthesizeIntent(
                payload.request as IntentSynthesizeRequestV1,
                workClaim,
              );
              break;
            case "runtime_start":
              await lifecycle.reserveRuntimeStart(
                payload.request as RuntimeStartRequestV1,
                workClaim,
              );
              break;
          }
          break;
        }
        case "runtime_start_recompose": {
          if (!("old_start_attempt_no" in payload)) {
            throw new Error("invalid_recovery_payload");
          }
          const request = payload.request as ContextComposeRequestV1;
          assertRecoveryProcessBinding(claim, request);
          await lifecycle.composeContext(request, workClaim);
          break;
        }
        case "meta_enqueue": {
          if (!("enqueue_reason" in payload)) {
            throw new Error("invalid_recovery_payload");
          }
          const request = payload.request as MetaJobCreateRequestV1;
          assertRecoveryProcessBinding(claim, request);
          await lifecycle.enqueueMeta({
            request,
            boundary_system_event_ref: payload.boundary_system_event_ref,
          }, workClaim);
          break;
        }
        case "snapshot_repair": {
          if (!Value.Check(TriggerSnapshotRepairWorkV1Schema, payload)) {
            throw new Error("invalid_recovery_payload");
          }
          await snapshotRepair.repair(
            claim,
            payload as TriggerSnapshotRepairWorkV1,
            signal,
          );
          break;
        }
      }
      if (signal.aborted) throw new Error("recovery_lease_expired");
      return "owner_writer_committed" as const;
    },
  });
}

function assertAck(
  value: unknown,
  claim: TriggerProcessRecoveryClaimV1,
  outcome: "completed" | "retry_wait" | "failed",
  resultHash: string,
): void {
  const snapshot = canonicalRecoverySnapshotV1<
    Readonly<Record<string, unknown>>
  >(
    value,
    "Trigger Process recovery ACK violated its fenced contract",
  );
  if (
    !isRecord(snapshot) ||
    Object.keys(snapshot).sort().join(",") !==
      "acknowledged,outcome,result_hash,work_item_id" ||
    snapshot.acknowledged !== true ||
    snapshot.work_item_id !== claim.work_item_id ||
    snapshot.outcome !== outcome ||
    snapshot.result_hash !== resultHash
  ) {
    throw new Error("Trigger Process recovery ACK violated its fenced contract");
  }
}

export function createTriggerProcessRecoveryWorkerV1(
  database: TriggerProcessorOwnerDatabaseV1,
  handler: TriggerProcessRecoveryHandlerV1,
  config: Readonly<{
    worker_id: string;
    batch_size?: number;
    lease_seconds?: number;
    max_attempts?: number;
    retry_delay_ms?: (attemptCount: number) => number;
  }>,
): TriggerProcessRecoveryWorkerV1 {
  const workerId = config.worker_id;
  // The durable owner writer rejects claim limits above 16. Keep the worker
  // default aligned with that database-enforced bound so the runner cannot
  // silently fail every claim cycle in a fresh production composition.
  const batchSize = config.batch_size ?? 16;
  const leaseSeconds = config.lease_seconds ?? 60;
  const maxAttempts = config.max_attempts ?? 8;
  const retryDelayMs =
    config.retry_delay_ms ??
    ((attempt) => Math.min(60_000, 1_000 * 2 ** Math.min(attempt - 1, 6)));
  if (
    !boundedIdentity(workerId) ||
    !Number.isSafeInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 256 ||
    !Number.isSafeInteger(leaseSeconds) ||
    leaseSeconds < 5 ||
    leaseSeconds > 3_600 ||
    !Number.isSafeInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 100
  ) {
    throw new Error("Trigger Process recovery worker configuration is invalid");
  }

  async function acknowledge(
    claim: TriggerProcessRecoveryClaimV1,
    outcome: "retry_wait" | "failed",
    error: Readonly<Record<string, unknown>> | null,
  ): Promise<void> {
    const retryDelay =
      outcome === "retry_wait" ? retryDelayMs(claim.attempt_count) : null;
    if (
      retryDelay !== null &&
      (!Number.isSafeInteger(retryDelay) || retryDelay < 1 || retryDelay > 86_400_000)
    ) {
      throw new Error("Trigger Process recovery retry delay is invalid");
    }
    const requestHash = sha256({
      work_item_id: claim.work_item_id,
      claim_token: claim.claim_token,
      lease_generation: claim.lease_generation,
      outcome,
      retry_delay_ms: retryDelay,
      error,
    });
    const resultHash = sha256({
      work_item_id: claim.work_item_id,
      payload_hash: claim.payload_hash,
      outcome,
      retry_delay_ms: retryDelay,
      error,
    });
    const response = await database.unit_of_work.withTransaction(
      {
        operation: "ack_trigger_process_work",
        idempotency_key: `${claim.work_item_id}:${claim.claim_token}:${outcome}`,
        trace_id: `recovery:${claim.work_item_id}:${claim.lease_generation}`,
        isolation: "read_committed",
        retry: "none",
      },
      async (transaction, { owner }) =>
        owner.executeWriter(transaction, {
          writer: "ack_trigger_process_work_v1",
          arguments: {
            p_work_item_id: claim.work_item_id,
            p_claim_token: claim.claim_token,
            p_lease_generation: String(claim.lease_generation),
            p_lease_owner: claim.lease_owner,
            p_outcome: outcome,
            p_retry_delay_ms: retryDelay,
            p_error: error,
            p_result_hash: resultHash,
            p_request_hash: requestHash,
            p_trace_id: `recovery:${claim.work_item_id}:${claim.lease_generation}`,
          },
          expected_rows: 1,
        }),
    );
    assertAck(response, claim, outcome, resultHash);
  }

  return Object.freeze({
    async runOnce() {
      const claimCycleId = randomUUID();
      const claimHash = sha256({
        worker_id: workerId,
        limit: batchSize,
        lease_seconds: leaseSeconds,
        claim_cycle_id: claimCycleId,
      });
      const claimStartedAt = performance.now();
      const rawClaims = await database.unit_of_work.withTransaction(
        {
          operation: "claim_trigger_process_work",
          idempotency_key: `${workerId}:${claimCycleId}`,
          trace_id: `recovery-claim:${workerId}:${claimCycleId}`,
          isolation: "read_committed",
          retry: "none",
        },
        async (transaction, { owner }) =>
          owner.executeWriter(transaction, {
            writer: "claim_trigger_process_work_v1",
            arguments: {
              p_worker_id: workerId,
              p_limit: batchSize,
              p_lease_seconds: leaseSeconds,
              p_request_hash: claimHash,
            },
            expected_rows: "zero_or_more",
          }),
      );
      const claims = validateClaims(rawClaims, batchSize);
      const settleClaim = async (
        claim: TriggerProcessRecoveryClaimV1,
      ): Promise<"completed" | "retried" | "failed" | "lease_expired"> => {
        const leaseBudget =
          Date.parse(claim.lease_until) - Date.parse(claim.database_now);
        const remaining = leaseBudget - (performance.now() - claimStartedAt);
        if (remaining <= 250) {
          // The owner DB will make the item claimable again after lease expiry.
          // Running a side effect without enough time for its fenced ACK would
          // only manufacture duplicate or untracked work.
          return "lease_expired";
        }
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          Math.max(1, remaining - 250),
        );
        let handlerError: unknown;
        try {
          const disposition = await handler.handle(claim, controller.signal);
          if (disposition !== "owner_writer_committed") {
            throw new Error("recovery_handler_did_not_commit_owner_writer");
          }
          if (controller.signal.aborted) {
            throw new Error("recovery_lease_expired");
          }
        } catch (error) {
          handlerError = error;
        }
        try {
          if (handlerError === undefined) {
            return "completed";
          }
          if (ownerCommitCompleted(handlerError)) {
            return "completed";
          }
          const terminal = claim.attempt_count >= maxAttempts;
          await acknowledge(
            claim,
            terminal ? "failed" : "retry_wait",
            safeError(handlerError),
          );
          return terminal ? "failed" : "retried";
        } finally {
          clearTimeout(timer);
        }
      };
      const settleInvalidPayloadClaim = async (
        claim: TriggerProcessRecoveryClaimV1,
      ): Promise<"failed"> => {
        // A claim that has passed its fence but failed immutable payload
        // validation must never be retried: no future worker can safely make
        // that payload executable under the current contract.
        await acknowledge(
          claim,
          "failed",
          Object.freeze({ reason_code: "invalid_recovery_payload" }),
        );
        return "failed";
      };
      // Every claim in a batch shares a finite DB lease. Start them together;
      // serial handling lets later claims expire before their handler begins.
      const settled = await Promise.allSettled(
        claims.map((entry) =>
          entry.kind === "processable"
            ? settleClaim(entry.claim)
            : settleInvalidPayloadClaim(entry.claim),
        ),
      );
      const rejected = settled.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (rejected !== undefined) {
        throw rejected.reason;
      }
      const outcomes = settled.map(
        (result) => (result as PromiseFulfilledResult<
          "completed" | "retried" | "failed" | "lease_expired"
        >).value,
      );
      return Object.freeze({
        claimed: claims.length,
        completed: outcomes.filter((outcome) => outcome === "completed").length,
        retried: outcomes.filter((outcome) => outcome === "retried").length,
        failed: outcomes.filter((outcome) => outcome === "failed").length,
        lease_expired: outcomes.filter((outcome) => outcome === "lease_expired")
          .length,
      });
    },
  });
}

function isSnapshotGapTransitionRaceV1(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as Readonly<{ code?: unknown }>).code === "40001"
  );
}

function isCanonicalTimestampV1(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

/**
 * Advances only pending owner events whose durable timeout is already due.
 * It never replays event contents or changes a Process directly: the existing
 * transition writer serializes the marker, repair work, and cursor fence.
 */
export function createTriggerSnapshotGapRecoveryWorkerV1(
  repository: TriggerSnapshotGapRecoveryRepositoryV1,
  database: TriggerProcessorOwnerDatabaseV1,
  config: Readonly<{
    worker_id: string;
    batch_size?: number;
  }>,
): TriggerSnapshotGapRecoveryWorkerV1 {
  const workerId = config.worker_id;
  const batchSize = config.batch_size ?? 16;
  if (
    !boundedIdentity(workerId) ||
    !Number.isSafeInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 16
  ) {
    throw new Error("Trigger snapshot-gap recovery worker configuration is invalid");
  }

  return Object.freeze({
    async runOnce() {
      const signal = new AbortController().signal;
      const candidates = await repository.listEligible(batchSize, signal);
      if (candidates.length > batchSize) {
        throw new Error("Trigger snapshot-gap recovery repository exceeded its limit");
      }
      const outcomes = await Promise.allSettled(
        candidates.map(async (candidate) => {
          if (
            !boundedIdentity(candidate.pending_event_id) ||
            candidate.status !== "pending" ||
            !isCanonicalTimestampV1(candidate.updated_at)
          ) {
            throw new Error("Trigger snapshot-gap recovery candidate is invalid");
          }
          const traceId = `snapshot-gap:${candidate.pending_event_id}`;
          try {
            await database.unit_of_work.withTransaction(
              {
                operation: "transition_trigger_snapshot_pending_event",
                idempotency_key:
                  `${candidate.pending_event_id}:${candidate.updated_at}:gap_skipped`,
                trace_id: traceId,
                isolation: "read_committed",
                retry: "serialization_failures",
              },
              async (transaction, { owner }) =>
                owner.executeWriter(transaction, {
                  writer: "transition_trigger_snapshot_pending_event_v1",
                  arguments: {
                    p_pending_event_id: candidate.pending_event_id,
                    p_expected_status: "pending",
                    p_expected_updated_at: candidate.updated_at,
                    p_next_status: "gap_skipped",
                    p_worker_id: workerId,
                    p_retry_delay_ms: null,
                    p_last_error: {
                      reason_code: "source_sequence_gap_timeout",
                      trace_id: traceId,
                    },
                  },
                  expected_rows: 1,
                }),
            );
            return "transitioned" as const;
          } catch (error) {
            if (isSnapshotGapTransitionRaceV1(error)) return "raced" as const;
            throw error;
          }
        }),
      );
      const rejected = outcomes.find(
        (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
      );
      if (rejected !== undefined) throw rejected.reason;
      const values = outcomes.map(
        (outcome) => (outcome as PromiseFulfilledResult<"transitioned" | "raced">).value,
      );
      return Object.freeze({
        claimed: candidates.length,
        completed: values.filter((value) => value === "transitioned").length,
        retried: 0,
        failed: 0,
        lease_expired: 0,
        transitioned: values.filter((value) => value === "transitioned").length,
        raced: values.filter((value) => value === "raced").length,
      });
    },
  });
}

export function createTriggerProcessRecoveryRunnerV1(
  worker: TriggerProcessRecoveryWorkerV1,
  options: Readonly<{
    poll_interval_ms?: number;
    stop_timeout_ms?: number;
    on_error?: (error: unknown) => void | Promise<void>;
  }> = {},
): TriggerProcessRecoveryRunnerV1 {
  const pollIntervalMs = options.poll_interval_ms ?? 1_000;
  const stopTimeoutMs = options.stop_timeout_ms ?? 65_000;
  if (
    !Number.isSafeInteger(pollIntervalMs) ||
    pollIntervalMs < 10 ||
    pollIntervalMs > 60_000 ||
    !Number.isSafeInteger(stopTimeoutMs) ||
    stopTimeoutMs < 1_000 ||
    stopTimeoutMs > 300_000
  ) {
    throw new Error("Trigger Process recovery runner configuration is invalid");
  }

  let state: TriggerProcessRecoveryRunnerV1["state"] = "idle";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  let stopPromise: Promise<void> | undefined;

  const schedule = () => {
    if (state !== "running") return;
    timer = setTimeout(run, pollIntervalMs);
  };
  const run = () => {
    if (state !== "running" || active !== undefined) return;
    active = worker
      .runOnce()
      .then(() => undefined)
      .catch(async (error: unknown) => {
        try {
          await options.on_error?.(error);
        } catch {
          // Reporting must not terminate the single-flight recovery loop.
        }
      })
      .finally(() => {
        active = undefined;
        schedule();
      });
  };

  return Object.freeze({
    get state() {
      return state;
    },
    start() {
      if (state === "running") return;
      if (state !== "idle") {
        throw new Error("Trigger Process recovery runner cannot be restarted");
      }
      state = "running";
      run();
    },
    stop() {
      if (stopPromise !== undefined) return stopPromise;
      state = state === "stopped" ? "stopped" : "stopping";
      if (timer !== undefined) clearTimeout(timer);
      const inFlight = active ?? Promise.resolve();
      stopPromise = Promise.race([
        inFlight,
        new Promise<never>((_resolve, reject) => {
          const stopTimer = setTimeout(
            () =>
              reject(
                new Error(
                  "Trigger Process recovery runner did not stop before its bounded deadline",
                ),
              ),
            stopTimeoutMs,
          );
          inFlight.finally(() => clearTimeout(stopTimer)).catch(() => undefined);
        }),
      ]).then(() => {
        state = "stopped";
      });
      return stopPromise;
    },
  });
}
