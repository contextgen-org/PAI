import { randomUUID } from "node:crypto";

import type {
  ObjectStoreReconciliationPortV1,
  ReconcileObjectStoreResultV1,
} from "./object-store-port.v1.js";

export interface ObjectStoreReconciliationWorkerOptionsV1 {
  readonly reconciliation: ObjectStoreReconciliationPortV1;
  readonly worker_id?: string;
  readonly interval_ms?: number;
  readonly retry_base_delay_ms?: number;
  readonly retry_max_delay_ms?: number;
  readonly batch_timeout_ms?: number;
  readonly stop_timeout_ms?: number;
  readonly random?: () => number;
  readonly batch_limit?: number;
  readonly lease_seconds?: number;
  readonly on_error?: (error: unknown) => void | Promise<void>;
}

/**
 * Durable reservations still live in the owner metadata repository; this
 * worker only provides the executable polling/claim loop. It never overlaps
 * claims from the same process. Batch and stop deadlines request cooperative
 * abort, but the bulkhead remains held until the injected task really settles.
 */
export class ObjectStoreReconciliationWorkerV1 {
  readonly #reconcilePending: ObjectStoreReconciliationPortV1["reconcilePending"];
  readonly #workerId: string;
  readonly #intervalMs: number;
  readonly #retryBaseDelayMs: number;
  readonly #retryMaxDelayMs: number;
  readonly #batchTimeoutMs: number;
  readonly #stopTimeoutMs: number;
  readonly #random: () => number;
  readonly #batchLimit: number;
  readonly #leaseSeconds: number;
  readonly #onError: (error: unknown) => void | Promise<void>;
  #timer: NodeJS.Timeout | undefined;
  #inFlight: Promise<ReconcileObjectStoreResultV1> | undefined;
  #lifecycle: "stopped" | "running" | "stopping" = "stopped";
  #lifecycleGeneration = 0;
  #consecutiveFailures = 0;
  #stopPromise: Promise<void> | undefined;
  #errorReporterInFlight: Promise<void> | undefined;
  #hasPendingError = false;
  #pendingError: unknown;
  #activeController: AbortController | undefined;

  static #assertSummary(
    value: unknown,
    limit: number,
  ): ReconcileObjectStoreResultV1 {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("ObjectStore reconciler returned a malformed summary");
    }
    let prototype: object | null;
    try {
      prototype = Object.getPrototypeOf(value);
    } catch {
      throw new Error("ObjectStore reconciler returned a malformed summary");
    }
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("ObjectStore reconciler returned a malformed summary");
    }
    let descriptors: PropertyDescriptorMap;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      throw new Error("ObjectStore reconciler returned a malformed summary");
    }
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.some((key) => typeof key !== "string") ||
      (keys as string[]).sort().join(",") !==
        "claimed,completed,retry_scheduled"
    ) {
      throw new Error("ObjectStore reconciler returned a malformed summary");
    }
    const readCounter = (key: string): unknown => {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new Error("ObjectStore reconciler returned a malformed summary");
      }
      return descriptor.value;
    };
    const claimed = readCounter("claimed");
    const completed = readCounter("completed");
    const retryScheduled = readCounter("retry_scheduled");
    const counters = [claimed, completed, retryScheduled];
    if (
      counters.some(
        (counter) =>
          !Number.isSafeInteger(counter) ||
          (counter as number) < 0 ||
          (counter as number) > limit,
      ) ||
      (completed as number) + (retryScheduled as number) !== (claimed as number)
    ) {
      throw new Error("ObjectStore reconciler returned an inconsistent summary");
    }
    return Object.freeze({
      claimed: claimed as number,
      completed: completed as number,
      retry_scheduled: retryScheduled as number,
    });
  }

  public constructor(options: ObjectStoreReconciliationWorkerOptionsV1) {
    const reconciliation = options?.reconciliation;
    const reconcilePending = reconciliation?.reconcilePending;
    const random = options?.random;
    const onError = options?.on_error;
    if (
      options === null ||
      typeof options !== "object" ||
      typeof reconcilePending !== "function" ||
      (random !== undefined && typeof random !== "function") ||
      (onError !== undefined && typeof onError !== "function")
    ) {
      throw new Error("invalid ObjectStore reconciliation worker options");
    }
    const intervalMs = options.interval_ms ?? 5_000;
    const retryBaseDelayMs = options.retry_base_delay_ms ?? intervalMs;
    const retryMaxDelayMs = options.retry_max_delay_ms ?? Math.min(
      300_000,
      Math.max(retryBaseDelayMs, retryBaseDelayMs * 32),
    );
    const batchLimit = options.batch_limit ?? 25;
    const leaseSeconds = options.lease_seconds ?? 30;
    const batchTimeoutMs = options.batch_timeout_ms ?? 30_000;
    const stopTimeoutMs = options.stop_timeout_ms ?? 30_000;
    const workerId = options.worker_id ?? `object-store-${randomUUID()}`;
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(workerId) ||
      !Number.isSafeInteger(intervalMs) ||
      intervalMs < 100 ||
      intervalMs > 300_000 ||
      !Number.isSafeInteger(retryBaseDelayMs) ||
      retryBaseDelayMs < 100 ||
      retryBaseDelayMs > 300_000 ||
      !Number.isSafeInteger(retryMaxDelayMs) ||
      retryMaxDelayMs < retryBaseDelayMs ||
      retryMaxDelayMs > 300_000 ||
      !Number.isSafeInteger(batchLimit) ||
      batchLimit < 1 ||
      batchLimit > 100 ||
      !Number.isSafeInteger(leaseSeconds) ||
      leaseSeconds < 1 ||
      leaseSeconds > 300 ||
      !Number.isSafeInteger(batchTimeoutMs) ||
      batchTimeoutMs < 100 ||
      batchTimeoutMs > 300_000 ||
      !Number.isSafeInteger(stopTimeoutMs) ||
      stopTimeoutMs < 100 ||
      stopTimeoutMs > 300_000
    ) {
      throw new Error("invalid ObjectStore reconciliation worker options");
    }
    this.#reconcilePending = reconcilePending.bind(reconciliation);
    this.#workerId = workerId;
    this.#intervalMs = intervalMs;
    this.#retryBaseDelayMs = retryBaseDelayMs;
    this.#retryMaxDelayMs = retryMaxDelayMs;
    this.#batchTimeoutMs = batchTimeoutMs;
    this.#stopTimeoutMs = stopTimeoutMs;
    this.#random = random ?? Math.random;
    this.#batchLimit = batchLimit;
    this.#leaseSeconds = leaseSeconds;
    this.#onError = onError ?? (() => undefined);
  }

  public runOnce(): Promise<ReconcileObjectStoreResultV1> {
    if (this.#inFlight !== undefined) return this.#inFlight;
    if (this.#lifecycle === "stopping") {
      return Promise.reject(
        new Error("ObjectStore reconciliation worker is stopping"),
      );
    }
    // Install the shared promise before calling the injected dependency so a
    // synchronous callback cannot re-enter and start a second claim batch.
    const controller = new AbortController();
    const batchTimer = setTimeout(() => {
      controller.abort(new Error("ObjectStore reconciliation batch timed out"));
    }, this.#batchTimeoutMs);
    batchTimer.unref();
    const work = Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        return this.#reconcilePending(
          {
            worker_id: this.#workerId,
            limit: this.#batchLimit,
            lease_seconds: this.#leaseSeconds,
          },
          controller.signal,
        );
      })
      .then((summary) =>
        ObjectStoreReconciliationWorkerV1.#assertSummary(
          summary,
          this.#batchLimit,
        ),
      );
    this.#inFlight = work;
    this.#activeController = controller;
    void work.finally(() => {
      if (this.#inFlight === work) {
        this.#inFlight = undefined;
        this.#activeController = undefined;
      }
      clearTimeout(batchTimer);
    }).catch(() => undefined);
    return work;
  }

  #isCurrentRun(generation: number): boolean {
    return (
      this.#lifecycle === "running" &&
      this.#lifecycleGeneration === generation
    );
  }

  #reportError(error: unknown): void {
    if (this.#errorReporterInFlight !== undefined) {
      // Retain only the newest pending error so a stuck observer cannot create
      // unbounded promises or callback fan-out.
      this.#pendingError = error;
      this.#hasPendingError = true;
      return;
    }
    const report = Promise.resolve()
      .then(() => this.#onError(error))
      .then(() => undefined, () => undefined);
    this.#errorReporterInFlight = report;
    void report.finally(() => {
      if (this.#errorReporterInFlight !== report) return;
      this.#errorReporterInFlight = undefined;
      if (!this.#hasPendingError) return;
      const pendingError = this.#pendingError;
      this.#pendingError = undefined;
      this.#hasPendingError = false;
      this.#reportError(pendingError);
    }).catch(() => undefined);
  }

  #retryDelayMs(): number {
    const exponent = Math.min(this.#consecutiveFailures - 1, 30);
    const ceiling = Math.min(
      this.#retryMaxDelayMs,
      this.#retryBaseDelayMs * 2 ** exponent,
    );
    const sample = this.#random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new Error(
        "ObjectStore reconciliation retry random source must return [0, 1)",
      );
    }
    const floor = Math.max(100, Math.floor(ceiling / 2));
    return floor + Math.floor(sample * (ceiling - floor + 1));
  }

  #schedule(generation: number, delayMs: number): void {
    if (!this.#isCurrentRun(generation)) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#tick(generation);
    }, delayMs);
    this.#timer.unref();
  }

  #tick(generation: number): void {
    if (!this.#isCurrentRun(generation)) return;
    const work = this.runOnce();
    void work.then(
      () => {
        if (!this.#isCurrentRun(generation)) return;
        this.#consecutiveFailures = 0;
        this.#schedule(generation, this.#intervalMs);
      },
      (error: unknown) => {
        if (!this.#isCurrentRun(generation)) return;
        this.#consecutiveFailures = Math.min(
          this.#consecutiveFailures + 1,
          31,
        );
        this.#reportError(error);
        let retryDelayMs: number;
        try {
          retryDelayMs = this.#retryDelayMs();
        } catch (backoffError) {
          this.#reportError(backoffError);
          this.#lifecycle = "stopped";
          this.#lifecycleGeneration += 1;
          return;
        }
        this.#schedule(generation, retryDelayMs);
      },
    );
  }

  public start(): void {
    if (this.#lifecycle === "running") return;
    if (this.#lifecycle === "stopping") {
      throw new Error("ObjectStore reconciliation worker is stopping");
    }
    this.#lifecycle = "running";
    this.#stopPromise = undefined;
    this.#consecutiveFailures = 0;
    const generation = ++this.#lifecycleGeneration;
    this.#tick(generation);
  }

  public stop(): Promise<void> {
    if (this.#lifecycle === "stopping") return this.#stopPromise!;
    if (this.#lifecycle === "stopped" && this.#inFlight === undefined) {
      return Promise.resolve();
    }
    this.#lifecycle = "stopping";
    const stopGeneration = ++this.#lifecycleGeneration;
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    this.#pendingError = undefined;
    this.#hasPendingError = false;
    this.#activeController?.abort(
      new Error("ObjectStore reconciliation worker is stopping"),
    );
    const inFlight = this.#inFlight;
    const drained = Promise.resolve(inFlight)
      .catch(() => undefined)
      .then(() => {
        if (
          this.#lifecycle === "stopping" &&
          this.#lifecycleGeneration === stopGeneration
        ) {
          this.#lifecycle = "stopped";
        }
      });
    let stopTimer: NodeJS.Timeout | undefined;
    const stopping = Promise.race([
      drained,
      new Promise<never>((_resolve, reject) => {
        stopTimer = setTimeout(() => {
          reject(
            new Error(
              `ObjectStore reconciliation worker did not stop within ${this.#stopTimeoutMs}ms`,
            ),
          );
        }, this.#stopTimeoutMs);
        stopTimer.unref();
      }),
    ]).finally(() => {
      if (stopTimer !== undefined) clearTimeout(stopTimer);
    });
    this.#stopPromise = stopping;
    return stopping;
  }
}
