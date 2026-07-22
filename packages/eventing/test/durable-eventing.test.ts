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
  type ClaimedOutboxRecordV1,
  type DurableEventTransportPortV1,
  type DurableOutboxStorePortV1,
  type TransactionalInboxApplyPortV1,
  type DurableEventDeliveryConsumerPortV1,
  type DurableEventConsumerDeadLetterPortV1,
  type DurableEventDeliveryV1,
  type DurableSentOutboxRedriveStorePortV1,
} from "../src/index.js";

function botScope(
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
    scope_kind: "bot",
    workspace_id: "workspace_001",
    bot_id: "bot_001",
    owner_agent_id: "owner_agent_001",
    deployment_environment: "dev",
    release_channel: "stable",
    ...overrides,
  } as const;
}

function event(
  overrides: Partial<DurableEventEnvelopeV1> = {},
): DurableEventEnvelopeV1 {
  return {
    event_id: "evt_001",
    event_type: "runtime.run.completed",
    schema_version: "runtime_domain_event.v1",
    producer: "action_runtime",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: "run_001:completed",
    trace_id: "trace_001",
    payload: {
      ...botScope(),
      runtime_run_id: "run_001",
      outcome: "completed",
    },
    ...overrides,
  };
}

interface StoredRecord extends ClaimedOutboxRecordV1 {
  status: "pending" | "dispatching" | "retry_wait" | "sent" | "failed";
  next_retry_at: string | null;
  locked_until: string | null;
  transport_ref: string | null;
  transport_epoch: string | null;
  sent_at: string | null;
}

class DurableStoreFake implements DurableOutboxStorePortV1 {
  public failNextAckBeforeCommit = false;
  public readonly records: StoredRecord[];
  public readonly acknowledgements: Array<{
    outbox_id: string;
    claim_token: string;
    outcome: "sent" | "retry_wait" | "failed";
    next_retry_at: string | null;
    error: Readonly<Record<string, unknown>> | null;
    transport_ref: string | null;
    transport_epoch: string | null;
    now: string;
  }> = [];

  public constructor(records: readonly DurableEventEnvelopeV1[]) {
    this.records = records.map((envelope, index) => ({
      outbox_id: `outbox_${index + 1}`,
      claim_token: "",
      attempt_count: 0,
      target: "trigger_processor.runtime_event_append",
      envelope,
      payload_hash: canonicalPayloadHashV1(envelope.payload),
      status: "pending",
      next_retry_at: null,
      locked_until: null,
      transport_ref: null,
      transport_epoch: null,
      sent_at: null,
    }));
  }

  public async claim(request: {
    worker_id: string;
    limit: number;
    lease_seconds: number;
    now: string;
  }): Promise<readonly ClaimedOutboxRecordV1[]> {
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
        record.claim_token = `${request.worker_id}:${record.attempt_count}`;
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
    record.sent_at = request.outcome === "sent" ? request.now : record.sent_at;
    this.acknowledgements.push(request);
  }
}

function dispatcher(
  store: DurableOutboxStorePortV1,
  transport: DurableEventTransportPortV1,
  clock: { now: Date },
  ownerService: ServiceIdV1 = "action_runtime",
) {
  return createDurableOutboxDispatcherV1(
    store,
    transport,
    {
      owner_service: ownerService,
      worker_id: "worker_001",
      batch_size: 100,
      lease_seconds: 5,
      max_attempts: 3,
      retry_base_delay_ms: 250,
      retry_max_delay_ms: 15_000,
      retry_jitter: "full",
    },
    { now: () => new Date(clock.now), random: () => 0.5 },
  );
}

describe("durable outbox dispatcher V1", () => {
  it("recovers an event committed before any dispatcher process existed", async () => {
    const store = new DurableStoreFake([event()]);
    const published: string[] = [];
    const transport: DurableEventTransportPortV1 = {
      async publish({ envelope }) {
        published.push(envelope.event_id);
        return { transport_ref: "redis_stream:1-0", transport_epoch: "epoch_1" };
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

  it("keeps an unknown publish-before-ack outcome replayable after lease expiry", async () => {
    const store = new DurableStoreFake([event()]);
    const published: string[] = [];
    const transport: DurableEventTransportPortV1 = {
      async publish({ envelope }) {
        published.push(envelope.event_id);
        return { transport_ref: `redis_stream:${published.length}-0`, transport_epoch: "epoch_1" };
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
      code: "transport_unavailable",
      retryable: true,
    });
  });

  it("moves an exhausted transient delivery to failed with a terminal error", async () => {
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
      expect(summary).toMatchObject(
        attempt < 3 ? { retry_wait: 1, failed: 0 } : { retry_wait: 0, failed: 1 },
      );
      clock.now = new Date(clock.now.getTime() + 1_000);
    }
    expect(store.records[0]).toMatchObject({ status: "failed", attempt_count: 3 });
    expect(store.acknowledgements[2]?.error).toEqual({
      code: "delivery_retry_exhausted",
      retryable: false,
    });
  });

  it("fails and releases an identified poison claim instead of leasing it forever", async () => {
    const store = new DurableStoreFake([event()]);
    store.records[0]!.target = null;
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        return { transport_ref: "unreachable", transport_epoch: "epoch_1" };
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
        return { transport_ref: "unreachable", transport_epoch: "epoch_1" };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };
    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves.toMatchObject({
      failed: 1,
    });
    expect(publishes).toBe(0);
    expect(store.records[0]?.status).toBe("failed");
  });

  it("fails an unknown owner event type before transport", async () => {
    const store = new DurableStoreFake([
      event({ event_type: "runtime.run.unregistered" }),
    ]);
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        return { transport_ref: "unreachable", transport_epoch: "epoch_1" };
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

  it("fails a durable event whose target is outside the route matrix", async () => {
    const store = new DurableStoreFake([event()]);
    store.records[0]!.target = "memory.runtime_event_append";
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        return { transport_ref: "unreachable", transport_epoch: "epoch_1" };
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
        return { transport_ref: "unreachable", transport_epoch: "epoch_1" };
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
});

describe("durable sent outbox redrive V1", () => {
  it("rebuilds a lost Redis epoch from retained PostgreSQL facts and dedupes replay", async () => {
    const envelope = event({ event_id: "evt_redrive_001" });
    const row = {
      outbox_id: "outbox_redrive_001",
      claim_token: "redrive_worker:1",
      attempt_count: 1,
      target: "trigger_processor.runtime_event_append",
      envelope,
      payload_hash: canonicalPayloadHashV1(envelope.payload),
      sent_at: "2026-07-21T05:00:00.000Z",
      transport_ref: "redis_stream:old-1-0",
      transport_epoch: "epoch_old",
    };
    const store: DurableSentOutboxRedriveStorePortV1 = {
      async claimSentForRedrive(request) {
        return row.transport_epoch === request.current_transport_epoch ? [] : [row];
      },
      async acknowledgeSentRedrive(request) {
        expect(request.previous_transport_epoch).toBe(row.transport_epoch);
        row.transport_ref = request.transport_ref;
        row.transport_epoch = request.transport_epoch;
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
          };
        },
      },
      {
        owner_service: "action_runtime",
        worker_id: "redrive_worker",
        batch_size: 10,
        lease_seconds: 30,
        current_transport_epoch: "epoch_new",
        sent_after: "2026-07-01T00:00:00.000Z",
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
});

describe("durable inbox consumer V1", () => {
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
    const skillPayload = {
      ...botScope(),
      runtime_run_id: "run_001",
      skill_id: "skill_001",
    } as const;
    await expect(
      consumer.consume(
        event({
          event_id: "evt_skill_001",
          event_type: "runtime.skill.load.requested",
          idempotency_key: "skill_load:run_001:skill_001",
          payload: skillPayload,
        }),
      ),
    ).resolves.toEqual({ status: "processed" });
    await expect(
      consumer.consume(
        event({
          event_id: "evt_skill_002",
          event_type: "runtime.skill.load.resolved",
          idempotency_key: "skill_load:run_001:skill_001",
          payload: skillPayload,
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
            ...botScope({ bot_id: "bot_002", owner_agent_id: "owner_agent_002" }),
            runtime_run_id: "run_001",
            outcome: "completed",
          },
        }),
      ),
    ).resolves.toEqual({ status: "processed" });
    expect(seen.size).toBe(2);
  });

  it("rejects an unknown producer event branch before owner side effects", async () => {
    let applies = 0;
    const consumer = createDurableInboxConsumerV1({
      async apply() {
        applies += 1;
        return { status: "processed" };
      },
    }, { consumer_service: "trigger_processor" });
    await expect(
      consumer.consume(event({ event_type: "runtime.run.unregistered" })),
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
    const originalAcknowledge = delivery.acknowledge.bind(delivery);
    delivery.acknowledge = async (request) => {
      order.push("xack");
      return originalAcknowledge(request);
    };
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
    };
    const deadLetter = deadLetterFake();
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: deadLetter.port,
      },
    );
    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 1,
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
