import { randomUUID } from "node:crypto";

import {
  createDurableEventConsumerWorkerV1,
  createRedisNamespaceV1,
  openVerifiedRedisStreamCompositionV1,
  type VerifiedRedisStreamCompositionV1,
} from "@pai/eventing";
import type { DeploymentEnvironmentV1, ReleaseChannelV1 } from "@pai/contracts";

import type { RuntimeSkillSecurityProjectionV1 } from "./skill-security-projection.v1.js";

export interface ActionRuntimeSkillProjectionRuntimeOptionsV1 {
  readonly redis_url: string;
  readonly deployment_environment: DeploymentEnvironmentV1;
  readonly release_channel: ReleaseChannelV1;
  readonly stream_epoch: string;
  readonly stream_generation: number;
  readonly projection: RuntimeSkillSecurityProjectionV1;
  readonly consumer_name?: string;
  readonly poll_interval_ms?: number;
}

export interface ActionRuntimeSkillProjectionRuntimeV1 {
  readonly redis: VerifiedRedisStreamCompositionV1;
  start(): void;
  runOnce(signal?: AbortSignal): Promise<void>;
  checkReadiness(signal: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

const consumerNamePatternV1 = /^[a-z][a-z0-9_]{0,63}$/u;

export async function openActionRuntimeSkillProjectionRuntimeV1(
  options: ActionRuntimeSkillProjectionRuntimeOptionsV1,
): Promise<ActionRuntimeSkillProjectionRuntimeV1> {
  const consumerName =
    options.consumer_name ?? "action_runtime_skill_projection_v1";
  const pollIntervalMs = options.poll_interval_ms ?? 1_000;
  if (
    !consumerNamePatternV1.test(consumerName) ||
    !Number.isSafeInteger(pollIntervalMs) ||
    pollIntervalMs < 100 ||
    pollIntervalMs > 10_000
  ) {
    throw new Error("Action Runtime skill projection worker config is invalid");
  }
  const namespace = createRedisNamespaceV1({
    deployment_environment: options.deployment_environment,
    release_channel: options.release_channel,
    owner_service: "skill_registry",
    stream_epoch: options.stream_epoch,
    stream_generation: options.stream_generation,
  });
  const redis = await openVerifiedRedisStreamCompositionV1({
    url: options.redis_url,
    namespace,
    routes: {
      "action_runtime.skill_projection": "consumer:action_runtime",
    },
  });
  const delivery = redis.createConsumerGroup({
    target: "action_runtime.skill_projection",
    group: "action_runtime_skill_projection_v1",
    consumer: consumerName,
  });
  await delivery.ensureGroup();
  const worker = createDurableEventConsumerWorkerV1(
    delivery,
    options.projection.inbox,
    {
      consumer_service: "action_runtime",
      dead_letter: options.projection.dead_letter,
    },
  );
  const lifecycle = new AbortController();
  let started = false;
  let closed = false;
  let timer: NodeJS.Timeout | undefined;
  let active: Promise<void> | undefined;
  let lastError: unknown;

  async function drainV1(
    read: () => Promise<Readonly<{
      received: number;
      failed: number;
      dead_lettered: number;
    }>>,
  ): Promise<void> {
    for (let page = 0; page < 100; page += 1) {
      const summary = await read();
      if (summary.failed > 0 || summary.dead_lettered > 0) {
        throw new Error("Runtime skill projection stream has an unresolved delivery");
      }
      if (summary.received === 0) return;
    }
    throw new Error("Runtime skill projection backlog exceeded one bounded cycle");
  }

  const runOnce = async (signal = lifecycle.signal): Promise<void> => {
    signal.throwIfAborted();
    await drainV1(() => worker.consumeOwnPendingBatch({ count: 16 }));
    signal.throwIfAborted();
    await drainV1(() => worker.consumeNewBatch({ count: 16, block_ms: 1 }));
    signal.throwIfAborted();
    await options.projection.markSynchronized(
      `skill-projection-sync:${randomUUID()}`,
      signal,
    );
    lastError = undefined;
  };

  function scheduleV1(): void {
    if (closed || lifecycle.signal.aborted) return;
    timer = setTimeout(() => {
      if (active !== undefined) {
        scheduleV1();
        return;
      }
      active = runOnce()
        .catch((error: unknown) => {
          if (!closed) lastError = error;
        })
        .finally(() => {
          active = undefined;
          scheduleV1();
        });
    }, pollIntervalMs);
    timer.unref?.();
  }

  return Object.freeze({
    redis,
    start() {
      if (started || closed) return;
      started = true;
      active = runOnce()
        .catch((error: unknown) => {
          if (!closed) lastError = error;
        })
        .finally(() => {
          active = undefined;
          scheduleV1();
        });
    },
    runOnce,
    async checkReadiness(signal: AbortSignal) {
      signal.throwIfAborted();
      if (!started || closed) {
        throw new Error("Action Runtime skill projection worker is not running");
      }
      await redis.checkReadiness(signal);
      await options.projection.checkReadiness(signal);
      if (lastError !== undefined) {
        throw new Error("Action Runtime skill projection worker has not recovered", {
          cause: lastError,
        });
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      lifecycle.abort(new Error("Action Runtime skill projection worker is stopping"));
      if (timer !== undefined) clearTimeout(timer);
      await active?.catch(() => undefined);
      await redis.close();
    },
  });
}
