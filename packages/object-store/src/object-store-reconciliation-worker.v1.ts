import { randomUUID } from "node:crypto";

import type {
  ObjectStoreReconciliationPortV1,
  ReconcileObjectStoreResultV1,
} from "./object-store-port.v1.js";

export interface ObjectStoreReconciliationWorkerOptionsV1 {
  readonly reconciliation: ObjectStoreReconciliationPortV1;
  readonly worker_id?: string;
  readonly interval_ms?: number;
  readonly batch_limit?: number;
  readonly lease_seconds?: number;
  readonly on_error?: (error: unknown) => void;
}

/**
 * Durable reservations still live in the owner metadata repository; this
 * worker only provides the executable polling/claim loop. It never overlaps
 * claims from the same process and can be stopped gracefully during shutdown.
 */
export class ObjectStoreReconciliationWorkerV1 {
  readonly #reconciliation: ObjectStoreReconciliationPortV1;
  readonly #workerId: string;
  readonly #intervalMs: number;
  readonly #batchLimit: number;
  readonly #leaseSeconds: number;
  readonly #onError: (error: unknown) => void;
  #timer: NodeJS.Timeout | undefined;
  #inFlight: Promise<ReconcileObjectStoreResultV1> | undefined;

  public constructor(options: ObjectStoreReconciliationWorkerOptionsV1) {
    const intervalMs = options.interval_ms ?? 5_000;
    const batchLimit = options.batch_limit ?? 25;
    const leaseSeconds = options.lease_seconds ?? 30;
    const workerId = options.worker_id ?? `object-store-${randomUUID()}`;
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(workerId) ||
      !Number.isSafeInteger(intervalMs) ||
      intervalMs < 100 ||
      intervalMs > 300_000 ||
      !Number.isSafeInteger(batchLimit) ||
      batchLimit < 1 ||
      batchLimit > 100 ||
      !Number.isSafeInteger(leaseSeconds) ||
      leaseSeconds < 1 ||
      leaseSeconds > 300
    ) {
      throw new Error("invalid ObjectStore reconciliation worker options");
    }
    this.#reconciliation = options.reconciliation;
    this.#workerId = workerId;
    this.#intervalMs = intervalMs;
    this.#batchLimit = batchLimit;
    this.#leaseSeconds = leaseSeconds;
    this.#onError = options.on_error ?? (() => undefined);
  }

  public runOnce(): Promise<ReconcileObjectStoreResultV1> {
    if (this.#inFlight !== undefined) return this.#inFlight;
    const work = this.#reconciliation.reconcilePending({
      worker_id: this.#workerId,
      limit: this.#batchLimit,
      lease_seconds: this.#leaseSeconds,
    });
    this.#inFlight = work;
    void work.finally(() => {
      if (this.#inFlight === work) this.#inFlight = undefined;
    }).catch(() => undefined);
    return work;
  }

  public start(): void {
    if (this.#timer !== undefined) return;
    const tick = (): void => {
      void this.runOnce().catch(this.#onError);
    };
    tick();
    this.#timer = setInterval(tick, this.#intervalMs);
    this.#timer.unref();
  }

  public async stop(): Promise<void> {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
    await this.#inFlight?.catch(() => undefined);
  }
}
