import type {
  DurableEventEnvelopeV1,
  DurableInboxIdentityV1,
  ServiceIdV1,
} from "@pai/contracts";
import { describe, expect, it } from "vitest";

import {
  canonicalDurableEventEnvelopePayloadHashV1,
  canonicalDurableEventEnvelopeSemanticHashV1,
  canonicalPayloadHashV1,
  durableEventScopeFingerprintV1,
  createDurableInboxConsumerV1,
  createDurableEventConsumerWorkerV1,
  createDurableOutboxDispatcherV1,
  createDurableSentOutboxRedriverV1,
  createPostgresOwnerOutboxStoreV1,
  DurableInboxApplyErrorV1,
  EventTransportErrorV1,
  EventTransportPreflightErrorV1,
  immutableBoundedJsonSnapshotV1,
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

describe("Shared canonical eventing boundary", () => {
  it("accepts an acyclic alias and de-aliases its immutable snapshot", () => {
    const shared = { value: "same" };
    const snapshot = immutableBoundedJsonSnapshotV1({
      left: shared,
      right: shared,
    }) as Readonly<{
      left: Readonly<{ value: string }>;
      right: Readonly<{ value: string }>;
    }>;

    expect(snapshot).toEqual({
      left: { value: "same" },
      right: { value: "same" },
    });
    expect(snapshot.left).not.toBe(snapshot.right);
    expect(Object.isFrozen(snapshot.left)).toBe(true);
  });

  it("preflights semantic envelope hashes before reading Proxy properties", () => {
    let trapCalls = 0;
    const proxied = new Proxy(event(), {
      get(target, property, receiver) {
        trapCalls += 1;
        return Reflect.get(target, property, receiver);
      },
    });

    expect(() =>
      canonicalDurableEventEnvelopeSemanticHashV1(proxied),
    ).toThrow(/proxy/u);
    expect(trapCalls).toBe(0);
  });
});

function pendingMemoryEvent(
  overrides: Partial<DurableEventEnvelopeV1> = {},
): DurableEventEnvelopeV1 {
  return {
    event_id: "evt_memory_pending_001",
    event_type: "memory.point.created",
    schema_version: "memory_event.v1",
    producer: "memory",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: "memory_001:created",
    trace_id: "trace_memory_pending_001",
    payload: {
      scope_kind: "bot",
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
      memory_point_id: "memory_001",
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

function actionRuntimeEvent(
  payloadOverrides: Partial<Record<string, unknown>> = {},
): DurableEventEnvelopeV1 {
  return {
    event_id: "runtime_event_001",
    event_type: "runtime.run.started",
    schema_version: "runtime_event.v1",
    producer: "action_runtime",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: "run_001:runtime.run.started:1",
    trace_id: "trace_runtime_001",
    payload: {
      trigger_process_id: "process_001",
      runtime_run_id: "run_001",
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
      start_attempt_no: 1,
      start_fence_generation: 1,
      sequence_no: 1,
      status: "running",
      previous_status: "queued",
      next_status: "running",
      model: "claude-sonnet-4-20250514",
      reason: null,
      duration_ms: null,
      reason_code: null,
      error_summary: null,
      terminal_artifact_ref: null,
      ...payloadOverrides,
    },
  };
}

function scopedSkillCatalogEvent(): DurableEventEnvelopeV1 {
  return {
    event_id: "skill_catalog_event_001",
    event_type: "skill.catalog.changed",
    schema_version: "skill_registry_event.v1",
    producer: "skill_registry",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: "catalog_revision_001:changed",
    trace_id: "trace_skill_catalog_001",
    payload: {
      scope_kind: "scoped",
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      deployment_environment: "dev",
      release_channel: "stable",
      actor_principal_id: "principal_001",
      reason_code: "activation_changed",
      catalog_revision_id: "catalog_revision_001",
      catalog_version: "catalog_001",
      catalog_as_of: "2026-07-21T05:00:00.000Z",
      changed_skill_keys: [],
      security_revocation_epoch: 1,
    },
  };
}

function globalSkillPublishedEvent(): DurableEventEnvelopeV1 {
  const digest = `sha256:${"1".repeat(64)}`;
  return {
    event_id: "skill_published_event_001",
    event_type: "skill.version.published",
    schema_version: "skill_registry_event.v1",
    producer: "skill_registry",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: "skill_version_001:published:1",
    trace_id: "trace_skill_published_001",
    payload: {
      scope_kind: "global",
      actor_principal_id: "principal_001",
      reason_code: "published",
      skill_id: "skill_001",
      skill_key: "source-reader",
      version_id: "skill_version_001",
      version: "1.0.0",
      lifecycle_version: 1,
      package_digest: digest,
      manifest_digest: digest,
      published_at: "2026-07-21T05:00:00.000Z",
    },
  };
}

function memoryPointCreatedEvent(): DurableEventEnvelopeV1 {
  return {
    event_id: "memory_event_001",
    event_type: "memory.point.created",
    schema_version: "memory.event.v1",
    producer: "memory",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: "point:point_001:v1",
    trace_id: "trace_memory_001",
    payload: {
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
      aggregate_id: "point_001",
      aggregate_version: 1,
      aggregate_type: "memory_point",
      memory_point_id: "point_001",
      series_id: "series_001",
      topic_key: "topic_001",
      state_version: 1,
      source_trigger_process_id: "process_001",
      write_batch_id: "batch_001",
      redaction_status: "not_required",
    },
  };
}

function provenanceSkillCandidateEvent(): DurableEventEnvelopeV1 {
  return {
    event_id: "skill_candidate_event_001",
    event_type: "skill.candidate.application.updated",
    schema_version: "skill_registry_event.v1",
    producer: "skill_registry",
    occurred_at: "2026-07-21T05:00:00.000Z",
    idempotency_key: "skill_candidate_application_001:received:1",
    trace_id: "trace_skill_candidate_001",
    payload: {
      scope_kind: "provenance",
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
      actor_principal_id: "principal_001",
      reason_code: "received",
      application_id: "skill_candidate_application_001",
      candidate_id: "skill_candidate_001",
      review_version: 1,
      candidate_type: "new_skill",
      skill_key: "new-source-reader",
      status: "received",
      response_ref: "response_001",
      response_hash: `sha256:${"2".repeat(64)}`,
    },
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
  it("requires the PostgreSQL owner writer to confirm its fenced ACK", async () => {
    const store = createPostgresOwnerOutboxStoreV1(
      {
        owner_service: "trigger_processor",
        outbox_tables: ["trigger_processor.trigger_outbox"],
        async claim() {
          return [];
        },
        async acknowledge() {
          return { acknowledged: false } as never;
        },
      },
      "trigger_processor.trigger_outbox",
    );

    await expect(
      store.acknowledge({
        outbox_id: "outbox-1",
        claim_token: "claim-1",
        outcome: "sent",
        next_retry_at: null,
        error: null,
        transport_ref: "stream:1-0",
        transport_epoch: "epoch-1",
        transport_generation: 1,
        current_transport_epoch: "epoch-1",
        current_transport_generation: 1,
        now: "2026-07-24T01:00:00.000Z",
      }),
    ).rejects.toThrow(/fenced compare-and-set/u);
  });

  it("rejects a service without an owner event contract before side effects", () => {
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
        "observation_gateway",
      ),
    ).toThrow(/no active owner durable event wire contract/u);
    expect({ claims, acknowledgements }).toEqual({
      claims: 0,
      acknowledgements: 0,
    });
  });

  it("rejects an unknown retry jitter mode before store or transport side effects", () => {
    let claims = 0;
    let publishes = 0;
    const store: DurableOutboxStorePortV1 = {
      async claim() {
        claims += 1;
        return [];
      },
      async acknowledge() {
        throw new Error("must not acknowledge");
      },
    };

    expect(() =>
      createDurableOutboxDispatcherV1(
        store,
        {
          async publish() {
            publishes += 1;
            throw new Error("must not publish");
          },
        },
        {
          owner_service: "trigger_processor",
          worker_id: "worker_invalid_jitter",
          batch_size: 1,
          lease_seconds: 5,
          max_attempts: 3,
          retry_base_delay_ms: 250,
          retry_max_delay_ms: 15_000,
          retry_jitter: "half" as never,
          current_transport_epoch: "epoch_1",
          current_transport_generation: 1,
        },
      ),
    ).toThrow(/invalid durable outbox dispatcher configuration/u);
    expect({ claims, publishes }).toEqual({ claims: 0, publishes: 0 });
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

  it("does not start a late ACK when publish settles after batch abort", async () => {
    const store = new DurableStoreFake([event()]);
    let publishEntered!: () => void;
    let releasePublish!: () => void;
    const entered = new Promise<void>((resolve) => {
      publishEntered = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    let observedSignal: AbortSignal | undefined;
    const transport: DurableEventTransportPortV1 = {
      async publish(_request, signal) {
        observedSignal = signal;
        publishEntered();
        await blocked;
        return {
          transport_ref: "redis_stream:late-1-0",
          transport_epoch: "epoch_1",
          transport_generation: 1,
        };
      },
    };
    const controller = new AbortController();
    const run = dispatcher(
      store,
      transport,
      { now: new Date("2026-07-21T05:00:01.000Z") },
    ).dispatchBatch(controller.signal);
    await entered;

    controller.abort(new Error("dispatch deadline exceeded"));
    releasePublish();

    await expect(run).rejects.toThrow("dispatch deadline exceeded");
    expect(observedSignal).toBe(controller.signal);
    expect(store.acknowledgements).toHaveLength(0);
    expect(store.records[0]?.status).toBe("dispatching");
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

  it("fails an invalid active-owner payload before transport side effects", async () => {
    const store = new DurableStoreFake([pendingMemoryEvent()]);
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

    await expect(
      dispatcher(store, transport, clock, "memory").dispatchBatch(),
    ).resolves.toMatchObject({ claimed: 1, failed: 1 });
    expect(publishes).toBe(0);
    expect(store.acknowledgements).toHaveLength(1);
    expect(store.records[0]?.status).toBe("failed");
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
  it("rejects a service without an owner event contract before redrive side effects", () => {
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
          owner_service: "observation_gateway",
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
      async acknowledgeSentRedrivePermanentFailure() {
        throw new Error("valid retained row must not be quarantined");
      },
    };
    let redisStream = [envelope];
    const seen = new Map<string, DurableInboxIdentityV1>();
    const consumer = createDurableInboxConsumerV1(
      {
        async apply(request) {
          const key = `${request.source}:${request.event_id}`;
          const existing = seen.get(key);
          if (existing !== undefined) {
            return existing.idempotency_key === request.idempotency_key &&
              existing.payload_hash === request.payload_hash &&
              existing.semantic_hash === request.semantic_hash &&
              existing.scope_fingerprint === request.scope_fingerprint
              ? { status: "replayed" }
              : {
                  status: "isolated",
                  isolation_code: "durable_inbox_identity_conflict",
                  isolation_ref: `memory-dlq:${key}`,
                };
          }
          seen.set(key, {
            source: request.source,
            event_id: request.event_id,
            idempotency_key: request.idempotency_key,
            payload_hash: request.payload_hash,
            semantic_hash: request.semantic_hash,
            scope_fingerprint: request.scope_fingerprint,
          });
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
      async acknowledgeSentRedrivePermanentFailure() {
        throw new Error("valid retained row must not be quarantined");
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

  it("persists only a closed code when a preflight error contains secrets", async () => {
    const envelope = event({ event_id: "evt_redrive_secret_error_001" });
    const secretError =
      "POST https://user:password@redis.invalid Authorization: Bearer redis-token prompt=private";
    let durableFailure:
      | Readonly<{ failure_code: string; failure_message: string }>
      | undefined;
    const redriver = createDurableSentOutboxRedriverV1(
      {
        async claimSentForRedrive() {
          return [{
            outbox_id: "outbox_redrive_secret_error_001",
            claim_token: "redrive_worker:secret-error",
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
          throw new Error("preflight rejection must not be acknowledged as sent");
        },
        async acknowledgeSentRedrivePermanentFailure(request) {
          durableFailure = request;
          return { acknowledged: true, status: "quarantined" };
        },
      },
      {
        async publish() {
          throw new EventTransportPreflightErrorV1(
            "transport_rejected",
            secretError,
          );
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

    await expect(redriver.redriveBatch()).resolves.toMatchObject({
      permanent_failures: 1,
      retryable_failures: 0,
    });
    expect(durableFailure).toMatchObject({
      failure_code: "transport_rejected",
      failure_message: "transport_rejected",
    });
    expect(JSON.stringify(durableFailure)).not.toContain("redis-token");
    expect(JSON.stringify(durableFailure)).not.toContain("private");
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

  it("consumes Action Runtime owner events with the exact bot scope fingerprint", async () => {
    let observedScope: string | undefined;
    const consumer = createDurableInboxConsumerV1(
      {
        async apply(request) {
          observedScope = request.scope_fingerprint;
          return { status: "processed" };
        },
      },
      { consumer_service: "trigger_processor" },
    );
    const envelope = actionRuntimeEvent();
    await expect(consumer.consume(envelope)).resolves.toEqual({
      status: "processed",
    });
    expect(observedScope).toBe(durableEventScopeFingerprintV1(envelope));
    const missingScope = actionRuntimeEvent();
    delete (missingScope.payload as Record<string, unknown>).workspace_id;
    await expect(
      consumer.consume(missingScope),
    ).rejects.toThrow(/payload/u);
  });

  it("consumes both scoped and global Skill Registry owner events", async () => {
    const observedScopes: string[] = [];
    const consumer = createDurableInboxConsumerV1(
      {
        async apply(request) {
          observedScopes.push(request.scope_fingerprint);
          return { status: "processed" };
        },
      },
      { consumer_service: "action_runtime" },
    );
    const scoped = scopedSkillCatalogEvent();
    const global = globalSkillPublishedEvent();
    await expect(consumer.consume(scoped)).resolves.toEqual({
      status: "processed",
    });
    await expect(consumer.consume(global)).resolves.toEqual({
      status: "processed",
    });
    expect(observedScopes).toEqual([
      durableEventScopeFingerprintV1(scoped),
      durableEventScopeFingerprintV1(global),
    ]);
    expect(observedScopes[0]).not.toBe(observedScopes[1]);
  });

  it("consumes provenance-scoped Skill candidate events", async () => {
    let observedScope: string | undefined;
    const consumer = createDurableInboxConsumerV1(
      {
        async apply(request) {
          observedScope = request.scope_fingerprint;
          return { status: "processed" };
        },
      },
      { consumer_service: "meta_cognition" },
    );
    const envelope = provenanceSkillCandidateEvent();
    await expect(consumer.consume(envelope)).resolves.toEqual({
      status: "processed",
    });
    expect(observedScope).toBe(durableEventScopeFingerprintV1(envelope));
  });

  it("uses the complete five-part bot scope for Memory events", async () => {
    let observedScope: string | undefined;
    const consumer = createDurableInboxConsumerV1(
      {
        async apply(request) {
          observedScope = request.scope_fingerprint;
          return { status: "processed" };
        },
      },
      { consumer_service: "meta_cognition" },
    );
    const envelope = memoryPointCreatedEvent();
    await expect(consumer.consume(envelope)).resolves.toEqual({
      status: "processed",
    });
    expect(observedScope).toBe(durableEventScopeFingerprintV1(envelope));
  });

  it("rejects legacy bot-only Memory events before inbox apply", async () => {
    let applied = false;
    const consumer = createDurableInboxConsumerV1(
      {
        async apply() {
          applied = true;
          return { status: "processed" };
        },
      },
      { consumer_service: "meta_cognition" },
    );
    const legacy = memoryPointCreatedEvent();
    const payload = legacy.payload as Record<string, unknown>;
    delete payload.workspace_id;
    delete payload.owner_agent_id;
    delete payload.deployment_environment;
    delete payload.release_channel;

    await expect(consumer.consume(legacy)).rejects.toThrow(
      /invalid durable event envelope/u,
    );
    expect(applied).toBe(false);
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

  it("uses source plus event_id as identity and isolates any replay fingerprint drift", async () => {
    type ReplayFingerprints = Readonly<{
      idempotency_key: string;
      payload_hash: string;
      semantic_hash: string;
      scope_fingerprint: string;
    }>;
    const seen = new Map<string, ReplayFingerprints>();
    const inbox: TransactionalInboxApplyPortV1 = {
      async apply(request) {
        const key = `${request.source}:${request.event_id}`;
        const existing = seen.get(key);
        const fingerprints = {
          idempotency_key: request.idempotency_key,
          payload_hash: request.payload_hash,
          semantic_hash: request.semantic_hash,
          scope_fingerprint: request.scope_fingerprint,
        };
        if (existing === undefined) {
          expect(request.payload_hash).toBe(
            canonicalDurableEventEnvelopePayloadHashV1(request.envelope),
          );
          expect(request.semantic_hash).toBe(
            canonicalDurableEventEnvelopeSemanticHashV1(request.envelope),
          );
          expect(request.scope_fingerprint).toBe(
            durableEventScopeFingerprintV1(request.envelope),
          );
          seen.set(key, fingerprints);
          return { status: "processed" };
        }
        if (
          Object.entries(fingerprints).some(
            ([field, value]) =>
              existing[field as keyof ReplayFingerprints] !== value,
          )
        ) {
          return {
            status: "isolated",
            isolation_code: "durable_inbox_identity_conflict",
            isolation_ref: `inbox-conflict:${key}`,
          };
        }
        return { status: "replayed" };
      },
    };
    const consumer = createDurableInboxConsumerV1(inbox, {
      consumer_service: "trigger_processor",
    });
    await expect(consumer.consume(event())).resolves.toEqual({ status: "processed" });
    await expect(consumer.consume(event())).resolves.toEqual({ status: "replayed" });
    const traceBound = event({ event_id: "evt_trace_bound_001" });
    await expect(consumer.consume(traceBound)).resolves.toEqual({
      status: "processed",
    });
    await expect(
      consumer.consume({ ...traceBound, trace_id: "trace_drifted_001" }),
    ).resolves.toMatchObject({
      status: "isolated",
      isolation_code: "durable_inbox_identity_conflict",
    });
    const timeBound = event({ event_id: "evt_time_bound_001" });
    await expect(consumer.consume(timeBound)).resolves.toEqual({
      status: "processed",
    });
    await expect(
      consumer.consume({
        ...timeBound,
        occurred_at: "2026-07-21T05:00:01.000Z",
      }),
    ).resolves.toMatchObject({
      status: "isolated",
      isolation_code: "durable_inbox_identity_conflict",
    });
    expect(
      canonicalDurableEventEnvelopeSemanticHashV1(traceBound),
    ).toBe(
      canonicalDurableEventEnvelopeSemanticHashV1({
        ...traceBound,
        trace_id: "trace_drifted_001",
      }),
    );
    expect(
      canonicalDurableEventEnvelopePayloadHashV1(traceBound),
    ).not.toBe(
      canonicalDurableEventEnvelopePayloadHashV1({
        ...traceBound,
        trace_id: "trace_drifted_001",
      }),
    );
    const reusedBusinessKey = "reused_business_key_001";
    await expect(
      consumer.consume(
        event({
          event_id: "evt_distinct_delivery_001",
          idempotency_key: reusedBusinessKey,
        }),
      ),
    ).resolves.toEqual({ status: "processed" });
    await expect(
      consumer.consume(
        event({
          event_id: "evt_distinct_delivery_002",
          event_type: "cooldown.expired",
          idempotency_key: reusedBusinessKey,
          payload: {
            ...triggerPayloadBase(),
            trigger_process_id: "process_001",
            cooldown_until: "2026-07-21T05:00:00.000Z",
            expired_at: "2026-07-21T05:00:01.000Z",
          },
        }),
      ),
    ).resolves.toEqual({ status: "processed" });
    await expect(
      consumer.consume(event({ idempotency_key: "drifted-business-key" })),
    ).resolves.toMatchObject({
      status: "isolated",
      isolation_code: "durable_inbox_identity_conflict",
    });
  });

  it("rejects semantically impossible Trigger Processor events before inbox apply", async () => {
    let applied = false;
    const consumer = createDurableInboxConsumerV1(
      {
        async apply() {
          applied = true;
          return { status: "processed" };
        },
      },
      { consumer_service: "trigger_processor" },
    );

    await expect(
      consumer.consume(
        event({
          event_id: "evt_trigger_cooldown_impossible",
          event_type: "cooldown.expired",
          idempotency_key: "process_001:cooldown_impossible",
          payload: {
            ...triggerPayloadBase({}),
            reason_code: "cooldown_expired",
            source_ref: "trigger_event:cooldown_001",
            trigger_process_id: "process_001",
            cooldown_until: "2026-07-22T05:00:00.000Z",
            expired_at: "2026-07-22T04:59:59.999Z",
          },
        }),
      ),
    ).rejects.toThrow(/semantic binding/u);
    expect(applied).toBe(false);
  });

  it("does not collapse different bot scopes that reuse producer idempotency keys", async () => {
    const seen = new Set<string>();
    const inbox: TransactionalInboxApplyPortV1 = {
      async apply(request) {
        const key = `${request.source}:${request.event_id}`;
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
          event_id: "evt_rejected_002",
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

  it("rejects an incomplete active-owner payload before owner side effects", async () => {
    let applies = 0;
    const consumer = createDurableInboxConsumerV1({
      async apply() {
        applies += 1;
        return { status: "processed" };
      },
    }, { consumer_service: "trigger_processor" });
    await expect(
      consumer.consume(pendingMemoryEvent()),
    ).rejects.toThrow(/schema_version|payload/u);
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

  it("captures deleted-delivery reconciliation authority before asynchronous reclaim", async () => {
    const reconciliation = deletedDeliveryReconciliationFake();
    const worker = createDurableEventConsumerWorkerV1(
      {
        async readNew() {
          return [];
        },
        async reclaimPending() {
          return {
            next_start_id: "0-0",
            deliveries: [],
            deleted_ids: ["1-0"],
          };
        },
        async acknowledge() {
          throw new Error("must not acknowledge a deleted delivery");
        },
        transportRefForDeliveryId(deliveryId) {
          return `redis_stream:pai:test:events:${deliveryId}`;
        },
      },
      {
        async apply() {
          throw new Error("must not apply a deleted delivery");
        },
      },
      {
        consumer_service: "trigger_processor",
        dead_letter: deadLetterFake().port,
        deleted_delivery_reconciliation: reconciliation,
      },
    );

    Object.assign(reconciliation.recorder, {
      async verifyPeriodicFullAuditActive() {
        throw new Error("mutated audit authority must not run");
      },
      async recordDeletedTransportRefs() {
        throw new Error("mutated recorder authority must not run");
      },
    });

    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 1,
        start_id: "0-0",
        max_pages: 1,
      }),
    ).resolves.toMatchObject({
      received: 0,
      failed: 0,
      deleted: 1,
      next_start_id: "0-0",
    });
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

  it("XACKs an identity conflict only after the inbox returns a durable isolation receipt", async () => {
    const delivery = new DeliveryFake([
      {
        kind: "event",
        delivery_id: "1-0",
        delivery_ref: "stream:test#1-0",
        envelope: event({ event_id: "evt_isolated_001" }),
      },
    ]);
    let consumerDlqCalls = 0;
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      {
        async apply() {
          return {
            status: "isolated",
            isolation_code: "durable_inbox_identity_conflict",
            isolation_ref: "trigger_processor.eventing_dlq/inbox-conflict-1",
          };
        },
      },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() {
            consumerDlqCalls += 1;
            return { status: "recorded" };
          },
        },
      },
    );

    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves
      .toMatchObject({
        received: 1,
        processed: 0,
        replayed: 0,
        failed: 0,
        dead_lettered: 1,
        acknowledged: 1,
      });
    expect(consumerDlqCalls).toBe(0);
    expect(delivery.acknowledged).toEqual(["1-0"]);
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
    expect(recordedMessage).toBe("invalid_envelope");
    expect(delivery.acknowledged).toEqual([]);
  });

  it("redacts secret-bearing invalid fields again at the durable DLQ boundary", async () => {
    const secretPayload =
      "{\"authorization\":\"Bearer stream-token\",\"prompt\":\"private prompt\"}";
    const delivery = new DeliveryFake([{
      kind: "invalid",
      delivery_id: "1-0",
      delivery_ref: "stream:test#1-0",
      error_code: "invalid_envelope",
      error_message:
        "https://user:password@redis.invalid Bearer stream-token private prompt",
      raw_fields: ["payload", secretPayload],
    }]);
    let recorded:
      | Parameters<DurableEventConsumerDeadLetterPortV1["recordPermanentFailure"]>[0]
      | undefined;
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure(request) {
            recorded = request;
            return { status: "recorded" };
          },
        },
      },
    );

    await expect(worker.consumeNewBatch({ count: 10, block_ms: 0 })).resolves
      .toMatchObject({ dead_lettered: 1, acknowledged: 1 });
    expect(recorded).toMatchObject({
      failure_code: "invalid_envelope",
      failure_message: "invalid_envelope",
      raw_fields: [
        expect.objectContaining({
          kind: "string",
          role: "field_name",
          field_name: "payload",
        }),
        expect.objectContaining({
          kind: "string",
          role: "field_value",
          field_name: null,
        }),
      ],
    });
    expect(JSON.stringify(recorded)).not.toContain("stream-token");
    expect(JSON.stringify(recorded)).not.toContain("private prompt");
    expect(JSON.stringify(recorded)).not.toContain("user:password");
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
