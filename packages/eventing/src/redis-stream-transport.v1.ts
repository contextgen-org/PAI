import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

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
  DURABLE_EVENT_DELIVERY_BATCH_MAX_V1,
  EventTransportErrorV1,
  EventTransportPreflightErrorV1,
  type DurableEventDeliveryConsumerPortV1,
  type DurableEventDeliveryV1,
  type DurableEventInvalidDeliveryV1,
  type DurableEventReclaimBatchV1,
  type DurableEventTransportPortV1,
} from "./durable-eventing.v1.js";
import type {
  DurableEventTransportReferenceProbePortV1,
} from "./redis-stream-reconciliation.v1.js";

const redisSegmentPattern = /^[a-z][a-z0-9_]{0,63}$/;
const redisStreamIdPattern = /^\d+-\d+$/u;
export const REDIS_STREAM_MESSAGE_MAX_BYTES_V1 = 1_048_576;
const MAX_INVALID_RAW_FIELD_CAPTURE_ELEMENTS = 64;
const MAX_INVALID_RAW_FIELD_CAPTURE_UTF8_BYTES = 16_384;
const MAX_INVALID_RAW_FIELD_CAPTURE_SERIALIZED_BYTES = 16_384;
const MAX_INVALID_DELIVERY_ERROR_MESSAGE_LENGTH = 512;
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
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    url.hostname,
  );
  if (
    (url.protocol !== "redis:" && url.protocol !== "rediss:") ||
    (url.protocol === "redis:" && !isLoopback) ||
    url.hostname.length === 0 ||
    url.hash.length > 0
  ) {
    throw new RedisRuntimeConfigErrorV1(
      "PAI_REDIS_URL must use rediss except for loopback redis and cannot contain a fragment",
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

function verifiedRedisNamespaceSnapshotV1(
  input: RedisNamespaceV1,
): RedisNamespaceV1 {
  const namespace = createRedisNamespaceV1({
    deployment_environment: input.deployment_environment,
    release_channel: input.release_channel,
    owner_service: input.owner_service,
    stream_epoch: input.stream_epoch,
    stream_generation: input.stream_generation,
  });
  if (
    input.schema_version !== namespace.schema_version ||
    input.prefix !== namespace.prefix
  ) {
    throw new Error("Redis namespace prefix does not match its canonical identity");
  }
  return namespace;
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

export interface RedisAofPublishClientPortV1 extends RedisCommandClientPortV1 {
  xAdd(
    stream: string,
    id: "*",
    message: Readonly<Record<string, string>>,
  ): Promise<string>;
}

export function redisStreamMessageBytesV1(
  message: Readonly<Record<string, string>>,
): number {
  return Object.entries(message).reduce(
    (total, [field, value]) =>
      total + Buffer.byteLength(field, "utf8") + Buffer.byteLength(value, "utf8"),
    0,
  );
}

function assertRedisStreamMessageSizeV1(
  message: Readonly<Record<string, string>>,
): void {
  if (redisStreamMessageBytesV1(message) > REDIS_STREAM_MESSAGE_MAX_BYTES_V1) {
    throw new EventTransportPreflightErrorV1(
      "transport_rejected",
      "Redis Stream message exceeds the bounded delivery size",
    );
  }
}

function immutableRedisStringRecordSnapshotV1(
  value: unknown,
): Readonly<Record<string, string>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EventTransportPreflightErrorV1(
      "transport_rejected",
      "Redis Stream message must be a string record",
    );
  }
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.length > 64) {
    throw new EventTransportPreflightErrorV1(
      "transport_rejected",
      "Redis Stream message field count is outside the V1 bound",
    );
  }
  const entries: Array<readonly [string, string]> = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      key.length === 0 ||
      key.length > 128 ||
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string"
    ) {
      throw new EventTransportPreflightErrorV1(
        "transport_rejected",
        "Redis Stream message fields must be bounded own string data properties",
      );
    }
    entries.push([key, descriptor.value]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

/**
 * WAITAOF only proves writes issued earlier on the same Redis connection. A
 * reconnect between XADD and WAITAOF therefore turns the publish outcome into
 * an ambiguity that must be retried through the durable PostgreSQL outbox.
 */
export async function xAddWithLocalAofFenceV1(
  client: RedisAofPublishClientPortV1,
  request: Readonly<{
    stream: string;
    message: Readonly<Record<string, string>>;
    aof_ack_timeout_ms: number;
    connection_generation: () => number;
  }>,
): Promise<string> {
  const stream = request.stream;
  const message = immutableRedisStringRecordSnapshotV1(request.message);
  const aofAckTimeoutMs = request.aof_ack_timeout_ms;
  const connectionGeneration = request.connection_generation;
  if (
    typeof stream !== "string" ||
    stream.trim().length === 0 ||
    stream.length > 2_048 ||
    !Number.isSafeInteger(aofAckTimeoutMs) ||
    aofAckTimeoutMs < 100 ||
    aofAckTimeoutMs > 30_000 ||
    typeof connectionGeneration !== "function"
  ) {
    throw new EventTransportPreflightErrorV1(
      "transport_rejected",
      "Redis durable publish request is outside the V1 bounds",
    );
  }
  assertRedisStreamMessageSizeV1(message);
  const generation = connectionGeneration();
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new EventTransportErrorV1(
      "transport_unavailable",
      true,
      "Redis connection is not ready for a durable publish",
    );
  }
  const streamId = await client.xAdd(stream, "*", message);
  if (
    !redisStreamIdPattern.test(streamId) ||
    connectionGeneration() !== generation
  ) {
    throw new EventTransportErrorV1(
      "transport_timeout",
      true,
      "Redis connection changed before the Stream write could be durability-fenced",
    );
  }
  const aofAcknowledgements = await client.sendCommand([
    "WAITAOF",
    "1",
    "0",
    String(aofAckTimeoutMs),
  ]);
  if (connectionGeneration() !== generation) {
    throw new EventTransportErrorV1(
      "transport_timeout",
      true,
      "Redis connection changed before local AOF persistence was confirmed",
    );
  }
  if (
    !Array.isArray(aofAcknowledgements) ||
    aofAcknowledgements.length !== 2 ||
    typeof aofAcknowledgements[0] !== "number" ||
    !Number.isSafeInteger(aofAcknowledgements[0]) ||
    aofAcknowledgements[0] < 1 ||
    typeof aofAcknowledgements[1] !== "number" ||
    !Number.isSafeInteger(aofAcknowledgements[1]) ||
    aofAcknowledgements[1] < 0
  ) {
    throw new EventTransportErrorV1(
      "transport_timeout",
      true,
      "Redis Stream write was not fsynced before the deadline",
    );
  }
  return streamId;
}

function redisTransportReferenceV1(stream: string, streamId: string): string {
  return `redis_stream:${stream}:${streamId}`;
}

function parseRedisTransportReferenceV1(
  transportRef: string,
): Readonly<{ stream: string; stream_id: string }> {
  if (!transportRef.startsWith("redis_stream:")) {
    throw new EventTransportErrorV1(
      "transport_rejected",
      false,
      "transport reference is not a Redis Stream receipt",
    );
  }
  const streamAndId = transportRef.slice("redis_stream:".length);
  const separator = streamAndId.lastIndexOf(":");
  const stream = streamAndId.slice(0, separator);
  const streamId = streamAndId.slice(separator + 1);
  if (
    separator < 1 ||
    stream.trim().length === 0 ||
    !redisStreamIdPattern.test(streamId)
  ) {
    throw new EventTransportErrorV1(
      "transport_rejected",
      false,
      "Redis Stream transport reference is malformed",
    );
  }
  return Object.freeze({ stream, stream_id: streamId });
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

function snapshotRedisDeliveryIdsV1(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error("Redis XACK delivery ids must be an array");
  }
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (
    !Number.isSafeInteger(length) ||
    (length as number) < 0 ||
    (length as number) > DURABLE_EVENT_DELIVERY_BATCH_MAX_V1
  ) {
    throw new Error("Redis XACK delivery ids exceed the V1 batch bound");
  }
  const deliveryIds: string[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      !redisStreamIdPattern.test(descriptor.value)
    ) {
      throw new Error("Redis XACK delivery id must be a stream id data property");
    }
    deliveryIds.push(descriptor.value);
  }
  if (
    Object.getOwnPropertyDescriptor(value, "length")?.value !== length ||
    new Set(deliveryIds).size !== deliveryIds.length
  ) {
    throw new Error(
      "Redis XACK delivery ids must be stable and unique within the V1 batch",
    );
  }
  return Object.freeze(deliveryIds);
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
  const capturedFields: string[] = [];
  let capturedUtf8Bytes = 0;
  if (Array.isArray(rawFields)) {
    let omittedFields = 0;
    for (let index = 0; index < rawFields.length; index += 1) {
      const rawField = rawFields[index];
      const capturedField =
        typeof rawField === "string"
          ? rawField
          : "[non-string field omitted]";
      const fieldBytes = Buffer.byteLength(capturedField, "utf8");
      const candidate = [...capturedFields, capturedField];
      if (
        candidate.length >= MAX_INVALID_RAW_FIELD_CAPTURE_ELEMENTS ||
        capturedUtf8Bytes + fieldBytes >
          MAX_INVALID_RAW_FIELD_CAPTURE_UTF8_BYTES ||
        Buffer.byteLength(canonicalJsonV1(candidate), "utf8") >
          MAX_INVALID_RAW_FIELD_CAPTURE_SERIALIZED_BYTES
      ) {
        omittedFields = rawFields.length - index;
        break;
      }
      capturedFields.push(capturedField);
      capturedUtf8Bytes += fieldBytes;
    }
    if (omittedFields > 0) {
      const marker = `[${omittedFields} raw fields omitted]`;
      const markerBytes = Buffer.byteLength(marker, "utf8");
      while (
        capturedFields.length > 0 &&
        (capturedFields.length + 1 > MAX_INVALID_RAW_FIELD_CAPTURE_ELEMENTS ||
          capturedUtf8Bytes + markerBytes >
            MAX_INVALID_RAW_FIELD_CAPTURE_UTF8_BYTES ||
          Buffer.byteLength(
            canonicalJsonV1([...capturedFields, marker]),
            "utf8",
          ) > MAX_INVALID_RAW_FIELD_CAPTURE_SERIALIZED_BYTES)
      ) {
        const removed = capturedFields.pop();
        if (removed !== undefined) {
          capturedUtf8Bytes -= Buffer.byteLength(removed, "utf8");
        }
      }
      capturedFields.push(marker);
    }
  }
  return Object.freeze({
    kind: "invalid" as const,
    delivery_id: deliveryId,
    delivery_ref: `${deliverySource}#${deliveryId}`,
    error_code: errorCode,
    error_message: (message.trim().length === 0 ? errorCode : message).slice(
      0,
      MAX_INVALID_DELIVERY_ERROR_MESSAGE_LENGTH,
    ),
    raw_fields: Object.freeze(capturedFields),
  });
}

function createPhysicalRedisRoutesV1(
  namespace: RedisNamespaceV1,
  routes: Readonly<Record<string, string>>,
): ReadonlyMap<string, string> {
  const entries = Object.entries(routes);
  if (entries.length === 0 || entries.length > 64) {
    throw new Error("Redis target route count is outside the V1 bound");
  }
  const physicalRoutes = new Map<string, string>();
  const consumerByPhysicalStream = new Map<string, ServiceIdV1>();
  for (const [target, logicalStream] of entries) {
    if (
      target.length === 0 ||
      target.length > 256 ||
      typeof logicalStream !== "string" ||
      logicalStream.length === 0 ||
      logicalStream.length > 256
    ) {
      throw new Error("Redis target route identity is outside the V1 bound");
    }
    const consumer = durableEventTargetConsumerV1(target);
    if (consumer === undefined) {
      throw new Error(
        "Redis route target must identify a known durable consumer",
      );
    }
    const physicalStream = namespacedRedisKeyV1(namespace, logicalStream);
    const existingConsumer = consumerByPhysicalStream.get(physicalStream);
    if (existingConsumer !== undefined && existingConsumer !== consumer) {
      throw new Error(
        "Redis routes for different consumers must use distinct physical streams",
      );
    }
    consumerByPhysicalStream.set(physicalStream, consumer);
    physicalRoutes.set(target, physicalStream);
  }
  return physicalRoutes;
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
  let messageBytes = 0;
  for (const rawField of rawFields) {
    if (typeof rawField === "string") {
      messageBytes += Buffer.byteLength(rawField, "utf8");
      if (messageBytes > REDIS_STREAM_MESSAGE_MAX_BYTES_V1) {
        return invalidRedisDelivery(
          deliveryId,
          deliverySource,
          rawFields,
          "malformed_stream_fields",
          "Redis Stream message exceeds the bounded delivery size",
        );
      }
    }
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
  if (streamEntries.length !== 1) {
    throw new EventTransportErrorV1(
      "transport_rejected",
      false,
      "Redis XREADGROUP must return exactly the requested stream",
    );
  }
  const messages: DurableEventDeliveryV1[] = [];
  for (const streamEntry of streamEntries) {
    if (
      !Array.isArray(streamEntry) ||
      streamEntry.length !== 2 ||
      streamEntry[0] !== expectedStream ||
      !Array.isArray(streamEntry[1]) ||
      streamEntry[1].length > DURABLE_EVENT_DELIVERY_BATCH_MAX_V1
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
        rawMessage.length !== 2 ||
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
  if (new Set(messages.map((message) => message.delivery_id)).size !== messages.length) {
    throw new EventTransportErrorV1(
      "transport_rejected",
      false,
      "Redis XREADGROUP returned duplicate delivery ids",
    );
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
    value.length !== 3 ||
    typeof value[0] !== "string" ||
    !redisStreamIdPattern.test(value[0]) ||
    !Array.isArray(value[1]) ||
    value[1].length > DURABLE_EVENT_DELIVERY_BATCH_MAX_V1 ||
    !Array.isArray(value[2]) ||
    value[2].length > DURABLE_EVENT_DELIVERY_BATCH_MAX_V1 ||
    value[1].length + value[2].length >
      DURABLE_EVENT_DELIVERY_BATCH_MAX_V1
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
      rawMessage.length !== 2 ||
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
  const deletedIds = value[2];
  if (
    new Set(deliveries.map((delivery) => delivery.delivery_id)).size !==
      deliveries.length ||
    new Set(deletedIds).size !== deletedIds.length ||
    deletedIds.some(
      (id: unknown) =>
        typeof id !== "string" || !redisStreamIdPattern.test(id),
    ) ||
    deletedIds.some((id) =>
      deliveries.some((delivery) => delivery.delivery_id === id),
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
  const consumerOptions = Object.freeze({
    stream: options.stream,
    group: options.group,
    consumer: options.consumer,
    namespace: verifiedRedisNamespaceSnapshotV1(options.namespace),
  });
  if (!consumerOptions.stream.startsWith(`${consumerOptions.namespace.prefix}:`)) {
    throw new Error("Redis consumer stream must belong to the verified namespace");
  }
  assertRedisConsumerName(consumerOptions.group, "Redis consumer group");
  assertRedisConsumerName(consumerOptions.consumer, "Redis consumer name");
  return Object.freeze({
    transportRefForDeliveryId(deliveryId: string): string {
      if (!redisStreamIdPattern.test(deliveryId)) {
        throw new Error("Redis delivery id must be a stream id");
      }
      return redisTransportReferenceV1(consumerOptions.stream, deliveryId);
    },
    async ensureGroup(): Promise<void> {
      try {
        await client.sendCommand([
          "XGROUP",
          "CREATE",
          consumerOptions.stream,
          consumerOptions.group,
          "0",
          "MKSTREAM",
        ]);
      } catch (error) {
        if (!String(error).includes("BUSYGROUP")) throw error;
      }
    },
    async readNew(request: Readonly<{ count: number; block_ms: number }>) {
      const readRequest = Object.freeze({
        count: request.count,
        block_ms: request.block_ms,
      });
      assertPositiveBoundedInteger(
        readRequest.count,
        "Redis XREADGROUP count",
        DURABLE_EVENT_DELIVERY_BATCH_MAX_V1,
      );
      if (
        !Number.isSafeInteger(readRequest.block_ms) ||
        readRequest.block_ms < 0 ||
        readRequest.block_ms > 60_000
      ) {
        throw new Error("Redis XREADGROUP block_ms is outside the V1 bounds");
      }
      const response = await client.sendCommand([
        "XREADGROUP",
        "GROUP",
        consumerOptions.group,
        consumerOptions.consumer,
        "COUNT",
        String(readRequest.count),
        "BLOCK",
        String(readRequest.block_ms),
        "STREAMS",
        consumerOptions.stream,
        ">",
      ]);
      const deliveries = parseXReadGroupResponse(
        response,
        consumerOptions.namespace,
        consumerOptions.stream,
      );
      if (deliveries.length > readRequest.count) {
        throw new EventTransportErrorV1(
          "transport_rejected",
          false,
          "Redis XREADGROUP exceeded the requested page",
        );
      }
      return deliveries;
    },
    async reclaimPending(
      request: Readonly<{
        min_idle_ms: number;
        count: number;
        start_id: string;
      }>,
    ) {
      const reclaimRequest = Object.freeze({
        min_idle_ms: request.min_idle_ms,
        count: request.count,
        start_id: request.start_id,
      });
      assertPositiveBoundedInteger(
        reclaimRequest.min_idle_ms,
        "Redis XAUTOCLAIM min_idle_ms",
        86_400_000,
      );
      assertPositiveBoundedInteger(
        reclaimRequest.count,
        "Redis XAUTOCLAIM count",
        DURABLE_EVENT_DELIVERY_BATCH_MAX_V1,
      );
      if (!redisStreamIdPattern.test(reclaimRequest.start_id)) {
        throw new Error("Redis XAUTOCLAIM start_id must be a stream id");
      }
      const response = await client.sendCommand([
        "XAUTOCLAIM",
        consumerOptions.stream,
        consumerOptions.group,
        consumerOptions.consumer,
        String(reclaimRequest.min_idle_ms),
        reclaimRequest.start_id,
        "COUNT",
        String(reclaimRequest.count),
      ]);
      const batch = parseXAutoClaimResponse(
        response,
        consumerOptions.namespace,
        consumerOptions.stream,
      );
      if (
        batch.deliveries.length + batch.deleted_ids.length > reclaimRequest.count
      ) {
        throw new EventTransportErrorV1(
          "transport_rejected",
          false,
          "Redis XAUTOCLAIM exceeded the requested page",
        );
      }
      return batch;
    },
    async acknowledge(request: Readonly<{ delivery_ids: readonly string[] }>) {
      const deliveryIds = snapshotRedisDeliveryIdsV1(request.delivery_ids);
      if (deliveryIds.length === 0) return { acknowledged: 0 };
      const acknowledged = await client.sendCommand([
        "XACK",
        consumerOptions.stream,
        consumerOptions.group,
        ...deliveryIds,
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

/**
 * Probes the exact stream entry captured in a PostgreSQL transport_ref. It
 * deliberately uses XRANGE id..id and never key existence, approximate
 * lengths, MAXLEN, or XTRIM.
 */
export function createRedisStreamReferenceProbeV1(
  client: RedisCommandClientPortV1,
  options: Readonly<{
    namespace: RedisNamespaceV1;
    routes: Readonly<Record<string, string>>;
  }>,
): DurableEventTransportReferenceProbePortV1 {
  const namespace = verifiedRedisNamespaceSnapshotV1(options.namespace);
  const routes = Object.freeze({ ...options.routes });
  const physicalRoutes = createPhysicalRedisRoutesV1(
    namespace,
    routes,
  );
  return Object.freeze({
    async probe(
      request: Readonly<{
        target: string;
        transport_ref: string;
        expected_envelope: DurableEventEnvelopeV1;
        expected_payload_hash: string;
      }>,
    ) {
      const probeRequest = Object.freeze({
        target: request.target,
        transport_ref: request.transport_ref,
        expected_envelope: request.expected_envelope,
        expected_payload_hash: request.expected_payload_hash,
      });
      const expectedStream = physicalRoutes.get(probeRequest.target);
      if (expectedStream === undefined) {
        throw new EventTransportErrorV1(
          "target_not_registered",
          false,
          "outbox target has no registered Redis reference probe route",
        );
      }
      const reference = parseRedisTransportReferenceV1(
        probeRequest.transport_ref,
      );
      if (reference.stream !== expectedStream) {
        throw new EventTransportErrorV1(
          "transport_rejected",
          false,
          "transport reference does not match the target Redis stream",
        );
      }
      try {
        assertOwnerDurableEventEnvelopeV1(probeRequest.expected_envelope);
      } catch (error) {
        throw new EventTransportErrorV1(
          "transport_rejected",
          false,
          "reference probe expected envelope is outside the owner contract",
          { cause: error },
        );
      }
      if (
        probeRequest.expected_envelope.producer !== namespace.owner_service ||
        !isDurableEventTargetAllowedV1(
          probeRequest.expected_envelope,
          probeRequest.target,
        ) ||
        !envelopeMatchesRedisNamespaceV1(
          probeRequest.expected_envelope,
          namespace,
        ) ||
        canonicalPayloadHashV1(probeRequest.expected_envelope.payload) !==
          probeRequest.expected_payload_hash
      ) {
        throw new EventTransportErrorV1(
          "transport_rejected",
          false,
          "reference probe expected event does not match its Redis namespace or payload hash",
        );
      }
      const expectedMessage = buildRedisStreamMessageV1(
        probeRequest.expected_envelope,
      );
      let response: unknown;
      try {
        response = await client.sendCommand([
          "XRANGE",
          reference.stream,
          reference.stream_id,
          reference.stream_id,
          "COUNT",
          "1",
        ]);
      } catch (error) {
        throw new EventTransportErrorV1(
          "transport_unavailable",
          true,
          "Redis Stream reference probe failed",
          { cause: error },
        );
      }
      if (!Array.isArray(response)) {
        throw new EventTransportErrorV1(
          "transport_rejected",
          false,
          "Redis XRANGE response is malformed",
        );
      }
      if (response.length === 0) {
        return Object.freeze({ status: "missing" as const });
      }
      if (
        response.length !== 1 ||
        !Array.isArray(response[0]) ||
        response[0].length !== 2 ||
        response[0][0] !== reference.stream_id
      ) {
        throw new EventTransportErrorV1(
          "transport_rejected",
          false,
          "Redis XRANGE response does not match the probed stream id",
        );
      }
      const rawFields = response[0][1];
      if (
        !Array.isArray(rawFields) ||
        rawFields.length !== redisEnvelopeFields.size * 2
      ) {
        return Object.freeze({ status: "mismatched" as const });
      }
      let rawMessageBytes = 0;
      for (const rawField of rawFields) {
        if (typeof rawField !== "string") {
          return Object.freeze({ status: "mismatched" as const });
        }
        rawMessageBytes += Buffer.byteLength(rawField, "utf8");
        if (rawMessageBytes > REDIS_STREAM_MESSAGE_MAX_BYTES_V1) {
          return Object.freeze({ status: "mismatched" as const });
        }
      }
      const actualFields = new Map<string, string>();
      for (let index = 0; index < rawFields.length; index += 2) {
        const field = rawFields[index];
        const value = rawFields[index + 1];
        if (
          typeof field !== "string" ||
          typeof value !== "string" ||
          !redisEnvelopeFields.has(field) ||
          actualFields.has(field)
        ) {
          return Object.freeze({ status: "mismatched" as const });
        }
        actualFields.set(field, value);
      }
      if (
        Object.entries(expectedMessage).some(
          ([field, value]) => actualFields.get(field) !== value,
        )
      ) {
        return Object.freeze({ status: "mismatched" as const });
      }
      return Object.freeze({ status: "present" as const });
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
  readonly referenceProbe: DurableEventTransportReferenceProbePortV1;
  readonly baseline: Readonly<{
    server_version: "8.8.0";
    maxmemory_bytes: number;
    effective_config_fingerprint: string;
  }>;
  readonly dependencyState: () => RedisDependencyStateV1;
  readonly checkReadiness: (signal?: AbortSignal) => Promise<void>;
  readonly close: () => Promise<void>;
}

export function validateRedisStreamServerConfigurationV1(
  serverVersion: string | undefined,
  config: Readonly<Record<string, string | undefined>>,
): Readonly<{
  server_version: "8.8.0";
  maxmemory_bytes: number;
  effective_config_fingerprint: string;
}> {
  const rawMaxmemory = config.maxmemory;
  const maxmemoryBytes =
    rawMaxmemory !== undefined && /^\d+$/u.test(rawMaxmemory)
      ? Number(rawMaxmemory)
      : Number.NaN;
  const effectiveConfig = {
    appendonly: config.appendonly,
    appendfsync: config.appendfsync,
    maxmemory: rawMaxmemory,
    "maxmemory-policy": config["maxmemory-policy"],
  };
  if (
    serverVersion !== "8.8.0" ||
    effectiveConfig.appendonly !== "yes" ||
    effectiveConfig.appendfsync !== "everysec" ||
    effectiveConfig["maxmemory-policy"] !== "noeviction" ||
    !Number.isSafeInteger(maxmemoryBytes) ||
    maxmemoryBytes < 1
  ) {
    throw new RedisDependencyErrorV1(
      "baseline_mismatch",
      false,
      "Redis server does not match the bounded durable PAI V1 baseline",
    );
  }
  return Object.freeze({
    server_version: "8.8.0" as const,
    maxmemory_bytes: maxmemoryBytes,
    effective_config_fingerprint: `sha256:${createHash("sha256")
      .update(canonicalJsonV1(effectiveConfig), "utf8")
      .digest("hex")}`,
  });
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
      client.configGet([
        "appendonly",
        "appendfsync",
        "maxmemory",
        "maxmemory-policy",
      ]),
    ]);
  } catch {
    throw new RedisDependencyErrorV1(
      "connection_failed",
      true,
      "Redis baseline inspection failed",
    );
  }
  const serverVersion = parseRedisVersion(serverInfo);
  const baseline = validateRedisStreamServerConfigurationV1(
    serverVersion,
    config,
  );
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
    aofCapability.length !== 2 ||
    typeof aofCapability[0] !== "number" ||
    !Number.isSafeInteger(aofCapability[0]) ||
    aofCapability[0] < 1 ||
    typeof aofCapability[1] !== "number" ||
    !Number.isSafeInteger(aofCapability[1]) ||
    aofCapability[1] < 0
  ) {
    throw new RedisDependencyErrorV1(
      "baseline_mismatch",
      false,
      "Redis local AOF persistence capability is unavailable",
    );
  }
  return baseline;
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
  const url = options.url;
  const namespace = verifiedRedisNamespaceSnapshotV1(options.namespace);
  assertRedisUrl(url);
  const routes = Object.freeze({ ...options.routes });
  const physicalRoutes = createPhysicalRedisRoutesV1(
    namespace,
    routes,
  );
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
    commandsQueueMaxLength > 10_000 ||
    !Number.isSafeInteger(reconnectBaseDelayMs) ||
    reconnectBaseDelayMs < 10 ||
    reconnectBaseDelayMs > 10_000 ||
    !Number.isSafeInteger(reconnectMaxDelayMs) ||
    reconnectMaxDelayMs < reconnectBaseDelayMs ||
    reconnectMaxDelayMs > 60_000
  ) {
    throw new Error("invalid Redis runtime configuration");
  }
  redisReconnectDelayV1(0, reconnectBaseDelayMs, reconnectMaxDelayMs);
  const dependencyMonitor = createRedisDependencyMonitorV1({
    failure_threshold: 1,
  });
  let connectionGeneration = 0;
  const client = createClient({
    url,
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
    connectionGeneration += 1;
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
    const referenceProbe = createRedisStreamReferenceProbeV1(client, {
      namespace,
      routes,
    });
    const transport: DurableEventTransportPortV1 = Object.freeze({
      async publish(request: Readonly<{
        target: string;
        envelope: DurableEventEnvelopeV1;
        payload_hash: string;
        current_transport_epoch: string;
        current_transport_generation: number;
      }>) {
        const publishRequest = Object.freeze({
          target: request.target,
          envelope: request.envelope,
          payload_hash: request.payload_hash,
          current_transport_epoch: request.current_transport_epoch,
          current_transport_generation: request.current_transport_generation,
        });
        try {
          assertOwnerDurableEventEnvelopeV1(publishRequest.envelope);
        } catch (error) {
          if (error instanceof DurableEventEnvelopeValidationErrorV1) {
            throw new EventTransportPreflightErrorV1(
              "transport_rejected",
              "event envelope is outside the owner durable contract",
              { cause: error },
            );
          }
          throw error;
        }
        if (
          publishRequest.envelope.producer !== namespace.owner_service ||
          !isOwnerDurableEventTypeV1(
            publishRequest.envelope.producer,
            publishRequest.envelope.event_type,
          )
        ) {
          throw new EventTransportPreflightErrorV1(
            "transport_rejected",
            "event producer or type is outside the Redis owner namespace",
          );
        }
        if (!envelopeMatchesRedisNamespaceV1(publishRequest.envelope, namespace)) {
          throw new EventTransportPreflightErrorV1(
            "transport_rejected",
            "event scope does not match the Redis environment/channel namespace",
          );
        }
        if (
          publishRequest.current_transport_epoch !== namespace.stream_epoch ||
          publishRequest.current_transport_generation !==
            namespace.stream_generation
        ) {
          throw new EventTransportPreflightErrorV1(
            "transport_rejected",
            "dispatcher transport generation is outside the Redis namespace",
          );
        }
        if (
          !isDurableEventTargetAllowedV1(
            publishRequest.envelope,
            publishRequest.target,
          )
        ) {
          throw new EventTransportPreflightErrorV1(
            "transport_rejected",
            "event target is outside the owner durable route matrix",
          );
        }
        if (
          canonicalPayloadHashV1(publishRequest.envelope.payload) !==
          publishRequest.payload_hash
        ) {
          throw new EventTransportPreflightErrorV1(
            "transport_rejected",
            "event payload hash does not match before Redis publish",
          );
        }
        const stream = physicalRoutes.get(publishRequest.target);
        if (stream === undefined) {
          throw new EventTransportPreflightErrorV1(
            "target_not_registered",
            "outbox target has no registered Redis stream route",
          );
        }
        try {
          const streamId = await xAddWithLocalAofFenceV1(client, {
            stream,
            message: buildRedisStreamMessageV1(publishRequest.envelope),
            aof_ack_timeout_ms: aofAckTimeoutMs,
            connection_generation: () => connectionGeneration,
          });
          dependencyMonitor.recordSuccess();
          return {
            transport_ref: redisTransportReferenceV1(stream, streamId),
            transport_epoch: namespace.stream_epoch,
            transport_generation: namespace.stream_generation,
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
      namespace,
      transport,
      referenceProbe,
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
