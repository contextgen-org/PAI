import { afterEach, describe, expect, it, vi } from "vitest";

import { EventDispatcherWorkerV1 } from "../src/index.js";

describe("event dispatcher polling shell", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fails closed when the durable dispatcher dependency is absent", () => {
    expect(
      () =>
        new EventDispatcherWorkerV1({
          dispatcher: undefined,
        } as never),
    ).toThrow("invalid event dispatcher worker options");
  });

  it("treats a widened or inconsistent batch summary as a worker failure", async () => {
    const widened = new EventDispatcherWorkerV1({
      dispatcher: {
        async dispatchBatch() {
          return {
            claimed: 0,
            sent: 0,
            retry_wait: 0,
            failed: 0,
            ignored: true,
          } as never;
        },
      },
    });
    await expect(widened.runOnce()).rejects.toThrow("malformed batch summary");

    const inconsistent = new EventDispatcherWorkerV1({
      dispatcher: {
        async dispatchBatch() {
          return { claimed: 2, sent: 1, retry_wait: 0, failed: 0 };
        },
      },
    });
    await expect(inconsistent.runOnce()).rejects.toThrow(
      "inconsistent batch summary",
    );

    const oversized = new EventDispatcherWorkerV1({
      dispatcher: {
        async dispatchBatch() {
          return { claimed: 17, sent: 17, retry_wait: 0, failed: 0 };
        },
      },
    });
    await expect(oversized.runOnce()).rejects.toThrow(
      "inconsistent batch summary",
    );
  });

  it("binds the configured port method and rejects accessor-backed summaries", async () => {
    let configuredCalls = 0;
    let replacementCalls = 0;
    const dispatcher = {
      async dispatchBatch() {
        configuredCalls += 1;
        return { claimed: 0, sent: 0, retry_wait: 0, failed: 0 };
      },
    };
    const worker = new EventDispatcherWorkerV1({ dispatcher });
    dispatcher.dispatchBatch = async () => {
      replacementCalls += 1;
      return { claimed: 0, sent: 0, retry_wait: 0, failed: 0 };
    };
    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 0,
      sent: 0,
      retry_wait: 0,
      failed: 0,
    });
    expect({ configuredCalls, replacementCalls }).toEqual({
      configuredCalls: 1,
      replacementCalls: 0,
    });

    let getterCalls = 0;
    const accessorSummary = {
      claimed: 0,
      sent: 0,
      retry_wait: 0,
      failed: 0,
    } as Record<string, unknown>;
    Object.defineProperty(accessorSummary, "claimed", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return 0;
      },
    });
    const accessorWorker = new EventDispatcherWorkerV1({
      dispatcher: {
        async dispatchBatch() {
          return accessorSummary as never;
        },
      },
    });
    await expect(accessorWorker.runOnce()).rejects.toThrow(
      "malformed batch summary",
    );
    expect(getterCalls).toBe(0);
  });

  it("does not overlap a batch and waits for it during graceful stop", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const worker = new EventDispatcherWorkerV1({
      dispatcher: {
        async dispatchBatch() {
          calls += 1;
          await blocked;
          return { claimed: 0, sent: 0, retry_wait: 0, failed: 0 };
        },
      },
      interval_ms: 100,
    });
    const first = worker.runOnce();
    expect(worker.runOnce()).toBe(first);
    await Promise.resolve();
    expect(calls).toBe(1);
    release();
    await worker.stop();
    await expect(first).resolves.toMatchObject({ claimed: 0 });
  });

  it("turns synchronous port failures into rejections and isolates a throwing reporter", async () => {
    let calls = 0;
    let reports = 0;
    const failure = new Error("synchronous dispatcher failure");
    const worker = new EventDispatcherWorkerV1({
      dispatcher: {
        dispatchBatch() {
          calls += 1;
          throw failure;
        },
      },
      interval_ms: 100,
      async on_error(error) {
        reports += 1;
        expect(error).toBe(failure);
        await Promise.resolve();
        throw new Error("broken error reporter");
      },
    });

    expect(() => worker.runOnce()).not.toThrow();
    await expect(worker.runOnce()).rejects.toBe(failure);
    worker.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await worker.stop();

    expect(calls).toBeGreaterThanOrEqual(2);
    expect(reports).toBeGreaterThanOrEqual(1);
  });

  it("installs the single-flight promise before a synchronous re-entry", async () => {
    let worker!: EventDispatcherWorkerV1;
    let calls = 0;
    let nested: Promise<unknown> | undefined;
    worker = new EventDispatcherWorkerV1({
      dispatcher: {
        dispatchBatch() {
          calls += 1;
          if (calls === 1) nested = worker.runOnce();
          return Promise.resolve({
            claimed: 0,
            sent: 0,
            retry_wait: 0,
            failed: 0,
          });
        },
      },
      interval_ms: 100,
    });

    const outer = worker.runOnce();
    await Promise.resolve();

    expect(nested).toBe(outer);
    await expect(outer).resolves.toMatchObject({ claimed: 0 });
    expect(calls).toBe(1);
  });

  it("linearizes stop against a concurrent start and permits restart after stop", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const worker = new EventDispatcherWorkerV1({
      dispatcher: {
        async dispatchBatch() {
          calls += 1;
          if (calls === 1) await blocked;
          return { claimed: 0, sent: 0, retry_wait: 0, failed: 0 };
        },
      },
      interval_ms: 100,
    });

    worker.start();
    await Promise.resolve();
    const stopping = worker.stop();
    expect(() => worker.start()).toThrow("event dispatcher worker is stopping");
    expect(worker.stop()).toBe(stopping);
    release();
    await stopping;
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    expect(calls).toBe(1);

    worker.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toBe(2);
    await worker.stop();
  });

  it("backs off persistent failures and bounds a hanging error reporter", async () => {
    vi.useFakeTimers();
    let calls = 0;
    let reports = 0;
    const never = new Promise<void>(() => undefined);
    const worker = new EventDispatcherWorkerV1({
      dispatcher: {
        async dispatchBatch() {
          calls += 1;
          throw new Error("database unavailable");
        },
      },
      interval_ms: 100,
      retry_base_delay_ms: 200,
      retry_max_delay_ms: 800,
      random: () => 0,
      on_error() {
        reports += 1;
        return never;
      },
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect({ calls, reports }).toEqual({ calls: 1, reports: 1 });

    await vi.advanceTimersByTimeAsync(99);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect({ calls, reports }).toEqual({ calls: 2, reports: 1 });

    await vi.advanceTimersByTimeAsync(199);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect({ calls, reports }).toEqual({ calls: 3, reports: 1 });

    await worker.stop();
  });

  it("aborts a hanging dispatch but rejects bounded stop until it really settles", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let observedSignal: AbortSignal | undefined;
    const worker = new EventDispatcherWorkerV1({
      dispatcher: {
        async dispatchBatch(signal) {
          observedSignal = signal;
          await blocked;
          return { claimed: 0, sent: 0, retry_wait: 0, failed: 0 };
        },
      },
      interval_ms: 100,
      batch_timeout_ms: 300_000,
      stop_timeout_ms: 100,
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    const stopping = worker.stop();
    const stopFailure = expect(stopping).rejects.toThrow(
      "did not stop within 100ms",
    );
    expect(observedSignal?.aborted).toBe(true);
    expect(() => worker.start()).toThrow("event dispatcher worker is stopping");
    await vi.advanceTimersByTimeAsync(100);
    await stopFailure;
    expect(() => worker.start()).toThrow("event dispatcher worker is stopping");

    release();
    await vi.advanceTimersByTimeAsync(0);
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();
  });

  it("requests cooperative abort when a batch exceeds its deadline", async () => {
    vi.useFakeTimers();
    let aborts = 0;
    const worker = new EventDispatcherWorkerV1({
      dispatcher: {
        dispatchBatch(signal) {
          return new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              aborts += 1;
              reject(signal.reason);
            }, { once: true });
          });
        },
      },
      interval_ms: 100,
      batch_timeout_ms: 100,
      random: () => 0,
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(aborts).toBe(1);
    await worker.stop();
  });

  it("releases the in-process bulkhead after an abort-aware timed-out batch settles", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const worker = new EventDispatcherWorkerV1({
      dispatcher: {
        dispatchBatch(signal) {
          calls += 1;
          if (calls > 1) {
            return Promise.resolve({
              claimed: 0,
              sent: 0,
              retry_wait: 0,
              failed: 0,
            });
          }
          return new Promise<never>((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(signal.reason),
              { once: true },
            );
          });
        },
      },
      batch_timeout_ms: 100,
    });

    const first = worker.runOnce();
    const timedOut = expect(first).rejects.toThrow(
      "event dispatcher batch timed out",
    );
    await vi.advanceTimersByTimeAsync(100);
    await timedOut;
    await vi.advanceTimersByTimeAsync(0);

    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 0,
      sent: 0,
      retry_wait: 0,
      failed: 0,
    });
    expect(calls).toBe(2);
  });
});
