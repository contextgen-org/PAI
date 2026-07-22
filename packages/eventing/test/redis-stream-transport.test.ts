import { describe, expect, it } from "vitest";

import {
  buildRedisStreamMessageV1,
  canonicalPayloadHashV1,
  createRedisNamespaceV1,
  createRedisDependencyMonitorV1,
  createRedisStreamConsumerGroupPortV1,
  loadRedisRuntimeConfigV1,
  namespacedRedisKeyV1,
  openVerifiedRedisStreamCompositionV1,
  redisReconnectDelayV1,
} from "../src/index.js";

const envelope = {
  event_id: "evt_timer_001",
  event_type: "timer.occurrence.due",
  schema_version: "timer_event.v1",
  producer: "timer_trigger_app",
  occurred_at: "2026-07-21T05:00:00Z",
  idempotency_key: "occurrence_001:due",
  trace_id: "trace_001",
  payload: {
    scope_kind: "bot",
    workspace_id: "workspace_001",
    bot_id: "bot_001",
    owner_agent_id: "owner_agent_001",
    deployment_environment: "dev",
    release_channel: "stable",
    occurrence_id: "occurrence_001",
    schedule_id: "schedule_001",
    scheduled_fire_at: "2026-07-21T05:00:00Z",
    effective_fire_at: "2026-07-21T05:00:00Z",
    dedupe_key: "timer:occurrence_001",
    is_catch_up: false,
  },
} as const;

describe("Redis Stream transport V1", () => {
  it("namespaces every physical key by environment, channel, owner and schema", () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "canary",
      owner_service: "timer_trigger_app",
    });
    expect(namespacedRedisKeyV1(namespace, "stream:timer_events")).toBe(
      "pai:dev:canary:timer_trigger_app:v1:stream:timer_events",
    );
    expect(() => namespacedRedisKeyV1(namespace, "../escape")).toThrow();
    expect(() =>
      createRedisNamespaceV1({
        deployment_environment: "dev:escape",
        release_channel: "canary",
        owner_service: "timer_trigger_app",
      } as never),
    ).toThrow(/namespace identity/);
  });

  it("publishes exactly the eight wire fields and no storage metadata", () => {
    const message = buildRedisStreamMessageV1(envelope);
    expect(Object.keys(message).sort()).toEqual(
      [
        "event_id",
        "event_type",
        "schema_version",
        "producer",
        "occurred_at",
        "idempotency_key",
        "trace_id",
        "payload",
      ].sort(),
    );
    expect(message).not.toHaveProperty("payload_hash");
    expect(message).not.toHaveProperty("status");
    expect(JSON.parse(message.payload)).toEqual(envelope.payload);
    expect(canonicalPayloadHashV1(envelope.payload)).toMatch(/^sha256:/);
  });

  it("uses bounded exponential reconnect backoff", () => {
    expect(redisReconnectDelayV1(0, 100, 5_000)).toBe(100);
    expect(redisReconnectDelayV1(4, 100, 5_000)).toBe(1_600);
    expect(redisReconnectDelayV1(20, 100, 5_000)).toBe(5_000);
  });

  it("loads bounded Redis settings without exposing credentials in errors", () => {
    expect(
      loadRedisRuntimeConfigV1({
        PAI_REDIS_URL: "rediss://service:secret@redis.internal:6380/0",
        PAI_REDIS_CONNECT_TIMEOUT_MS: "1500",
      }),
    ).toMatchObject({
      connect_timeout_ms: 1_500,
      startup_timeout_ms: 10_000,
      aof_ack_timeout_ms: 2_000,
      reconnect_base_delay_ms: 100,
      reconnect_max_delay_ms: 5_000,
      commands_queue_max_length: 1_024,
    });
    expect(() =>
      loadRedisRuntimeConfigV1({
        PAI_REDIS_URL: "rediss://service:do-not-log@redis.internal:6380/0",
        PAI_REDIS_CONNECT_TIMEOUT_MS: "invalid",
      }),
    ).toThrowError(/PAI_REDIS_CONNECT_TIMEOUT_MS must be an integer/);
    try {
      loadRedisRuntimeConfigV1({
        PAI_REDIS_URL: "rediss://service:do-not-log@redis.internal:6380/0",
        PAI_REDIS_CONNECT_TIMEOUT_MS: "invalid",
      });
    } catch (error) {
      expect(String(error)).not.toContain("do-not-log");
    }
  });

  it("rejects an unbounded Redis command queue configuration", () => {
    expect(() =>
      loadRedisRuntimeConfigV1({
        PAI_REDIS_URL: "redis://redis.internal:6379",
        PAI_REDIS_COMMANDS_QUEUE_MAX_LENGTH: "10001",
      }),
    ).toThrow(/runtime settings are outside the V1 bounds/);
  });

  it("rejects Observation as an outbox transport target", async () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "memory",
    });
    await expect(
      openVerifiedRedisStreamCompositionV1({
        url: "redis://127.0.0.1:1",
        namespace,
        routes: { observation_gateway: "stream:memory_events" },
      }),
    ).rejects.toThrow(/outbox route target/u);
    await expect(
      openVerifiedRedisStreamCompositionV1({
        url: "redis://127.0.0.1:1",
        namespace,
        routes: { memory: "stream:memory_events" },
      }),
    ).rejects.toThrow(/outbox route target/u);
  });

  it("enters degraded mode after three failures and recovers only on success", () => {
    const clock = { now: new Date("2026-07-21T05:00:00.000Z") };
    const monitor = createRedisDependencyMonitorV1({
      now: () => new Date(clock.now),
    });
    expect(monitor.recordFailure().status).toBe("healthy");
    expect(monitor.recordFailure().status).toBe("healthy");
    clock.now = new Date("2026-07-21T05:00:10.000Z");
    expect(monitor.recordFailure()).toMatchObject({
      status: "degraded",
      consecutive_failures: 3,
    });
    clock.now = new Date("2026-07-21T05:00:20.000Z");
    expect(monitor.recordSuccess()).toMatchObject({
      status: "healthy",
      consecutive_failures: 0,
      changed_at: "2026-07-21T05:00:20.000Z",
    });
  });

  it("reads, reclaims and acknowledges through Redis consumer-group commands", async () => {
    const commands: string[][] = [];
    const client = {
      async sendCommand(args: readonly string[]): Promise<unknown> {
        commands.push([...args]);
        if (args[0] === "XGROUP") {
          throw new Error("BUSYGROUP Consumer Group name already exists");
        }
        if (args[0] === "XREADGROUP") {
          return [
            [
              "pai:dev:stable:timer_trigger_app:v1:stream:timer_events",
              [
                [
                  "1-0",
                  Object.entries(buildRedisStreamMessageV1(envelope)).flat(),
                ],
              ],
            ],
          ];
        }
        if (args[0] === "XAUTOCLAIM") {
          return [
            "0-0",
            [["1-0", Object.entries(buildRedisStreamMessageV1(envelope)).flat()]],
            [],
          ];
        }
        if (args[0] === "XACK") return 1;
        throw new Error(`unexpected command ${args[0]}`);
      },
    };
    const consumer = createRedisStreamConsumerGroupPortV1(client, {
      stream: "pai:dev:stable:timer_trigger_app:v1:stream:timer_events",
      group: "trigger_processor",
      consumer: "worker_001",
    });
    await expect(consumer.ensureGroup()).resolves.toBeUndefined();
    await expect(consumer.readNew({ count: 10, block_ms: 0 })).resolves.toEqual([
      { delivery_id: "1-0", envelope },
    ]);
    await expect(
      consumer.reclaimPending({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).resolves.toEqual([{ delivery_id: "1-0", envelope }]);
    await expect(
      consumer.acknowledge({ delivery_ids: ["1-0"] }),
    ).resolves.toEqual({ acknowledged: 1 });
    expect(commands.map((command) => command[0])).toEqual([
      "XGROUP",
      "XREADGROUP",
      "XAUTOCLAIM",
      "XACK",
    ]);
  });
});
