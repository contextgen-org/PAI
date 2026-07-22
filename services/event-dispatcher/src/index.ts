import {
  DURABLE_EVENT_BATCH_MAX_V1,
  type DurableOutboxDispatchSummaryV1,
} from "@pai/eventing";

export interface EventDispatcherBatchPortV1 {
  /**
   * The implementation must settle after abort. The signal is cooperative: the
   * shell never assumes an external publish or PostgreSQL commit was cancelled
   * until this promise actually settles.
   */
  dispatchBatch(signal: AbortSignal): Promise<DurableOutboxDispatchSummaryV1>;
}

export interface EventDispatcherWorkerOptionsV1 {
  readonly dispatcher: EventDispatcherBatchPortV1;
  readonly interval_ms?: number;
  readonly retry_base_delay_ms?: number;
  readonly retry_max_delay_ms?: number;
  readonly batch_timeout_ms?: number;
  readonly stop_timeout_ms?: number;
  readonly random?: () => number;
  readonly on_error?: (error: unknown) => void | Promise<void>;
}

function assertDispatchSummaryV1(
  value: unknown,
): DurableOutboxDispatchSummaryV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("event dispatcher returned a malformed batch summary");
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch {
    throw new Error("event dispatcher returned a malformed batch summary");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("event dispatcher returned a malformed batch summary");
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new Error("event dispatcher returned a malformed batch summary");
  }
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).sort().join(",") !== "claimed,failed,retry_wait,sent"
  ) {
    throw new Error("event dispatcher returned a malformed batch summary");
  }
  const readCounter = (key: string): unknown => {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error("event dispatcher returned a malformed batch summary");
    }
    return descriptor.value;
  };
  const claimed = readCounter("claimed");
  const sent = readCounter("sent");
  const retryWait = readCounter("retry_wait");
  const failed = readCounter("failed");
  const counters = [claimed, sent, retryWait, failed];
  if (
    counters.some(
      (counter) =>
        !Number.isSafeInteger(counter) ||
        (counter as number) < 0 ||
        (counter as number) > DURABLE_EVENT_BATCH_MAX_V1,
    ) ||
    (sent as number) + (retryWait as number) + (failed as number) !== claimed
  ) {
    throw new Error("event dispatcher returned an inconsistent batch summary");
  }
  return Object.freeze({
    claimed: claimed as number,
    sent: sent as number,
    retry_wait: retryWait as number,
    failed: failed as number,
  });
}

/**
 * Embeddable polling-shell library for a durable owner outbox dispatcher. This
 * package does not compose production persistence/transport dependencies or
 * expose a deployable process. The injected owner-store lease is the
 * cross-process fence; this shell additionally prevents one process from
 * overlapping its own batch. Batch and stop deadlines request cooperative
 * abort, but the bulkhead remains held until the injected task really settles.
 */
export class EventDispatcherWorkerV1 {
  readonly #dispatchBatch: EventDispatcherBatchPortV1["dispatchBatch"];
  readonly #intervalMs: number;
  readonly #retryBaseDelayMs: number;
  readonly #retryMaxDelayMs: number;
  readonly #batchTimeoutMs: number;
  readonly #stopTimeoutMs: number;
  readonly #random: () => number;
  readonly #onError: (error: unknown) => void | Promise<void>;
  #timer: NodeJS.Timeout | undefined;
  #inFlight: Promise<DurableOutboxDispatchSummaryV1> | undefined;
  #lifecycle: "stopped" | "running" | "stopping" = "stopped";
  #lifecycleGeneration = 0;
  #consecutiveFailures = 0;
  #stopPromise: Promise<void> | undefined;
  #errorReporterInFlight: Promise<void> | undefined;
  #hasPendingError = false;
  #pendingError: unknown;
  #activeController: AbortController | undefined;

  public constructor(options: EventDispatcherWorkerOptionsV1) {
    const dispatcher = options?.dispatcher;
    const dispatchBatch = dispatcher?.dispatchBatch;
    const random = options?.random;
    const onError = options?.on_error;
    if (
      options === null ||
      typeof options !== "object" ||
      typeof dispatchBatch !== "function" ||
      (random !== undefined && typeof random !== "function") ||
      (onError !== undefined && typeof onError !== "function")
    ) {
      throw new Error("invalid event dispatcher worker options");
    }
    const intervalMs = options.interval_ms ?? 1_000;
    if (
      !Number.isSafeInteger(intervalMs) ||
      intervalMs < 100 ||
      intervalMs > 300_000
    ) {
      throw new Error("invalid event dispatcher worker options");
    }
    const retryBaseDelayMs = options.retry_base_delay_ms ?? intervalMs;
    const retryMaxDelayMs = options.retry_max_delay_ms ?? Math.min(
      300_000,
      Math.max(retryBaseDelayMs, retryBaseDelayMs * 32),
    );
    if (
      !Number.isSafeInteger(retryBaseDelayMs) ||
      retryBaseDelayMs < 100 ||
      retryBaseDelayMs > 300_000 ||
      !Number.isSafeInteger(retryMaxDelayMs) ||
      retryMaxDelayMs < retryBaseDelayMs ||
      retryMaxDelayMs > 300_000
    ) {
      throw new Error("invalid event dispatcher worker options");
    }
    const stopTimeoutMs = options.stop_timeout_ms ?? 30_000;
    if (
      !Number.isSafeInteger(stopTimeoutMs) ||
      stopTimeoutMs < 100 ||
      stopTimeoutMs > 300_000
    ) {
      throw new Error("invalid event dispatcher worker options");
    }
    const batchTimeoutMs = options.batch_timeout_ms ?? 30_000;
    if (
      !Number.isSafeInteger(batchTimeoutMs) ||
      batchTimeoutMs < 100 ||
      batchTimeoutMs > 300_000
    ) {
      throw new Error("invalid event dispatcher worker options");
    }
    this.#dispatchBatch = dispatchBatch.bind(dispatcher);
    this.#intervalMs = intervalMs;
    this.#retryBaseDelayMs = retryBaseDelayMs;
    this.#retryMaxDelayMs = retryMaxDelayMs;
    this.#batchTimeoutMs = batchTimeoutMs;
    this.#stopTimeoutMs = stopTimeoutMs;
    this.#random = random ?? Math.random;
    this.#onError = onError ?? (() => undefined);
  }

  public runOnce(): Promise<DurableOutboxDispatchSummaryV1> {
    if (this.#inFlight !== undefined) return this.#inFlight;
    if (this.#lifecycle === "stopping") {
      return Promise.reject(
        new Error("event dispatcher worker is stopping"),
      );
    }
    // Defer the injected call until after the shared promise is installed.
    // This closes synchronous re-entry through instrumentation or callbacks.
    const controller = new AbortController();
    const batchTimer = setTimeout(() => {
      controller.abort(new Error("event dispatcher batch timed out"));
    }, this.#batchTimeoutMs);
    batchTimer.unref();
    const work = Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        return this.#dispatchBatch(controller.signal);
      })
      .then(assertDispatchSummaryV1);
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
      // Keep only the newest pending error. A stuck reporter therefore retains
      // constant memory and cannot create an unbounded callback fan-out.
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
      throw new Error("event dispatcher retry random source must return [0, 1)");
    }
    // Equal jitter retains a non-zero lower bound while desynchronizing peers.
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
          // A broken entropy source is configuration failure, not permission to
          // spin. Stop this generation after reporting it through the same
          // bounded channel.
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
      throw new Error("event dispatcher worker is stopping");
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
      new Error("event dispatcher worker is stopping"),
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
              `event dispatcher worker did not stop within ${this.#stopTimeoutMs}ms`,
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
