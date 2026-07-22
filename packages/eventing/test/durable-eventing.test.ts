import type {
  DurableEventEnvelopeV1,
  ServiceIdV1,
} from "@pai/contracts";
import { describe, expect, it } from "vitest";

import {
  canonicalDurableEventEnvelopeSemanticHashV1,
  canonicalPayloadHashV1,
  durableEventScopeFingerprintV1,
  createDurableInboxConsumerV1,
  createDurableEventConsumerWorkerV1,
  createDurableOutboxDispatcherV1,
  createDurableSentOutboxRedriverV1,
  DurableInboxApplyErrorV1,
  EventTransportErrorV1,
  EventTransportPreflightErrorV1,
  OutboxClaimContractErrorV1,
  type ClaimedOutboxRecordV1,
  type DurableEventTransportPortV1,
  type DurableOutboxStorePortV1,
  type TransactionalInboxApplyPortV1,
  type DurableEventDeliveryConsumerPortV1,
  type DurableEventConsumerDeadLetterPortV1,
  type DurableEventDeliveryV1,
  type DurableSentOutboxRedriveStorePortV1,
} from "../src/index.js";

function triggerPayloadBase(
  overrides: Partial<Record<
    | "workspace_id"
    | "bot_id"
    | "owner_agent_id"
    | "deployment_environment"
    | "release_channel",
    string
  >> = {},
) {
  return {
    workspace_id: "workspace_001",
    bot_id: "bot_001",
    owner_agent_id: "owner_agent_001",
    deployment_environment: "dev",
    release_channel: "stable",
    reason_code: "business_admission_rejected",
    source_ref: "trigger_event:submit_attempt_001",
    ...overrides,
  } as const;
}

function event(
  overrides: Partial<DurableEventEnvelopeV1> = {},
): DurableEventEnvelopeV1 {
  return {
    event_id: "evt_001",
    event_type: "trigger.rejected",
    schema_version: "trigger_processor_event.v1",
    producer: "trigger_processor",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: "submit_attempt_001:rejected",
    trace_id: "trace_001",
    payload: {
      ...triggerPayloadBase(),
      submit_attempt_id: "submit_attempt_001",
      rejection_stage: "business_admission",
      rejection_code: "admission_capacity_exceeded",
    },
    ...overrides,
  };
}

function pendingRuntimeEvent(
  overrides: Partial<DurableEventEnvelopeV1> = {},
): DurableEventEnvelopeV1 {
  return {
    event_id: "evt_runtime_pending_001",
    event_type: "runtime.run.completed",
    schema_version: "runtime_domain_event.v1",
    producer: "action_runtime",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: "run_001:completed",
    trace_id: "trace_runtime_pending_001",
    payload: {
      scope_kind: "bot",
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
      runtime_run_id: "run_001",
      outcome: "completed",
    },
    ...overrides,
  };
}

function triggerEvent(
  overrides: Partial<DurableEventEnvelopeV1> = {},
): DurableEventEnvelopeV1 {
  return {
    event_id: "evt_trigger_accepted_001",
    event_type: "trigger.accepted",
    schema_version: "trigger_processor_event.v1",
    producer: "trigger_processor",
    occurred_at: "2026-07-22T04:00:00.000Z",
    idempotency_key: "trigger_001:accepted",
    trace_id: "trace_trigger_001",
    payload: {
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
      reason_code: "admission_accepted",
      source_ref: "trigger_event:submit_001",
      trigger_id: "trigger_001",
      trigger_process_id: "process_001",
      admission_outcome: "accepted",
      priority: "strong",
      dedupe_key: "chat:message_001",
      request_hash: "hash_001",
    },
    ...overrides,
  };
}

function claimedEventRecord(
  outboxId: string,
  claimToken: string,
  eventId = outboxId,
): ClaimedOutboxRecordV1 {
  const envelope = event({
    event_id: eventId,
    idempotency_key: `${eventId}:rejected`,
  });
  return {
    outbox_id: outboxId,
    claim_token: claimToken,
    attempt_count: 1,
    target: "trigger_processor.admission_audit",
    envelope,
    payload_hash: canonicalPayloadHashV1(envelope.payload),
  };
}

interface StoredRecord extends ClaimedOutboxRecordV1 {
  status: "pending" | "dispatching" | "retry_wait" | "sent" | "failed";
  next_retry_at: string | null;
  locked_until: string | null;
  transport_ref: string | null;
  transport_epoch: string | null;
  transport_generation: number | null;
  sent_at: string | null;
}

class DurableStoreFake implements DurableOutboxStorePortV1 {
  public failNextAckBeforeCommit = false;
  public activeTransportEpoch = "epoch_1";
  public activeTransportGeneration = 1;
  public readonly records: StoredRecord[];
  public readonly acknowledgements: Array<{
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
  }> = [];

  public constructor(records: readonly DurableEventEnvelopeV1[]) {
    this.records = records.map((envelope, index) => ({
      outbox_id: `outbox_${index + 1}`,
      claim_token: "",
      attempt_count: 0,
      target: "trigger_processor.admission_audit",
      envelope,
      payload_hash: canonicalPayloadHashV1(envelope.payload),
      status: "pending",
      next_retry_at: null,
      locked_until: null,
      transport_ref: null,
      transport_epoch: null,
      transport_generation: null,
      sent_at: null,
    }));
  }

  public async claim(request: {
    worker_id: string;
    limit: number;
    lease_seconds: number;
    now: string;
    current_transport_epoch: string;
    current_transport_generation: number;
  }): Promise<readonly ClaimedOutboxRecordV1[]> {
    if (
      request.current_transport_epoch !== this.activeTransportEpoch ||
      request.current_transport_generation !== this.activeTransportGeneration
    ) {
      return [];
    }
    const nowMs = Date.parse(request.now);
    return this.records
      .filter(
        (record) =>
          (record.status === "pending" ||
            record.status === "retry_wait" ||
            (record.status === "dispatching" &&
              record.locked_until !== null &&
              Date.parse(record.locked_until) <= nowMs)) &&
          (record.next_retry_at === null ||
            Date.parse(record.next_retry_at) <= nowMs),
      )
      .slice(0, request.limit)
      .map((record) => {
        record.status = "dispatching";
        record.attempt_count += 1;
        record.claim_token =
          `${request.worker_id}:${record.outbox_id}:${record.attempt_count}`;
        record.locked_until = new Date(
          nowMs + request.lease_seconds * 1_000,
        ).toISOString();
        return record;
      });
  }

  public async acknowledge(request: {
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
  }): Promise<void> {
    if (this.failNextAckBeforeCommit) {
      this.failNextAckBeforeCommit = false;
      throw new Error("simulated database disconnect before ack commit");
    }
    const record = this.records.find(
      (candidate) => candidate.outbox_id === request.outbox_id,
    );
    if (
      request.current_transport_epoch !== this.activeTransportEpoch ||
      request.current_transport_generation !== this.activeTransportGeneration
    ) {
      throw new Error("stale active transport generation");
    }
    if (
      record === undefined ||
      record.status !== "dispatching" ||
      record.claim_token !== request.claim_token
    ) {
      throw new Error("stale outbox claim token");
    }
    record.status = request.outcome;
    record.next_retry_at = request.next_retry_at;
    record.locked_until = null;
    record.transport_ref = request.transport_ref;
    record.transport_epoch = request.transport_epoch;
    record.transport_generation = request.transport_generation;
    record.sent_at = request.outcome === "sent" ? request.now : record.sent_at;
    this.acknowledgements.push(request);
  }
}

function dispatcher(
  store: DurableOutboxStorePortV1,
  transport: DurableEventTransportPortV1,
  clock: { now: Date },
  ownerService: ServiceIdV1 = "trigger_processor",
  transportEpoch = "epoch_1",
  transportGeneration = 1,
) {
  return createDurableOutboxDispatcherV1(
    store,
    transport,
    {
      owner_service: ownerService,
      worker_id: "worker_001",
      batch_size: 16,
      lease_seconds: 5,
      max_attempts: 3,
      retry_base_delay_ms: 250,
      retry_max_delay_ms: 15_000,
      retry_jitter: "full",
      current_transport_epoch: transportEpoch,
      current_transport_generation: transportGeneration,
    },
    { now: () => new Date(clock.now), random: () => 0.5 },
  );
}

describe("durable outbox dispatcher V1", () => {
  it("rejects a pending owner before claim or acknowledgement side effects", () => {
    let claims = 0;
    let acknowledgements = 0;
    const store: DurableOutboxStorePortV1 = {
      async claim() {
        claims += 1;
        return [];
      },
      async acknowledge() {
        acknowledgements += 1;
      },
    };

    expect(() =>
      dispatcher(
        store,
        { async publish() { throw new Error("must not publish"); } },
        { now: new Date("2026-07-21T05:00:01.000Z") },
        "action_runtime",
      ),
    ).toThrow(/no active owner durable event wire contract/u);
    expect({ claims, acknowledgements }).toEqual({
      claims: 0,
      acknowledgements: 0,
    });
  });

  it("recovers an event committed before any dispatcher process existed", async () => {
    const store = new DurableStoreFake([event()]);
    const published: string[] = [];
    const transport: DurableEventTransportPortV1 = {
      async publish({ envelope }) {
        published.push(envelope.event_id);
        return {
          transport_ref: "redis_stream:1-0",
          transport_epoch: "epoch_1",
          transport_generation: 1,
        };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };

    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves.toEqual({
      claimed: 1,
      sent: 1,
      retry_wait: 0,
      failed: 0,
    });
    expect(published).toEqual(["evt_001"]);
    expect(store.records[0]?.status).toBe("sent");
  });

  it("snapshots claim pages and constructor fences before entering publish", async () => {
    const claimed = [claimedEventRecord("outbox_snapshot_1", "claim_snapshot_1")];
    const acknowledged: string[] = [];
    const claimRequests: Array<Readonly<{
      limit: number;
      current_transport_epoch: string;
      current_transport_generation: number;
    }>> = [];
    const config = {
      owner_service: "trigger_processor" as const,
      worker_id: "worker_snapshot",
      batch_size: 2,
      lease_seconds: 5,
      max_attempts: 3,
      retry_base_delay_ms: 250,
      retry_max_delay_ms: 15_000,
      retry_jitter: "none" as const,
      current_transport_epoch: "epoch_snapshot",
      current_transport_generation: 7,
    };
    const worker = createDurableOutboxDispatcherV1(
      {
        async claim(request) {
          claimRequests.push(request);
          return claimed;
        },
        async acknowledge(request) {
          acknowledged.push(request.outbox_id);
        },
      },
      {
        async publish() {
          claimed.push(
            claimedEventRecord("outbox_late_append", "claim_late_append"),
          );
          return {
            transport_ref: "redis_stream:snapshot:1-0",
            transport_epoch: "epoch_snapshot",
            transport_generation: 7,
          };
        },
      },
      config,
      { now: () => new Date("2026-07-22T07:00:00.000Z") },
    );

    Object.assign(config, {
      owner_service: "action_runtime",
      batch_size: 999,
      current_transport_epoch: "epoch_mutated",
      current_transport_generation: 999,
    });

    await expect(worker.dispatchBatch()).resolves.toEqual({
      claimed: 1,
      sent: 1,
      retry_wait: 0,
      failed: 0,
    });
    expect(claimRequests).toEqual([{
      worker_id: "worker_snapshot",
      limit: 2,
      lease_seconds: 5,
      now: "2026-07-22T07:00:00.000Z",
      current_transport_epoch: "epoch_snapshot",
      current_transport_generation: 7,
    }]);
    expect(acknowledged).toEqual(["outbox_snapshot_1"]);
  });

  it("rejects duplicate outbox identities before any publish side effect", async () => {
    let publishes = 0;
    const duplicateClaim = [
      claimedEventRecord("outbox_duplicate", "claim_duplicate_1"),
      claimedEventRecord("outbox_duplicate", "claim_duplicate_2"),
    ];
    const worker = dispatcher(
      {
        async claim() { return duplicateClaim; },
        async acknowledge() { throw new Error("must not acknowledge"); },
      },
      {
        async publish() {
          publishes += 1;
          throw new Error("must not publish");
        },
      },
      { now: new Date("2026-07-22T07:00:00.000Z") },
    );

    await expect(worker.dispatchBatch()).rejects.toThrow(
      /outbox ids must be unique/u,
    );
    expect(publishes).toBe(0);
  });

  it("allows one opaque claim token to fence distinct outbox rows", async () => {
    const sharedClaimToken = "claim_batch_001";
    const claims = [
      claimedEventRecord("outbox_shared_token_1", sharedClaimToken),
      claimedEventRecord("outbox_shared_token_2", sharedClaimToken),
    ];
    const acknowledgements: string[] = [];
    const worker = dispatcher(
      {
        async claim() { return claims; },
        async acknowledge(request) {
          acknowledgements.push(`${request.outbox_id}:${request.claim_token}`);
        },
      },
      {
        async publish({ envelope }) {
          return {
            transport_ref: `redis_stream:${envelope.event_id}`,
            transport_epoch: "epoch_1",
            transport_generation: 1,
          };
        },
      },
      { now: new Date("2026-07-22T07:00:00.000Z") },
    );

    await expect(worker.dispatchBatch()).resolves.toMatchObject({
      claimed: 2,
      sent: 2,
    });
    expect(acknowledgements).toEqual([
      `outbox_shared_token_1:${sharedClaimToken}`,
      `outbox_shared_token_2:${sharedClaimToken}`,
    ]);
  });

  it("does not let a stale transport generation claim after cutover", async () => {
    const store = new DurableStoreFake([event()]);
    store.activeTransportEpoch = "epoch_2";
    store.activeTransportGeneration = 2;
    const published: string[] = [];
    const transport: DurableEventTransportPortV1 = {
      async publish({ envelope }) {
        published.push(envelope.event_id);
        return {
          transport_ref: `redis_stream:${published.length}-0`,
          transport_epoch: "epoch_2",
          transport_generation: 2,
        };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };

    await expect(
      dispatcher(store, transport, clock, "trigger_processor", "epoch_1", 1)
        .dispatchBatch(),
    ).resolves.toEqual({
      claimed: 0,
      sent: 0,
      retry_wait: 0,
      failed: 0,
    });
    expect(published).toEqual([]);
    expect(store.records[0]?.status).toBe("pending");

    await expect(
      dispatcher(store, transport, clock, "trigger_processor", "epoch_2", 2)
        .dispatchBatch(),
    ).resolves.toEqual({
      claimed: 1,
      sent: 1,
      retry_wait: 0,
      failed: 0,
    });
    expect(store.records[0]).toMatchObject({
      status: "sent",
      transport_epoch: "epoch_2",
      transport_generation: 2,
    });
  });

  it("keeps an unknown publish-before-ack outcome replayable after lease expiry", async () => {
    const store = new DurableStoreFake([event()]);
    const published: string[] = [];
    const transport: DurableEventTransportPortV1 = {
      async publish({ envelope }) {
        published.push(envelope.event_id);
        return {
          transport_ref: `redis_stream:${published.length}-0`,
          transport_epoch: "epoch_1",
          transport_generation: 1,
        };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };
    store.failNextAckBeforeCommit = true;
    await expect(
      dispatcher(store, transport, clock).dispatchBatch(),
    ).rejects.toThrow(/disconnect/);
    expect(store.records[0]?.status).toBe("dispatching");

    clock.now = new Date("2026-07-21T05:00:07.000Z");
    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves.toMatchObject({
      sent: 1,
    });
    expect(published).toEqual(["evt_001", "evt_001"]);
    expect(store.records[0]?.status).toBe("sent");
  });

  it("does not acknowledge success on transient transport failure", async () => {
    const store = new DurableStoreFake([event()]);
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        throw new EventTransportErrorV1(
          "transport_unavailable",
          true,
          "Redis unavailable",
        );
      },
    };
    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves.toEqual({
      claimed: 1,
      sent: 0,
      retry_wait: 1,
      failed: 0,
    });
    expect(store.records[0]).toMatchObject({
      status: "retry_wait",
      attempt_count: 1,
    });
    expect(store.acknowledgements[0]?.error).toEqual({
      code: "delivery_outcome_ambiguous",
      retryable: true,
    });
    expect(store.acknowledgements[0]?.next_retry_at).toBe(
      "2026-07-21T05:00:01.125Z",
    );
  });

  it("does not retry a permanent bounded-transport rejection", async () => {
    const store = new DurableStoreFake([event()]);
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        throw new EventTransportPreflightErrorV1(
          "transport_rejected",
          "Redis Stream message exceeds the bounded delivery size",
        );
      },
    };

    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves
      .toEqual({ claimed: 1, sent: 0, retry_wait: 0, failed: 1 });
    expect(store.acknowledgements[0]?.error).toEqual({
      code: "transport_rejected",
      retryable: false,
    });
  });

  it("never terminalizes an exhausted commit-ambiguous delivery attempt", async () => {
    const store = new DurableStoreFake([event()]);
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        throw new EventTransportErrorV1(
          "transport_timeout",
          true,
          "Redis publish timed out",
        );
      },
    };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const summary = await dispatcher(store, transport, clock).dispatchBatch();
      expect(summary).toMatchObject({ retry_wait: 1, failed: 0 });
      clock.now = new Date(clock.now.getTime() + 1_000);
    }
    expect(store.records[0]).toMatchObject({
      status: "retry_wait",
      attempt_count: 3,
    });
    expect(store.acknowledgements[2]?.error).toEqual({
      code: "delivery_outcome_ambiguous",
      retryable: true,
    });
  });

  it("fails and releases an identified poison claim instead of leasing it forever", async () => {
    const store = new DurableStoreFake([event()]);
    store.records[0]!.target = null;
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        return {
          transport_ref: "unreachable",
          transport_epoch: "epoch_1",
          transport_generation: 1,
        };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };

    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves.toEqual({
      claimed: 1,
      sent: 0,
      retry_wait: 0,
      failed: 1,
    });
    expect(publishes).toBe(0);
    expect(store.records[0]).toMatchObject({ status: "failed", locked_until: null });
    expect(store.acknowledgements[0]?.error).toEqual({
      code: "outbox_contract_violation",
      retryable: false,
    });
  });

  it("fails closed before transport on producer or payload-hash drift", async () => {
    const store = new DurableStoreFake([event()]);
    store.records[0]!.payload_hash = canonicalPayloadHashV1({ drift: true });
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        return {
          transport_ref: "unreachable",
          transport_epoch: "epoch_1",
          transport_generation: 1,
        };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };
    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves.toMatchObject({
      failed: 1,
    });
    expect(publishes).toBe(0);
    expect(store.records[0]?.status).toBe("failed");
  });

  it("fails a declared-but-pending owner before constructing a dispatcher", () => {
    const store = new DurableStoreFake([pendingRuntimeEvent()]);
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        return {
          transport_ref: "unreachable",
          transport_epoch: "epoch_1",
          transport_generation: 1,
        };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };

    expect(() =>
      dispatcher(store, transport, clock, "action_runtime"),
    ).toThrow(/no active owner durable event wire contract/u);
    expect(publishes).toBe(0);
    expect(store.acknowledgements).toHaveLength(0);
    expect(store.records[0]?.status).toBe("pending");
  });

  it("fails a durable event whose target is outside the route matrix", async () => {
    const store = new DurableStoreFake([event()]);
    store.records[0]!.target = "memory.admission_audit";
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        return {
          transport_ref: "unreachable",
          transport_epoch: "epoch_1",
          transport_generation: 1,
        };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };

    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves
      .toMatchObject({ failed: 1, retry_wait: 0 });
    expect(publishes).toBe(0);
    expect(store.acknowledgements[0]?.error).toEqual({
      code: "outbox_contract_violation",
      retryable: false,
    });
  });

  it("classifies a non-JSON payload as a non-retryable contract violation", async () => {
    const invalid = event({ payload: { invalid: 1n } as never });
    const store = new DurableStoreFake([event()]);
    store.records[0]!.envelope = invalid;
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        return {
          transport_ref: "unreachable",
          transport_epoch: "epoch_1",
          transport_generation: 1,
        };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };

    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves.toMatchObject({
      retry_wait: 0,
      failed: 1,
    });
    expect(publishes).toBe(0);
    expect(store.acknowledgements[0]?.error).toEqual({
      code: "outbox_contract_violation",
      retryable: false,
    });
  });

  it("bounds oversized and over-deep poison snapshots before publishing", async () => {
    let deepPayload: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 70; depth += 1) {
      deepPayload = { next: deepPayload };
    }
    const store = new DurableStoreFake([
      event({ event_id: "evt_deep_poison" }),
      event({ event_id: "evt_oversized_poison" }),
    ]);
    store.records[0]!.envelope = event({
      event_id: "evt_deep_poison",
      idempotency_key: "evt_deep_poison:rejected",
      payload: deepPayload as never,
    });
    store.records[1]!.envelope = event({
      event_id: "evt_oversized_poison",
      idempotency_key: "evt_oversized_poison:rejected",
      payload: { value: "x".repeat(1_048_577) } as never,
    });
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        throw new Error("poison rows must not publish");
      },
    };

    await expect(
      dispatcher(store, transport, {
        now: new Date("2026-07-22T07:00:00.000Z"),
      }).dispatchBatch(),
    ).resolves.toEqual({ claimed: 2, sent: 0, retry_wait: 0, failed: 2 });
    expect(publishes).toBe(0);
    expect(store.records.map((record) => record.status)).toEqual([
      "failed",
      "failed",
    ]);
  });
});

describe("durable sent outbox redrive V1", () => {
  it("rejects a pending owner before claiming or rewriting sent rows", () => {
    let claims = 0;
    let acknowledgements = 0;

    expect(() =>
      createDurableSentOutboxRedriverV1(
        {
          async claimSentForRedrive() {
            claims += 1;
            return [];
          },
          async acknowledgeSentRedrive() {
            acknowledgements += 1;
          },
        },
        { async publish() { throw new Error("must not publish"); } },
        {
          owner_service: "timer_trigger_app",
          worker_id: "redrive_worker",
          batch_size: 10,
          lease_seconds: 30,
          current_transport_epoch: "epoch_current",
          current_transport_generation: 1,
        },
      ),
    ).toThrow(/no active owner durable event wire contract/u);
    expect({ claims, acknowledgements }).toEqual({
      claims: 0,
      acknowledgements: 0,
    });
  });

  it("snapshots redrive configuration and claimed rows before publish", async () => {
    const firstEnvelope = event({
      event_id: "evt_redrive_snapshot_1",
      idempotency_key: "evt_redrive_snapshot_1:rejected",
    });
    const rows = [{
      outbox_id: "outbox_redrive_snapshot_1",
      claim_token: "claim_redrive_snapshot_1",
      attempt_count: 1,
      target: "trigger_processor.admission_audit",
      envelope: firstEnvelope,
      payload_hash: canonicalPayloadHashV1(firstEnvelope.payload),
      sent_at: "2026-07-22T06:00:00.000Z",
      transport_ref: "redis_stream:old:1-0",
      transport_epoch: "epoch_old",
      transport_generation: 1,
      active_transport_generation: 2,
    }];
    const acknowledgements: string[] = [];
    const config = {
      owner_service: "trigger_processor" as const,
      worker_id: "redrive_snapshot",
      batch_size: 2,
      lease_seconds: 30,
      current_transport_epoch: "epoch_new",
      current_transport_generation: 2,
    };
    const redriver = createDurableSentOutboxRedriverV1(
      {
        async claimSentForRedrive() { return rows; },
        async acknowledgeSentRedrive(request) {
          acknowledgements.push(request.outbox_id);
        },
        async acknowledgeSentRedrivePermanentFailure() {
          throw new Error("valid snapshot must not be quarantined");
        },
      },
      {
        async publish() {
          const lateEnvelope = event({
            event_id: "evt_redrive_late_2",
            idempotency_key: "evt_redrive_late_2:rejected",
          });
          rows.push({
            ...rows[0]!,
            outbox_id: "outbox_redrive_late_2",
            claim_token: "claim_redrive_late_2",
            envelope: lateEnvelope,
            payload_hash: canonicalPayloadHashV1(lateEnvelope.payload),
          });
          return {
            transport_ref: "redis_stream:new:1-0",
            transport_epoch: "epoch_new",
            transport_generation: 2,
          };
        },
      },
      config,
      { now: () => new Date("2026-07-22T07:00:00.000Z") },
    );
    Object.assign(config, {
      owner_service: "memory",
      batch_size: 999,
      current_transport_epoch: "epoch_mutated",
      current_transport_generation: 999,
    });

    await expect(redriver.redriveBatch()).resolves.toEqual({
      claimed: 1,
      redriven: 1,
      retryable_failures: 0,
      permanent_failures: 0,
    });
    expect(acknowledgements).toEqual(["outbox_redrive_snapshot_1"]);
  });

  it("rebuilds a lost Redis epoch from retained PostgreSQL facts and dedupes replay", async () => {
    const envelope = event({ event_id: "evt_redrive_001" });
    const row = {
      outbox_id: "outbox_redrive_001",
      claim_token: "redrive_worker:1",
      attempt_count: 1,
      target: "trigger_processor.admission_audit",
      envelope,
      payload_hash: canonicalPayloadHashV1(envelope.payload),
      sent_at: "2026-07-21T05:00:00.000Z",
      transport_ref: "redis_stream:old-1-0",
      transport_epoch: "epoch_old",
      transport_generation: 1,
      active_transport_generation: 2,
    };
    const store: DurableSentOutboxRedriveStorePortV1 = {
      async claimSentForRedrive(request) {
        expect(request.current_transport_generation).toBe(2);
        return row.transport_epoch === request.current_transport_epoch &&
          row.transport_generation === request.current_transport_generation
          ? []
          : [row];
      },
      async acknowledgeSentRedrive(request) {
        expect(request.previous_transport_epoch).toBe(row.transport_epoch);
        expect(request.previous_transport_generation).toBe(row.transport_generation);
        expect(request.current_transport_generation).toBe(2);
        row.transport_ref = request.transport_ref;
        row.transport_epoch = request.transport_epoch;
        row.transport_generation = request.current_transport_generation;
        row.active_transport_generation = request.current_transport_generation;
      },
    };
    let redisStream = [envelope];
    const seen = new Set<string>();
    const consumer = createDurableInboxConsumerV1(
      {
        async apply(request) {
          const key = `${request.source}:${request.scope_fingerprint}:${request.idempotency_key}:${request.semantic_hash}`;
          if (seen.has(key)) return { status: "replayed" };
          seen.add(key);
          return { status: "processed" };
        },
      },
      { consumer_service: "trigger_processor" },
    );
    await expect(consumer.consume(redisStream[0]!)).resolves.toEqual({
      status: "processed",
    });

    redisStream = [];
    const redriver = createDurableSentOutboxRedriverV1(
      store,
      {
        async publish({ envelope: published }) {
          redisStream.push(published);
          return {
            transport_ref: "redis_stream:new-1-0",
            transport_epoch: "epoch_new",
            transport_generation: 2,
          };
        },
      },
      {
        owner_service: "trigger_processor",
        worker_id: "redrive_worker",
        batch_size: 10,
        lease_seconds: 30,
        current_transport_epoch: "epoch_new",
        current_transport_generation: 2,
      },
      { now: () => new Date("2026-07-22T04:00:00.000Z") },
    );
    await expect(redriver.redriveBatch()).resolves.toEqual({
      claimed: 1,
      redriven: 1,
      retryable_failures: 0,
      permanent_failures: 0,
    });
    expect(row).toMatchObject({
      transport_ref: "redis_stream:new-1-0",
      transport_epoch: "epoch_new",
    });
    expect(redisStream).toHaveLength(1);
    await expect(consumer.consume(redisStream[0]!)).resolves.toEqual({
      status: "replayed",
    });
    await expect(redriver.redriveBatch()).resolves.toMatchObject({ claimed: 0 });
  });

  it("redrives the same Redis epoch when the authoritative generation advances", async () => {
    const envelope = event({ event_id: "evt_redrive_same_epoch_001" });
    const row = {
      outbox_id: "outbox_redrive_same_epoch_001",
      claim_token: "redrive_worker:1",
      attempt_count: 1,
      target: "trigger_processor.admission_audit",
      envelope,
      payload_hash: canonicalPayloadHashV1(envelope.payload),
      sent_at: "2026-07-21T05:00:00.000Z",
      transport_ref: "redis_stream:old-1-0",
      transport_epoch: "epoch_current",
      transport_generation: 1,
      active_transport_generation: 2,
    };
    const store: DurableSentOutboxRedriveStorePortV1 = {
      async claimSentForRedrive(request) {
        expect(request.current_transport_epoch).toBe("epoch_current");
        expect(request.current_transport_generation).toBe(2);
        return [row];
      },
      async acknowledgeSentRedrive(request) {
        expect(request.previous_transport_epoch).toBe("epoch_current");
        expect(request.previous_transport_generation).toBe(1);
        row.transport_ref = request.transport_ref;
        row.transport_generation = request.current_transport_generation;
        row.active_transport_generation = request.current_transport_generation;
      },
    };
    const redriver = createDurableSentOutboxRedriverV1(
      store,
      {
        async publish() {
          return {
            transport_ref: "redis_stream:same-epoch-new-1-0",
            transport_epoch: "epoch_current",
            transport_generation: 2,
          };
        },
      },
      {
        owner_service: "trigger_processor",
        worker_id: "redrive_worker",
        batch_size: 10,
        lease_seconds: 30,
        current_transport_epoch: "epoch_current",
        current_transport_generation: 2,
      },
      { now: () => new Date("2026-07-22T04:00:00.000Z") },
    );
    await expect(redriver.redriveBatch()).resolves.toMatchObject({
      claimed: 1,
      redriven: 1,
      permanent_failures: 0,
    });
    expect(row).toMatchObject({
      transport_ref: "redis_stream:same-epoch-new-1-0",
      transport_generation: 2,
    });
  });

  it("fails a redrive claim with a non-positive persisted generation before publish", async () => {
    const envelope = event({ event_id: "evt_redrive_invalid_generation_001" });
    let publishes = 0;
    const quarantined: string[] = [];
    const redriver = createDurableSentOutboxRedriverV1(
      {
        async claimSentForRedrive() {
          return [{
            outbox_id: "outbox_redrive_invalid_generation_001",
            claim_token: "redrive_worker:1",
            attempt_count: 1,
            target: "trigger_processor.admission_audit",
            envelope,
            payload_hash: canonicalPayloadHashV1(envelope.payload),
            sent_at: "2026-07-21T05:00:00.000Z",
            transport_ref: "redis_stream:old-1-0",
            transport_epoch: "epoch_old",
            transport_generation: 0,
            active_transport_generation: 2,
          }];
        },
        async acknowledgeSentRedrive() {
          throw new Error("invalid claim must not be acknowledged as redriven");
        },
        async acknowledgeSentRedrivePermanentFailure(request) {
          expect(request).toMatchObject({
            outbox_id: "outbox_redrive_invalid_generation_001",
            previous_transport_generation: 0,
            current_transport_generation: 2,
            failure_code: "outbox_contract_violation",
          });
          quarantined.push(request.outbox_id);
          return { acknowledged: true, status: "quarantined" };
        },
      },
      {
        async publish() {
          publishes += 1;
          throw new Error("invalid claim must not reach the transport");
        },
      },
      {
        owner_service: "trigger_processor",
        worker_id: "redrive_worker",
        batch_size: 10,
        lease_seconds: 30,
        current_transport_epoch: "epoch_current",
        current_transport_generation: 2,
      },
    );

    await expect(redriver.redriveBatch()).resolves.toEqual({
      claimed: 1,
      redriven: 0,
      retryable_failures: 0,
      permanent_failures: 1,
    });
    expect(publishes).toBe(0);
    expect(quarantined).toEqual(["outbox_redrive_invalid_generation_001"]);
  });

  it("does not quarantine a valid row when the post-publish PostgreSQL ACK is ambiguous", async () => {
    const envelope = event({ event_id: "evt_redrive_ack_ambiguous_001" });
    let quarantineCalls = 0;
    const redriver = createDurableSentOutboxRedriverV1(
      {
        async claimSentForRedrive() {
          return [{
            outbox_id: "outbox_redrive_ack_ambiguous_001",
            claim_token: "redrive_worker:ack-ambiguous",
            attempt_count: 1,
            target: "trigger_processor.admission_audit",
            envelope,
            payload_hash: canonicalPayloadHashV1(envelope.payload),
            sent_at: "2026-07-21T05:00:00.000Z",
            transport_ref: "redis_stream:old-1-0",
            transport_epoch: "epoch_old",
            transport_generation: 1,
            active_transport_generation: 2,
          }];
        },
        async acknowledgeSentRedrive() {
          throw new OutboxClaimContractErrorV1(
            "PostgreSQL ACK shape was malformed after commit",
          );
        },
        async acknowledgeSentRedrivePermanentFailure() {
          quarantineCalls += 1;
          return { acknowledged: true, status: "quarantined" };
        },
      },
      {
        async publish() {
          return {
            transport_ref: "redis_stream:new-1-0",
            transport_epoch: "epoch_current",
            transport_generation: 2,
          };
        },
      },
      {
        owner_service: "trigger_processor",
        worker_id: "redrive_worker",
        batch_size: 1,
        lease_seconds: 30,
        current_transport_epoch: "epoch_current",
        current_transport_generation: 2,
      },
    );

    await expect(redriver.redriveBatch()).resolves.toEqual({
      claimed: 1,
      redriven: 0,
      retryable_failures: 1,
      permanent_failures: 0,
    });
    expect(quarantineCalls).toBe(0);
  });

  it("does not quarantine a valid row when publish throws after a commit-ambiguous attempt", async () => {
    const envelope = event({ event_id: "evt_redrive_publish_ambiguous_001" });
    let quarantineCalls = 0;
    const redriver = createDurableSentOutboxRedriverV1(
      {
        async claimSentForRedrive() {
          return [{
            outbox_id: "outbox_redrive_publish_ambiguous_001",
            claim_token: "redriver:publish-ambiguous",
            attempt_count: 1,
            target: "trigger_processor.admission_audit",
            envelope,
            payload_hash: canonicalPayloadHashV1(envelope.payload),
            sent_at: "2026-07-22T00:00:00.000Z",
            transport_ref: "redis_stream:old:1-0",
            transport_epoch: "epoch-old",
            transport_generation: 1,
            active_transport_generation: 2,
          }];
        },
        async acknowledgeSentRedrive() {
          throw new Error("ACK must not be reached");
        },
        async acknowledgeSentRedrivePermanentFailure() {
          quarantineCalls += 1;
          return { acknowledged: true, status: "quarantined" } as const;
        },
      },
      {
        async publish() {
          throw new EventTransportErrorV1(
            "transport_rejected",
            false,
            "connection closed after Redis accepted the command",
          );
        },
      },
      {
        owner_service: "trigger_processor",
        worker_id: "redriver",
        batch_size: 1,
        lease_seconds: 30,
        current_transport_epoch: "epoch-new",
        current_transport_generation: 2,
      },
      { now: () => new Date("2026-07-22T00:01:00.000Z") },
    );

    await expect(redriver.redriveBatch()).resolves.toEqual({
      claimed: 1,
      redriven: 0,
      retryable_failures: 1,
      permanent_failures: 0,
    });
    expect(quarantineCalls).toBe(0);
  });

  it("keeps a permanent redrive failure retryable until its fenced quarantine ACK commits", async () => {
    const envelope = event({ event_id: "evt_redrive_quarantine_retry_001" });
    let failQuarantine = true;
    let quarantineAttempts = 0;
    const store: DurableSentOutboxRedriveStorePortV1 = {
      async claimSentForRedrive() {
        return [{
          outbox_id: "outbox_redrive_quarantine_retry_001",
          claim_token: `redrive_worker:${quarantineAttempts + 1}`,
          attempt_count: quarantineAttempts + 1,
          target: "trigger_processor.admission_audit",
          envelope,
          payload_hash: canonicalPayloadHashV1(envelope.payload),
          sent_at: "2026-07-21T05:00:00.000Z",
          transport_ref: "redis_stream:old-1-0",
          transport_epoch: "epoch_old",
          transport_generation: 0,
          active_transport_generation: 2,
        }];
      },
      async acknowledgeSentRedrive() {
        throw new Error("invalid claim must not be acknowledged as redriven");
      },
      async acknowledgeSentRedrivePermanentFailure() {
        quarantineAttempts += 1;
        if (failQuarantine) throw new Error("commit outcome unknown");
        return { acknowledged: true, status: "quarantined" };
      },
    };
    const redriver = createDurableSentOutboxRedriverV1(
      store,
      { async publish() { throw new Error("must not publish"); } },
      {
        owner_service: "trigger_processor",
        worker_id: "redrive_worker",
        batch_size: 1,
        lease_seconds: 30,
        current_transport_epoch: "epoch_current",
        current_transport_generation: 2,
      },
      { now: () => new Date("2026-07-22T04:00:00.000Z") },
    );

    await expect(redriver.redriveBatch()).resolves.toMatchObject({
      retryable_failures: 1,
      permanent_failures: 0,
    });
    failQuarantine = false;
    await expect(redriver.redriveBatch()).resolves.toMatchObject({
      retryable_failures: 0,
      permanent_failures: 1,
    });
    expect(quarantineAttempts).toBe(2);
  });
});

describe("durable inbox consumer V1", () => {
  it("computes scope fingerprint for canonical flat Trigger domain payloads", async () => {
    let observedScope: string | undefined;
    const consumer = createDurableInboxConsumerV1(
      {
        async apply(request) {
          observedScope = request.scope_fingerprint;
          return { status: "processed" };
        },
      },
      { consumer_service: "observation_gateway" },
    );
    const envelope = triggerEvent();
    await expect(consumer.consume(envelope)).resolves.toEqual({
      status: "processed",
    });
    expect(observedScope).toBe(durableEventScopeFingerprintV1(envelope));
  });

  it("snapshots consumer routing and the envelope before the inbox await", async () => {
    const config = {
      consumer_service: "observation_gateway" as const,
    };
    const original = triggerEvent();
    let observedReason: unknown;
    const consumer = createDurableInboxConsumerV1(
      {
        async apply(request) {
          expect(Object.isFrozen(request.envelope)).toBe(true);
          expect(Object.isFrozen(request.envelope.payload)).toBe(true);
          Object.assign(original.payload, { reason_code: "mutated_after_snapshot" });
          observedReason = (request.envelope.payload as Record<string, unknown>)
            .reason_code;
          return { status: "processed" };
        },
      },
      config,
    );
    Object.assign(config, { consumer_service: "memory" });

    await expect(consumer.consume(original)).resolves.toEqual({
      status: "processed",
    });
    expect(observedReason).toBe("admission_accepted");
  });

  it("processes one scoped identity once and rejects same-key semantic drift", async () => {
    const seen = new Map<string, string>();
    const inbox: TransactionalInboxApplyPortV1 = {
      async apply(request) {
        const key = `${request.source}:${request.scope_fingerprint}:${request.idempotency_key}`;
        const existing = seen.get(key);
        if (existing === undefined) {
          expect(request.payload_hash).toBe(
            canonicalPayloadHashV1(request.envelope.payload),
          );
          expect(request.semantic_hash).toBe(
            canonicalDurableEventEnvelopeSemanticHashV1(request.envelope),
          );
          expect(request.scope_fingerprint).toBe(
            durableEventScopeFingerprintV1(request.envelope),
          );
          seen.set(key, request.semantic_hash);
          return { status: "processed" };
        }
        if (existing !== request.semantic_hash) {
          throw new Error("inbox idempotency semantic hash conflict");
        }
        return { status: "replayed" };
      },
    };
    const consumer = createDurableInboxConsumerV1(inbox, {
      consumer_service: "trigger_processor",
    });
    await expect(consumer.consume(event())).resolves.toEqual({ status: "processed" });
    await expect(consumer.consume(event())).resolves.toEqual({ status: "replayed" });
    const semanticConflictKey = "semantic_conflict_001";
    await expect(
      consumer.consume(
        event({
          event_id: "evt_rejected_semantic_001",
          idempotency_key: semanticConflictKey,
        }),
      ),
    ).resolves.toEqual({ status: "processed" });
    await expect(
      consumer.consume(
        event({
          event_id: "evt_cooldown_semantic_002",
          event_type: "cooldown.expired",
          idempotency_key: semanticConflictKey,
          payload: {
            ...triggerPayloadBase(),
            trigger_process_id: "process_001",
            cooldown_until: "2026-07-21T05:00:00.000Z",
            expired_at: "2026-07-21T05:00:01.000Z",
          },
        }),
      ),
    ).rejects.toThrow(/semantic hash conflict/);
  });

  it("does not collapse different bot scopes that reuse producer idempotency keys", async () => {
    const seen = new Set<string>();
    const inbox: TransactionalInboxApplyPortV1 = {
      async apply(request) {
        const key = `${request.source}:${request.scope_fingerprint}:${request.idempotency_key}`;
        if (seen.has(key)) return { status: "replayed" };
        seen.add(key);
        return { status: "processed" };
      },
    };
    const consumer = createDurableInboxConsumerV1(inbox, {
      consumer_service: "trigger_processor",
    });
    await expect(consumer.consume(event())).resolves.toEqual({ status: "processed" });
    await expect(
      consumer.consume(
        event({
          payload: {
            ...triggerPayloadBase({
              bot_id: "bot_002",
              owner_agent_id: "owner_agent_002",
            }),
            submit_attempt_id: "submit_attempt_001",
            rejection_stage: "business_admission",
            rejection_code: "admission_capacity_exceeded",
          },
        }),
      ),
    ).resolves.toEqual({ status: "processed" });
    expect(seen.size).toBe(2);
  });

  it("rejects a declared-but-pending producer branch before owner side effects", async () => {
    let applies = 0;
    const consumer = createDurableInboxConsumerV1({
      async apply() {
        applies += 1;
        return { status: "processed" };
      },
    }, { consumer_service: "trigger_processor" });
    await expect(
      consumer.consume(pendingRuntimeEvent()),
    ).rejects.toThrow(/producer owner union/u);
    expect(applies).toBe(0);
  });

  it("rejects events outside the durable consumer route matrix before side effects", async () => {
    let applies = 0;
    const consumer = createDurableInboxConsumerV1({
      async apply() {
        applies += 1;
        return { status: "processed" };
      },
    }, { consumer_service: "memory" });
    await expect(consumer.consume(event())).rejects.toThrow(/consumer/u);
    expect(applies).toBe(0);
  });

  it.each([
    null,
    {},
    { status: "unknown" },
    { status: "processed", unexpected: true },
  ])(
    "rejects invalid inbox apply result %# before callers can ACK",
    async (invalidResult) => {
      const consumer = createDurableInboxConsumerV1(
        {
          async apply() {
            return invalidResult as never;
          },
        },
        { consumer_service: "trigger_processor" },
      );
      await expect(consumer.consume(event())).rejects.toThrow(
        /invalid result status/u,
      );
    },
  );
});

describe("durable event consumer worker V1", () => {
  class DeliveryFake implements DurableEventDeliveryConsumerPortV1 {
    public readonly acknowledged: string[] = [];
    public constructor(
      private readonly newMessages: readonly DurableEventDeliveryV1[],
      private readonly reclaimedMessages: readonly DurableEventDeliveryV1[] = [],
    ) {}

    public async readNew(): Promise<readonly DurableEventDeliveryV1[]> {
      return this.newMessages;
    }

    public async reclaimPending() {
      return {
        next_start_id: "0-0",
        deliveries: this.reclaimedMessages,
        deleted_ids: [],
      };
    }

    public async acknowledge(request: {
      delivery_ids: readonly string[];
    }): Promise<Readonly<{ acknowledged: number }>> {
      this.acknowledged.push(...request.delivery_ids);
      return { acknowledged: request.delivery_ids.length };
    }

    public transportRefForDeliveryId(deliveryId: string): string {
      return `redis_stream:pai:test:events:${deliveryId}`;
    }
  }

  function deadLetterFake() {
    const records: string[] = [];
    const port: DurableEventConsumerDeadLetterPortV1 = {
      async recordPermanentFailure(request) {
        records.push(request.delivery_id);
        return { status: "recorded" };
      },
    };
    return { port, records };
  }

  function deletedDeliveryReconciliationFake() {
    let guardRequestSequence = 0;
    return {
      recorder: {
        async verifyPeriodicFullAuditActive(request: {
          readonly request_id: string;
          readonly consumer_service: "trigger_processor";
          readonly coverage_fingerprint: string;
          readonly transport_epoch: string;
          readonly transport_generation: number;
        }) {
          return {
            acknowledged: true as const,
            status: "active" as const,
            request_id: request.request_id,
            consumer_service: request.consumer_service,
            coverage_fingerprint: request.coverage_fingerprint,
            transport_epoch: request.transport_epoch,
            transport_generation: request.transport_generation,
            audit_fence: "1",
            checked_at: "2026-07-22T00:00:00.000Z",
            heartbeat_at: "2026-07-22T00:00:00.000Z",
            last_full_pass_completed_at: "2026-07-22T00:00:00.000Z",
            expires_at: "2026-07-22T00:01:00.000Z",
          };
        },
        async recordDeletedTransportRefs(request: {
          readonly transport_refs: readonly string[];
        }) {
          return { matched: request.transport_refs.length, already_missing: 0 };
        },
      },
      transport_epoch: "epoch_test",
      transport_generation: 1,
      coverage_fingerprint: `sha256:${"1".repeat(64)}`,
      required_remaining_ms: 5_000,
      max_heartbeat_age_ms: 1_000,
      max_full_audit_lag_ms: 60_000,
      new_guard_request_id: () => `guard-${++guardRequestSequence}`,
    } as const;
  }

  it("acks transport only after the transactional inbox apply succeeds", async () => {
    const delivery = new DeliveryFake([
      { kind: "event", delivery_id: "1-0", delivery_ref: "stream:test#1-0", envelope: event({ event_id: "evt_worker_001" }) },
    ]);
    const deadLetter = deadLetterFake();
    const applied: string[] = [];
    const inbox: TransactionalInboxApplyPortV1 = {
      async apply(request) {
        applied.push(request.event_id);
        return { status: "processed" };
      },
    };
    const worker = createDurableEventConsumerWorkerV1(delivery, inbox, {
      consumer_service: "trigger_processor",
      dead_letter: deadLetter.port,
      deleted_delivery_reconciliation: deletedDeliveryReconciliationFake(),
    });
    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves.toEqual({
      received: 1,
      processed: 1,
      replayed: 0,
      failed: 0,
      dead_lettered: 0,
      acknowledged: 1,
      deleted: 0,
      next_start_id: null,
    });
    expect(applied).toEqual(["evt_worker_001"]);
    expect(delivery.acknowledged).toEqual(["1-0"]);
  });

  it("snapshots a read page before inbox awaits can append more deliveries", async () => {
    const messages: DurableEventDeliveryV1[] = [{
      kind: "event",
      delivery_id: "1-0",
      delivery_ref: "stream:test#1-0",
      envelope: event({ event_id: "evt_snapshot_delivery_1" }),
    }];
    const acknowledged: string[] = [];
    const worker = createDurableEventConsumerWorkerV1(
      {
        async readNew() { return messages; },
        async reclaimPending() {
          return { next_start_id: "0-0", deliveries: [], deleted_ids: [] };
        },
        async acknowledge(request) {
          acknowledged.push(...request.delivery_ids);
          return { acknowledged: request.delivery_ids.length };
        },
      },
      {
        async apply() {
          messages.push({
            kind: "event",
            delivery_id: "2-0",
            delivery_ref: "stream:test#2-0",
            envelope: event({ event_id: "evt_late_delivery_2" }),
          });
          return { status: "processed" };
        },
      },
      {
        consumer_service: "trigger_processor",
        dead_letter: deadLetterFake().port,
      },
    );

    await expect(worker.consumeNewBatch({ count: 2, block_ms: 0 })).resolves
      .toMatchObject({ received: 1, processed: 1, acknowledged: 1 });
    expect(acknowledged).toEqual(["1-0"]);
  });

  it("rejects duplicate delivery identities before inbox, DLQ, or XACK", async () => {
    let applies = 0;
    let acknowledgements = 0;
    const worker = createDurableEventConsumerWorkerV1(
      {
        async readNew() {
          return [
            {
              kind: "event" as const,
              delivery_id: "1-0",
              delivery_ref: "stream:test#1-0",
              envelope: event({ event_id: "evt_duplicate_delivery_1" }),
            },
            {
              kind: "event" as const,
              delivery_id: "1-0",
              delivery_ref: "stream:test#duplicate-1-0",
              envelope: event({ event_id: "evt_duplicate_delivery_2" }),
            },
          ];
        },
        async reclaimPending() {
          return { next_start_id: "0-0", deliveries: [], deleted_ids: [] };
        },
        async acknowledge() {
          acknowledgements += 1;
          return { acknowledged: 1 };
        },
      },
      {
        async apply() {
          applies += 1;
          return { status: "processed" };
        },
      },
      {
        consumer_service: "trigger_processor",
        dead_letter: deadLetterFake().port,
      },
    );

    await expect(
      worker.consumeNewBatch({ count: 2, block_ms: 0 }),
    ).rejects.toThrow(/independently unique/u);
    expect({ applies, acknowledgements }).toEqual({
      applies: 0,
      acknowledgements: 0,
    });
  });

  it("does not ack when the inbox transaction fails, leaving the message reclaimable", async () => {
    const delivery = new DeliveryFake(
      [{ kind: "event", delivery_id: "1-0", delivery_ref: "stream:test#1-0", envelope: event({ event_id: "evt_worker_fail" }) }],
      [{ kind: "event", delivery_id: "1-0", delivery_ref: "stream:test#1-0", envelope: event({ event_id: "evt_worker_fail" }) }],
    );
    const deadLetter = deadLetterFake();
    let fail = true;
    const inbox: TransactionalInboxApplyPortV1 = {
      async apply() {
        if (fail) throw new Error("domain transaction failed");
        return { status: "replayed" };
      },
    };
    const worker = createDurableEventConsumerWorkerV1(delivery, inbox, {
      consumer_service: "trigger_processor",
      dead_letter: deadLetter.port,
      deleted_delivery_reconciliation: deletedDeliveryReconciliationFake(),
    });
    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves.toEqual({
      received: 1,
      processed: 0,
      replayed: 0,
      failed: 1,
      dead_lettered: 0,
      acknowledged: 0,
      deleted: 0,
      next_start_id: null,
    });
    expect(delivery.acknowledged).toEqual([]);

    fail = false;
    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).resolves.toMatchObject({ replayed: 1, acknowledged: 1 });
    expect(delivery.acknowledged).toEqual(["1-0"]);
  });

  it("durably dead-letters one malformed delivery without blocking its valid sibling", async () => {
    const delivery = new DeliveryFake([
      {
        kind: "invalid",
        delivery_id: "1-0",
        delivery_ref: "stream:test#1-0",
        error_code: "invalid_json",
        error_message: "payload is malformed",
        raw_fields: ["payload", "{"],
      },
      {
        kind: "event",
        delivery_id: "2-0",
        delivery_ref: "stream:test#2-0",
        envelope: event({ event_id: "evt_valid_sibling" }),
      },
    ]);
    const deadLetter = deadLetterFake();
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      {
        async apply() {
          return { status: "processed" };
        },
      },
      {
        consumer_service: "trigger_processor",
        dead_letter: deadLetter.port,
      },
    );
    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves
      .toMatchObject({
        received: 2,
        processed: 1,
        dead_lettered: 1,
        failed: 0,
        acknowledged: 2,
      });
    expect(deadLetter.records).toEqual(["1-0"]);
    expect(delivery.acknowledged).toEqual(["1-0", "2-0"]);
  });

  it("dead-letters a permanent inbox semantic conflict before XACK", async () => {
    const delivery = new DeliveryFake([
      { kind: "event", delivery_id: "1-0", delivery_ref: "stream:test#1-0", envelope: event() },
    ]);
    const order: string[] = [];
    const originalAcknowledge = delivery.acknowledge.bind(delivery);
    delivery.acknowledge = async (request) => {
      order.push("xack");
      return originalAcknowledge(request);
    };
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      {
        async apply() {
          throw new DurableInboxApplyErrorV1(
            "semantic_conflict",
            false,
            "same idempotency key has different semantics",
          );
        },
      },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() {
            order.push("dlq");
            return { status: "recorded" };
          },
        },
      },
    );
    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves
      .toMatchObject({ dead_lettered: 1, acknowledged: 1, failed: 0 });
    expect(order).toEqual(["dlq", "xack"]);
  });

  it("does not XACK when the durable consumer DLQ transaction fails", async () => {
    const delivery = new DeliveryFake([
      {
        kind: "invalid",
        delivery_id: "1-0",
        delivery_ref: "stream:test#1-0",
        error_code: "invalid_envelope",
        error_message: "invalid event",
        raw_fields: [],
      },
    ]);
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() {
            throw new Error("DLQ transaction unavailable");
          },
        },
      },
    );
    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves
      .toMatchObject({ failed: 1, dead_lettered: 0, acknowledged: 0 });
    expect(delivery.acknowledged).toEqual([]);
  });

  it("bounds DLQ errors and rejects a widened terminal ACK before XACK", async () => {
    const delivery = new DeliveryFake([{
      kind: "invalid",
      delivery_id: "1-0",
      delivery_ref: "stream:test#1-0",
      error_code: "invalid_envelope",
      error_message: "x".repeat(2_000),
      raw_fields: [],
    }]);
    let recordedMessage = "";
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure(request) {
            recordedMessage = request.failure_message;
            return { status: "recorded", unexpected: true } as never;
          },
        },
      },
    );

    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves
      .toMatchObject({ failed: 1, dead_lettered: 0, acknowledged: 0 });
    expect(recordedMessage).toHaveLength(512);
    expect(delivery.acknowledged).toEqual([]);
  });

  it("rejects accessor-backed inbox and DLQ acknowledgements before XACK", async () => {
    const processedDelivery = new DeliveryFake([{
      kind: "event",
      delivery_id: "1-0",
      delivery_ref: "stream:test#1-0",
      envelope: event({ event_id: "evt_accessor_ack" }),
    }]);
    processedDelivery.acknowledge = async () => {
      const ack = {} as { acknowledged: number };
      Object.defineProperty(ack, "acknowledged", {
        enumerable: true,
        get: () => 1,
      });
      return ack;
    };
    const processedWorker = createDurableEventConsumerWorkerV1(
      processedDelivery,
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: deadLetterFake().port,
      },
    );
    await expect(
      processedWorker.consumeNewBatch({ count: 1, block_ms: 0 }),
    ).resolves.toMatchObject({
      processed: 0,
      failed: 1,
      acknowledged: 0,
    });

    const invalidDelivery = new DeliveryFake([{
      kind: "invalid",
      delivery_id: "2-0",
      delivery_ref: "stream:test#2-0",
      error_code: "invalid_envelope",
      error_message: "invalid event",
      raw_fields: [],
    }]);
    const invalidWorker = createDurableEventConsumerWorkerV1(
      invalidDelivery,
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() {
            const ack = {} as { status: "recorded" };
            Object.defineProperty(ack, "status", {
              enumerable: true,
              get: () => "recorded",
            });
            return ack;
          },
        },
      },
    );
    await expect(
      invalidWorker.consumeNewBatch({ count: 1, block_ms: 0 }),
    ).resolves.toMatchObject({
      dead_lettered: 0,
      failed: 1,
      acknowledged: 0,
    });
    expect(invalidDelivery.acknowledged).toEqual([]);
  });

  it.each([null, {}, { status: "unknown" }])(
    "does not XACK invalid inbox apply result %#",
    async (invalidResult) => {
      const delivery = new DeliveryFake([
        {
          kind: "event",
          delivery_id: "1-0",
          delivery_ref: "stream:test#1-0",
          envelope: event({ event_id: "evt_worker_invalid_result" }),
        },
      ]);
      const deadLetter = deadLetterFake();
      const worker = createDurableEventConsumerWorkerV1(
        delivery,
        {
          async apply() {
            return invalidResult as never;
          },
        },
        {
          consumer_service: "trigger_processor",
          dead_letter: deadLetter.port,
        },
      );
      await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves
        .toMatchObject({
          processed: 0,
          replayed: 0,
          failed: 1,
          dead_lettered: 0,
          acknowledged: 0,
        });
      expect(delivery.acknowledged).toEqual([]);
      expect(deadLetter.records).toEqual([]);
    },
  );

  it("advances XAUTOCLAIM across a poison prefix until the PEL cursor reaches zero", async () => {
    const cursors: string[] = [];
    const acknowledged: string[] = [];
    const delivery: DurableEventDeliveryConsumerPortV1 = {
      async readNew() { return []; },
      async reclaimPending(request) {
        cursors.push(request.start_id);
        return request.start_id === "0-0"
          ? {
              next_start_id: "5-0",
              deliveries: [{
                kind: "invalid" as const,
                delivery_id: "1-0",
                delivery_ref: "stream:test#1-0",
                error_code: "invalid_json" as const,
                error_message: "poison prefix",
                raw_fields: ["payload", "{"],
              }],
              deleted_ids: ["0-9"],
            }
          : {
              next_start_id: "0-0",
              deliveries: [{
                kind: "event" as const,
                delivery_id: "6-0",
                delivery_ref: "stream:test#6-0",
                envelope: event({ event_id: "evt_after_poison" }),
              }],
              deleted_ids: [],
            };
      },
      async acknowledge(request) {
        acknowledged.push(...request.delivery_ids);
        return { acknowledged: request.delivery_ids.length };
      },
      transportRefForDeliveryId(deliveryId) {
        return `redis_stream:pai:test:events:${deliveryId}`;
      },
    };
    const deadLetter = deadLetterFake();
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: deadLetter.port,
        deleted_delivery_reconciliation: deletedDeliveryReconciliationFake(),
      },
    );
    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 2,
        start_id: "0-0",
        max_pages: 5,
      }),
    ).resolves.toMatchObject({
      received: 2,
      processed: 1,
      dead_lettered: 1,
      acknowledged: 2,
      deleted: 1,
      next_start_id: "0-0",
    });
    expect(cursors).toEqual(["0-0", "5-0"]);
    expect(acknowledged).toEqual(["1-0", "6-0"]);
  });
});
