import type {
  DurableEventEnvelopeV1,
  ServiceIdV1,
} from "@pai/contracts";
import { describe, expect, it } from "vitest";

import {
  canonicalPayloadHashV1,
  createDurableInboxConsumerV1,
  createDurableOutboxDispatcherV1,
  EventTransportErrorV1,
  type ClaimedOutboxRecordV1,
  type DurableEventTransportPortV1,
  type DurableOutboxStorePortV1,
  type TransactionalInboxApplyPortV1,
} from "../src/index.js";

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
    payload: { runtime_run_id: "run_001", outcome: "completed" },
    ...overrides,
  };
}

interface StoredRecord extends ClaimedOutboxRecordV1 {
  status: "pending" | "dispatching" | "retry_wait" | "sent" | "failed";
  next_retry_at: string | null;
  locked_until: string | null;
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
        return { transport_ref: "redis_stream:1-0" };
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
        return { transport_ref: `redis_stream:${published.length}-0` };
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
        return { transport_ref: "unreachable" };
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
        return { transport_ref: "unreachable" };
      },
    };
    const clock = { now: new Date("2026-07-21T05:00:01.000Z") };
    await expect(dispatcher(store, transport, clock).dispatchBatch()).resolves.toMatchObject({
      failed: 1,
    });
    expect(publishes).toBe(0);
    expect(store.records[0]?.status).toBe("failed");
  });

  it("classifies a non-JSON payload as a non-retryable contract violation", async () => {
    const invalid = event({ payload: { invalid: 1n } as never });
    const store = new DurableStoreFake([event()]);
    store.records[0]!.envelope = invalid;
    let publishes = 0;
    const transport: DurableEventTransportPortV1 = {
      async publish() {
        publishes += 1;
        return { transport_ref: "unreachable" };
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

describe("durable inbox consumer V1", () => {
  it("processes one identity once and rejects same-key payload drift", async () => {
    const seen = new Map<string, string>();
    const inbox: TransactionalInboxApplyPortV1 = {
      async apply(request) {
        const key = `${request.source}:${request.idempotency_key}`;
        const existing = seen.get(key);
        if (existing === undefined) {
          seen.set(key, request.payload_hash);
          return { status: "processed" };
        }
        if (existing !== request.payload_hash) {
          throw new Error("inbox idempotency payload hash conflict");
        }
        return { status: "replayed" };
      },
    };
    const consumer = createDurableInboxConsumerV1(inbox);
    await expect(consumer.consume(event())).resolves.toEqual({ status: "processed" });
    await expect(consumer.consume(event())).resolves.toEqual({ status: "replayed" });
    await expect(
      consumer.consume(event({ payload: { runtime_run_id: "run_drift" } })),
    ).rejects.toThrow(/payload hash conflict/);
  });
});
