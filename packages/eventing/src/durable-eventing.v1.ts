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
  canonicalPayloadHashV1,
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
  }>): Promise<readonly ClaimedOutboxRecordV1[]>;
  acknowledge(request: Readonly<{
    outbox_id: string;
    claim_token: string;
    outcome: "sent" | "retry_wait" | "failed";
    next_retry_at: string | null;
    error: Readonly<Record<string, unknown>> | null;
    now: string;
  }>): Promise<void>;
}

export interface DurableEventTransportPortV1 {
  publish(request: Readonly<{
    target: string;
    envelope: DurableEventEnvelopeV1;
    payload_hash: string;
  }>): Promise<Readonly<{ transport_ref: string }>>;
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
    }>) {
      const records = await ownerOutbox.claim({
        outbox_table: outboxTable,
        worker_id: request.worker_id,
        limit: request.limit,
        lease_seconds: request.lease_seconds,
        now: request.now,
      });
      return records.map(claimedOutboxRecordV1);
    },
    async acknowledge(request: Readonly<{
      outbox_id: string;
      claim_token: string;
      outcome: "sent" | "retry_wait" | "failed";
      next_retry_at: string | null;
      error: Readonly<Record<string, unknown>> | null;
      now: string;
    }>) {
      await ownerOutbox.acknowledge({
        outbox_table: outboxTable,
        ...request,
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
    config.retry_max_delay_ms > 300_000
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
      });
      let sent = 0;
      let retryWait = 0;
      let failed = 0;
      for (const record of records) {
        let failure: Readonly<{ code: string; retryable: boolean }> | undefined;
        let attemptCount = 1;
        try {
          assertOwnerDurableEventEnvelopeV1(record.envelope);
          if (
            !Number.isSafeInteger(record.attempt_count) ||
            (record.attempt_count as number) < 1 ||
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
          await transport.publish({
            target: record.target,
            envelope: record.envelope,
            payload_hash: record.payload_hash,
          });
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

export interface TransactionalInboxApplyPortV1 {
  apply(request: Readonly<{
    source: ServiceIdV1;
    event_id: string;
    idempotency_key: string;
    payload_hash: string;
    envelope: DurableEventEnvelopeV1;
  }>): Promise<Readonly<{ status: "processed" | "replayed" }>>;
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
      return inbox.apply({
        source: envelope.producer,
        event_id: envelope.event_id,
        idempotency_key: envelope.idempotency_key,
        payload_hash: canonicalPayloadHashV1(envelope.payload),
        envelope,
      });
    },
  });
}
