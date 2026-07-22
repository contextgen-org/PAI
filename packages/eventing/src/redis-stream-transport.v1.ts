import { createHash } from "node:crypto";

import {
  DEPLOYMENT_ENVIRONMENTS,
  RELEASE_CHANNELS,
  SERVICE_IDS,
  assertOwnerDurableEventEnvelopeV1,
  assertDurableEventEnvelopeV1,
  DurableEventEnvelopeValidationErrorV1,
  durableEventTargetConsumerV1,
  isDurableEventTargetAllowedV1,
  isOwnerDurableEventTypeV1,
  type DeploymentEnvironmentV1,
  type DurableEventEnvelopeV1,
  type ReleaseChannelV1,
  type ServiceIdV1,
} from "@pai/contracts";
import { createClient, type RedisClientType } from "redis";

import { canonicalJsonV1, canonicalPayloadHashV1 } from "./canonical-json.v1.js";
import {
  EventTransportErrorV1,
  type DurableEventDeliveryConsumerPortV1,
  type DurableEventDeliveryV1,
  type DurableEventInvalidDeliveryV1,
  type DurableEventReclaimBatchV1,
  type DurableEventTransportPortV1,
} from "./durable-eventing.v1.js";

const redisSegmentPattern = /^[a-z][a-z0-9_]{0,63}$/;
const redisStreamIdPattern = /^\d+-\d+$/u;
const redisEnvelopeFields = new Set([
  "event_id",
  "event_type",
  "schema_version",
  "producer",
  "occurred_at",
  "idempotency_key",
  "trace_id",
  "payload",
]);

export interface RedisRuntimeConfigV1 {
  readonly url: string;
  readonly connect_timeout_ms: number;
  readonly startup_timeout_ms: number;
  readonly aof_ack_timeout_ms: number;
  readonly reconnect_base_delay_ms: number;
  readonly reconnect_max_delay_ms: number;
  readonly commands_queue_max_length: number;
}

export class RedisRuntimeConfigErrorV1 extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RedisRuntimeConfigErrorV1";
  }
}

export class RedisDependencyErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "connection_failed"
      | "connection_timeout"
      | "baseline_mismatch"
      | "readiness_failed",
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "RedisDependencyErrorV1";
  }
}

function assertRedisUrl(rawUrl: string | undefined): asserts rawUrl is string {
  if (rawUrl === undefined || rawUrl.trim().length === 0) {
    throw new RedisRuntimeConfigErrorV1("PAI_REDIS_URL is required");
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RedisRuntimeConfigErrorV1("PAI_REDIS_URL must be a valid URL");
  }
  if (
    (url.protocol !== "redis:" && url.protocol !== "rediss:") ||
    url.hostname.length === 0 ||
    url.hash.length > 0
  ) {
    throw new RedisRuntimeConfigErrorV1(
      "PAI_REDIS_URL must use redis or rediss with a host and no fragment",
    );
  }
}

function parseIntegerSetting(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/u.test(value)) {
    throw new RedisRuntimeConfigErrorV1(`${name} must be an integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new RedisRuntimeConfigErrorV1(`${name} must be a safe integer`);
  }
  return parsed;
}

export function loadRedisRuntimeConfigV1(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RedisRuntimeConfigV1 {
  const rawUrl = env.PAI_REDIS_URL;
  assertRedisUrl(rawUrl);
  const config = {
    url: rawUrl,
    connect_timeout_ms: parseIntegerSetting(
      "PAI_REDIS_CONNECT_TIMEOUT_MS",
      env.PAI_REDIS_CONNECT_TIMEOUT_MS,
      2_000,
    ),
    startup_timeout_ms: parseIntegerSetting(
      "PAI_REDIS_STARTUP_TIMEOUT_MS",
      env.PAI_REDIS_STARTUP_TIMEOUT_MS,
      10_000,
    ),
    aof_ack_timeout_ms: parseIntegerSetting(
      "PAI_REDIS_AOF_ACK_TIMEOUT_MS",
      env.PAI_REDIS_AOF_ACK_TIMEOUT_MS,
      2_000,
    ),
    reconnect_base_delay_ms: parseIntegerSetting(
      "PAI_REDIS_RECONNECT_BASE_DELAY_MS",
      env.PAI_REDIS_RECONNECT_BASE_DELAY_MS,
      100,
    ),
    reconnect_max_delay_ms: parseIntegerSetting(
      "PAI_REDIS_RECONNECT_MAX_DELAY_MS",
      env.PAI_REDIS_RECONNECT_MAX_DELAY_MS,
      5_000,
    ),
    commands_queue_max_length: parseIntegerSetting(
      "PAI_REDIS_COMMANDS_QUEUE_MAX_LENGTH",
      env.PAI_REDIS_COMMANDS_QUEUE_MAX_LENGTH,
      1_024,
    ),
  };
  if (
    config.connect_timeout_ms < 100 ||
    config.connect_timeout_ms > 30_000 ||
    config.startup_timeout_ms < config.connect_timeout_ms ||
    config.startup_timeout_ms > 60_000 ||
    config.aof_ack_timeout_ms < 100 ||
    config.aof_ack_timeout_ms > 30_000 ||
    config.reconnect_base_delay_ms < 10 ||
    config.reconnect_base_delay_ms > 10_000 ||
    config.reconnect_max_delay_ms < config.reconnect_base_delay_ms ||
    config.reconnect_max_delay_ms > 60_000 ||
    config.commands_queue_max_length < 1 ||
    config.commands_queue_max_length > 10_000
  ) {
    throw new RedisRuntimeConfigErrorV1(
      "Redis runtime settings are outside the V1 bounds",
    );
  }
  return Object.freeze(config);
}

export interface RedisDependencyStateV1 {
  readonly status: "healthy" | "degraded";
  readonly consecutive_failures: number;
  readonly changed_at: string;
}

export function createRedisDependencyMonitorV1(options: Readonly<{
  failure_threshold?: number;
  now?: () => Date;
}> = {}): Readonly<{
  recordSuccess: () => RedisDependencyStateV1;
  recordFailure: () => RedisDependencyStateV1;
  snapshot: () => RedisDependencyStateV1;
}> {
  const threshold = options.failure_threshold ?? 3;
  if (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > 100) {
    throw new Error("invalid Redis degradation failure threshold");
  }
  const now = options.now ?? (() => new Date());
  let consecutiveFailures = 0;
  let status: RedisDependencyStateV1["status"] = "healthy";
  let changedAt = now().toISOString();
  const state = (): RedisDependencyStateV1 =>
    Object.freeze({
      status,
      consecutive_failures: consecutiveFailures,
      changed_at: changedAt,
    });
  return Object.freeze({
    recordSuccess() {
      consecutiveFailures = 0;
      if (status !== "healthy") {
        status = "healthy";
        changedAt = now().toISOString();
      }
      return state();
    },
    recordFailure() {
      consecutiveFailures += 1;
      if (status !== "degraded" && consecutiveFailures >= threshold) {
        status = "degraded";
        changedAt = now().toISOString();
      }
      return state();
    },
    snapshot: state,
  });
}

export interface RedisNamespaceV1 {
  readonly deployment_environment: DeploymentEnvironmentV1;
  readonly release_channel: ReleaseChannelV1;
  readonly owner_service: ServiceIdV1;
  readonly stream_epoch: string;
  readonly stream_generation: number;
  readonly schema_version: "v1";
  readonly prefix: string;
}

export function createRedisNamespaceV1(input: Readonly<{
  deployment_environment: DeploymentEnvironmentV1;
  release_channel: ReleaseChannelV1;
  owner_service: ServiceIdV1;
  stream_epoch: string;
  stream_generation: number;
}>): RedisNamespaceV1 {
  if (
    !DEPLOYMENT_ENVIRONMENTS.includes(input.deployment_environment) ||
    !RELEASE_CHANNELS.includes(input.release_channel) ||
    !SERVICE_IDS.includes(input.owner_service) ||
    !redisSegmentPattern.test(input.stream_epoch) ||
    !Number.isSafeInteger(input.stream_generation) ||
    input.stream_generation < 1
  ) {
    throw new Error("invalid Redis namespace identity");
  }
  return Object.freeze({
    deployment_environment: input.deployment_environment,
    release_channel: input.release_channel,
    owner_service: input.owner_service,
    stream_epoch: input.stream_epoch,
    stream_generation: input.stream_generation,
    schema_version: "v1",
    prefix: [
      "pai",
      input.deployment_environment,
      input.release_channel,
      input.owner_service,
      "v1",
      input.stream_epoch,
      `generation_${input.stream_generation}`,
    ].join(":"),
  });
}

export function namespacedRedisKeyV1(
  namespace: RedisNamespaceV1,
  logicalKey: string,
): string {
  const segments = logicalKey.split(":");
  if (
    segments.length < 2 ||
    segments.some((segment) => !redisSegmentPattern.test(segment))
  ) {
    throw new Error("Redis logical key must be a safe multi-segment namespace");
  }
  return `${namespace.prefix}:${logicalKey}`;
}

export function buildRedisStreamMessageV1(
  envelope: DurableEventEnvelopeV1,
): Readonly<Record<keyof DurableEventEnvelopeV1, string>> {
  assertDurableEventEnvelopeV1(envelope);
  return Object.freeze({
    event_id: envelope.event_id,
    event_type: envelope.event_type,
    schema_version: envelope.schema_version,
    producer: envelope.producer,
    occurred_at: envelope.occurred_at,
    idempotency_key: envelope.idempotency_key,
    trace_id: envelope.trace_id,
    payload: canonicalJsonV1(envelope.payload),
  });
}

export interface RedisStreamConsumerGroupPortV1
  extends DurableEventDeliveryConsumerPortV1 {
  ensureGroup(): Promise<void>;
}

export interface RedisCommandClientPortV1 {
  sendCommand(args: readonly string[]): Promise<unknown>;
}

function assertRedisConsumerName(value: string, label: string): void {
  if (!redisSegmentPattern.test(value)) {
    throw new Error(`${label} must be a safe Redis consumer-group segment`);
  }
}

function assertPositiveBoundedInteger(
  value: number,
  label: string,
  max: number,
): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`${label} is outside the V1 bounds`);
  }
}

function envelopeMatchesRedisNamespaceV1(
  envelope: DurableEventEnvelopeV1,
  namespace: RedisNamespaceV1,
): boolean {
  if (
    typeof envelope.payload !== "object" ||
    envelope.payload === null ||
    Array.isArray(envelope.payload)
  ) {
    return false;
  }
  const payload = envelope.payload as Readonly<Record<string, unknown>>;
  return (
    envelope.producer === namespace.owner_service &&
    payload.deployment_environment === namespace.deployment_environment &&
    payload.release_channel === namespace.release_channel
  );
}

function invalidRedisDelivery(
  deliveryId: string,
  deliverySource: string,
  rawFields: unknown,
  errorCode: DurableEventInvalidDeliveryV1["error_code"],
  message: string,
): DurableEventInvalidDeliveryV1 {
  return Object.freeze({
    kind: "invalid" as const,
    delivery_id: deliveryId,
    delivery_ref: `${deliverySource}#${deliveryId}`,
    error_code: errorCode,
    error_message: message,
    raw_fields: Object.freeze(Array.isArray(rawFields) ? [...rawFields] : []),
  });
}

function redisMessageToDelivery(
  deliveryId: string,
  deliverySource: string,
  rawFields: unknown,
  namespace: RedisNamespaceV1,
): DurableEventDeliveryV1 {
  if (
    !Array.isArray(rawFields) ||
    rawFields.length !== redisEnvelopeFields.size * 2
  ) {
    return invalidRedisDelivery(
      deliveryId,
      deliverySource,
      rawFields,
      "malformed_stream_fields",
      "Redis Stream message fields are malformed",
    );
  }
  const fields = new Map<string, string>();
  for (let index = 0; index < rawFields.length; index += 2) {
    const key = rawFields[index];
    const value = rawFields[index + 1];
    if (
      typeof key !== "string" ||
      typeof value !== "string" ||
      !redisEnvelopeFields.has(key) ||
      fields.has(key)
    ) {
      return invalidRedisDelivery(
        deliveryId,
        deliverySource,
        rawFields,
        "malformed_stream_fields",
        "Redis Stream message must contain each canonical string field exactly once",
      );
    }
    fields.set(key, value);
  }
  const payload = fields.get("payload");
  if (payload === undefined) {
    return invalidRedisDelivery(
      deliveryId,
      deliverySource,
      rawFields,
      "malformed_stream_fields",
      "Redis Stream message is missing payload",
    );
  }
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(payload) as unknown;
  } catch {
    return invalidRedisDelivery(
      deliveryId,
      deliverySource,
      rawFields,
      "invalid_json",
      "Redis Stream payload is not valid JSON",
    );
  }
  const envelope = {
    event_id: fields.get("event_id"),
    event_type: fields.get("event_type"),
    schema_version: fields.get("schema_version"),
    producer: fields.get("producer"),
    occurred_at: fields.get("occurred_at"),
    idempotency_key: fields.get("idempotency_key"),
    trace_id: fields.get("trace_id"),
    payload: parsedPayload,
  };
  try {
    assertOwnerDurableEventEnvelopeV1(envelope);
  } catch (error) {
    return invalidRedisDelivery(
      deliveryId,
      deliverySource,
      rawFields,
      "invalid_envelope",
      error instanceof Error ? error.message : "Redis envelope is invalid",
    );
  }
  if (!envelopeMatchesRedisNamespaceV1(envelope, namespace)) {
    return invalidRedisDelivery(
      deliveryId,
      deliverySource,
      rawFields,
      "namespace_mismatch",
      "Redis envelope scope does not match its verified namespace",
    );
  }
  return Object.freeze({
    kind: "event" as const,
    delivery_id: deliveryId,
    delivery_ref: `${deliverySource}#${deliveryId}`,
    envelope,
  });
}

function parseXReadGroupResponse(
  value: unknown,
  namespace: RedisNamespaceV1,
  expectedStream: string,
): readonly DurableEventDeliveryV1[] {
  if (value === null) return [];
  const streamEntries = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null
      ? Object.entries(value)
      : undefined;
  if (streamEntries === undefined) {
    throw new EventTransportErrorV1(
      "transport_rejected",
      false,
      "Redis XREADGROUP response is malformed",
    );
  }
  const messages: DurableEventDeliveryV1[] = [];
  for (const streamEntry of streamEntries) {
    if (
      !Array.isArray(streamEntry) ||
      streamEntry.length !== 2 ||
      streamEntry[0] !== expectedStream ||
      !Array.isArray(streamEntry[1])
    ) {
      throw new EventTransportErrorV1(
        "transport_rejected",
        false,
        "Redis XREADGROUP stream response is malformed",
      );
    }
    for (const rawMessage of streamEntry[1]) {
      if (
        !Array.isArray(rawMessage) ||
        typeof rawMessage[0] !== "string" ||
        !redisStreamIdPattern.test(rawMessage[0])
      ) {
        throw new EventTransportErrorV1(
          "transport_rejected",
          false,
          "Redis Stream delivery is malformed",
        );
      }
      messages.push(
        redisMessageToDelivery(
          rawMessage[0],
          expectedStream,
          rawMessage[1],
          namespace,
        ),
      );
    }
  }
  return messages;
}

function parseXAutoClaimResponse(
  value: unknown,
  namespace: RedisNamespaceV1,
  expectedStream: string,
): DurableEventReclaimBatchV1 {
  if (
    !Array.isArray(value) ||
    typeof value[0] !== "string" ||
    !redisStreamIdPattern.test(value[0]) ||
    !Array.isArray(value[1]) ||
    (value[2] !== undefined && !Array.isArray(value[2]))
  ) {
    throw new EventTransportErrorV1(
      "transport_rejected",
      false,
      "Redis XAUTOCLAIM response is malformed",
    );
  }
  const deliveries = value[1].map((rawMessage: unknown) => {
    if (
      !Array.isArray(rawMessage) ||
      typeof rawMessage[0] !== "string" ||
      !redisStreamIdPattern.test(rawMessage[0])
    ) {
      throw new EventTransportErrorV1(
        "transport_rejected",
        false,
        "Redis pending delivery is malformed",
      );
    }
    return redisMessageToDelivery(
      rawMessage[0],
      expectedStream,
      rawMessage[1],
      namespace,
    );
  });
  const deletedIds = value[2] ?? [];
  if (
    deletedIds.some(
      (id: unknown) =>
        typeof id !== "string" || !redisStreamIdPattern.test(id),
    )
  ) {
    throw new EventTransportErrorV1(
      "transport_rejected",
      false,
      "Redis XAUTOCLAIM deleted delivery ids are malformed",
    );
  }
  return Object.freeze({
    next_start_id: value[0],
    deliveries: Object.freeze(deliveries),
    deleted_ids: Object.freeze([...deletedIds]) as readonly string[],
  });
}

export function createRedisStreamConsumerGroupPortV1(
  client: RedisCommandClientPortV1,
  options: Readonly<{
    stream: string;
    group: string;
    consumer: string;
    namespace: RedisNamespaceV1;
  }>,
): RedisStreamConsumerGroupPortV1 {
  if (!options.stream.startsWith(`${options.namespace.prefix}:`)) {
    throw new Error("Redis consumer stream must belong to the verified namespace");
  }
  assertRedisConsumerName(options.group, "Redis consumer group");
  assertRedisConsumerName(options.consumer, "Redis consumer name");
  return Object.freeze({
    async ensureGroup(): Promise<void> {
      try {
        await client.sendCommand([
          "XGROUP",
          "CREATE",
          options.stream,
          options.group,
          "0",
          "MKSTREAM",
        ]);
      } catch (error) {
        if (!String(error).includes("BUSYGROUP")) throw error;
      }
    },
    async readNew(request: Readonly<{ count: number; block_ms: number }>) {
      assertPositiveBoundedInteger(request.count, "Redis XREADGROUP count", 1_000);
      if (
        !Number.isSafeInteger(request.block_ms) ||
        request.block_ms < 0 ||
        request.block_ms > 60_000
      ) {
        throw new Error("Redis XREADGROUP block_ms is outside the V1 bounds");
      }
      const response = await client.sendCommand([
        "XREADGROUP",
        "GROUP",
        options.group,
        options.consumer,
        "COUNT",
        String(request.count),
        "BLOCK",
        String(request.block_ms),
        "STREAMS",
        options.stream,
        ">",
      ]);
      return parseXReadGroupResponse(response, options.namespace, options.stream);
    },
    async reclaimPending(
      request: Readonly<{
        min_idle_ms: number;
        count: number;
        start_id: string;
      }>,
    ) {
      assertPositiveBoundedInteger(
        request.min_idle_ms,
        "Redis XAUTOCLAIM min_idle_ms",
        86_400_000,
      );
      assertPositiveBoundedInteger(request.count, "Redis XAUTOCLAIM count", 1_000);
      if (!redisStreamIdPattern.test(request.start_id)) {
        throw new Error("Redis XAUTOCLAIM start_id must be a stream id");
      }
      const response = await client.sendCommand([
        "XAUTOCLAIM",
        options.stream,
        options.group,
        options.consumer,
        String(request.min_idle_ms),
        request.start_id,
        "COUNT",
        String(request.count),
      ]);
      return parseXAutoClaimResponse(response, options.namespace, options.stream);
    },
    async acknowledge(request: Readonly<{ delivery_ids: readonly string[] }>) {
      if (request.delivery_ids.length === 0) return { acknowledged: 0 };
      if (
        request.delivery_ids.some(
          (deliveryId: string) => !redisStreamIdPattern.test(deliveryId),
        )
      ) {
        throw new Error("Redis XACK delivery id must be a stream id");
      }
      const acknowledged = await client.sendCommand([
        "XACK",
        options.stream,
        options.group,
        ...request.delivery_ids,
      ]);
      if (typeof acknowledged !== "number" || !Number.isSafeInteger(acknowledged)) {
        throw new EventTransportErrorV1(
          "transport_rejected",
          false,
          "Redis XACK response is malformed",
        );
      }
      return { acknowledged };
    },
  });
}

export function redisReconnectDelayV1(
  retries: number,
  baseDelayMs = 100,
  maxDelayMs = 5_000,
): number {
  if (
    !Number.isSafeInteger(retries) ||
    retries < 0 ||
    !Number.isSafeInteger(baseDelayMs) ||
    baseDelayMs < 1 ||
    !Number.isSafeInteger(maxDelayMs) ||
    maxDelayMs < baseDelayMs
  ) {
    throw new Error("invalid Redis reconnect backoff inputs");
  }
  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.min(retries, 30));
}

export interface VerifiedRedisStreamCompositionV1 {
  readonly namespace: RedisNamespaceV1;
  readonly transport: DurableEventTransportPortV1;
  readonly baseline: Readonly<{
    server_version: "8.8.0";
    effective_config_fingerprint: string;
  }>;
  readonly dependencyState: () => RedisDependencyStateV1;
  readonly checkReadiness: (signal?: AbortSignal) => Promise<void>;
  readonly close: () => Promise<void>;
}

function parseRedisVersion(info: string): string | undefined {
  return info
    .split(/\r?\n/u)
    .find((line) => line.startsWith("redis_version:"))
    ?.slice("redis_version:".length)
    .trim();
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new RedisDependencyErrorV1(
      "readiness_failed",
      true,
      "Redis readiness PING was aborted",
    );
  }
}

async function verifyRedisBaselineV1(
  client: RedisClientType,
): Promise<VerifiedRedisStreamCompositionV1["baseline"]> {
  let serverInfo: string;
  let config: Record<string, string>;
  try {
    [serverInfo, config] = await Promise.all([
      client.info("server"),
      client.configGet(["appendonly", "appendfsync", "maxmemory-policy"]),
    ]);
  } catch {
    throw new RedisDependencyErrorV1(
      "connection_failed",
      true,
      "Redis baseline inspection failed",
    );
  }
  const serverVersion = parseRedisVersion(serverInfo);
  const effectiveConfig = {
    appendonly: config.appendonly,
    appendfsync: config.appendfsync,
    "maxmemory-policy": config["maxmemory-policy"],
  };
  if (
    serverVersion !== "8.8.0" ||
    effectiveConfig.appendonly !== "yes" ||
    effectiveConfig.appendfsync !== "everysec" ||
    effectiveConfig["maxmemory-policy"] !== "noeviction"
  ) {
    throw new RedisDependencyErrorV1(
      "baseline_mismatch",
      false,
      "Redis server does not match the locked PAI V1 baseline",
    );
  }
  let aofCapability: unknown;
  try {
    aofCapability = await client.sendCommand(["WAITAOF", "1", "0", "100"]);
  } catch {
    throw new RedisDependencyErrorV1(
      "baseline_mismatch",
      false,
      "Redis credential cannot confirm local AOF persistence",
    );
  }
  if (
    !Array.isArray(aofCapability) ||
    typeof aofCapability[0] !== "number" ||
    aofCapability[0] < 1
  ) {
    throw new RedisDependencyErrorV1(
      "baseline_mismatch",
      false,
      "Redis local AOF persistence capability is unavailable",
    );
  }
  return Object.freeze({
    server_version: "8.8.0" as const,
    effective_config_fingerprint: `sha256:${createHash("sha256")
      .update(canonicalJsonV1(effectiveConfig), "utf8")
      .digest("hex")}`,
  });
}

export async function openVerifiedRedisStreamCompositionV1(options: Readonly<{
  url: string;
  namespace: RedisNamespaceV1;
  routes: Readonly<Record<string, string>>;
  connect_timeout_ms?: number;
  startup_timeout_ms?: number;
  aof_ack_timeout_ms?: number;
  reconnect_base_delay_ms?: number;
  reconnect_max_delay_ms?: number;
  commands_queue_max_length?: number;
}>): Promise<VerifiedRedisStreamCompositionV1> {
  assertRedisUrl(options.url);
  if (Object.keys(options.routes).length === 0) {
    throw new Error("at least one Redis target route is required");
  }
  const connectTimeoutMs = options.connect_timeout_ms ?? 2_000;
  const startupTimeoutMs = options.startup_timeout_ms ?? 10_000;
  const aofAckTimeoutMs = options.aof_ack_timeout_ms ?? 2_000;
  const reconnectBaseDelayMs = options.reconnect_base_delay_ms ?? 100;
  const reconnectMaxDelayMs = options.reconnect_max_delay_ms ?? 5_000;
  const commandsQueueMaxLength = options.commands_queue_max_length ?? 1_024;
  if (
    !Number.isSafeInteger(connectTimeoutMs) ||
    connectTimeoutMs < 100 ||
    connectTimeoutMs > 30_000 ||
    !Number.isSafeInteger(startupTimeoutMs) ||
    startupTimeoutMs < connectTimeoutMs ||
    startupTimeoutMs > 60_000 ||
    !Number.isSafeInteger(aofAckTimeoutMs) ||
    aofAckTimeoutMs < 100 ||
    aofAckTimeoutMs > 30_000 ||
    !Number.isSafeInteger(commandsQueueMaxLength) ||
    commandsQueueMaxLength < 1 ||
    commandsQueueMaxLength > 10_000
  ) {
    throw new Error("invalid Redis runtime configuration");
  }
  redisReconnectDelayV1(0, reconnectBaseDelayMs, reconnectMaxDelayMs);
  const physicalRoutes = new Map(
    Object.entries(options.routes).map(([target, logicalStream]) => {
      if (target.trim().length === 0) {
        throw new Error("Redis route target must be non-empty");
      }
      if (durableEventTargetConsumerV1(target) === undefined) {
        throw new Error("Observation cannot be an outbox route target");
      }
      return [
        target,
        namespacedRedisKeyV1(options.namespace, logicalStream),
      ] as const;
    }),
  );
  const dependencyMonitor = createRedisDependencyMonitorV1({
    failure_threshold: 1,
  });
  const client = createClient({
    url: options.url,
    commandsQueueMaxLength,
    disableOfflineQueue: true,
    commandOptions: {
      timeout: Math.min(aofAckTimeoutMs + 1_000, 31_000),
    },
    socket: {
      connectTimeout: connectTimeoutMs,
      reconnectStrategy: (retries) =>
        redisReconnectDelayV1(
          retries,
          reconnectBaseDelayMs,
          reconnectMaxDelayMs,
        ),
    },
  });
  client.on("error", () => {
    dependencyMonitor.recordFailure();
  });
  client.on("ready", () => {
    dependencyMonitor.recordSuccess();
  });
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      client.connect().catch(() => {
        throw new RedisDependencyErrorV1(
          "connection_failed",
          true,
          "Redis connection failed",
        );
      }),
      new Promise<never>((_resolve, reject) => {
        startupTimer = setTimeout(
          () =>
            reject(
              new RedisDependencyErrorV1(
                "connection_timeout",
                true,
                "Redis connection exceeded the startup deadline",
              ),
            ),
          startupTimeoutMs,
        );
      }),
    ]);
    const baseline = await verifyRedisBaselineV1(client);
    const transport: DurableEventTransportPortV1 = Object.freeze({
      async publish(request: Readonly<{
        target: string;
        envelope: DurableEventEnvelopeV1;
        payload_hash: string;
        current_transport_epoch: string;
        current_transport_generation: number;
      }>) {
        try {
          assertOwnerDurableEventEnvelopeV1(request.envelope);
        } catch (error) {
          if (error instanceof DurableEventEnvelopeValidationErrorV1) {
            throw new EventTransportErrorV1(
              "transport_rejected",
              false,
              "event envelope is outside the owner durable contract",
              { cause: error },
            );
          }
          throw error;
        }
        if (
          request.envelope.producer !== options.namespace.owner_service ||
          !isOwnerDurableEventTypeV1(
            request.envelope.producer,
            request.envelope.event_type,
          )
        ) {
          throw new EventTransportErrorV1(
            "transport_rejected",
            false,
            "event producer or type is outside the Redis owner namespace",
          );
        }
        if (!envelopeMatchesRedisNamespaceV1(request.envelope, options.namespace)) {
          throw new EventTransportErrorV1(
            "transport_rejected",
            false,
            "event scope does not match the Redis environment/channel namespace",
          );
        }
        if (
          request.current_transport_epoch !== options.namespace.stream_epoch ||
          request.current_transport_generation !==
            options.namespace.stream_generation
        ) {
          throw new EventTransportErrorV1(
            "transport_rejected",
            false,
            "dispatcher transport generation is outside the Redis namespace",
          );
        }
        if (!isDurableEventTargetAllowedV1(request.envelope, request.target)) {
          throw new EventTransportErrorV1(
            "transport_rejected",
            false,
            "event target is outside the owner durable route matrix",
          );
        }
        if (canonicalPayloadHashV1(request.envelope.payload) !== request.payload_hash) {
          throw new EventTransportErrorV1(
            "transport_rejected",
            false,
            "event payload hash does not match before Redis publish",
          );
        }
        const stream = physicalRoutes.get(request.target);
        if (stream === undefined) {
          throw new EventTransportErrorV1(
            "target_not_registered",
            false,
            "outbox target has no registered Redis stream route",
          );
        }
        try {
          const streamId = await client.xAdd(
            stream,
            "*",
            buildRedisStreamMessageV1(request.envelope),
          );
          const aofAcknowledgements = await client.sendCommand([
            "WAITAOF",
            "1",
            "0",
            String(aofAckTimeoutMs),
          ]);
          if (
            !Array.isArray(aofAcknowledgements) ||
            typeof aofAcknowledgements[0] !== "number" ||
            aofAcknowledgements[0] < 1
          ) {
            throw new EventTransportErrorV1(
              "transport_timeout",
              true,
              "Redis Stream write was not fsynced before the deadline",
            );
          }
          dependencyMonitor.recordSuccess();
          return {
            transport_ref: `redis_stream:${stream}:${streamId}`,
            transport_epoch: options.namespace.stream_epoch,
            transport_generation: options.namespace.stream_generation,
          };
        } catch (error) {
          dependencyMonitor.recordFailure();
          if (error instanceof EventTransportErrorV1) throw error;
          throw new EventTransportErrorV1(
            "transport_unavailable",
            true,
            "Redis Stream publish failed",
            { cause: error },
          );
        }
      },
    });
    return Object.freeze({
      namespace: options.namespace,
      transport,
      baseline,
      dependencyState: dependencyMonitor.snapshot,
      async checkReadiness(signal?: AbortSignal): Promise<void> {
        assertNotAborted(signal);
        try {
          const pong = await (signal === undefined
            ? client.ping()
            : client.withAbortSignal(signal).ping());
          assertNotAborted(signal);
          if (pong !== "PONG") {
            throw new RedisDependencyErrorV1(
              "readiness_failed",
              true,
              "Redis readiness PING failed",
            );
          }
          dependencyMonitor.recordSuccess();
        } catch (error) {
          dependencyMonitor.recordFailure();
          if (error instanceof RedisDependencyErrorV1) throw error;
          throw new RedisDependencyErrorV1(
            "readiness_failed",
            true,
            "Redis readiness PING failed",
          );
        }
      },
      async close(): Promise<void> {
        if (client.isOpen) await client.close();
      },
    });
  } catch (error) {
    if (client.isOpen) client.destroy();
    throw error;
  } finally {
    if (startupTimer !== undefined) clearTimeout(startupTimer);
  }
}
