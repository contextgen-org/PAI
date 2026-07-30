import type { KnowThatApplicationV1 } from "./knowthat-application.v1.js";

export interface KnowThatPromotionCommandWorkerV1 {
  start(): void;
  runOnce(signal?: AbortSignal): Promise<Readonly<{
    ack_attempted: number;
    release_attempted: number;
    sent: number;
    retry_wait: number;
    failed: number;
  }>>;
  checkReadiness(signal: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

function boundedIntegerV1(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is outside its supported range`);
  }
  return value;
}

export function createKnowThatPromotionCommandWorkerV1(
  options: Readonly<{
    application: KnowThatApplicationV1;
    poll_interval_ms?: number;
    batch_size?: number;
  }>,
): KnowThatPromotionCommandWorkerV1 {
  const pollIntervalMs = boundedIntegerV1(
    options.poll_interval_ms ?? 1_000,
    50,
    60_000,
    "KnowThat promotion command poll_interval_ms",
  );
  const batchSize = boundedIntegerV1(
    options.batch_size ?? 16,
    1,
    100,
    "KnowThat promotion command batch_size",
  );
  const lifecycle = new AbortController();
  let started = false;
  let closed = false;
  let active: Promise<unknown> | undefined;
  let timer: NodeJS.Timeout | undefined;
  let lastCycleCompletedAt = 0;

  const runOnce = async (
    signal = lifecycle.signal,
  ): Promise<Readonly<{
    ack_attempted: number;
    release_attempted: number;
    sent: number;
    retry_wait: number;
    failed: number;
  }>> => {
    signal.throwIfAborted();
    const now = new Date();
    const releases = await options.application.reconcilePromotionReleases(
      signal,
      now,
      batchSize,
    );
    signal.throwIfAborted();
    const acks = await options.application.reconcilePromotionAcks(
      signal,
      now,
      batchSize,
    );
    lastCycleCompletedAt = Date.now();
    return Object.freeze({
      ack_attempted: acks.attempted,
      release_attempted: releases.attempted,
      sent: acks.sent + releases.sent,
      retry_wait: acks.retry_wait + releases.retry_wait,
      failed: acks.failed + releases.failed,
    });
  };

  const schedule = (): void => {
    if (closed || lifecycle.signal.aborted) return;
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
      if (closed) throw new Error("KnowThat promotion command worker is closed");
      if (
        started &&
        lastCycleCompletedAt !== 0 &&
        Date.now() - lastCycleCompletedAt > pollIntervalMs * 10
      ) {
        throw new Error(
          "KnowThat promotion command worker has stopped making progress",
        );
      }
    },

    async close() {
      if (closed) return;
      closed = true;
      lifecycle.abort();
      if (timer !== undefined) clearTimeout(timer);
      await active?.catch(() => undefined);
    },
  });
}
