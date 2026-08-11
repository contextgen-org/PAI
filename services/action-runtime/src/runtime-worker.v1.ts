import type { PostgresQueryPortV1 } from "@pai/persistence";

import type { RuntimeExecutionApplicationV1 } from "./runtime-execution.v1.js";

export interface RuntimeQueuedExecutionV1 {
  readonly runtime_run_id: string;
  readonly expected_start_fence_generation: number;
  readonly deadline_at: string;
}

export interface RuntimeExecutionQueuePortV1 {
  listQueued(
    limit: number,
    signal?: AbortSignal,
  ): Promise<readonly RuntimeQueuedExecutionV1[]>;
  checkReadiness(signal: AbortSignal): Promise<void>;
}

export interface ActionRuntimeWorkerOptionsV1 {
  readonly execution: RuntimeExecutionApplicationV1;
  readonly queue: RuntimeExecutionQueuePortV1;
  readonly worker_id: string;
  readonly poll_interval_ms?: number;
  readonly run_lease_seconds?: number;
  readonly queued_batch_size?: number;
  readonly callback_batch_size?: number;
  readonly artifact_batch_size?: number;
  readonly artifact_lease_seconds?: number;
  /**
   * Receives a deliberately redacted execution failure so a production host
   * can make a stuck queued run observable without serializing provider,
   * database, or workload credentials into its log stream.
   */
  readonly on_execution_error?: (failure: Readonly<{
    runtime_run_id: string;
    error_code: string;
    retryable: boolean;
    /**
     * A bounded internal execution phase. This is never a provider, database,
     * or workload error message, so production logs can pinpoint a failed
     * boundary without disclosing credentials or prompt contents.
     */
    diagnostic_stage?: string;
  }>) => void;
  /**
   * Receives a deliberately redacted failure from queue discovery or durable
   * recovery. Background-cycle failures must stay observable: otherwise the
   * readiness endpoint can correctly fail while production logs contain no
   * actionable, safe-to-emit cause.
   */
  readonly on_cycle_error?: (failure: Readonly<{
    stage: "queue" | "callbacks" | "artifacts";
    error_code: string;
    retryable: boolean;
  }>) => void;
}

export interface ActionRuntimeWorkerV1 {
  start(): void;
  runOnce(signal?: AbortSignal): Promise<void>;
  checkReadiness(signal: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

const WORKER_ID_PATTERN_V1 = /^[A-Za-z0-9._:-]{1,128}$/u;

function boundedIntegerV1(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function assertQueuedRowV1(value: RuntimeQueuedExecutionV1): void {
  if (
    typeof value.runtime_run_id !== "string" ||
    value.runtime_run_id.length < 1 ||
    value.runtime_run_id.length > 512 ||
    !Number.isSafeInteger(value.expected_start_fence_generation) ||
    value.expected_start_fence_generation < 1 ||
    !Number.isFinite(Date.parse(value.deadline_at))
  ) {
    throw new Error("Action Runtime queue returned an invalid queued run");
  }
}

function executionFailureForLogV1(
  runtimeRunId: string,
  error: unknown,
): Readonly<{
  runtime_run_id: string;
  error_code: string;
  retryable: boolean;
  diagnostic_stage?: string;
  diagnostic_detail?: string;
  diagnostic_fingerprint?: string;
}> {
  const candidate =
    typeof error === "object" && error !== null
      ? (error as Readonly<Record<string, unknown>>)
      : undefined;
  const code = candidate?.code;
  const diagnosticStage = candidate?.diagnostic_stage;
  const diagnosticDetail = candidate?.diagnostic_detail;
  const diagnosticFingerprint = candidate?.diagnostic_fingerprint;
  return Object.freeze({
    runtime_run_id: runtimeRunId,
    error_code:
      typeof code === "string" && /^[a-z0-9_:-]{1,128}$/u.test(code)
        ? code
        : "runtime_worker_execution_failed",
    retryable: candidate?.retryable === true,
    ...(typeof diagnosticStage === "string" &&
    /^[a-z_]{1,64}$/u.test(diagnosticStage)
      ? { diagnostic_stage: diagnosticStage }
      : {}),
    ...(typeof diagnosticDetail === "string" &&
    /^[a-z_]{1,64}$/u.test(diagnosticDetail)
      ? { diagnostic_detail: diagnosticDetail }
      : {}),
    ...(typeof diagnosticFingerprint === "string" &&
    /^[a-f0-9]{16}$/u.test(diagnosticFingerprint)
      ? { diagnostic_fingerprint: diagnosticFingerprint }
      : {}),
  });
}

function cycleFailureForLogV1(
  stage: "queue" | "callbacks" | "artifacts",
  error: unknown,
): Readonly<{
  stage: "queue" | "callbacks" | "artifacts";
  error_code: string;
  retryable: boolean;
}> {
  const candidate =
    typeof error === "object" && error !== null
      ? (error as Readonly<Record<string, unknown>>)
      : undefined;
  const code = candidate?.code;
  return Object.freeze({
    stage,
    error_code:
      typeof code === "string" && /^[a-z0-9_:-]{1,128}$/u.test(code)
        ? code
        : "runtime_worker_cycle_failed",
    retryable: candidate?.retryable === true,
  });
}

export function createPostgresRuntimeExecutionQueueV1(
  postgres: PostgresQueryPortV1,
): RuntimeExecutionQueuePortV1 {
  return Object.freeze({
    async listQueued(limit: number, signal?: AbortSignal) {
      signal?.throwIfAborted();
      boundedIntegerV1(limit, 1, 100, "queued_batch_size");
      const result = await postgres.query<{
        runtime_run_id: string;
        start_fence_generation: string | number;
        deadline_at: Date | string;
      }>(
        `SELECT run.id AS runtime_run_id,
                run.start_fence_generation,
                policy.expires_at AS deadline_at
           FROM action_runtime.runtime_runs AS run
           JOIN action_runtime.runtime_policy_snapshots AS policy
             ON policy.runtime_run_id = run.id
           LEFT JOIN action_runtime.runtime_run_leases AS lease
             ON lease.runtime_run_id = run.id
          WHERE run.status = 'queued'
             OR (
               run.status = 'running'
               AND lease.lease_expires_at <= clock_timestamp()
             )
          ORDER BY run.created_at, run.id
          LIMIT $1`,
        [limit],
      );
      signal?.throwIfAborted();
      return Object.freeze(
        result.rows.map((row) => {
          const generation = Number(row.start_fence_generation);
          const deadline =
            row.deadline_at instanceof Date
              ? row.deadline_at.toISOString()
              : new Date(row.deadline_at).toISOString();
          const queued = Object.freeze({
            runtime_run_id: row.runtime_run_id,
            expected_start_fence_generation: generation,
            deadline_at: deadline,
          });
          assertQueuedRowV1(queued);
          return queued;
        }),
      );
    },

    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      await postgres.query(
        `SELECT 1
           FROM action_runtime.runtime_runs AS run
           JOIN action_runtime.runtime_policy_snapshots AS policy
             ON policy.runtime_run_id = run.id
          WHERE FALSE`,
      );
      signal.throwIfAborted();
    },
  });
}

export function createActionRuntimeWorkerV1(
  options: ActionRuntimeWorkerOptionsV1,
): ActionRuntimeWorkerV1 {
  if (!WORKER_ID_PATTERN_V1.test(options.worker_id)) {
    throw new Error("Action Runtime worker_id is invalid");
  }
  const pollIntervalMs = boundedIntegerV1(
    options.poll_interval_ms ?? 1_000,
    50,
    60_000,
    "poll_interval_ms",
  );
  const runLeaseSeconds = boundedIntegerV1(
    options.run_lease_seconds ?? 30,
    15,
    120,
    "run_lease_seconds",
  );
  const queuedBatchSize = boundedIntegerV1(
    options.queued_batch_size ?? 10,
    1,
    100,
    "queued_batch_size",
  );
  const callbackBatchSize = boundedIntegerV1(
    options.callback_batch_size ?? 100,
    1,
    1_000,
    "callback_batch_size",
  );
  const artifactBatchSize = boundedIntegerV1(
    // `claim_runtime_artifact_reconciliation_v1` has a strict durable bound
    // of 16. Keep worker defaults and validation aligned so an idle runtime
    // cannot continuously fail its reconciliation loop before it processes
    // any artifact.
    options.artifact_batch_size ?? 16,
    1,
    16,
    "artifact_batch_size",
  );
  const artifactLeaseSeconds = boundedIntegerV1(
    options.artifact_lease_seconds ?? 60,
    1,
    3_600,
    "artifact_lease_seconds",
  );
  const lifecycleController = new AbortController();
  let started = false;
  let closed = false;
  let timer: NodeJS.Timeout | undefined;
  let active: Promise<void> | undefined;
  let startedAt = 0;
  let lastCycleCompletedAt = 0;

  const runOnce = async (
    signal = lifecycleController.signal,
  ): Promise<void> => {
    let stage: "queue" | "callbacks" | "artifacts" = "queue";
    try {
      signal.throwIfAborted();
      const queued = await options.queue.listQueued(queuedBatchSize, signal);
      for (const item of queued) {
        signal.throwIfAborted();
        assertQueuedRowV1(item);
        try {
          await options.execution.executeQueued(
            {
              runtime_run_id: item.runtime_run_id,
              worker_id: options.worker_id,
              expected_start_fence_generation:
                item.expected_start_fence_generation,
              lease_seconds: runLeaseSeconds,
              deadline_at: item.deadline_at,
            },
            signal,
          );
        } catch (error) {
          if (signal.aborted) throw error;
          options.on_execution_error?.(
            executionFailureForLogV1(item.runtime_run_id, error),
          );
          // The durable run ledger owns failure/retry state. One conflicting or
          // transient run must not starve recovery of other queued runs.
        }
      }
      stage = "callbacks";
      signal.throwIfAborted();
      await options.execution.recoverPendingCallbacks(
        callbackBatchSize,
        signal,
      );
      stage = "artifacts";
      signal.throwIfAborted();
      await options.execution.recoverPendingArtifacts(
        {
          worker_id: `${options.worker_id}:artifacts`,
          limit: artifactBatchSize,
          lease_seconds: artifactLeaseSeconds,
        },
        signal,
      );
      lastCycleCompletedAt = Date.now();
    } catch (error) {
      if (!signal.aborted) {
        options.on_cycle_error?.(cycleFailureForLogV1(stage, error));
      }
      throw error;
    }
  };

  const schedule = (): void => {
    if (closed || lifecycleController.signal.aborted) return;
    timer = setTimeout(() => {
      if (active !== undefined) {
        schedule();
        return;
      }
      active = runOnce()
        .catch(() => undefined)
        .finally(() => {
          active = undefined;
          schedule();
        });
    }, pollIntervalMs);
    timer.unref?.();
  };

  return Object.freeze({
    start() {
      if (started || closed) return;
      started = true;
      startedAt = Date.now();
      active = runOnce()
        .catch(() => undefined)
        .finally(() => {
          active = undefined;
          schedule();
        });
    },

    runOnce,

    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      if (closed) throw new Error("Action Runtime worker is closed");
      if (!started) throw new Error("Action Runtime worker is not running");
      await options.queue.checkReadiness(signal);
      if (
        started &&
        Date.now() -
          (lastCycleCompletedAt === 0 ? startedAt : lastCycleCompletedAt) >
          pollIntervalMs * 10
      ) {
        throw new Error("Action Runtime worker has stopped making progress");
      }
    },

    async close() {
      if (closed) return;
      closed = true;
      lifecycleController.abort();
      if (timer !== undefined) clearTimeout(timer);
      await active?.catch(() => undefined);
    },
  });
}
