import {
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

import {
  canonicalDurableEventEnvelopeSemanticHashV1,
  canonicalPayloadHashV1,
  durableEventScopeFingerprintV1,
  CanonicalJsonValidationErrorV1,
} from "./canonical-json.v1.js";

const sha256Pattern = /^sha256:[0-9a-f]{64}$/;

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
    typeof receipt.transport_ref !== "string" ||
    receipt.transport_ref.trim().length === 0 ||
    typeof receipt.transport_epoch !== "string" ||
    receipt.transport_epoch.trim().length === 0 ||
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

export class OutboxClaimContractErrorV1 extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "OutboxClaimContractErrorV1";
  }
}

function claimedOutboxRecordV1(value: unknown): ClaimedOutboxRecordV1 {
  if (typeof value !== "object" || value === null) {
    throw new OutboxClaimContractErrorV1("outbox claim must be an object");
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.outbox_id !== "string" ||
    record.outbox_id.length === 0 ||
    typeof record.claim_token !== "string" ||
    record.claim_token.length === 0
  ) {
    throw new OutboxClaimContractErrorV1(
      "outbox claim identity or lease token is invalid",
    );
  }
  return {
    outbox_id: record.outbox_id,
    claim_token: record.claim_token,
    attempt_count: record.attempt_count,
    target: record.target,
    envelope: record.envelope,
    payload_hash: record.payload_hash,
  };
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
    !Number.isSafeInteger(config.batch_size) ||
    config.batch_size < 1 ||
    config.batch_size > 1_000 ||
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
  assertDispatcherConfig(config);
  const now = dependencies.now ?? (() => new Date());
  const random = dependencies.random ?? Math.random;
  return Object.freeze({
    async dispatchBatch(): Promise<DurableOutboxDispatchSummaryV1> {
      const claimedAt = now().toISOString();
      const records = await store.claim({
        worker_id: config.worker_id,
        limit: config.batch_size,
        lease_seconds: config.lease_seconds,
        now: claimedAt,
        current_transport_epoch: config.current_transport_epoch,
        current_transport_generation: config.current_transport_generation,
      });
      let sent = 0;
      let retryWait = 0;
      let failed = 0;
      for (const record of records) {
        let failure: Readonly<{ code: string; retryable: boolean }> | undefined;
        let receipt: DurableEventTransportReceiptV1 | undefined;
        let attemptCount = 1;
        try {
          assertOwnerDurableEventEnvelopeV1(record.envelope);
          if (
            !Number.isSafeInteger(record.attempt_count) ||
            (record.attempt_count as number) < 1 ||
            typeof record.outbox_id !== "string" ||
            record.outbox_id.trim().length === 0 ||
            typeof record.claim_token !== "string" ||
            record.claim_token.trim().length === 0 ||
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
          if (record.envelope.producer !== config.owner_service) {
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
          receipt = await transport.publish({
            target: record.target,
            envelope: record.envelope,
            payload_hash: record.payload_hash,
            current_transport_epoch: config.current_transport_epoch,
            current_transport_generation: config.current_transport_generation,
          });
          assertTransportReceiptV1(
            receipt,
            config.current_transport_epoch,
            config.current_transport_generation,
          );
        } catch (error) {
          failure = deliveryFailure(error);
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
            current_transport_epoch: config.current_transport_epoch,
            current_transport_generation: config.current_transport_generation,
            now: acknowledgedAt.toISOString(),
          });
          sent += 1;
          continue;
        }
        const exhausted = attemptCount >= config.max_attempts;
        const retryable = failure.retryable && !exhausted;
        await store.acknowledge({
          outbox_id: record.outbox_id,
          claim_token: record.claim_token,
          outcome: retryable ? "retry_wait" : "failed",
          next_retry_at: retryable
            ? new Date(
                acknowledgedAt.getTime() +
                  retryDelayMs(config, attemptCount, random),
              ).toISOString()
            : null,
          error: {
            code: exhausted && failure.retryable
              ? "delivery_retry_exhausted"
              : failure.code,
            retryable,
          },
          transport_ref: null,
          transport_epoch: null,
          transport_generation: null,
          current_transport_epoch: config.current_transport_epoch,
          current_transport_generation: config.current_transport_generation,
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
    previous_transport_epoch: string;
    previous_transport_generation: number | null;
    transport_ref: string;
    transport_epoch: string;
    current_transport_generation: number;
    now: string;
  }>): Promise<void>;
}

export interface DurableSentOutboxRedriveSummaryV1 {
  readonly claimed: number;
  readonly redriven: number;
  readonly retryable_failures: number;
  readonly permanent_failures: number;
}

/**
 * Re-materializes retained PostgreSQL sent rows into a new Redis stream epoch.
 * The store must lease only rows whose persisted epoch differs from the current
 * epoch and must CAS the previous epoch when acknowledging the new receipt.
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
  if (
    config.worker_id.trim().length === 0 ||
    config.current_transport_epoch.trim().length === 0 ||
    !Number.isSafeInteger(config.current_transport_generation) ||
    config.current_transport_generation < 1 ||
    !Number.isSafeInteger(config.batch_size) ||
    config.batch_size < 1 ||
    config.batch_size > 1_000 ||
    !Number.isSafeInteger(config.lease_seconds) ||
    config.lease_seconds < 1 ||
    config.lease_seconds > 3_600
  ) {
    throw new Error("invalid sent outbox redrive configuration");
  }
  const now = dependencies.now ?? (() => new Date());
  return Object.freeze({
    async redriveBatch(): Promise<DurableSentOutboxRedriveSummaryV1> {
      const claimedAt = now().toISOString();
      const records = await store.claimSentForRedrive({
        worker_id: config.worker_id,
        limit: config.batch_size,
        lease_seconds: config.lease_seconds,
        now: claimedAt,
        current_transport_epoch: config.current_transport_epoch,
        current_transport_generation: config.current_transport_generation,
      });
      let redriven = 0;
      let retryableFailures = 0;
      let permanentFailures = 0;
      for (const record of records) {
        try {
          assertOwnerDurableEventEnvelopeV1(record.envelope);
          if (
            !Number.isSafeInteger(record.attempt_count) ||
            (record.attempt_count as number) < 1 ||
            typeof record.outbox_id !== "string" ||
            record.outbox_id.trim().length === 0 ||
            typeof record.claim_token !== "string" ||
            record.claim_token.trim().length === 0 ||
            typeof record.target !== "string" ||
            record.target.length === 0 ||
            typeof record.payload_hash !== "string" ||
            !sha256Pattern.test(record.payload_hash) ||
            typeof record.sent_at !== "string" ||
            !Number.isFinite(Date.parse(record.sent_at)) ||
            typeof record.transport_ref !== "string" ||
            record.transport_ref.trim().length === 0 ||
            typeof record.transport_epoch !== "string" ||
            record.transport_epoch.trim().length === 0 ||
            (record.transport_generation !== null &&
              !Number.isSafeInteger(record.transport_generation)) ||
            record.active_transport_generation !==
              config.current_transport_generation ||
            (record.transport_epoch === config.current_transport_epoch &&
              record.transport_generation ===
                config.current_transport_generation) ||
            record.envelope.producer !== config.owner_service ||
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
          const receipt = await transport.publish({
            target: record.target,
            envelope: record.envelope,
            payload_hash: record.payload_hash,
            current_transport_epoch: config.current_transport_epoch,
            current_transport_generation: config.current_transport_generation,
          });
          assertTransportReceiptV1(
            receipt,
            config.current_transport_epoch,
            config.current_transport_generation,
          );
          await store.acknowledgeSentRedrive({
            outbox_id: record.outbox_id,
            claim_token: record.claim_token,
            previous_transport_epoch: record.transport_epoch,
            previous_transport_generation:
              record.transport_generation === null
                ? null
                : (record.transport_generation as number),
            transport_ref: receipt.transport_ref,
            transport_epoch: receipt.transport_epoch,
            current_transport_generation: config.current_transport_generation,
            now: now().toISOString(),
          });
          redriven += 1;
        } catch (error) {
          if (deliveryFailure(error).retryable) retryableFailures += 1;
          else permanentFailures += 1;
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
  return Object.freeze({
    async consume(envelope) {
      assertOwnerDurableEventEnvelopeV1(envelope);
      if (!isOwnerDurableEventTypeV1(envelope.producer, envelope.event_type)) {
        throw new DurableEventEnvelopeValidationErrorV1([
          "/event_type: must belong to the producer owner union",
        ]);
      }
      if (
        !isDurableEventConsumerAllowedV1(envelope, config.consumer_service)
      ) {
        throw new DurableEventEnvelopeValidationErrorV1([
          "/producer: event branch is not accepted by this durable consumer",
        ]);
      }
      const result = await inbox.apply({
        source: envelope.producer,
        event_id: envelope.event_id,
        idempotency_key: envelope.idempotency_key,
        payload_hash: canonicalPayloadHashV1(envelope.payload),
        semantic_hash: canonicalDurableEventEnvelopeSemanticHashV1(envelope),
        scope_fingerprint: durableEventScopeFingerprintV1(envelope),
        envelope,
      });
      assertInboxApplyResultV1(result);
      return result;
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

export function createDurableEventConsumerWorkerV1(
  delivery: DurableEventDeliveryConsumerPortV1,
  inbox: TransactionalInboxApplyPortV1,
  config: Readonly<{
    consumer_service: DurableEventConsumerServiceIdV1;
    dead_letter: DurableEventConsumerDeadLetterPortV1;
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
  const consumer = createDurableInboxConsumerV1(inbox, config);
  const acknowledgeOne = async (deliveryId: string): Promise<number> => {
    const result = await delivery.acknowledge({ delivery_ids: [deliveryId] });
    if (result.acknowledged !== 1) {
      throw new Error(`Redis delivery acknowledgement drift: ${deliveryId}`);
    }
    return result.acknowledged;
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
          const deadLetter = await config.dead_letter.recordPermanentFailure({
            consumer_service: config.consumer_service,
            delivery_id: message.delivery_id,
            delivery_ref: message.delivery_ref,
            failure_code: message.error_code,
            failure_message: message.error_message,
            raw_fields: message.raw_fields,
            envelope: null,
          });
          if (
            deadLetter.status !== "recorded" &&
            deadLetter.status !== "replayed"
          ) {
            throw new Error("durable consumer DLQ returned an invalid status");
          }
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
          const deadLetter = await config.dead_letter.recordPermanentFailure({
            consumer_service: config.consumer_service,
            delivery_id: message.delivery_id,
            delivery_ref: message.delivery_ref,
            failure_code:
              error instanceof DurableInboxApplyErrorV1
                ? error.code
                : "consumer_contract_violation",
            failure_message:
              error instanceof Error ? error.message : "permanent consumer failure",
            raw_fields: null,
            envelope: message.envelope,
          });
          if (
            deadLetter.status !== "recorded" &&
            deadLetter.status !== "replayed"
          ) {
            throw new Error("durable consumer DLQ returned an invalid status");
          }
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
      return consumeMessages(await delivery.readNew(request));
    },
    async reclaimAndConsumeBatch(request) {
      const maxPages = request.max_pages ?? 10;
      if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 100) {
        throw new Error("Redis reclaim max_pages is outside the V1 bounds");
      }
      let cursor = request.start_id;
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
        const batch = await delivery.reclaimPending({
          min_idle_ms: request.min_idle_ms,
          count: request.count,
          start_id: cursor,
        });
        const summary = await consumeMessages(
          batch.deliveries,
          batch.deleted_ids.length,
          batch.next_start_id,
        );
        total.received += summary.received;
        total.processed += summary.processed;
        total.replayed += summary.replayed;
        total.failed += summary.failed;
        total.dead_lettered += summary.dead_lettered;
        total.acknowledged += summary.acknowledged;
        total.deleted += summary.deleted;
        total.next_start_id = batch.next_start_id;
        if (batch.next_start_id === "0-0") break;
        if (batch.next_start_id === cursor) {
          throw new Error("Redis XAUTOCLAIM cursor did not advance");
        }
        cursor = batch.next_start_id;
      }
      return total;
    },
  });
}
