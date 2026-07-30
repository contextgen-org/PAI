import type { MetaJobApplicationV1 } from "./meta-job-application.v1.js";

export interface MetaJobWorkerCandidateV1 {
  readonly job_id: string;
  readonly expected_lease_generation: number;
  readonly trace_id: string;
}

export interface MetaJobWorkerCandidateSourceV1 {
  claimable(limit: number, now: Date): Promise<readonly MetaJobWorkerCandidateV1[]>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

export interface MetaJobWorkerV1 {
  start(): void;
  close(): Promise<void>;
  runOnce(signal?: AbortSignal): Promise<number>;
  checkReadiness(signal: AbortSignal): Promise<void>;
}

export interface MetaJobWorkerOptionsV1 {
  readonly application: MetaJobApplicationV1;
  readonly candidates: MetaJobWorkerCandidateSourceV1;
  readonly worker_id: string;
  readonly poll_interval_ms?: number;
  readonly batch_size?: number;
  readonly now?: () => Date;
}

function boundedIntegerV1(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is outside bounds`);
  }
  return value;
}

function workerIdV1(value: string): string {
  if (value.length < 1 || value.length > 256 || /[\r\n\u0000]/u.test(value)) {
    throw new Error("PAI_META_WORKER_ID is invalid");
  }
  return value;
}

/**
 * A pull worker deliberately treats the SQL candidate query as advisory only.
 * The owner lease CAS remains the sole authority for claim, takeover, and
 * state transition; concurrent workers can race safely without an in-memory
 * reservation.
 */
export function createMetaJobWorkerV1(
  options: MetaJobWorkerOptionsV1,
): MetaJobWorkerV1 {
  const workerId = workerIdV1(options.worker_id);
  const pollIntervalMs = boundedIntegerV1(
    options.poll_interval_ms ?? 1_000,
    "PAI_META_WORKER_POLL_INTERVAL_MS",
    100,
    60_000,
  );
  const batchSize = boundedIntegerV1(
    options.batch_size ?? 8,
    "PAI_META_WORKER_BATCH_SIZE",
    1,
    100,
  );
  const now = options.now ?? (() => new Date());
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let draining: Promise<number> | undefined;

  const runOnce = async (signal = new AbortController().signal): Promise<number> => {
    signal.throwIfAborted();
    const candidates = await options.candidates.claimable(batchSize, now());
    let processed = 0;
    for (const candidate of candidates) {
      signal.throwIfAborted();
      try {
        const lease = await options.application.acquireLease({
          job_id: candidate.job_id,
          owner_id: workerId,
          expected_generation: candidate.expected_lease_generation,
          trace_id: candidate.trace_id,
        });
        await options.application.runJob(lease, signal);
        processed += 1;
      } catch {
        // A competing claimant, stale lease, or job-local failure is durable
        // in the owner writer/application. Continue with the bounded batch;
        // readiness remains a separate dependency check.
      }
    }
    return processed;
  };

  const schedule = (): void => {
    if (closed) return;
    timer = setTimeout(() => {
      draining = runOnce().catch(() => 0).finally(() => {
        draining = undefined;
        schedule();
      });
    }, pollIntervalMs);
    timer.unref?.();
  };

  return Object.freeze({
    start() {
      if (closed || timer !== undefined || draining !== undefined) return;
      schedule();
    },
    async close() {
      closed = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      await draining;
    },
    runOnce,
    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      await options.application.checkReadiness(signal);
      await options.candidates.checkReadiness?.(signal);
      signal.throwIfAborted();
    },
  });
}
