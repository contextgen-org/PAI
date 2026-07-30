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
          WHERE run.status = 'queued'
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
    options.artifact_batch_size ?? 100,
    1,
    100,
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
  let lastCycleCompletedAt = 0;

  const runOnce = async (
    signal = lifecycleController.signal,
  ): Promise<void> => {
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
        // The durable run ledger owns failure/retry state. One conflicting or
        // transient run must not starve recovery of other queued runs.
      }
    }
    signal.throwIfAborted();
    await options.execution.recoverPendingCallbacks(
      callbackBatchSize,
      signal,
    );
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
      await options.queue.checkReadiness(signal);
      if (
        started &&
        lastCycleCompletedAt !== 0 &&
        Date.now() - lastCycleCompletedAt > pollIntervalMs * 10
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
