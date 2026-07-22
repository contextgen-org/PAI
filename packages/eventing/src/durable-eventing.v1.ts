import {
  ACTIVE_OWNER_DURABLE_EVENT_TYPES_V1,
  SERVICE_IDS,
  assertOwnerDurableEventEnvelopeV1,
  DurableEventEnvelopeValidationErrorV1,
  isDurableEventConsumerAllowedV1,
  isDurableEventTargetAllowedV1,
  isOwnerDurableEventTypeV1,
  type DurableEventConsumerServiceIdV1,
  type DurableEventEnvelopeV1,
  type ServiceIdV1,
} from "@pai/contracts";
import type { OwnerOutboxStorePortV1 } from "@pai/persistence";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import {
  canonicalDurableEventEnvelopeSemanticHashV1,
  canonicalJsonV1,
  canonicalPayloadHashV1,
  durableEventScopeFingerprintV1,
  CanonicalJsonValidationErrorV1,
} from "./canonical-json.v1.js";

const sha256Pattern = /^sha256:[0-9a-f]{64}$/;
const MAX_EVENTING_IDENTITY_LENGTH_V1 = 256;
const MAX_EVENTING_EPOCH_LENGTH_V1 = 128;
const MAX_EVENTING_TRANSPORT_REF_LENGTH_V1 = 2_048;
const MAX_DURABLE_JSON_BYTES_V1 = 1_048_576;
const MAX_DURABLE_JSON_DEPTH_V1 = 64;
const MAX_DURABLE_JSON_NODES_V1 = 100_000;

/**
 * A durable envelope can be up to 1 MiB. A sixteen-record page bounds normal
 * claim/read materialization to roughly 16 MiB before JavaScript overhead.
 */
export const DURABLE_EVENT_BATCH_MAX_V1 = 16;

function snapshotOwnDataFieldsV1(
  value: unknown,
  fields: readonly string[],
  label: string,
  exact = false,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new OutboxClaimContractErrorV1(`${label} must be an object`);
  }
  if (exact) {
    const actualKeys = Object.keys(value).sort();
    const expectedKeys = [...fields].sort();
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, index) => key !== expectedKeys[index])
    ) {
      throw new OutboxClaimContractErrorV1(`${label} fields must be exact`);
    }
  }
  const snapshot: Record<string, unknown> = {};
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new OutboxClaimContractErrorV1(
        `${label}.${field} must be an own data property`,
      );
    }
    snapshot[field] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotBoundedDenseArrayV1<T>(
  value: unknown,
  maxLength: number,
  label: string,
  snapshotEntry: (entry: unknown, index: number) => T,
): readonly T[] {
  if (!Array.isArray(value)) {
    throw new OutboxClaimContractErrorV1(`${label} must be an array`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length = lengthDescriptor?.value;
  if (
    !Number.isSafeInteger(length) ||
    (length as number) < 0 ||
    (length as number) > maxLength
  ) {
    throw new OutboxClaimContractErrorV1(
      `${label} exceeded the bounded requested batch`,
    );
  }
  const snapshot: T[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new OutboxClaimContractErrorV1(
        `${label} must be dense and contain only data properties`,
      );
    }
    snapshot.push(snapshotEntry(descriptor.value, index));
  }
  if (Object.getOwnPropertyDescriptor(value, "length")?.value !== length) {
    throw new OutboxClaimContractErrorV1(
      `${label} changed while its bounded snapshot was captured`,
    );
  }
  return Object.freeze(snapshot);
}

function deepFreezeJsonSnapshotV1(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    for (const entry of value) deepFreezeJsonSnapshotV1(entry);
    return Object.freeze(value);
  }
  for (const entry of Object.values(value)) deepFreezeJsonSnapshotV1(entry);
  return Object.freeze(value);
}

function assertBoundedJsonCandidateV1(value: unknown): void {
  const pending: Array<Readonly<{ value: unknown; depth: number }>> = [
    { value, depth: 0 },
  ];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let estimatedBytes = 0;
  while (pending.length > 0) {
    const current = pending.pop()!;
    nodes += 1;
    if (
      nodes > MAX_DURABLE_JSON_NODES_V1 ||
      current.depth > MAX_DURABLE_JSON_DEPTH_V1
    ) {
      throw new CanonicalJsonValidationErrorV1(
        "durable JSON exceeds the bounded depth or node count",
      );
    }
    const candidate = current.value;
    if (candidate === null) {
      estimatedBytes += 4;
    } else if (typeof candidate === "string") {
      estimatedBytes += Buffer.byteLength(candidate, "utf8") + 2;
    } else if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) {
        throw new CanonicalJsonValidationErrorV1(
          "durable JSON rejects non-finite numbers",
        );
      }
      estimatedBytes += 24;
    } else if (typeof candidate === "boolean") {
      estimatedBytes += 5;
    } else if (typeof candidate !== "object") {
      throw new CanonicalJsonValidationErrorV1(
        `durable JSON rejects ${typeof candidate} values`,
      );
    } else {
      if (seen.has(candidate)) {
        throw new CanonicalJsonValidationErrorV1(
          "durable JSON rejects cyclic or aliased object graphs",
        );
      }
      seen.add(candidate);
      if (Array.isArray(candidate)) {
        const length = Object.getOwnPropertyDescriptor(candidate, "length")
          ?.value;
        if (
          !Number.isSafeInteger(length) ||
          (length as number) < 0 ||
          (length as number) > MAX_DURABLE_JSON_NODES_V1 - nodes
        ) {
          throw new CanonicalJsonValidationErrorV1(
            "durable JSON array length is outside the bounded contract",
          );
        }
        estimatedBytes += (length as number) + 2;
        for (let index = 0; index < (length as number); index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(
            candidate,
            String(index),
          );
          if (descriptor === undefined || !("value" in descriptor)) {
            throw new CanonicalJsonValidationErrorV1(
              "durable JSON arrays must be dense data properties",
            );
          }
          pending.push({
            value: descriptor.value,
            depth: current.depth + 1,
          });
        }
      } else {
        const prototype = Object.getPrototypeOf(candidate) as object | null;
        if (prototype !== Object.prototype && prototype !== null) {
          throw new CanonicalJsonValidationErrorV1(
            "durable JSON accepts only plain objects",
          );
        }
        for (const key in candidate as Record<string, unknown>) {
          const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
          if (descriptor === undefined || !("value" in descriptor)) {
            throw new CanonicalJsonValidationErrorV1(
              "durable JSON object fields must be own data properties",
            );
          }
          estimatedBytes += Buffer.byteLength(key, "utf8") + 4;
          if (
            estimatedBytes > MAX_DURABLE_JSON_BYTES_V1 ||
            pending.length + nodes >= MAX_DURABLE_JSON_NODES_V1
          ) {
            throw new CanonicalJsonValidationErrorV1(
              "durable JSON exceeds the bounded byte or node budget",
            );
          }
          pending.push({
            value: descriptor.value,
            depth: current.depth + 1,
          });
        }
      }
    }
    if (
      estimatedBytes > MAX_DURABLE_JSON_BYTES_V1 ||
      pending.length + nodes > MAX_DURABLE_JSON_NODES_V1
    ) {
      throw new CanonicalJsonValidationErrorV1(
        "durable JSON exceeds the bounded byte or node budget",
      );
    }
  }
}

export function immutableBoundedJsonSnapshotV1(value: unknown): unknown {
  assertBoundedJsonCandidateV1(value);
  const canonical = canonicalJsonV1(value);
  if (Buffer.byteLength(canonical, "utf8") > MAX_DURABLE_JSON_BYTES_V1) {
    throw new CanonicalJsonValidationErrorV1(
      "durable JSON exceeds the exact serialized byte bound",
    );
  }
  return deepFreezeJsonSnapshotV1(JSON.parse(canonical) as unknown);
}

function immutableEnvelopeSnapshotOrPoisonV1(value: unknown): unknown {
  try {
    return immutableBoundedJsonSnapshotV1(value);
  } catch {
    // Preserve per-row poison handling without retaining a caller-controlled
    // mutable object across an asynchronous publish/ACK boundary.
    return Object.freeze({});
  }
}

function assertClaimBatchIdentitiesV1(
  records: readonly Readonly<{
    outbox_id: unknown;
    claim_token: unknown;
  }>[],
  label: string,
): void {
  const outboxIds = new Set<string>();
  for (const record of records) {
    if (
      typeof record.outbox_id !== "string" ||
      record.outbox_id.trim().length === 0 ||
      record.outbox_id.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
      typeof record.claim_token !== "string" ||
      record.claim_token.trim().length === 0 ||
      record.claim_token.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
      outboxIds.has(record.outbox_id)
    ) {
      throw new OutboxClaimContractErrorV1(
        `${label} identities must be bounded and outbox ids must be unique`,
      );
    }
    outboxIds.add(record.outbox_id);
  }
}

export function assertActiveOwnerDurableEventContractV1(
  ownerService: ServiceIdV1,
): void {
  if (
    !Object.prototype.hasOwnProperty.call(
      ACTIVE_OWNER_DURABLE_EVENT_TYPES_V1,
      ownerService,
    )
  ) {
    throw new Error(
      `${ownerService} has no active owner durable event wire contract`,
    );
  }
}

export interface ClaimedOutboxRecordV1 {
  readonly outbox_id: string;
  readonly claim_token: string;
  readonly attempt_count: unknown;
  readonly target: unknown;
  readonly envelope: unknown;
  readonly payload_hash: unknown;
}

export interface DurableOutboxStorePortV1 {
  claim(request: Readonly<{
    worker_id: string;
    limit: number;
    lease_seconds: number;
    now: string;
    current_transport_epoch: string;
    current_transport_generation: number;
  }>): Promise<readonly ClaimedOutboxRecordV1[]>;
  acknowledge(request: Readonly<{
    outbox_id: string;
    claim_token: string;
    outcome: "sent" | "retry_wait" | "failed";
    next_retry_at: string | null;
    error: Readonly<Record<string, unknown>> | null;
    transport_ref: string | null;
    transport_epoch: string | null;
    transport_generation: number | null;
    current_transport_epoch: string;
    current_transport_generation: number;
    now: string;
  }>): Promise<void>;
}

export interface DurableEventTransportReceiptV1 {
  readonly transport_ref: string;
  readonly transport_epoch: string;
  readonly transport_generation: number;
}

export interface DurableEventTransportPortV1 {
  publish(request: Readonly<{
    target: string;
    envelope: DurableEventEnvelopeV1;
    payload_hash: string;
    current_transport_epoch: string;
    current_transport_generation: number;
  }>): Promise<DurableEventTransportReceiptV1>;
}

function assertTransportReceiptV1(
  receipt: DurableEventTransportReceiptV1,
  expectedEpoch?: string,
  expectedGeneration?: number,
): void {
  if (
    typeof receipt !== "object" ||
    receipt === null ||
    Array.isArray(receipt) ||
    (Object.getPrototypeOf(receipt) !== Object.prototype &&
      Object.getPrototypeOf(receipt) !== null) ||
    Object.keys(receipt).length !== 3 ||
    !Object.prototype.hasOwnProperty.call(receipt, "transport_ref") ||
    !Object.prototype.hasOwnProperty.call(receipt, "transport_epoch") ||
    !Object.prototype.hasOwnProperty.call(receipt, "transport_generation") ||
    typeof receipt.transport_ref !== "string" ||
    receipt.transport_ref.trim().length === 0 ||
    receipt.transport_ref.length > MAX_EVENTING_TRANSPORT_REF_LENGTH_V1 ||
    typeof receipt.transport_epoch !== "string" ||
    receipt.transport_epoch.trim().length === 0 ||
    receipt.transport_epoch.length > MAX_EVENTING_EPOCH_LENGTH_V1 ||
    !Number.isSafeInteger(receipt.transport_generation) ||
    receipt.transport_generation < 1 ||
    (expectedEpoch !== undefined && receipt.transport_epoch !== expectedEpoch) ||
    (expectedGeneration !== undefined &&
      receipt.transport_generation !== expectedGeneration)
  ) {
    throw new EventTransportErrorV1(
      "transport_rejected",
      false,
      "transport receipt identity is invalid",
    );
  }
}

function snapshotTransportReceiptV1(
  value: unknown,
): DurableEventTransportReceiptV1 {
  const receipt = snapshotOwnDataFieldsV1(
    value,
    ["transport_ref", "transport_epoch", "transport_generation"],
    "transport receipt",
    true,
  );
  return Object.freeze({
    transport_ref: receipt.transport_ref,
    transport_epoch: receipt.transport_epoch,
    transport_generation: receipt.transport_generation,
  }) as unknown as DurableEventTransportReceiptV1;
}

export class EventTransportErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "transport_unavailable"
      | "transport_timeout"
      | "target_not_registered"
      | "transport_rejected",
    public readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EventTransportErrorV1";
  }
}

/**
 * A transport rejection that is proven to occur before any delivery side
 * effect. Only this explicit subtype may terminalize an otherwise valid owner
 * row after the publish boundary is entered.
 */
export class EventTransportPreflightErrorV1 extends EventTransportErrorV1 {
  public constructor(
    code: "target_not_registered" | "transport_rejected",
    message: string,
    options?: ErrorOptions,
  ) {
    super(code, false, message, options);
    this.name = "EventTransportPreflightErrorV1";
  }
}

export class OutboxClaimContractErrorV1 extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "OutboxClaimContractErrorV1";
  }
}

function claimedOutboxRecordV1(value: unknown): ClaimedOutboxRecordV1 {
  const record = snapshotOwnDataFieldsV1(
    value,
    [
      "outbox_id",
      "claim_token",
      "attempt_count",
      "target",
      "envelope",
      "payload_hash",
    ],
    "outbox claim",
  );
  if (
    typeof record.outbox_id !== "string" ||
    record.outbox_id.length === 0 ||
    record.outbox_id.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
    typeof record.claim_token !== "string" ||
    record.claim_token.length === 0 ||
    record.claim_token.length > MAX_EVENTING_IDENTITY_LENGTH_V1
  ) {
    throw new OutboxClaimContractErrorV1(
      "outbox claim identity or lease token is invalid",
    );
  }
  return Object.freeze({
    outbox_id: record.outbox_id,
    claim_token: record.claim_token,
    attempt_count: record.attempt_count,
    target: record.target,
    envelope: immutableEnvelopeSnapshotOrPoisonV1(record.envelope),
    payload_hash: record.payload_hash,
  }) as ClaimedOutboxRecordV1;
}

function snapshotClaimedOutboxBatchV1(
  value: unknown,
  limit: number,
  label: string,
): readonly ClaimedOutboxRecordV1[] {
  const records = snapshotBoundedDenseArrayV1(
    value,
    limit,
    label,
    (record) => claimedOutboxRecordV1(record),
  );
  assertClaimBatchIdentitiesV1(records, label);
  return records;
}

export function createPostgresOwnerOutboxStoreV1(
  ownerOutbox: OwnerOutboxStorePortV1,
  outboxTable: string,
): DurableOutboxStorePortV1 {
  if (!ownerOutbox.outbox_tables.includes(outboxTable)) {
    throw new Error(
      `outbox table is outside ${ownerOutbox.owner_service}: ${outboxTable}`,
    );
  }
  return Object.freeze({
    async claim(request: Readonly<{
      worker_id: string;
      limit: number;
      lease_seconds: number;
      now: string;
      current_transport_epoch: string;
      current_transport_generation: number;
    }>) {
      const rows = await ownerOutbox.claim({
        outbox_table: outboxTable,
        worker_id: request.worker_id,
        limit: request.limit,
        lease_seconds: request.lease_seconds,
        now: request.now,
        current_transport_epoch: request.current_transport_epoch,
        current_transport_generation: request.current_transport_generation,
      });
      return rows.map(claimedOutboxRecordV1);
    },
    async acknowledge(request: Readonly<{
      outbox_id: string;
      claim_token: string;
      outcome: "sent" | "retry_wait" | "failed";
      next_retry_at: string | null;
      error: Readonly<Record<string, unknown>> | null;
      transport_ref: string | null;
      transport_epoch: string | null;
      transport_generation: number | null;
      current_transport_epoch: string;
      current_transport_generation: number;
      now: string;
    }>) {
      await ownerOutbox.acknowledge({
        outbox_table: outboxTable,
        outbox_id: request.outbox_id,
        claim_token: request.claim_token,
        outcome: request.outcome,
        next_retry_at: request.next_retry_at,
        error: request.error,
        transport_ref: request.transport_ref,
        transport_epoch: request.transport_epoch,
        transport_generation: request.transport_generation,
        current_transport_epoch: request.current_transport_epoch,
        current_transport_generation: request.current_transport_generation,
        now: request.now,
      });
    },
  });
}

export interface DurableOutboxDispatcherConfigV1 {
  readonly owner_service: ServiceIdV1;
  readonly worker_id: string;
  readonly batch_size: number;
  readonly lease_seconds: number;
  readonly max_attempts: number;
  readonly retry_base_delay_ms: number;
  readonly retry_max_delay_ms: number;
  readonly retry_jitter: "none" | "full";
  readonly current_transport_epoch: string;
  readonly current_transport_generation: number;
}

export interface DurableOutboxDispatchSummaryV1 {
  readonly claimed: number;
  readonly sent: number;
  readonly retry_wait: number;
  readonly failed: number;
}

function assertDispatcherConfig(config: DurableOutboxDispatcherConfigV1): void {
  if (
    config.worker_id.trim().length === 0 ||
    config.worker_id.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
    !Number.isSafeInteger(config.batch_size) ||
    config.batch_size < 1 ||
    config.batch_size > DURABLE_EVENT_BATCH_MAX_V1 ||
    !Number.isSafeInteger(config.lease_seconds) ||
    config.lease_seconds < 1 ||
    config.lease_seconds > 3_600 ||
    !Number.isSafeInteger(config.max_attempts) ||
    config.max_attempts < 1 ||
    config.max_attempts > 100 ||
    !Number.isSafeInteger(config.retry_base_delay_ms) ||
    config.retry_base_delay_ms < 1 ||
    !Number.isSafeInteger(config.retry_max_delay_ms) ||
    config.retry_max_delay_ms < config.retry_base_delay_ms ||
    config.retry_max_delay_ms > 300_000 ||
    config.current_transport_epoch.trim().length === 0 ||
    config.current_transport_epoch.length > MAX_EVENTING_EPOCH_LENGTH_V1 ||
    !Number.isSafeInteger(config.current_transport_generation) ||
    config.current_transport_generation < 1
  ) {
    throw new Error("invalid durable outbox dispatcher configuration");
  }
}

function retryDelayMs(
  config: DurableOutboxDispatcherConfigV1,
  attemptCount: number,
  random: () => number,
): number {
  const exponent = Math.min(attemptCount - 1, 30);
  const ceiling = Math.min(
    config.retry_max_delay_ms,
    config.retry_base_delay_ms * 2 ** exponent,
  );
  if (config.retry_jitter === "none") return ceiling;
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error("outbox retry random source must return [0, 1)");
  }
  return Math.floor(sample * (ceiling + 1));
}

function deliveryFailure(error: unknown): Readonly<{
  code: string;
  retryable: boolean;
}> {
  if (error instanceof EventTransportErrorV1) {
    return { code: error.code, retryable: error.retryable };
  }
  if (
    error instanceof DurableEventEnvelopeValidationErrorV1 ||
    error instanceof OutboxClaimContractErrorV1 ||
    error instanceof CanonicalJsonValidationErrorV1
  ) {
    return { code: "outbox_contract_violation", retryable: false };
  }
  return { code: "transport_unavailable", retryable: true };
}

export function createDurableOutboxDispatcherV1(
  store: DurableOutboxStorePortV1,
  transport: DurableEventTransportPortV1,
  config: DurableOutboxDispatcherConfigV1,
  dependencies: Readonly<{
    now?: () => Date;
    random?: () => number;
  }> = {},
): Readonly<{ dispatchBatch: () => Promise<DurableOutboxDispatchSummaryV1> }> {
  const dispatcherConfig = Object.freeze({ ...config });
  assertActiveOwnerDurableEventContractV1(dispatcherConfig.owner_service);
  assertDispatcherConfig(dispatcherConfig);
  const now = dependencies.now ?? (() => new Date());
  const random = dependencies.random ?? Math.random;
  return Object.freeze({
    async dispatchBatch(): Promise<DurableOutboxDispatchSummaryV1> {
      const claimedAt = now().toISOString();
      const claimedRecords = await store.claim({
        worker_id: dispatcherConfig.worker_id,
        limit: dispatcherConfig.batch_size,
        lease_seconds: dispatcherConfig.lease_seconds,
        now: claimedAt,
        current_transport_epoch: dispatcherConfig.current_transport_epoch,
        current_transport_generation:
          dispatcherConfig.current_transport_generation,
      });
      const records = snapshotClaimedOutboxBatchV1(
        claimedRecords,
        dispatcherConfig.batch_size,
        "outbox claim",
      );
      let sent = 0;
      let retryWait = 0;
      let failed = 0;
      for (const record of records) {
        let failure: Readonly<{ code: string; retryable: boolean }> | undefined;
        let publishAttempted = false;
        let publishOutcomeAmbiguous = false;
        let receipt: DurableEventTransportReceiptV1 | undefined;
        let attemptCount = 1;
        try {
          assertOwnerDurableEventEnvelopeV1(record.envelope);
          if (
            !Number.isSafeInteger(record.attempt_count) ||
            (record.attempt_count as number) < 1 ||
            typeof record.outbox_id !== "string" ||
            record.outbox_id.trim().length === 0 ||
            record.outbox_id.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
            typeof record.claim_token !== "string" ||
            record.claim_token.trim().length === 0 ||
            record.claim_token.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
            typeof record.target !== "string" ||
            record.target.length === 0 ||
            typeof record.payload_hash !== "string" ||
            !sha256Pattern.test(record.payload_hash)
          ) {
            throw new OutboxClaimContractErrorV1(
              "outbox claim storage metadata is invalid",
            );
          }
          attemptCount = record.attempt_count as number;
          if (record.envelope.producer !== dispatcherConfig.owner_service) {
            throw new OutboxClaimContractErrorV1(
              "outbox producer does not match the owner service",
            );
          }
          if (
            !isOwnerDurableEventTypeV1(
              record.envelope.producer,
              record.envelope.event_type,
            )
          ) {
            throw new OutboxClaimContractErrorV1(
              "outbox event type is outside the producer owner union",
            );
          }
          if (!isDurableEventTargetAllowedV1(record.envelope, record.target)) {
            throw new OutboxClaimContractErrorV1(
              "outbox target is outside the owner durable route matrix",
            );
          }
          if (
            !sha256Pattern.test(record.payload_hash) ||
            canonicalPayloadHashV1(record.envelope.payload) !== record.payload_hash
          ) {
            throw new OutboxClaimContractErrorV1(
              "outbox payload hash does not match the canonical payload",
            );
          }
          publishAttempted = true;
          receipt = snapshotTransportReceiptV1(await transport.publish({
            target: record.target,
            envelope: record.envelope,
            payload_hash: record.payload_hash,
            current_transport_epoch: dispatcherConfig.current_transport_epoch,
            current_transport_generation:
              dispatcherConfig.current_transport_generation,
          }));
          assertTransportReceiptV1(
            receipt,
            dispatcherConfig.current_transport_epoch,
            dispatcherConfig.current_transport_generation,
          );
        } catch (error) {
          publishOutcomeAmbiguous =
            publishAttempted &&
            !(error instanceof EventTransportPreflightErrorV1);
          failure = publishOutcomeAmbiguous
            ? { code: "delivery_outcome_ambiguous", retryable: true }
            : deliveryFailure(error);
        }
        const acknowledgedAt = now();
        if (failure === undefined) {
          await store.acknowledge({
            outbox_id: record.outbox_id,
            claim_token: record.claim_token,
            outcome: "sent",
            next_retry_at: null,
            error: null,
            transport_ref: receipt?.transport_ref ?? null,
            transport_epoch: receipt?.transport_epoch ?? null,
            transport_generation: receipt?.transport_generation ?? null,
            current_transport_epoch: dispatcherConfig.current_transport_epoch,
            current_transport_generation:
              dispatcherConfig.current_transport_generation,
            now: acknowledgedAt.toISOString(),
          });
          sent += 1;
          continue;
        }
        const exhausted = attemptCount >= dispatcherConfig.max_attempts;
        const retryable =
          publishOutcomeAmbiguous || (failure.retryable && !exhausted);
        await store.acknowledge({
          outbox_id: record.outbox_id,
          claim_token: record.claim_token,
          outcome: retryable ? "retry_wait" : "failed",
          next_retry_at: retryable
            ? new Date(
                acknowledgedAt.getTime() +
                  retryDelayMs(dispatcherConfig, attemptCount, random),
              ).toISOString()
            : null,
          error: {
            code: exhausted && failure.retryable && !publishOutcomeAmbiguous
              ? "delivery_retry_exhausted"
              : failure.code,
            retryable,
          },
          transport_ref: null,
          transport_epoch: null,
          transport_generation: null,
          current_transport_epoch: dispatcherConfig.current_transport_epoch,
          current_transport_generation:
            dispatcherConfig.current_transport_generation,
          now: acknowledgedAt.toISOString(),
        });
        if (retryable) retryWait += 1;
        else failed += 1;
      }
      return {
        claimed: records.length,
        sent,
        retry_wait: retryWait,
        failed,
      };
    },
  });
}

export interface ClaimedSentOutboxRecordV1 extends ClaimedOutboxRecordV1 {
  readonly sent_at: unknown;
  readonly transport_ref: unknown;
  readonly transport_epoch: unknown;
  readonly transport_generation: unknown;
  readonly active_transport_generation: unknown;
}

function claimedSentOutboxRecordSnapshotV1(
  value: unknown,
): ClaimedSentOutboxRecordV1 {
  const record = snapshotOwnDataFieldsV1(
    value,
    [
      "outbox_id",
      "claim_token",
      "attempt_count",
      "target",
      "envelope",
      "payload_hash",
      "sent_at",
      "transport_ref",
      "transport_epoch",
      "transport_generation",
      "active_transport_generation",
    ],
    "sent outbox redrive claim",
  );
  return Object.freeze({
    outbox_id: record.outbox_id,
    claim_token: record.claim_token,
    attempt_count: record.attempt_count,
    target: record.target,
    envelope: immutableEnvelopeSnapshotOrPoisonV1(record.envelope),
    payload_hash: record.payload_hash,
    sent_at: record.sent_at,
    transport_ref: record.transport_ref,
    transport_epoch: record.transport_epoch,
    transport_generation: record.transport_generation,
    active_transport_generation: record.active_transport_generation,
  }) as ClaimedSentOutboxRecordV1;
}

function snapshotClaimedSentOutboxBatchV1(
  value: unknown,
  limit: number,
): readonly ClaimedSentOutboxRecordV1[] {
  const records = snapshotBoundedDenseArrayV1(
    value,
    limit,
    "sent outbox redrive claim",
    (record) => claimedSentOutboxRecordSnapshotV1(record),
  );
  assertClaimBatchIdentitiesV1(records, "sent outbox redrive claim");
  return records;
}

export interface DurableSentOutboxPermanentFailureAckV1 {
  readonly outbox_id: string;
  readonly claim_token: string;
  readonly previous_transport_ref: string;
  readonly previous_transport_epoch: string;
  readonly previous_transport_generation: number | null;
  readonly current_transport_epoch: string;
  readonly current_transport_generation: number;
  readonly failure_code: string;
  readonly failure_message: string;
  readonly now: string;
}

export interface DurableSentOutboxPermanentFailureAckResultV1 {
  readonly acknowledged: true;
  readonly status: "quarantined" | "replayed";
}

export function assertDurableSentOutboxPermanentFailureAckResultV1(
  value: unknown,
): asserts value is DurableSentOutboxPermanentFailureAckResultV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Object.keys(value).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(value, "acknowledged") ||
    !Object.prototype.hasOwnProperty.call(value, "status") ||
    (value as Readonly<Record<string, unknown>>).acknowledged !== true ||
    ((value as Readonly<Record<string, unknown>>).status !== "quarantined" &&
      (value as Readonly<Record<string, unknown>>).status !== "replayed")
  ) {
    throw new OutboxClaimContractErrorV1(
      "permanent sent-outbox failure did not receive an exact fenced quarantine ACK",
    );
  }
}

export interface DurableSentOutboxRedriveStorePortV1 {
  claimSentForRedrive(request: Readonly<{
    worker_id: string;
    limit: number;
    lease_seconds: number;
    now: string;
    current_transport_epoch: string;
    current_transport_generation: number;
  }>): Promise<readonly ClaimedSentOutboxRecordV1[]>;
  acknowledgeSentRedrive(request: Readonly<{
    outbox_id: string;
    claim_token: string;
    previous_transport_ref: string;
    previous_transport_epoch: string;
    previous_transport_generation: number | null;
    transport_ref: string;
    transport_epoch: string;
    current_transport_generation: number;
    now: string;
  }>): Promise<void>;
  /**
   * Claim-fenced terminalization. The authoritative row must be retained and
   * durably moved out of the redrive candidate set before this resolves.
   */
  acknowledgeSentRedrivePermanentFailure(
    request: Readonly<DurableSentOutboxPermanentFailureAckV1>,
  ): Promise<DurableSentOutboxPermanentFailureAckResultV1>;
}

export interface DurableSentOutboxRedriveSummaryV1 {
  readonly claimed: number;
  readonly redriven: number;
  readonly retryable_failures: number;
  readonly permanent_failures: number;
}

const MAX_DURABLE_FAILURE_MESSAGE_LENGTH_V1 = 512;

function boundedDurableFailureMessageV1(error: unknown, code: string): string {
  const message = error instanceof Error ? error.message.trim() : "";
  return (message.length === 0 ? code : message).slice(
    0,
    MAX_DURABLE_FAILURE_MESSAGE_LENGTH_V1,
  );
}

function sentOutboxPermanentFailureAckV1(
  record: ClaimedSentOutboxRecordV1,
  config: Readonly<{
    current_transport_epoch: string;
    current_transport_generation: number;
  }>,
  failure: Readonly<{ code: string }>,
  error: unknown,
  now: string,
): DurableSentOutboxPermanentFailureAckV1 {
  if (
    typeof record.outbox_id !== "string" ||
    record.outbox_id.trim().length === 0 ||
    record.outbox_id.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
    typeof record.claim_token !== "string" ||
    record.claim_token.trim().length === 0 ||
    record.claim_token.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
    typeof record.transport_ref !== "string" ||
    record.transport_ref.trim().length === 0 ||
    record.transport_ref.length > MAX_EVENTING_TRANSPORT_REF_LENGTH_V1 ||
    typeof record.transport_epoch !== "string" ||
    record.transport_epoch.trim().length === 0 ||
    record.transport_epoch.length > MAX_EVENTING_EPOCH_LENGTH_V1 ||
    (record.transport_generation !== null &&
      !Number.isSafeInteger(record.transport_generation)) ||
    record.active_transport_generation !== config.current_transport_generation
  ) {
    throw new OutboxClaimContractErrorV1(
      "sent outbox permanent failure cannot be fenced to its claimed transport identity",
    );
  }
  return Object.freeze({
    outbox_id: record.outbox_id,
    claim_token: record.claim_token,
    previous_transport_ref: record.transport_ref,
    previous_transport_epoch: record.transport_epoch,
    previous_transport_generation:
      record.transport_generation === null
        ? null
        : (record.transport_generation as number),
    current_transport_epoch: config.current_transport_epoch,
    current_transport_generation: config.current_transport_generation,
    failure_code: failure.code,
    failure_message: boundedDurableFailureMessageV1(error, failure.code),
    now,
  });
}

/**
 * Re-materializes retained PostgreSQL sent rows into a new Redis stream epoch.
 * The store must lease only rows whose persisted epoch differs from the current
 * epoch and must CAS the previous transport ref, epoch, and generation when
 * acknowledging the new receipt.
 */
export function createDurableSentOutboxRedriverV1(
  store: DurableSentOutboxRedriveStorePortV1,
  transport: DurableEventTransportPortV1,
  config: Readonly<{
    owner_service: ServiceIdV1;
    worker_id: string;
    batch_size: number;
    lease_seconds: number;
    current_transport_epoch: string;
    current_transport_generation: number;
  }>,
  dependencies: Readonly<{ now?: () => Date }> = {},
): Readonly<{ redriveBatch: () => Promise<DurableSentOutboxRedriveSummaryV1> }> {
  const redriveConfig = Object.freeze({ ...config });
  assertActiveOwnerDurableEventContractV1(redriveConfig.owner_service);
  if (
    redriveConfig.worker_id.trim().length === 0 ||
    redriveConfig.worker_id.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
    redriveConfig.current_transport_epoch.trim().length === 0 ||
    redriveConfig.current_transport_epoch.length >
      MAX_EVENTING_EPOCH_LENGTH_V1 ||
    !Number.isSafeInteger(redriveConfig.current_transport_generation) ||
    redriveConfig.current_transport_generation < 1 ||
    !Number.isSafeInteger(redriveConfig.batch_size) ||
    redriveConfig.batch_size < 1 ||
    redriveConfig.batch_size > DURABLE_EVENT_BATCH_MAX_V1 ||
    !Number.isSafeInteger(redriveConfig.lease_seconds) ||
    redriveConfig.lease_seconds < 1 ||
    redriveConfig.lease_seconds > 3_600
  ) {
    throw new Error("invalid sent outbox redrive configuration");
  }
  const now = dependencies.now ?? (() => new Date());
  return Object.freeze({
    async redriveBatch(): Promise<DurableSentOutboxRedriveSummaryV1> {
      const claimedAt = now().toISOString();
      const claimedRecords = await store.claimSentForRedrive({
        worker_id: redriveConfig.worker_id,
        limit: redriveConfig.batch_size,
        lease_seconds: redriveConfig.lease_seconds,
        now: claimedAt,
        current_transport_epoch: redriveConfig.current_transport_epoch,
        current_transport_generation:
          redriveConfig.current_transport_generation,
      });
      const records = snapshotClaimedSentOutboxBatchV1(
        claimedRecords,
        redriveConfig.batch_size,
      );
      let redriven = 0;
      let retryableFailures = 0;
      let permanentFailures = 0;
      for (const record of records) {
        let publishAttempted = false;
        try {
          assertOwnerDurableEventEnvelopeV1(record.envelope);
          if (
            !Number.isSafeInteger(record.attempt_count) ||
            (record.attempt_count as number) < 1 ||
            typeof record.outbox_id !== "string" ||
            record.outbox_id.trim().length === 0 ||
            record.outbox_id.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
            typeof record.claim_token !== "string" ||
            record.claim_token.trim().length === 0 ||
            record.claim_token.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
            typeof record.target !== "string" ||
            record.target.length === 0 ||
            typeof record.payload_hash !== "string" ||
            !sha256Pattern.test(record.payload_hash) ||
            typeof record.sent_at !== "string" ||
            record.sent_at.length > 64 ||
            !Number.isFinite(Date.parse(record.sent_at)) ||
            typeof record.transport_ref !== "string" ||
            record.transport_ref.trim().length === 0 ||
            record.transport_ref.length > MAX_EVENTING_TRANSPORT_REF_LENGTH_V1 ||
            typeof record.transport_epoch !== "string" ||
            record.transport_epoch.trim().length === 0 ||
            record.transport_epoch.length > MAX_EVENTING_EPOCH_LENGTH_V1 ||
            (record.transport_generation !== null &&
              (!Number.isSafeInteger(record.transport_generation) ||
                (record.transport_generation as number) < 1)) ||
            record.active_transport_generation !==
              redriveConfig.current_transport_generation ||
            (record.transport_epoch === redriveConfig.current_transport_epoch &&
              record.transport_generation ===
                redriveConfig.current_transport_generation) ||
            record.envelope.producer !== redriveConfig.owner_service ||
            !isOwnerDurableEventTypeV1(
              record.envelope.producer,
              record.envelope.event_type,
            ) ||
            !isDurableEventTargetAllowedV1(record.envelope, record.target) ||
            canonicalPayloadHashV1(record.envelope.payload) !== record.payload_hash
          ) {
            throw new OutboxClaimContractErrorV1(
              "sent outbox redrive claim is outside the retained owner contract",
            );
          }
          // Once control enters the transport, a throw can mean
          // commit-then-disconnect. A valid retained row must therefore remain
          // retryable for every publish attempt, not only when a receipt was
          // returned to this process.
          publishAttempted = true;
          const receipt = snapshotTransportReceiptV1(await transport.publish({
            target: record.target,
            envelope: record.envelope,
            payload_hash: record.payload_hash,
            current_transport_epoch: redriveConfig.current_transport_epoch,
            current_transport_generation:
              redriveConfig.current_transport_generation,
          }));
          assertTransportReceiptV1(
            receipt,
            redriveConfig.current_transport_epoch,
            redriveConfig.current_transport_generation,
          );
          await store.acknowledgeSentRedrive({
            outbox_id: record.outbox_id,
            claim_token: record.claim_token,
            previous_transport_ref: record.transport_ref,
            previous_transport_epoch: record.transport_epoch,
            previous_transport_generation:
              record.transport_generation === null
                ? null
                : (record.transport_generation as number),
            transport_ref: receipt.transport_ref,
            transport_epoch: receipt.transport_epoch,
            current_transport_generation:
              redriveConfig.current_transport_generation,
            now: now().toISOString(),
          });
          redriven += 1;
        } catch (error) {
          if (
            publishAttempted &&
            !(error instanceof EventTransportPreflightErrorV1)
          ) {
            retryableFailures += 1;
            continue;
          }
          const failure = deliveryFailure(error);
          if (failure.retryable) {
            retryableFailures += 1;
            continue;
          }
          try {
            const quarantineAck = snapshotOwnDataFieldsV1(
              await store.acknowledgeSentRedrivePermanentFailure(
                sentOutboxPermanentFailureAckV1(
                  record,
                  redriveConfig,
                  failure,
                  error,
                  now().toISOString(),
                ),
              ),
              ["acknowledged", "status"],
              "permanent sent-outbox failure ACK",
              true,
            ) as unknown as DurableSentOutboxPermanentFailureAckResultV1;
            assertDurableSentOutboxPermanentFailureAckResultV1(quarantineAck);
            permanentFailures += 1;
          } catch {
            // Without the claim-fenced durable ACK the row remains retryable;
            // counting it as terminal would recreate poison-row starvation.
            retryableFailures += 1;
          }
        }
      }
      return {
        claimed: records.length,
        redriven,
        retryable_failures: retryableFailures,
        permanent_failures: permanentFailures,
      };
    },
  });
}

export interface TransactionalInboxApplyPortV1 {
  apply(request: Readonly<{
    source: ServiceIdV1;
    event_id: string;
    idempotency_key: string;
    payload_hash: string;
    semantic_hash: string;
    scope_fingerprint: string;
    envelope: DurableEventEnvelopeV1;
  }>): Promise<Readonly<{ status: "processed" | "replayed" }>>;
}

function assertInboxApplyResultV1(
  value: unknown,
): asserts value is Readonly<{ status: "processed" | "replayed" }> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Object.keys(value).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(value, "status") ||
    ((value as Readonly<Record<string, unknown>>).status !== "processed" &&
      (value as Readonly<Record<string, unknown>>).status !== "replayed")
  ) {
    throw new Error(
      "durable inbox apply returned an invalid result status before XACK",
    );
  }
}

export function createDurableInboxConsumerV1(
  inbox: TransactionalInboxApplyPortV1,
  config: Readonly<{ consumer_service: DurableEventConsumerServiceIdV1 }>,
): Readonly<{
  consume: (
    envelope: DurableEventEnvelopeV1,
  ) => Promise<Readonly<{ status: "processed" | "replayed" }>>;
}> {
  const consumerService = config.consumer_service;
  if (!SERVICE_IDS.includes(consumerService)) {
    throw new Error(
      "durable inbox consumer service is outside the V1 service registry",
    );
  }
  const applyInbox = inbox.apply.bind(inbox);
  return Object.freeze({
    async consume(envelope) {
      const envelopeSnapshot = immutableBoundedJsonSnapshotV1(
        envelope,
      ) as DurableEventEnvelopeV1;
      assertOwnerDurableEventEnvelopeV1(envelopeSnapshot);
      if (
        !isOwnerDurableEventTypeV1(
          envelopeSnapshot.producer,
          envelopeSnapshot.event_type,
        )
      ) {
        throw new DurableEventEnvelopeValidationErrorV1([
          "/event_type: must belong to the producer owner union",
        ]);
      }
      if (
        !isDurableEventConsumerAllowedV1(envelopeSnapshot, consumerService)
      ) {
        throw new DurableEventEnvelopeValidationErrorV1([
          "/producer: event branch is not accepted by this durable consumer",
        ]);
      }
      const result = await applyInbox(Object.freeze({
        source: envelopeSnapshot.producer,
        event_id: envelopeSnapshot.event_id,
        idempotency_key: envelopeSnapshot.idempotency_key,
        payload_hash: canonicalPayloadHashV1(envelopeSnapshot.payload),
        semantic_hash:
          canonicalDurableEventEnvelopeSemanticHashV1(envelopeSnapshot),
        scope_fingerprint: durableEventScopeFingerprintV1(envelopeSnapshot),
        envelope: envelopeSnapshot,
      }));
      let stableResult: Readonly<{ status: "processed" | "replayed" }>;
      try {
        stableResult = snapshotOwnDataFieldsV1(
          result,
          ["status"],
          "durable inbox apply result",
          true,
        ) as unknown as Readonly<{ status: "processed" | "replayed" }>;
      } catch {
        throw new Error(
          "durable inbox apply returned an invalid result status before XACK",
        );
      }
      assertInboxApplyResultV1(stableResult);
      return stableResult;
    },
  });
}

export interface DurableEventDeliveryMessageV1 {
  readonly kind: "event";
  readonly delivery_id: string;
  readonly delivery_ref: string;
  readonly envelope: DurableEventEnvelopeV1;
}

export interface DurableEventInvalidDeliveryV1 {
  readonly kind: "invalid";
  readonly delivery_id: string;
  readonly delivery_ref: string;
  readonly error_code:
    | "malformed_stream_fields"
    | "invalid_json"
    | "invalid_envelope"
    | "namespace_mismatch";
  readonly error_message: string;
  readonly raw_fields: readonly unknown[];
}

export type DurableEventDeliveryV1 =
  | DurableEventDeliveryMessageV1
  | DurableEventInvalidDeliveryV1;

export const DURABLE_EVENT_DELIVERY_BATCH_MAX_V1 =
  DURABLE_EVENT_BATCH_MAX_V1;
const MAX_INVALID_RAW_FIELD_CAPTURE_ELEMENTS_V1 = 64;

function deliverySnapshotV1(value: unknown): DurableEventDeliveryV1 {
  const header = snapshotOwnDataFieldsV1(
    value,
    ["kind", "delivery_id", "delivery_ref"],
    "durable delivery",
  );
  if (
    typeof header.delivery_id !== "string" ||
    header.delivery_id.trim().length === 0 ||
    header.delivery_id.length > MAX_EVENTING_IDENTITY_LENGTH_V1 ||
    typeof header.delivery_ref !== "string" ||
    header.delivery_ref.trim().length === 0 ||
    header.delivery_ref.length > MAX_EVENTING_TRANSPORT_REF_LENGTH_V1
  ) {
    throw new OutboxClaimContractErrorV1(
      "durable delivery identity is invalid",
    );
  }
  if (header.kind === "event") {
    const message = snapshotOwnDataFieldsV1(
      value,
      ["kind", "delivery_id", "delivery_ref", "envelope"],
      "durable event delivery",
      true,
    );
    return Object.freeze({
      kind: "event" as const,
      delivery_id: header.delivery_id,
      delivery_ref: header.delivery_ref,
      envelope: immutableBoundedJsonSnapshotV1(
        message.envelope,
      ) as DurableEventEnvelopeV1,
    });
  }
  if (header.kind === "invalid") {
    const message = snapshotOwnDataFieldsV1(
      value,
      [
        "kind",
        "delivery_id",
        "delivery_ref",
        "error_code",
        "error_message",
        "raw_fields",
      ],
      "invalid durable delivery",
      true,
    );
    if (
      (message.error_code !== "malformed_stream_fields" &&
        message.error_code !== "invalid_json" &&
        message.error_code !== "invalid_envelope" &&
        message.error_code !== "namespace_mismatch") ||
      typeof message.error_message !== "string"
    ) {
      throw new OutboxClaimContractErrorV1(
        "invalid durable delivery failure metadata is outside the contract",
      );
    }
    const rawFields = immutableBoundedJsonSnapshotV1(message.raw_fields);
    if (
      !Array.isArray(rawFields) ||
      rawFields.length > MAX_INVALID_RAW_FIELD_CAPTURE_ELEMENTS_V1
    ) {
      throw new OutboxClaimContractErrorV1(
        "invalid durable delivery raw fields exceed the bounded capture",
      );
    }
    return Object.freeze({
      kind: "invalid" as const,
      delivery_id: header.delivery_id,
      delivery_ref: header.delivery_ref,
      error_code: message.error_code,
      error_message: message.error_message.slice(
        0,
        MAX_DURABLE_FAILURE_MESSAGE_LENGTH_V1,
      ),
      raw_fields: rawFields as readonly unknown[],
    }) as DurableEventInvalidDeliveryV1;
  }
  throw new OutboxClaimContractErrorV1(
    "durable delivery kind is outside the V1 contract",
  );
}

function deliveryBatchSnapshotV1(
  value: unknown,
  limit: number,
  label: string,
): readonly DurableEventDeliveryV1[] {
  const messages = snapshotBoundedDenseArrayV1(
    value,
    limit,
    label,
    (message) => deliverySnapshotV1(message),
  );
  const deliveryIds = new Set<string>();
  const deliveryRefs = new Set<string>();
  for (const message of messages) {
    if (
      deliveryIds.has(message.delivery_id) ||
      deliveryRefs.has(message.delivery_ref)
    ) {
      throw new OutboxClaimContractErrorV1(
        `${label} delivery identities must be independently unique`,
      );
    }
    deliveryIds.add(message.delivery_id);
    deliveryRefs.add(message.delivery_ref);
  }
  return messages;
}

function deletedDeliveryIdsSnapshotV1(
  value: unknown,
  limit: number,
): readonly string[] {
  const deletedIds = snapshotBoundedDenseArrayV1(
    value,
    limit,
    "Redis XAUTOCLAIM deleted ids",
    (entry) => {
      if (typeof entry !== "string" || !redisDeliveryIdPatternV1.test(entry)) {
        throw new OutboxClaimContractErrorV1(
          "Redis XAUTOCLAIM deleted id is invalid",
        );
      }
      return entry;
    },
  );
  if (new Set(deletedIds).size !== deletedIds.length) {
    throw new OutboxClaimContractErrorV1(
      "Redis XAUTOCLAIM deleted ids must be unique",
    );
  }
  return deletedIds;
}

export interface DurableEventReclaimBatchV1 {
  readonly next_start_id: string;
  readonly deliveries: readonly DurableEventDeliveryV1[];
  readonly deleted_ids: readonly string[];
}

export interface DurableEventDeliveryConsumerPortV1 {
  readNew(request: Readonly<{
    count: number;
    block_ms: number;
  }>): Promise<readonly DurableEventDeliveryV1[]>;
  reclaimPending(request: Readonly<{
    min_idle_ms: number;
    count: number;
    start_id: string;
  }>): Promise<DurableEventReclaimBatchV1>;
  acknowledge(request: Readonly<{
    delivery_ids: readonly string[];
  }>): Promise<Readonly<{ acknowledged: number }>>;
  /** Maps a consumer-group delivery id back to the persisted outbox receipt. */
  transportRefForDeliveryId?(delivery_id: string): string;
}

export interface DurableDeletedDeliveryRecorderPortV1 {
  /**
   * Must commit a missing marker with a generation fence before resolving.
   * Repeating the same transport ref is idempotent. A periodic same-generation
   * audit remains mandatory because this XAUTOCLAIM signal can be lost.
   */
  recordDeletedTransportRefs(request: Readonly<{
    consumer_service: DurableEventConsumerServiceIdV1;
    transport_refs: readonly string[];
    observed_transport_epoch: string;
    observed_transport_generation: number;
    observed_at: string;
  }>): Promise<Readonly<{ matched: number; already_missing: number }>>;
}

export interface DurablePeriodicFullAuditGuardRequestV1 {
  readonly request_id: string;
  readonly consumer_service: DurableEventConsumerServiceIdV1;
  readonly coverage_fingerprint: string;
  readonly transport_epoch: string;
  readonly transport_generation: number;
  readonly required_remaining_ms: number;
}

export interface DurablePeriodicFullAuditGuardAckV1 {
  readonly acknowledged: true;
  readonly status: "active";
  readonly request_id: string;
  readonly consumer_service: DurableEventConsumerServiceIdV1;
  readonly coverage_fingerprint: string;
  readonly transport_epoch: string;
  readonly transport_generation: number;
  /** PostgreSQL bigint encoded as canonical positive decimal text. */
  readonly audit_fence: string;
  /** Canonical ISO timestamps produced from PostgreSQL clock_timestamp(). */
  readonly checked_at: string;
  readonly heartbeat_at: string;
  readonly last_full_pass_completed_at: string;
  readonly expires_at: string;
}

export interface DurablePeriodicFullAuditGuardPolicyV1 {
  readonly max_heartbeat_age_ms: number;
  readonly max_full_audit_lag_ms: number;
}

/**
 * One PostgreSQL-backed composition must implement both methods. This prevents
 * a caller from combining a liveness assertion from one owner/generation with
 * the deleted-reference recorder for another.
 */
export interface DurableDeletedDeliveryReconciliationPortV1
  extends DurableDeletedDeliveryRecorderPortV1 {
  /**
   * Must query a durable PostgreSQL audit-control row using PostgreSQL time,
   * join the active transport epoch/generation, and return an exact ACK. The
   * heartbeat and last-full-pass fields may only advance as part of the real
   * fenced periodic full-audit scan/claim workflow; an independent liveness
   * ping is not sufficient. The coverage fingerprint binds the consumer,
   * Redis stream/group, owner outbox tables, and complete route set.
   */
  verifyPeriodicFullAuditActive(
    request: Readonly<DurablePeriodicFullAuditGuardRequestV1>,
  ): Promise<DurablePeriodicFullAuditGuardAckV1>;
}

const periodicAuditGuardAckKeysV1 = [
  "acknowledged",
  "audit_fence",
  "checked_at",
  "consumer_service",
  "coverage_fingerprint",
  "expires_at",
  "heartbeat_at",
  "last_full_pass_completed_at",
  "request_id",
  "status",
  "transport_epoch",
  "transport_generation",
] as const;
const periodicAuditGuardRequestKeysV1 = [
  "consumer_service",
  "coverage_fingerprint",
  "request_id",
  "required_remaining_ms",
  "transport_epoch",
  "transport_generation",
] as const;
const sha256FingerprintPatternV1 = /^sha256:[0-9a-f]{64}$/u;
const guardRequestIdPatternV1 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const positiveDecimalBigintPatternV1 = /^[1-9][0-9]{0,18}$/u;
const postgresBigintMaxV1 = 9_223_372_036_854_775_807n;
const redisDeliveryIdPatternV1 = /^\d+-\d+$/u;

function periodicAuditGuardAckSnapshotV1(
  value: unknown,
): DurablePeriodicFullAuditGuardAckV1 {
  const ack = snapshotOwnDataFieldsV1(
    value,
    periodicAuditGuardAckKeysV1,
    "periodic full-audit guard ACK",
    true,
  );
  return Object.freeze({ ...ack }) as unknown as DurablePeriodicFullAuditGuardAckV1;
}

function canonicalIsoMillisecondsV1(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function assertDurablePeriodicFullAuditGuardRequestV1(
  request: Readonly<DurablePeriodicFullAuditGuardRequestV1>,
): void {
  const requestKeys =
    typeof request === "object" && request !== null
      ? Object.keys(request).sort()
      : [];
  if (
    typeof request !== "object" ||
    request === null ||
    (Object.getPrototypeOf(request) !== Object.prototype &&
      Object.getPrototypeOf(request) !== null) ||
    requestKeys.length !== periodicAuditGuardRequestKeysV1.length ||
    requestKeys.some(
      (key, index) => key !== periodicAuditGuardRequestKeysV1[index],
    ) ||
    typeof request.request_id !== "string" ||
    !guardRequestIdPatternV1.test(request.request_id) ||
    typeof request.consumer_service !== "string" ||
    typeof request.coverage_fingerprint !== "string" ||
    !sha256FingerprintPatternV1.test(request.coverage_fingerprint) ||
    typeof request.transport_epoch !== "string" ||
    request.transport_epoch.trim().length === 0 ||
    request.transport_epoch.length > 128 ||
    !Number.isSafeInteger(request.transport_generation) ||
    request.transport_generation < 1 ||
    !Number.isSafeInteger(request.required_remaining_ms) ||
    request.required_remaining_ms < 100 ||
    request.required_remaining_ms > 60_000
  ) {
    throw new OutboxClaimContractErrorV1(
      "periodic full-audit guard request is outside the bounded fence contract",
    );
  }
}

export function assertDurablePeriodicFullAuditGuardAckV1(
  value: unknown,
  request: Readonly<DurablePeriodicFullAuditGuardRequestV1>,
  policy: Readonly<DurablePeriodicFullAuditGuardPolicyV1>,
): asserts value is DurablePeriodicFullAuditGuardAckV1 {
  assertDurablePeriodicFullAuditGuardRequestV1(request);
  if (
    !Number.isSafeInteger(policy.max_heartbeat_age_ms) ||
    policy.max_heartbeat_age_ms < 100 ||
    policy.max_heartbeat_age_ms > 60_000 ||
    !Number.isSafeInteger(policy.max_full_audit_lag_ms) ||
    policy.max_full_audit_lag_ms < 1_000 ||
    policy.max_full_audit_lag_ms > 3_600_000 ||
    typeof value !== "object" ||
    value === null ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new OutboxClaimContractErrorV1(
      "periodic full-audit guard ACK is invalid",
    );
  }
  const ack = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(ack).sort();
  if (
    keys.length !== periodicAuditGuardAckKeysV1.length ||
    keys.some((key, index) => key !== periodicAuditGuardAckKeysV1[index]) ||
    ack.acknowledged !== true ||
    ack.status !== "active" ||
    ack.request_id !== request.request_id ||
    ack.consumer_service !== request.consumer_service ||
    ack.coverage_fingerprint !== request.coverage_fingerprint ||
    ack.transport_epoch !== request.transport_epoch ||
    ack.transport_generation !== request.transport_generation ||
    typeof ack.audit_fence !== "string" ||
    !positiveDecimalBigintPatternV1.test(ack.audit_fence) ||
    BigInt(ack.audit_fence) > postgresBigintMaxV1 ||
    !canonicalIsoMillisecondsV1(ack.checked_at) ||
    !canonicalIsoMillisecondsV1(ack.heartbeat_at) ||
    !canonicalIsoMillisecondsV1(ack.last_full_pass_completed_at) ||
    !canonicalIsoMillisecondsV1(ack.expires_at)
  ) {
    throw new OutboxClaimContractErrorV1(
      "periodic full-audit guard ACK did not exactly match its request",
    );
  }
  const checkedAt = Date.parse(ack.checked_at);
  const heartbeatAt = Date.parse(ack.heartbeat_at);
  const fullPassAt = Date.parse(ack.last_full_pass_completed_at);
  const expiresAt = Date.parse(ack.expires_at);
  if (
    heartbeatAt > checkedAt ||
    fullPassAt > checkedAt ||
    checkedAt >= expiresAt ||
    expiresAt - checkedAt < request.required_remaining_ms ||
    checkedAt - heartbeatAt > policy.max_heartbeat_age_ms ||
    checkedAt - fullPassAt > policy.max_full_audit_lag_ms
  ) {
    throw new OutboxClaimContractErrorV1(
      "periodic full-audit guard lease is stale or too close to expiry",
    );
  }
}

export class DurableInboxApplyErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "semantic_conflict"
      | "consumer_contract_violation"
      | "transient_database_failure",
    public readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DurableInboxApplyErrorV1";
  }
}

export interface DurableEventConsumerDeadLetterPortV1 {
  /** Must durably commit consumer DLQ + audit before resolving. */
  recordPermanentFailure(request: Readonly<{
    consumer_service: DurableEventConsumerServiceIdV1;
    delivery_id: string;
    delivery_ref: string;
    failure_code: string;
    failure_message: string;
    raw_fields: readonly unknown[] | null;
    envelope: DurableEventEnvelopeV1 | null;
  }>): Promise<Readonly<{ status: "recorded" | "replayed" }>>;
}

export interface DurableEventConsumerWorkerSummaryV1 {
  readonly received: number;
  readonly processed: number;
  readonly replayed: number;
  readonly failed: number;
  readonly dead_lettered: number;
  readonly acknowledged: number;
  readonly deleted: number;
  readonly next_start_id: string | null;
}

function boundedConsumerFailureMessageV1(
  value: unknown,
  fallback: string,
): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return (raw.length === 0 ? fallback : raw).slice(
    0,
    MAX_DURABLE_FAILURE_MESSAGE_LENGTH_V1,
  );
}

function assertDurableConsumerDeadLetterAckV1(value: unknown): void {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Object.keys(value).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(value, "status") ||
    ((value as Readonly<Record<string, unknown>>).status !== "recorded" &&
      (value as Readonly<Record<string, unknown>>).status !== "replayed")
  ) {
    throw new OutboxClaimContractErrorV1(
      "durable consumer DLQ did not return an exact terminal ACK",
    );
  }
}

export function createDurableEventConsumerWorkerV1(
  delivery: DurableEventDeliveryConsumerPortV1,
  inbox: TransactionalInboxApplyPortV1,
  config: Readonly<{
    consumer_service: DurableEventConsumerServiceIdV1;
    dead_letter: DurableEventConsumerDeadLetterPortV1;
    deleted_delivery_reconciliation?: Readonly<{
      recorder: DurableDeletedDeliveryReconciliationPortV1;
      transport_epoch: string;
      transport_generation: number;
      coverage_fingerprint: string;
      required_remaining_ms: number;
      max_heartbeat_age_ms: number;
      max_full_audit_lag_ms: number;
      new_guard_request_id?: () => string;
    }>;
  }>,
): Readonly<{
  consumeNewBatch: (
    request: Readonly<{ count: number; block_ms: number }>,
  ) => Promise<DurableEventConsumerWorkerSummaryV1>;
  reclaimAndConsumeBatch: (
    request: Readonly<{
      min_idle_ms: number;
      count: number;
      start_id: string;
      max_pages?: number;
    }>,
  ) => Promise<DurableEventConsumerWorkerSummaryV1>;
}> {
  const consumerService = config.consumer_service;
  const deadLetter = config.dead_letter;
  if (!SERVICE_IDS.includes(consumerService)) {
    throw new Error(
      "durable event consumer service is outside the V1 service registry",
    );
  }
  const readNew = delivery.readNew.bind(delivery);
  const reclaimPending = delivery.reclaimPending.bind(delivery);
  const acknowledgeDelivery = delivery.acknowledge.bind(delivery);
  const transportRefForDeliveryId =
    delivery.transportRefForDeliveryId?.bind(delivery);
  const recordPermanentFailure =
    deadLetter.recordPermanentFailure.bind(deadLetter);
  const deletedDeliveryReconciliation =
    config.deleted_delivery_reconciliation === undefined
      ? undefined
      : Object.freeze({ ...config.deleted_delivery_reconciliation });
  if (
    deletedDeliveryReconciliation !== undefined &&
    (deletedDeliveryReconciliation.transport_epoch.trim().length === 0 ||
      deletedDeliveryReconciliation.transport_epoch.length >
        MAX_EVENTING_EPOCH_LENGTH_V1 ||
      !Number.isSafeInteger(
        deletedDeliveryReconciliation.transport_generation,
      ) ||
      deletedDeliveryReconciliation.transport_generation < 1 ||
      !sha256FingerprintPatternV1.test(
        deletedDeliveryReconciliation.coverage_fingerprint,
      ) ||
      !Number.isSafeInteger(
        deletedDeliveryReconciliation.required_remaining_ms,
      ) ||
      deletedDeliveryReconciliation.required_remaining_ms < 100 ||
      deletedDeliveryReconciliation.required_remaining_ms > 60_000 ||
      !Number.isSafeInteger(
        deletedDeliveryReconciliation.max_heartbeat_age_ms,
      ) ||
      deletedDeliveryReconciliation.max_heartbeat_age_ms < 100 ||
      deletedDeliveryReconciliation.max_heartbeat_age_ms > 60_000 ||
      !Number.isSafeInteger(
        deletedDeliveryReconciliation.max_full_audit_lag_ms,
      ) ||
      deletedDeliveryReconciliation.max_full_audit_lag_ms < 1_000 ||
      deletedDeliveryReconciliation.max_full_audit_lag_ms > 3_600_000)
  ) {
    throw new Error("invalid deleted delivery reconciliation configuration");
  }
  const consumer = createDurableInboxConsumerV1(inbox, {
    consumer_service: consumerService,
  });
  const acknowledgeOne = async (deliveryId: string): Promise<number> => {
    let result: Readonly<Record<string, unknown>>;
    try {
      result = snapshotOwnDataFieldsV1(
        await acknowledgeDelivery({ delivery_ids: [deliveryId] }),
        ["acknowledged"],
        "Redis delivery acknowledgement",
        true,
      );
    } catch {
      throw new Error(`Redis delivery acknowledgement drift: ${deliveryId}`);
    }
    if (result.acknowledged !== 1) {
      throw new Error(`Redis delivery acknowledgement drift: ${deliveryId}`);
    }
    return 1;
  };
  const isPermanentFailure = (error: unknown): boolean =>
    error instanceof DurableEventEnvelopeValidationErrorV1 ||
    error instanceof CanonicalJsonValidationErrorV1 ||
    (error instanceof DurableInboxApplyErrorV1 && !error.retryable);
  const consumeMessages = async (
    messages: readonly DurableEventDeliveryV1[],
    deleted = 0,
    nextStartId: string | null = null,
  ): Promise<DurableEventConsumerWorkerSummaryV1> => {
    let processed = 0;
    let replayed = 0;
    let failed = 0;
    let deadLettered = 0;
    let acknowledged = 0;
    for (const message of messages) {
      if (
        typeof message.delivery_id !== "string" ||
        message.delivery_id.trim().length === 0 ||
        typeof message.delivery_ref !== "string" ||
        message.delivery_ref.trim().length === 0
      ) {
        failed += 1;
        continue;
      }
      if (message.kind === "invalid") {
        try {
          const deadLetterAck = snapshotOwnDataFieldsV1(
            await recordPermanentFailure({
              consumer_service: consumerService,
              delivery_id: message.delivery_id,
              delivery_ref: message.delivery_ref,
              failure_code: message.error_code,
              failure_message: boundedConsumerFailureMessageV1(
                message.error_message,
                message.error_code,
              ),
              raw_fields: message.raw_fields,
              envelope: null,
            }),
            ["status"],
            "durable consumer DLQ ACK",
            true,
          );
          assertDurableConsumerDeadLetterAckV1(deadLetterAck);
          acknowledged += await acknowledgeOne(message.delivery_id);
          deadLettered += 1;
        } catch {
          failed += 1;
        }
        continue;
      }
      try {
        const result = await consumer.consume(message.envelope);
        acknowledged += await acknowledgeOne(message.delivery_id);
        if (result.status === "processed") processed += 1;
        else replayed += 1;
      } catch (error) {
        if (!isPermanentFailure(error)) {
          failed += 1;
          continue;
        }
        try {
          const deadLetterAck = snapshotOwnDataFieldsV1(
            await recordPermanentFailure({
              consumer_service: consumerService,
              delivery_id: message.delivery_id,
              delivery_ref: message.delivery_ref,
              failure_code:
                error instanceof DurableInboxApplyErrorV1
                  ? error.code
                  : "consumer_contract_violation",
              failure_message: boundedConsumerFailureMessageV1(
                error instanceof Error ? error.message : undefined,
                "permanent consumer failure",
              ),
              raw_fields: null,
              envelope: message.envelope,
            }),
            ["status"],
            "durable consumer DLQ ACK",
            true,
          );
          assertDurableConsumerDeadLetterAckV1(deadLetterAck);
          acknowledged += await acknowledgeOne(message.delivery_id);
          deadLettered += 1;
        } catch {
          failed += 1;
        }
      }
    }
    return {
      received: messages.length,
      processed,
      replayed,
      failed,
      dead_lettered: deadLettered,
      acknowledged,
      deleted,
      next_start_id: nextStartId,
    };
  };
  return Object.freeze({
    async consumeNewBatch(request) {
      const readRequest = Object.freeze({
        count: request.count,
        block_ms: request.block_ms,
      });
      if (
        !Number.isSafeInteger(readRequest.count) ||
        readRequest.count < 1 ||
        readRequest.count > DURABLE_EVENT_DELIVERY_BATCH_MAX_V1 ||
        !Number.isSafeInteger(readRequest.block_ms) ||
        readRequest.block_ms < 0 ||
        readRequest.block_ms > 60_000
      ) {
        throw new Error("Redis read request is outside the bounded V1 page");
      }
      const messages = deliveryBatchSnapshotV1(
        await readNew(readRequest),
        readRequest.count,
        "Redis read",
      );
      return consumeMessages(messages);
    },
    async reclaimAndConsumeBatch(request) {
      if (deletedDeliveryReconciliation === undefined) {
        throw new Error(
          "durable deleted-delivery reconciliation is required before XAUTOCLAIM",
        );
      }
      if (transportRefForDeliveryId === undefined) {
        throw new Error(
          "deleted delivery reconciliation requires transport ref mapping before XAUTOCLAIM",
        );
      }
      const reclaimRequest = Object.freeze({
        min_idle_ms: request.min_idle_ms,
        count: request.count,
        start_id: request.start_id,
        max_pages: request.max_pages,
      });
      const maxPages = reclaimRequest.max_pages ?? 10;
      if (
        !Number.isSafeInteger(maxPages) ||
        maxPages < 1 ||
        maxPages > 100 ||
        !Number.isSafeInteger(reclaimRequest.min_idle_ms) ||
        reclaimRequest.min_idle_ms < 1 ||
        reclaimRequest.min_idle_ms > 86_400_000 ||
        !Number.isSafeInteger(reclaimRequest.count) ||
        reclaimRequest.count < 1 ||
        reclaimRequest.count > DURABLE_EVENT_DELIVERY_BATCH_MAX_V1 ||
        !redisDeliveryIdPatternV1.test(reclaimRequest.start_id)
      ) {
        throw new Error("Redis reclaim request is outside the V1 bounds");
      }
      let cursor = reclaimRequest.start_id;
      const guardRequestIds = new Set<string>();
      let lastAuditFence = 0n;
      let lastGuardCheckedAt = Number.NEGATIVE_INFINITY;
      const total = {
        received: 0,
        processed: 0,
        replayed: 0,
        failed: 0,
        dead_lettered: 0,
        acknowledged: 0,
        deleted: 0,
        next_start_id: cursor,
      };
      for (let page = 0; page < maxPages; page += 1) {
        const guardRequest = Object.freeze({
          request_id: (
            deletedDeliveryReconciliation.new_guard_request_id ?? randomUUID
          )(),
          consumer_service: consumerService,
          coverage_fingerprint:
            deletedDeliveryReconciliation.coverage_fingerprint,
          transport_epoch: deletedDeliveryReconciliation.transport_epoch,
          transport_generation:
            deletedDeliveryReconciliation.transport_generation,
          required_remaining_ms:
            deletedDeliveryReconciliation.required_remaining_ms,
        });
        assertDurablePeriodicFullAuditGuardRequestV1(guardRequest);
        if (guardRequestIds.has(guardRequest.request_id)) {
          throw new OutboxClaimContractErrorV1(
            "periodic full-audit guard request ids must be unique per reclaim scan",
          );
        }
        guardRequestIds.add(guardRequest.request_id);
        const guardAck = periodicAuditGuardAckSnapshotV1(
          await deletedDeliveryReconciliation.recorder
            .verifyPeriodicFullAuditActive(guardRequest),
        );
        assertDurablePeriodicFullAuditGuardAckV1(
          guardAck,
          guardRequest,
          deletedDeliveryReconciliation,
        );
        const auditFence = BigInt(guardAck.audit_fence);
        const guardCheckedAt = Date.parse(guardAck.checked_at);
        if (
          auditFence < lastAuditFence ||
          guardCheckedAt < lastGuardCheckedAt
        ) {
          throw new OutboxClaimContractErrorV1(
            "periodic full-audit guard fence or PostgreSQL clock regressed",
          );
        }
        lastAuditFence = auditFence;
        lastGuardCheckedAt = guardCheckedAt;
        const rawBatch = await reclaimPending(Object.freeze({
          min_idle_ms: reclaimRequest.min_idle_ms,
          count: reclaimRequest.count,
          start_id: cursor,
        }));
        const batchFields = snapshotOwnDataFieldsV1(
          rawBatch,
          ["next_start_id", "deliveries", "deleted_ids"],
          "Redis XAUTOCLAIM response",
          true,
        );
        if (
          typeof batchFields.next_start_id !== "string" ||
          !redisDeliveryIdPatternV1.test(batchFields.next_start_id)
        ) {
          throw new Error("Redis XAUTOCLAIM response cursor is invalid");
        }
        const deliveries = deliveryBatchSnapshotV1(
          batchFields.deliveries,
          reclaimRequest.count,
          "Redis XAUTOCLAIM deliveries",
        );
        const deletedIds = deletedDeliveryIdsSnapshotV1(
          batchFields.deleted_ids,
          reclaimRequest.count,
        );
        const reclaimedDeliveryIds = deliveries.map(
          (message) => message.delivery_id,
        );
        if (
          deliveries.length + deletedIds.length > reclaimRequest.count ||
          reclaimedDeliveryIds.some(
            (deliveryId) => !redisDeliveryIdPatternV1.test(deliveryId),
          ) ||
          deletedIds.some((deliveryId) =>
            reclaimedDeliveryIds.includes(deliveryId),
          )
        ) {
          throw new Error("Redis XAUTOCLAIM response exceeded the bounded page");
        }
        if (
          deletedIds.length > 0 &&
          deletedDeliveryReconciliation !== undefined
        ) {
          const transportRefs = Object.freeze(
            deletedIds.map((deliveryId) =>
              transportRefForDeliveryId(deliveryId),
            ),
          );
          if (
            transportRefs.some(
              (transportRef, index) =>
                typeof transportRef !== "string" ||
                transportRef.trim().length === 0 ||
                transportRef.length > MAX_EVENTING_TRANSPORT_REF_LENGTH_V1 ||
                !transportRef.startsWith("redis_stream:") ||
                !transportRef.endsWith(`:${deletedIds[index]}`),
            ) ||
            new Set(transportRefs).size !== transportRefs.length
          ) {
            throw new Error(
              "deleted delivery transport refs must be bounded, mapped, and unique",
            );
          }
          const recorded = snapshotOwnDataFieldsV1(
            await deletedDeliveryReconciliation.recorder
              .recordDeletedTransportRefs({
              consumer_service: consumerService,
              transport_refs: transportRefs,
              observed_transport_epoch:
                deletedDeliveryReconciliation.transport_epoch,
              observed_transport_generation:
                deletedDeliveryReconciliation.transport_generation,
              observed_at: guardAck.checked_at,
            }),
            ["matched", "already_missing"],
            "deleted delivery reconciliation ACK",
            true,
          );
          if (
            !Number.isSafeInteger(recorded.matched) ||
            (recorded.matched as number) < 0 ||
            !Number.isSafeInteger(recorded.already_missing) ||
            (recorded.already_missing as number) < 0 ||
            (recorded.matched as number) +
                (recorded.already_missing as number) !==
              transportRefs.length
          ) {
            throw new Error(
              "deleted delivery reconciliation did not durably account for every reference",
            );
          }
        }
        const summary = await consumeMessages(
          deliveries,
          deletedIds.length,
          batchFields.next_start_id,
        );
        total.received += summary.received;
        total.processed += summary.processed;
        total.replayed += summary.replayed;
        total.failed += summary.failed;
        total.dead_lettered += summary.dead_lettered;
        total.acknowledged += summary.acknowledged;
        total.deleted += summary.deleted;
        total.next_start_id = batchFields.next_start_id;
        if (batchFields.next_start_id === "0-0") break;
        if (batchFields.next_start_id === cursor) {
          throw new Error("Redis XAUTOCLAIM cursor did not advance");
        }
        cursor = batchFields.next_start_id;
      }
      return total;
    },
  });
}
