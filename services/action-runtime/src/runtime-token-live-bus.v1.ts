import { createHash } from "node:crypto";

import {
  RuntimeTokenSseEventV1Schema,
  type RuntimeTokenSseEventV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import { Value } from "@sinclair/typebox/value";
import {
  createClient,
  type RedisClientType,
} from "redis";

import type {
  RuntimeQueryBotScopeV1,
} from "./runtime-query.v1.js";
import type { RuntimeTokenLiveSourceV1 } from "./runtime-token-stream.v1.js";

const TOKEN_CHANNEL_PREFIX_V1 = "pai:v1:runtime-token:";
const MAX_SUBSCRIBER_FRAMES_V1 = 128;
const MAX_SUBSCRIBER_BYTES_V1 = 1_048_576;

export interface RuntimeTokenPublishInputV1 {
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly scope: RuntimeQueryBotScopeV1;
  readonly token: string;
  readonly emitted_at: string;
}

export interface RuntimeTokenPublisherV1 {
  publish(
    input: RuntimeTokenPublishInputV1,
    signal?: AbortSignal,
  ): Promise<void>;
}

export interface RedisRuntimeTokenLiveBusV1 {
  readonly source: RuntimeTokenLiveSourceV1;
  readonly publisher: RuntimeTokenPublisherV1;
  close(): Promise<void>;
}

function assertIdentifierV1(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error(`${label} is invalid`);
  }
}

function assertScopeV1(value: RuntimeQueryBotScopeV1): void {
  assertIdentifierV1(value.workspace_id, "token workspace_id");
  assertIdentifierV1(value.bot_id, "token bot_id");
  assertIdentifierV1(value.owner_agent_id, "token owner_agent_id");
  if (
    !["local", "dev", "staging", "prod"].includes(
      value.deployment_environment,
    ) ||
    !["stable", "canary"].includes(value.release_channel)
  ) {
    throw new Error("token scope is invalid");
  }
}

function tokenChannelV1(input: Readonly<{
  runtime_run_id: string;
  trigger_process_id: string;
  scope: RuntimeQueryBotScopeV1;
}>): string {
  assertIdentifierV1(input.runtime_run_id, "token runtime_run_id");
  assertIdentifierV1(input.trigger_process_id, "token trigger_process_id");
  assertScopeV1(input.scope);
  const fingerprint = createHash("sha256")
    .update(canonicalJsonV1({
      schema_version: "runtime_token_channel.v1",
      runtime_run_id: input.runtime_run_id,
      trigger_process_id: input.trigger_process_id,
      ...input.scope,
    }))
    .digest("hex");
  return `${TOKEN_CHANNEL_PREFIX_V1}${fingerprint}`;
}

function tokenFrameV1(input: RuntimeTokenPublishInputV1): RuntimeTokenSseEventV1 {
  const frame = {
    schema_version: "runtime_token_sse_event.v1" as const,
    runtime_run_id: input.runtime_run_id,
    trigger_process_id: input.trigger_process_id,
    token: input.token,
    emitted_at: input.emitted_at,
  };
  if (!Value.Check(RuntimeTokenSseEventV1Schema, frame)) {
    throw new Error("runtime token frame is invalid");
  }
  return Object.freeze(frame);
}

function parseTokenFrameV1(
  value: string,
  runtimeRunId: string,
  triggerProcessId: string,
): RuntimeTokenSseEventV1 {
  let candidate: unknown;
  try {
    candidate = JSON.parse(value);
  } catch {
    throw new Error("runtime token transport emitted invalid JSON");
  }
  if (
    !Value.Check(RuntimeTokenSseEventV1Schema, candidate) ||
    candidate.runtime_run_id !== runtimeRunId ||
    candidate.trigger_process_id !== triggerProcessId ||
    canonicalJsonV1(candidate) !== value
  ) {
    throw new Error("runtime token transport frame drifted");
  }
  return Object.freeze(candidate);
}

async function closeRedisClientV1(client: RedisClientType): Promise<void> {
  if (!client.isOpen) return;
  await client.quit().catch(() => {
    client.destroy();
  });
}

export async function openRedisRuntimeTokenLiveBusV1(
  redisUrl: string,
): Promise<RedisRuntimeTokenLiveBusV1> {
  if (typeof redisUrl !== "string" || redisUrl.length < 1) {
    throw new Error("runtime token Redis URL is required");
  }
  const publisherClient = createClient({
    url: redisUrl,
    socket: { connectTimeout: 5_000 },
  });
  publisherClient.on("error", () => undefined);
  await publisherClient.connect();
  let closed = false;
  const activeStreams = new Set<AbortController>();

  const publisher: RuntimeTokenPublisherV1 = {
    async publish(
      input: RuntimeTokenPublishInputV1,
      signal?: AbortSignal,
    ) {
      const throwIfAborted = (): void => {
        if (signal?.aborted === true) throw signal.reason;
      };
      if (closed) throw new Error("runtime token bus is closed");
      throwIfAborted();
      const channel = tokenChannelV1(input);
      const payload = canonicalJsonV1(tokenFrameV1(input));
      if (Buffer.byteLength(payload, "utf8") > 32_768) {
        throw new Error("runtime token transport frame is too large");
      }
      await publisherClient.publish(channel, payload);
      throwIfAborted();
    },
  };
  Object.freeze(publisher);

  const source: RuntimeTokenLiveSourceV1 = {
    stream(
      input: Readonly<{
        runtime_run_id: string;
        trigger_process_id: string;
        scope: RuntimeQueryBotScopeV1;
      }>,
      signal: AbortSignal,
    ) {
      const channel = tokenChannelV1(input);
      return Object.freeze({
        async *[Symbol.asyncIterator]() {
          if (closed) throw new Error("runtime token bus is closed");
          if (signal.aborted) return;
          const localController = new AbortController();
          activeStreams.add(localController);
          const combinedSignal = AbortSignal.any([
            signal,
            localController.signal,
          ]);
          const subscriber = publisherClient.duplicate();
          const queue: Array<Readonly<{
            frame: RuntimeTokenSseEventV1;
            bytes: number;
          }>> = [];
          let queuedBytes = 0;
          let failure: unknown;
          let wake: (() => void) | undefined;
          const notify = (): void => {
            const current = wake;
            wake = undefined;
            current?.();
          };
          const fail = (error: unknown): void => {
            failure ??= error;
            notify();
          };
          const onAbort = (): void => notify();
          const onMessage = (message: string): void => {
            try {
              const bytes = Buffer.byteLength(message, "utf8");
              if (
                queue.length >= MAX_SUBSCRIBER_FRAMES_V1 ||
                queuedBytes + bytes > MAX_SUBSCRIBER_BYTES_V1
              ) {
                throw new Error("runtime token subscriber buffer overflowed");
              }
              const frame = parseTokenFrameV1(
                message,
                input.runtime_run_id,
                input.trigger_process_id,
              );
              queue.push(Object.freeze({ frame, bytes }));
              queuedBytes += bytes;
              notify();
            } catch (error) {
              fail(error);
            }
          };
          subscriber.on("error", fail);
          combinedSignal.addEventListener("abort", onAbort, { once: true });
          try {
            await subscriber.connect();
            if (combinedSignal.aborted) return;
            await subscriber.subscribe(channel, onMessage);
            while (!combinedSignal.aborted) {
              if (failure !== undefined) throw failure;
              const item = queue.shift();
              if (item !== undefined) {
                queuedBytes -= item.bytes;
                yield item.frame;
                continue;
              }
              await new Promise<void>((resolve) => {
                wake = resolve;
                if (
                  combinedSignal.aborted ||
                  failure !== undefined ||
                  queue.length > 0
                ) {
                  notify();
                }
              });
            }
          } finally {
            combinedSignal.removeEventListener("abort", onAbort);
            activeStreams.delete(localController);
            if (subscriber.isOpen) {
              await subscriber.unsubscribe(channel).catch(() => undefined);
            }
            await closeRedisClientV1(subscriber);
          }
        },
      });
    },

    async checkReadiness(signal?: AbortSignal) {
      const throwIfAborted = (): void => {
        if (signal?.aborted === true) throw signal.reason;
      };
      if (closed) throw new Error("runtime token bus is closed");
      throwIfAborted();
      const pong = await publisherClient.ping();
      throwIfAborted();
      if (pong !== "PONG") throw new Error("runtime token Redis is unavailable");
    },
  };
  Object.freeze(source);

  return Object.freeze({
    source,
    publisher,
    async close() {
      if (closed) return;
      closed = true;
      for (const controller of activeStreams) {
        controller.abort(new Error("runtime token bus is closing"));
      }
      await closeRedisClientV1(publisherClient);
    },
  });
}
