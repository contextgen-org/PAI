import { describe, expect, it } from "vitest";

import {
  buildRedisStreamMessageV1,
  canonicalPayloadHashV1,
  createRedisNamespaceV1,
  createRedisDependencyMonitorV1,
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
  payload: { occurrence_id: "occurrence_001", scheduled: true },
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
});
