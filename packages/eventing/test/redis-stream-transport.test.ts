import { assertOwnerDurableEventEnvelopeV1 } from "@pai/contracts";
import { describe, expect, it } from "vitest";

import {
  buildRedisStreamMessageV1,
  canonicalPayloadHashV1,
  createRedisNamespaceV1,
  createRedisDependencyMonitorV1,
  createRedisStreamConsumerGroupPortV1,
  createRedisStreamReferenceProbeV1,
  loadRedisRuntimeConfigV1,
  namespacedRedisKeyV1,
  openVerifiedRedisStreamCompositionV1,
  REDIS_STREAM_MESSAGE_MAX_BYTES_V1,
  redisReconnectDelayV1,
  redisStreamMessageBytesV1,
  xAddWithLocalAofFenceV1,
} from "../src/index.js";

const envelope = {
  event_id: "evt_trigger_rejected_001",
  event_type: "trigger.rejected",
  schema_version: "trigger_processor_event.v1",
  producer: "trigger_processor",
  occurred_at: "2026-07-21T05:00:00Z",
  idempotency_key: "submit_attempt_001:rejected",
  trace_id: "trace_001",
  payload: {
    workspace_id: "workspace_001",
    bot_id: "bot_001",
    owner_agent_id: "owner_agent_001",
    deployment_environment: "dev",
    release_channel: "stable",
    reason_code: "business_admission_rejected",
    source_ref: "trigger_event:submit_attempt_001",
    submit_attempt_id: "submit_attempt_001",
    rejection_stage: "business_admission",
    rejection_code: "admission_capacity_exceeded",
  },
} as const;

function envelopeAtRedisMessageBytes(targetBytes: number) {
  const minimum = {
    ...envelope,
    payload: { ...envelope.payload, source_ref: "trigger_event:" },
  };
  const minimumBytes = redisStreamMessageBytesV1(
    buildRedisStreamMessageV1(minimum),
  );
  if (targetBytes < minimumBytes) throw new Error("target is below fixture size");
  return {
    ...minimum,
    payload: {
      ...minimum.payload,
      source_ref: `trigger_event:${"x".repeat(targetBytes - minimumBytes)}`,
    },
  } as const;
}

describe("Redis Stream transport V1", () => {
  it("namespaces every physical key by environment, channel, owner and schema", () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "canary",
      owner_service: "timer_trigger_app",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    expect(namespacedRedisKeyV1(namespace, "stream:timer_events")).toBe(
      "pai:dev:canary:timer_trigger_app:v1:epoch_20260722:generation_1:stream:timer_events",
    );
    const nextGeneration = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "canary",
      owner_service: "timer_trigger_app",
      stream_epoch: "epoch_20260722",
      stream_generation: 2,
    });
    expect(namespacedRedisKeyV1(nextGeneration, "stream:timer_events")).toBe(
      "pai:dev:canary:timer_trigger_app:v1:epoch_20260722:generation_2:stream:timer_events",
    );
    expect(() => namespacedRedisKeyV1(namespace, "../escape")).toThrow();
    expect(() =>
      createRedisNamespaceV1({
        deployment_environment: "dev:escape",
        release_channel: "canary",
        owner_service: "timer_trigger_app",
        stream_epoch: "epoch_20260722",
        stream_generation: 1,
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
        PAI_REDIS_URL: "rediss://redis.internal:6379",
        PAI_REDIS_COMMANDS_QUEUE_MAX_LENGTH: "10001",
      }),
    ).toThrow(/runtime settings are outside the V1 bounds/);
  });

  it("allows plaintext Redis only on loopback", () => {
    expect(() =>
      loadRedisRuntimeConfigV1({
        PAI_REDIS_URL: "redis://redis.internal:6379",
      }),
    ).toThrow(/rediss except for loopback/);
    expect(() =>
      loadRedisRuntimeConfigV1({
        PAI_REDIS_URL: "redis://127.0.0.1:6379",
      }),
    ).not.toThrow();
    expect(() =>
      loadRedisRuntimeConfigV1({
        PAI_REDIS_URL: "redis://[::1]:6379",
      }),
    ).not.toThrow();
  });

  it("permits only the explicitly configured local Docker Redis origin", () => {
    expect(() =>
      loadRedisRuntimeConfigV1({
        PAI_DEPLOYMENT_ENVIRONMENT: "local",
        PAI_LOCAL_DOCKER_TRANSPORT: "true",
        PAI_REDIS_URL: "redis://redis:6379",
      }),
    ).not.toThrow();
    expect(() =>
      loadRedisRuntimeConfigV1({
        PAI_DEPLOYMENT_ENVIRONMENT: "local",
        PAI_LOCAL_DOCKER_TRANSPORT: "true",
        PAI_REDIS_URL: "redis://redis.internal:6379",
      }),
    ).toThrow(/rediss except for loopback/u);
  });

  it("does not accept WAITAOF proof from a different Redis connection", async () => {
    let generation = 1;
    const reconnectAfterWrite = {
      async xAdd() {
        generation += 1;
        return "1-0";
      },
      async sendCommand() {
        return [1, 0];
      },
    };
    await expect(
      xAddWithLocalAofFenceV1(reconnectAfterWrite, {
        stream: "pai:test:stream",
        message: { event_id: "evt_1" },
        aof_ack_timeout_ms: 2_000,
        connection_generation: () => generation,
      }),
    ).rejects.toMatchObject({ code: "transport_timeout", retryable: true });

    generation = 1;
    const reconnectDuringWait = {
      async xAdd() {
        return "1-0";
      },
      async sendCommand() {
        generation += 1;
        return [1, 0];
      },
    };
    await expect(
      xAddWithLocalAofFenceV1(reconnectDuringWait, {
        stream: "pai:test:stream",
        message: { event_id: "evt_1" },
        aof_ack_timeout_ms: 2_000,
        connection_generation: () => generation,
      }),
    ).rejects.toMatchObject({ code: "transport_timeout", retryable: true });

    generation = 1;
    await expect(
      xAddWithLocalAofFenceV1(
        {
          async xAdd() {
            return "2-0";
          },
          async sendCommand() {
            return [1, 0];
          },
        },
        {
          stream: "pai:test:stream",
          message: { event_id: "evt_2" },
          aof_ack_timeout_ms: 2_000,
          connection_generation: () => generation,
        },
      ),
    ).resolves.toBe("2-0");
  });

  it("snapshots the Redis publish request before the asynchronous XADD boundary", async () => {
    let releaseWrite!: () => void;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const observed: Array<Readonly<{
      stream: string;
      message: Readonly<Record<string, string>>;
    }>> = [];
    const commands: readonly string[][] = [];
    const mutableCommands = commands as string[][];
    const client = {
      async xAdd(
        stream: string,
        _id: "*",
        message: Readonly<Record<string, string>>,
      ) {
        observed.push({ stream, message });
        await writeGate;
        return "7-0";
      },
      async sendCommand(args: readonly string[]) {
        mutableCommands.push([...args]);
        return [1, 0];
      },
    };
    const mutableMessage = { event_id: "evt_before_await" };
    const request = {
      stream: "pai:test:stream",
      message: mutableMessage,
      aof_ack_timeout_ms: 2_000,
      connection_generation: () => 1,
    };

    const publishing = xAddWithLocalAofFenceV1(client, request);
    Object.assign(request, {
      stream: "pai:mutated:stream",
      aof_ack_timeout_ms: 30_000,
      connection_generation: () => 999,
    });
    mutableMessage.event_id = "evt_mutated_after_xadd";
    releaseWrite();

    await expect(publishing).resolves.toBe("7-0");
    expect(observed).toHaveLength(1);
    expect(observed[0]).toEqual({
      stream: "pai:test:stream",
      message: { event_id: "evt_before_await" },
    });
    expect(Object.isFrozen(observed[0]?.message)).toBe(true);
    expect(commands).toEqual([["WAITAOF", "1", "0", "2000"]]);
  });

  it("uses the exact same bounded message bytes before XADD as the consumer", async () => {
    let xAdds = 0;
    const client = {
      async xAdd() {
        xAdds += 1;
        return `${xAdds}-0`;
      },
      async sendCommand() {
        return [1, 0];
      },
    };
    const boundaryEnvelope = envelopeAtRedisMessageBytes(
      REDIS_STREAM_MESSAGE_MAX_BYTES_V1,
    );
    const oversizedEnvelope = envelopeAtRedisMessageBytes(
      REDIS_STREAM_MESSAGE_MAX_BYTES_V1 + 1,
    );
    assertOwnerDurableEventEnvelopeV1(boundaryEnvelope);
    assertOwnerDurableEventEnvelopeV1(oversizedEnvelope);
    expect(
      redisStreamMessageBytesV1(buildRedisStreamMessageV1(boundaryEnvelope)),
    ).toBe(REDIS_STREAM_MESSAGE_MAX_BYTES_V1);

    await expect(
      xAddWithLocalAofFenceV1(client, {
        stream: "pai:test:stream",
        message: buildRedisStreamMessageV1(boundaryEnvelope),
        aof_ack_timeout_ms: 2_000,
        connection_generation: () => 1,
      }),
    ).resolves.toBe("1-0");
    await expect(
      xAddWithLocalAofFenceV1(client, {
        stream: "pai:test:stream",
        message: buildRedisStreamMessageV1(oversizedEnvelope),
        aof_ack_timeout_ms: 2_000,
        connection_generation: () => 1,
      }),
    ).rejects.toMatchObject({
      code: "transport_rejected",
      retryable: false,
    });
    expect(xAdds).toBe(1);
  });

  it("rejects route targets without a durable consumer subroute", async () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "memory",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    await expect(
      openVerifiedRedisStreamCompositionV1({
        url: "redis://127.0.0.1:1",
        namespace,
        routes: { observation_gateway: "stream:memory_events" },
      }),
    ).rejects.toThrow(/known durable consumer/u);
    await expect(
      openVerifiedRedisStreamCompositionV1({
        url: "redis://127.0.0.1:1",
        namespace,
        routes: { memory: "stream:memory_events" },
      }),
    ).rejects.toThrow(/known durable consumer/u);
  });

  it("rejects physical Redis stream aliases across consumer services", async () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    const routes = {
      "trigger_processor.admission_audit": "stream:shared_events",
      "observation_gateway.trigger_event_append": "stream:shared_events",
    } as const;

    expect(() =>
      createRedisStreamReferenceProbeV1(
        {
          async sendCommand() {
            return [];
          },
        },
        { namespace, routes },
      ),
    ).toThrow(/different consumers must use distinct physical streams/u);
    await expect(
      openVerifiedRedisStreamCompositionV1({
        url: "redis://127.0.0.1:1",
        namespace,
        routes,
      }),
    ).rejects.toThrow(/different consumers must use distinct physical streams/u);
  });

  it("rejects a forged Redis namespace prefix before issuing commands", () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    let commands = 0;
    expect(() =>
      createRedisStreamConsumerGroupPortV1(
        {
          async sendCommand() {
            commands += 1;
            return null;
          },
        },
        {
          stream: "pai:forged:stream:trigger_events",
          group: "trigger_processor",
          consumer: "worker_001",
          namespace: {
            ...namespace,
            prefix: "pai:forged",
          },
        },
      ),
    ).toThrow(/canonical identity/u);
    expect(commands).toBe(0);
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
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    const commands: string[][] = [];
    let xAutoClaimResponse: unknown = [
      "5-0",
      [["1-0", Object.entries(buildRedisStreamMessageV1(envelope)).flat()]],
      ["0-9"],
    ];
    const client = {
      async sendCommand(args: readonly string[]): Promise<unknown> {
        commands.push([...args]);
        if (args[0] === "XGROUP") {
          throw new Error("BUSYGROUP Consumer Group name already exists");
        }
        if (args[0] === "XREADGROUP") {
          return [
            [
              "pai:dev:stable:trigger_processor:v1:epoch_20260722:generation_1:stream:trigger_events",
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
          return xAutoClaimResponse;
        }
        if (args[0] === "XACK") return 1;
        throw new Error(`unexpected command ${args[0]}`);
      },
    };
    const consumerOptions = {
      stream: "pai:dev:stable:trigger_processor:v1:epoch_20260722:generation_1:stream:trigger_events",
      group: "trigger_processor",
      consumer: "worker_001",
      namespace,
    };
    const consumer = createRedisStreamConsumerGroupPortV1(
      client,
      consumerOptions,
    );
    Object.assign(consumerOptions, {
      stream: "pai:mutated:stream",
      group: "mutated_group",
      consumer: "mutated_consumer",
    });
    await expect(consumer.ensureGroup()).resolves.toBeUndefined();
    await expect(consumer.readNew({ count: 10, block_ms: 0 })).resolves.toEqual([
      {
        kind: "event",
        delivery_id: "1-0",
        delivery_ref:
          "pai:dev:stable:trigger_processor:v1:epoch_20260722:generation_1:stream:trigger_events#1-0",
        envelope,
      },
    ]);
    await expect(
      consumer.reclaimPending({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).resolves.toEqual({
      next_start_id: "5-0",
      deliveries: [{
        kind: "event",
        delivery_id: "1-0",
        delivery_ref:
          "pai:dev:stable:trigger_processor:v1:epoch_20260722:generation_1:stream:trigger_events#1-0",
        envelope,
      }],
      deleted_ids: ["0-9"],
    });
    await expect(
      consumer.acknowledge({ delivery_ids: ["1-0"] }),
    ).resolves.toEqual({ acknowledged: 1 });
    xAutoClaimResponse = ["0-0", [], [], "unexpected"];
    await expect(
      consumer.reclaimPending({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).rejects.toThrow(/XAUTOCLAIM response is malformed/u);
    xAutoClaimResponse = ["0-0", []];
    await expect(
      consumer.reclaimPending({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).rejects.toThrow(/XAUTOCLAIM response is malformed/u);
    xAutoClaimResponse = [
      "0-0",
      [["1-0", Object.entries(buildRedisStreamMessageV1(envelope)).flat()]],
      ["2-0"],
    ];
    await expect(
      consumer.reclaimPending({
        min_idle_ms: 30_000,
        count: 1,
        start_id: "0-0",
      }),
    ).rejects.toThrow(/exceeded the requested page/u);
    await expect(
      consumer.readNew({ count: 17, block_ms: 0 }),
    ).rejects.toThrow(/XREADGROUP count/u);
    await expect(
      consumer.reclaimPending({
        min_idle_ms: 30_000,
        count: 17,
        start_id: "0-0",
      }),
    ).rejects.toThrow(/XAUTOCLAIM count/u);
    await expect(
      consumer.acknowledge({
        delivery_ids: Array.from({ length: 17 }, (_, index) => `${index + 1}-0`),
      }),
    ).rejects.toThrow(/batch bound/u);
    const accessorIds = ["1-0"];
    Object.defineProperty(accessorIds, "0", {
      enumerable: true,
      configurable: true,
      get: () => "1-0",
    });
    await expect(
      consumer.acknowledge({ delivery_ids: accessorIds }),
    ).rejects.toThrow(/data property/u);
    expect(commands.map((command) => command[0])).toEqual([
      "XGROUP",
      "XREADGROUP",
      "XAUTOCLAIM",
      "XACK",
      "XAUTOCLAIM",
      "XAUTOCLAIM",
      "XAUTOCLAIM",
    ]);
  });

  it("materializes malformed and valid Redis siblings independently", async () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    const validFields = Object.entries(buildRedisStreamMessageV1(envelope)).flat();
    const invalidFields = [...validFields];
    invalidFields[invalidFields.indexOf("payload") + 1] = "{";
    const duplicateFields = [...validFields];
    duplicateFields[0] = "payload";
    const wrongScopeFields = Object.entries(
      buildRedisStreamMessageV1({
        ...envelope,
        event_id: "evt_trigger_scope_drift",
        payload: {
          ...envelope.payload,
          deployment_environment: "prod",
          release_channel: "canary",
        },
      }),
    ).flat();
    const consumer = createRedisStreamConsumerGroupPortV1(
      {
        async sendCommand(args) {
          if (args[0] === "XREADGROUP") {
            return [[
              namespacedRedisKeyV1(namespace, "stream:trigger_events"),
              [
                ["1-0", invalidFields],
                ["2-0", validFields],
                ["3-0", wrongScopeFields],
                ["4-0", duplicateFields],
              ],
            ]];
          }
          if (args[0] === "XACK") return args.length - 3;
          return "OK";
        },
      },
      {
        stream: namespacedRedisKeyV1(namespace, "stream:trigger_events"),
        group: "trigger_processor",
        consumer: "worker_001",
        namespace,
      },
    );
    const deliveries = await consumer.readNew({ count: 10, block_ms: 0 });
    expect(deliveries).toHaveLength(4);
    expect(deliveries[0]).toMatchObject({
      kind: "invalid",
      delivery_id: "1-0",
      error_code: "invalid_json",
    });
    expect(deliveries[1]).toEqual({
      kind: "event",
      delivery_id: "2-0",
      delivery_ref:
        "pai:dev:stable:trigger_processor:v1:epoch_20260722:generation_1:stream:trigger_events#2-0",
      envelope,
    });
    expect(deliveries[2]).toMatchObject({
      kind: "invalid",
      delivery_id: "3-0",
      error_code: "namespace_mismatch",
    });
    expect(deliveries[3]).toMatchObject({
      kind: "invalid",
      delivery_id: "4-0",
      error_code: "malformed_stream_fields",
    });
  });

  it("rejects semantically impossible Trigger Processor events at Redis parse", async () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    const stream = namespacedRedisKeyV1(namespace, "stream:trigger_events");
    const impossibleCooldown = {
      ...envelope,
      event_id: "evt_trigger_cooldown_impossible",
      event_type: "cooldown.expired",
      idempotency_key: "process_001:cooldown_impossible",
      payload: {
        workspace_id: "workspace_001",
        bot_id: "bot_001",
        owner_agent_id: "owner_agent_001",
        deployment_environment: "dev",
        release_channel: "stable",
        reason_code: "cooldown_expired",
        source_ref: "trigger_event:cooldown_001",
        trigger_process_id: "process_001",
        cooldown_until: "2026-07-22T05:00:00.000Z",
        expired_at: "2026-07-22T04:59:59.999Z",
      },
    } as const;
    const consumer = createRedisStreamConsumerGroupPortV1(
      {
        async sendCommand(args) {
          if (args[0] === "XREADGROUP") {
            return [[
              stream,
              [[
                "11-0",
                Object.entries(
                  buildRedisStreamMessageV1(impossibleCooldown),
                ).flat(),
              ]],
            ]];
          }
          return "OK";
        },
      },
      {
        stream,
        group: "trigger_processor",
        consumer: "worker_001",
        namespace,
      },
    );

    const [delivery] = await consumer.readNew({ count: 1, block_ms: 0 });

    expect(delivery).toMatchObject({
      kind: "invalid",
      delivery_id: "11-0",
      error_code: "invalid_envelope",
    });
  });

  it("requires complete five-part scope for Memory and KnowThat durable events at Redis parse", async () => {
    const scope = {
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
    } as const;
    const memoryEnvelope = {
      event_id: "evt_memory_point_created_001",
      event_type: "memory.point.created",
      schema_version: "memory.event.v1",
      producer: "memory",
      occurred_at: "2026-07-24T00:00:00.000Z",
      idempotency_key: "point:memory_point_001:v1",
      trace_id: "trace_memory_001",
      payload: {
        ...scope,
        aggregate_id: "memory_point_001",
        aggregate_version: 1,
        aggregate_type: "memory_point",
        memory_point_id: "memory_point_001",
        series_id: "memory_series_001",
        topic_key: "topic_001",
        state_version: 1,
        source_trigger_process_id: "process_001",
        write_batch_id: "batch_001",
        redaction_status: "not_required",
      },
    } as const;
    const legacyBotOnlyMemoryEnvelope = {
      ...memoryEnvelope,
      event_id: "evt_memory_point_created_legacy",
      payload: {
        bot_id: scope.bot_id,
        aggregate_id: "memory_point_001",
        aggregate_version: 1,
        aggregate_type: "memory_point",
        memory_point_id: "memory_point_001",
        series_id: "memory_series_001",
        topic_key: "topic_001",
        state_version: 1,
        source_trigger_process_id: "process_001",
        write_batch_id: "batch_001",
        redaction_status: "not_required",
      },
    } as const;
    const knowThatEnvelope = {
      event_id: "evt_knowthat_fact_created_001",
      event_type: "knowthat.fact.created",
      schema_version: "knowthat_event.v1",
      producer: "knowthat",
      occurred_at: "2026-07-24T00:00:00.000Z",
      idempotency_key: "knowthat.fact.created:bot_001:fact_001:revision_001",
      trace_id: "trace_knowthat_001",
      payload: {
        ...scope,
        fact_id: "fact_001",
        semantic_key: "semantic_key_001",
        category: "project_fact",
        current_status: "active",
        revision_id: "revision_001",
        source_ref: "artifact:release_001",
      },
    } as const;

    async function readSingle(
      owner_service: "memory" | "knowthat",
      delivery_id: string,
      envelopeForDelivery: typeof memoryEnvelope | typeof legacyBotOnlyMemoryEnvelope | typeof knowThatEnvelope,
    ) {
      const namespace = createRedisNamespaceV1({
        deployment_environment: "dev",
        release_channel: "stable",
        owner_service,
        stream_epoch: "epoch_20260722",
        stream_generation: 1,
      });
      const stream = namespacedRedisKeyV1(
        namespace,
        owner_service === "memory"
          ? "stream:memory_events"
          : "stream:knowthat_events",
      );
      const consumer = createRedisStreamConsumerGroupPortV1(
        {
          async sendCommand(args) {
            if (args[0] === "XREADGROUP") {
              return [[
                stream,
                [[
                  delivery_id,
                  Object.entries(
                    buildRedisStreamMessageV1(envelopeForDelivery),
                  ).flat(),
                ]],
              ]];
            }
            return "OK";
          },
        },
        {
          stream,
          group: owner_service,
          consumer: "worker_001",
          namespace,
        },
      );
      const [delivery] = await consumer.readNew({ count: 1, block_ms: 0 });
      return delivery;
    }

    await expect(
      readSingle("memory", "21-0", memoryEnvelope),
    ).resolves.toMatchObject({
      kind: "event",
      delivery_id: "21-0",
      envelope: memoryEnvelope,
    });
    await expect(
      readSingle("knowthat", "22-0", knowThatEnvelope),
    ).resolves.toMatchObject({
      kind: "event",
      delivery_id: "22-0",
      envelope: knowThatEnvelope,
    });
    await expect(
      readSingle("memory", "23-0", legacyBotOnlyMemoryEnvelope),
    ).resolves.toMatchObject({
      kind: "invalid",
      delivery_id: "23-0",
      error_code: "invalid_envelope",
    });
  });

  it("rejects oversized stream messages without amplifying the raw payload into DLQ input", async () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    const oversizedFields = Object.entries(
      buildRedisStreamMessageV1(
        envelopeAtRedisMessageBytes(REDIS_STREAM_MESSAGE_MAX_BYTES_V1 + 1),
      ),
    ).flat();
    const consumer = createRedisStreamConsumerGroupPortV1(
      {
        async sendCommand(args) {
          if (args[0] === "XREADGROUP") {
            return [[
              namespacedRedisKeyV1(namespace, "stream:trigger_events"),
              [["9-0", oversizedFields]],
            ]];
          }
          return "OK";
        },
      },
      {
        stream: namespacedRedisKeyV1(namespace, "stream:trigger_events"),
        group: "trigger_processor",
        consumer: "worker_001",
        namespace,
      },
    );

    const [delivery] = await consumer.readNew({ count: 1, block_ms: 0 });

    expect(delivery).toMatchObject({
      kind: "invalid",
      error_code: "malformed_stream_fields",
    });
    expect(JSON.stringify(delivery)).not.toContain("x".repeat(20_000));
    if (delivery?.kind === "invalid") {
      expect(Buffer.byteLength(JSON.stringify(delivery.raw_fields), "utf8"))
        .toBeLessThan(20_000);
    }
  });

  it("summarizes malformed fields without retaining bearer tokens, URLs, or prompts", async () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    const stream = namespacedRedisKeyV1(namespace, "stream:trigger_events");
    const secretPayload =
      "https://user:password@redis.invalid Authorization: Bearer stream-token prompt=private";
    const consumer = createRedisStreamConsumerGroupPortV1(
      {
        async sendCommand(args) {
          if (args[0] === "XREADGROUP") {
            return [[stream, [["10-0", ["payload", secretPayload]]]]];
          }
          return "OK";
        },
      },
      {
        stream,
        group: "trigger_processor",
        consumer: "worker_001",
        namespace,
      },
    );

    const [delivery] = await consumer.readNew({ count: 1, block_ms: 0 });

    expect(delivery).toMatchObject({
      kind: "invalid",
      error_code: "malformed_stream_fields",
      error_message: "malformed_stream_fields",
      raw_fields: [
        expect.objectContaining({
          kind: "string",
          role: "field_name",
          field_name: "payload",
          utf8_bytes: 7,
        }),
        expect.objectContaining({
          kind: "string",
          role: "field_value",
          field_name: null,
          utf8_bytes: Buffer.byteLength(secretPayload, "utf8"),
        }),
      ],
    });
    expect(JSON.stringify(delivery)).not.toContain("stream-token");
    expect(JSON.stringify(delivery)).not.toContain("private");
    expect(JSON.stringify(delivery)).not.toContain("user:password");
  });

  it("bounds malformed raw-field evidence by count, UTF-8 bytes and serialized bytes", async () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_20260722",
      stream_generation: 1,
    });
    const stream = namespacedRedisKeyV1(namespace, "stream:trigger_events");
    const malformedFields = [
      Array.from({ length: 20_000 }, () => ""),
      Array.from({ length: 100 }, () => "x".repeat(1_000)),
      Array.from({ length: 100 }, () => "\\".repeat(1_000)),
      Array.from({ length: 20_000 }, () => ({ attacker: true })),
    ];
    const consumer = createRedisStreamConsumerGroupPortV1(
      {
        async sendCommand(args) {
          if (args[0] === "XREADGROUP") {
            return [[
              stream,
              malformedFields.map((fields, index) => [
                `${index + 1}-0`,
                fields,
              ]),
            ]];
          }
          return "OK";
        },
      },
      {
        stream,
        group: "trigger_processor",
        consumer: "worker_001",
        namespace,
      },
    );

    const deliveries = await consumer.readNew({ count: 4, block_ms: 0 });

    expect(deliveries).toHaveLength(malformedFields.length);
    for (const delivery of deliveries) {
      expect(delivery).toMatchObject({
        kind: "invalid",
        error_code: "malformed_stream_fields",
      });
      if (delivery.kind !== "invalid") {
        throw new Error("expected invalid delivery");
      }
      expect(delivery.raw_fields.length).toBeLessThanOrEqual(64);
      expect(
        delivery.raw_fields.reduce(
          (total, field) =>
            total + Buffer.byteLength(String(field), "utf8"),
          0,
        ),
      ).toBeLessThanOrEqual(16_384);
      expect(
        Buffer.byteLength(JSON.stringify(delivery.raw_fields), "utf8"),
      ).toBeLessThanOrEqual(16_384);
      expect(delivery.raw_fields.at(-1)).toMatchObject({
        schema_version: "eventing.raw_field_summary.v1",
        kind: "omitted",
        omitted_count: expect.any(Number),
      });
    }
  });
});
