import type { DurableEventEnvelopeV1 } from "@pai/contracts";
import { ownerEventingReconciliationContractV1 } from "@pai/persistence";
import { describe, expect, it } from "vitest";

import {
  buildRedisStreamMessageV1,
  canonicalPayloadHashV1,
  createDurableEventConsumerWorkerV1,
  createDurableSentOutboxReconcilerV1,
  createPostgresOwnerSentOutboxRedriverStoreV1,
  createPostgresSentOutboxReconciliationStoreV1,
  createRedisNamespaceV1,
  createRedisStreamReferenceProbeV1,
  namespacedRedisKeyV1,
  OutboxClaimContractErrorV1,
  validateRedisStreamServerConfigurationV1,
  type ClaimedSentOutboxReconciliationRecordV1,
  type DurableEventDeliveryConsumerPortV1,
  type DurableEventTransportPortV1,
  type DurableSentOutboxReconciliationStorePortV1,
} from "../src/index.js";

function envelope(eventId: string): DurableEventEnvelopeV1 {
  return {
    event_id: eventId,
    event_type: "trigger.rejected",
    schema_version: "trigger_processor_event.v1",
    producer: "trigger_processor",
    occurred_at: "2026-07-22T06:00:00.000Z",
    idempotency_key: `${eventId}:rejected`,
    trace_id: `trace_${eventId}`,
    payload: {
      workspace_id: "workspace_001",
      bot_id: "bot_001",
      owner_agent_id: "owner_agent_001",
      deployment_environment: "dev",
      release_channel: "stable",
      reason_code: "business_admission_rejected",
      source_ref: `trigger_event:${eventId}`,
      submit_attempt_id: eventId,
      rejection_stage: "business_admission",
      rejection_code: "admission_capacity_exceeded",
    },
  };
}

interface StoredRow {
  outbox_id: string;
  target: string;
  envelope: DurableEventEnvelopeV1;
  payload_hash: string;
  sent_at: string;
  transport_ref: string;
  transport_epoch: string;
  transport_generation: number;
  missing: boolean;
  next_probe_at: string;
  claim_token: string | null;
  locked_until: string | null;
  claim_generation: number;
  quarantined: boolean;
  quarantine_code: string | null;
}

class DurableReconciliationStoreFake
  implements DurableSentOutboxReconciliationStorePortV1 {
  public activeEpoch = "epoch_current";
  public activeGeneration = 1;
  public databaseNow = new Date("2026-07-22T06:02:00.000Z");
  public failNextRematerializedAck = false;
  public failNextDeletedRecord = false;

  public constructor(public readonly rows: StoredRow[]) {}

  public async verifyPeriodicFullAuditActive(request: {
    request_id: string;
    consumer_service: "trigger_processor";
    coverage_fingerprint: string;
    transport_epoch: string;
    transport_generation: number;
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
      checked_at: "2026-07-22T06:02:00.000Z",
      heartbeat_at: "2026-07-22T06:02:00.000Z",
      last_full_pass_completed_at: "2026-07-22T06:02:00.000Z",
      expires_at: "2026-07-22T06:03:00.000Z",
    };
  }

  public async recordDeletedTransportRefs(request: {
    consumer_service: "trigger_processor";
    transport_refs: readonly string[];
    observed_transport_epoch: string;
    observed_transport_generation: number;
    observed_at: string;
  }): Promise<Readonly<{ matched: number; already_missing: number }>> {
    expect(request.consumer_service).toBe("trigger_processor");
    if (this.failNextDeletedRecord) {
      this.failNextDeletedRecord = false;
      throw new Error("simulated recorder transaction failure");
    }
    let matched = 0;
    let alreadyMissing = 0;
    if (
      request.observed_transport_epoch !== this.activeEpoch ||
      request.observed_transport_generation !== this.activeGeneration
    ) {
      return { matched, already_missing: alreadyMissing };
    }
    for (const transportRef of request.transport_refs) {
      const row = this.rows.find(
        (candidate) =>
          candidate.transport_ref === transportRef &&
          candidate.transport_epoch === request.observed_transport_epoch &&
          candidate.transport_generation ===
            request.observed_transport_generation,
      );
      if (row === undefined) continue;
      if (row.missing) alreadyMissing += 1;
      else {
        row.missing = true;
        row.next_probe_at = request.observed_at;
        matched += 1;
      }
    }
    return { matched, already_missing: alreadyMissing };
  }

  public async claimSentForReconciliation(request: {
    worker_id: string;
    limit: number;
    lease_seconds: number;
    current_transport_epoch: string;
    current_transport_generation: number;
  }): Promise<readonly ClaimedSentOutboxReconciliationRecordV1[]> {
    if (
      request.current_transport_epoch !== this.activeEpoch ||
      request.current_transport_generation !== this.activeGeneration
    ) {
      throw new Error("stale active transport generation");
    }
    const now = this.databaseNow.getTime();
    return this.rows
      .filter((row) => {
        const unlocked =
          row.locked_until === null || Date.parse(row.locked_until) <= now;
        const generationMismatch =
          row.transport_epoch !== this.activeEpoch ||
          row.transport_generation !== this.activeGeneration;
        return (
          !row.quarantined &&
          unlocked &&
          (generationMismatch || row.missing || Date.parse(row.next_probe_at) <= now)
        );
      })
      .slice(0, request.limit)
      .map((row) => {
        row.claim_generation += 1;
        row.claim_token = `${request.worker_id}:${row.outbox_id}:${row.claim_generation}`;
        row.locked_until = new Date(
          now + request.lease_seconds * 1_000,
        ).toISOString();
        const generationMismatch =
          row.transport_epoch !== this.activeEpoch ||
          row.transport_generation !== this.activeGeneration;
        return {
          outbox_id: row.outbox_id,
          claim_token: row.claim_token,
          attempt_count: 1,
          target: row.target,
          envelope: row.envelope,
          payload_hash: row.payload_hash,
          sent_at: row.sent_at,
          transport_ref: row.transport_ref,
          transport_epoch: row.transport_epoch,
          transport_generation: row.transport_generation,
          active_transport_epoch: this.activeEpoch,
          active_transport_generation: this.activeGeneration,
          reconciliation_reason: generationMismatch
            ? "generation_mismatch"
            : row.missing
              ? "reported_deleted"
              : "periodic_probe",
        };
      });
  }

  private assertedRow(request: {
    outbox_id: string;
    claim_token: string;
    previous_transport_ref: string;
    previous_transport_epoch: string;
    previous_transport_generation: number | null;
    current_transport_epoch: string;
    current_transport_generation: number;
  }): StoredRow {
    const row = this.rows.find(({ outbox_id }) => outbox_id === request.outbox_id);
    if (
      row === undefined ||
      row.claim_token !== request.claim_token ||
      row.transport_ref !== request.previous_transport_ref ||
      row.transport_epoch !== request.previous_transport_epoch ||
      row.transport_generation !== request.previous_transport_generation ||
      this.activeEpoch !== request.current_transport_epoch ||
      this.activeGeneration !== request.current_transport_generation
    ) {
      throw new Error("stale reconciliation CAS");
    }
    return row;
  }

  public async acknowledgeTransportPresent(request: {
    outbox_id: string;
    claim_token: string;
    previous_transport_ref: string;
    previous_transport_epoch: string;
    previous_transport_generation: number | null;
    current_transport_epoch: string;
    current_transport_generation: number;
    probe_interval_ms: number;
  }) {
    const row = this.assertedRow(request);
    row.next_probe_at = new Date(
      this.databaseNow.getTime() + request.probe_interval_ms,
    ).toISOString();
    row.missing = false;
    row.claim_token = null;
    row.locked_until = null;
  }

  public async acknowledgeRematerialized(request: {
    outbox_id: string;
    claim_token: string;
    previous_transport_ref: string;
    previous_transport_epoch: string;
    previous_transport_generation: number | null;
    transport_ref: string;
    transport_epoch: string;
    transport_generation: number;
    current_transport_epoch: string;
    current_transport_generation: number;
    probe_interval_ms: number;
  }): Promise<void> {
    const row = this.assertedRow(request);
    if (this.failNextRematerializedAck) {
      this.failNextRematerializedAck = false;
      throw new Error("simulated crash before PostgreSQL receipt CAS");
    }
    if (
      request.transport_epoch !== this.activeEpoch ||
      request.transport_generation !== this.activeGeneration
    ) {
      throw new Error("stale rematerialized generation");
    }
    row.transport_ref = request.transport_ref;
    row.transport_epoch = request.transport_epoch;
    row.transport_generation = request.transport_generation;
    row.next_probe_at = new Date(
      this.databaseNow.getTime() + request.probe_interval_ms,
    ).toISOString();
    row.missing = false;
    row.claim_token = null;
    row.locked_until = null;
  }

  public async acknowledgePermanentFailure(request: {
    outbox_id: string;
    claim_token: string;
    previous_transport_ref: string;
    previous_transport_epoch: string;
    previous_transport_generation: number | null;
    current_transport_epoch: string;
    current_transport_generation: number;
    failure_code: string;
    failure_message: string;
    now: string;
  }) {
    const row = this.assertedRow(request);
    expect(request.failure_code).toMatch(/^[a-z][a-z0-9_]{0,63}$/u);
    expect(request.failure_message).toBe(request.failure_code);
    row.quarantined = true;
    row.quarantine_code = request.failure_code;
    row.claim_token = null;
    row.locked_until = null;
    return { acknowledged: true, status: "quarantined" };
  }
}

function row(
  eventId: string,
  overrides: Partial<StoredRow> = {},
): StoredRow {
  const event = envelope(eventId);
  return {
    outbox_id: eventId,
    target: "trigger_processor.admission_audit",
    envelope: event,
    payload_hash: canonicalPayloadHashV1(event.payload),
    sent_at: "2026-07-22T06:00:00.000Z",
    transport_ref: "redis_stream:stream:trigger_events:1-0",
    transport_epoch: "epoch_current",
    transport_generation: 1,
    missing: false,
    next_probe_at: "2026-07-22T06:01:00.000Z",
    claim_token: null,
    locked_until: null,
    claim_generation: 0,
    quarantined: false,
    quarantine_code: null,
    ...overrides,
  };
}

function reconciler(
  store: DurableReconciliationStoreFake,
  clock: { now: Date },
  published: string[],
  presentRefs: Set<string>,
) {
  store.databaseNow = new Date(clock.now);
  const transport: DurableEventTransportPortV1 = {
    async publish(request) {
      const transportRef = `redis_stream:stream:trigger_events:${published.length + 2}-0`;
      published.push(request.envelope.event_id);
      presentRefs.add(transportRef);
      return {
        transport_ref: transportRef,
        transport_epoch: store.activeEpoch,
        transport_generation: store.activeGeneration,
      };
    },
  };
  return createDurableSentOutboxReconcilerV1(
    store,
    {
      async probe(request) {
        return { status: presentRefs.has(request.transport_ref) ? "present" : "missing" };
      },
    },
    transport,
    {
      owner_service: "trigger_processor",
      worker_id: "redriver_001",
      batch_size: 10,
      lease_seconds: 30,
      probe_interval_ms: 60_000,
      current_transport_epoch: store.activeEpoch,
      current_transport_generation: store.activeGeneration,
    },
    { now: () => new Date(clock.now) },
  );
}

describe("durable Redis Stream reconciliation", () => {
  it("rejects a service without an owner event contract before reconciliation side effects", () => {
    let claims = 0;
    let probes = 0;
    let publishes = 0;
    const store = new DurableReconciliationStoreFake([]);
    store.claimSentForReconciliation = async () => {
      claims += 1;
      return [];
    };

    expect(() =>
      createDurableSentOutboxReconcilerV1(
        store,
        {
          async probe() {
            probes += 1;
            return { status: "missing" };
          },
        },
        {
          async publish() {
            publishes += 1;
            throw new Error("must not publish");
          },
        },
        {
          owner_service: "observation_gateway",
          worker_id: "redriver_001",
          batch_size: 10,
          lease_seconds: 30,
          probe_interval_ms: 60_000,
          current_transport_epoch: "epoch_current",
          current_transport_generation: 1,
        },
      ),
    ).toThrow(/no active owner durable event wire contract/u);
    expect({ claims, probes, publishes }).toEqual({
      claims: 0,
      probes: 0,
      publishes: 0,
    });
  });

  it("snapshots reconciler configuration and claim pages before probe awaits", async () => {
    const store = new DurableReconciliationStoreFake([
      row("evt_reconcile_snapshot"),
    ]);
    const originalClaim = store.claimSentForReconciliation.bind(store);
    let claimedPage: ClaimedSentOutboxReconciliationRecordV1[] = [];
    store.claimSentForReconciliation = async (request) => {
      claimedPage = [...await originalClaim(request)];
      return claimedPage;
    };
    const config = {
      owner_service: "trigger_processor" as const,
      worker_id: "reconciler_snapshot",
      batch_size: 2,
      lease_seconds: 30,
      probe_interval_ms: 60_000,
      current_transport_epoch: "epoch_current",
      current_transport_generation: 1,
    };
    const worker = createDurableSentOutboxReconcilerV1(
      store,
      {
        async probe() {
          claimedPage.push({
            ...claimedPage[0]!,
            outbox_id: "evt_reconcile_late_append",
            claim_token: "claim_reconcile_late_append",
          });
          return { status: "present" };
        },
      },
      {
        async publish() { throw new Error("present row must not publish"); },
      },
      config,
      { now: () => new Date("2026-07-22T06:02:00.000Z") },
    );
    Object.assign(config, {
      owner_service: "memory",
      batch_size: 999,
      current_transport_epoch: "epoch_mutated",
      current_transport_generation: 999,
    });

    await expect(worker.reconcileBatch()).resolves.toEqual({
      claimed: 1,
      probed: 1,
      present: 1,
      missing: 0,
      rematerialized: 0,
      retryable_failures: 0,
      permanent_failures: 0,
    });
  });

  it("rejects duplicate reconciliation identities before probe or publish", async () => {
    const store = new DurableReconciliationStoreFake([
      row("evt_reconcile_duplicate_1"),
      row("evt_reconcile_duplicate_2", {
        transport_ref: "redis_stream:stream:trigger_events:2-0",
      }),
    ]);
    const originalClaim = store.claimSentForReconciliation.bind(store);
    store.claimSentForReconciliation = async (request) => {
      const records = [...await originalClaim(request)];
      return [
        records[0]!,
        { ...records[1]!, outbox_id: records[0]!.outbox_id },
      ];
    };
    let probes = 0;
    let publishes = 0;
    const worker = createDurableSentOutboxReconcilerV1(
      store,
      {
        async probe() {
          probes += 1;
          return { status: "present" };
        },
      },
      {
        async publish() {
          publishes += 1;
          throw new Error("must not publish");
        },
      },
      {
        owner_service: "trigger_processor",
        worker_id: "reconciler_duplicate",
        batch_size: 2,
        lease_seconds: 30,
        probe_interval_ms: 60_000,
        current_transport_epoch: "epoch_current",
        current_transport_generation: 1,
      },
    );

    await expect(worker.reconcileBatch()).rejects.toThrow(
      /outbox ids must be unique/u,
    );
    expect({ probes, publishes }).toEqual({ probes: 0, publishes: 0 });
  });

  it("keeps invalid probe results out of classified probe counters", async () => {
    const store = new DurableReconciliationStoreFake([
      row("evt_reconcile_invalid_probe"),
    ]);
    const worker = createDurableSentOutboxReconcilerV1(
      store,
      {
        async probe() { return { status: "unknown" } as never; },
      },
      {
        async publish() { throw new Error("invalid probe must not publish"); },
      },
      {
        owner_service: "trigger_processor",
        worker_id: "reconciler_invalid_probe",
        batch_size: 1,
        lease_seconds: 30,
        probe_interval_ms: 60_000,
        current_transport_epoch: "epoch_current",
        current_transport_generation: 1,
      },
    );

    await expect(worker.reconcileBatch()).resolves.toMatchObject({
      claimed: 1,
      probed: 0,
      present: 0,
      missing: 0,
      retryable_failures: 1,
    });
  });

  it("requires exact PostgreSQL guard, CAS, and quarantine acknowledgments", async () => {
    let ackResult: unknown = { acknowledged: false };
    let guardResult: unknown = { acknowledged: false, status: "inactive" };
    let deletedResult: unknown = { matched: 0, already_missing: 1 };
    let claimCalls = 0;
    let guardCalls = 0;
    const store = createPostgresSentOutboxReconciliationStoreV1({
      async claimSentForReconciliation() {
        claimCalls += 1;
        return [];
      },
      async recordDeletedTransportRefs() {
        return deletedResult;
      },
      async verifyPeriodicFullAuditActive() {
        guardCalls += 1;
        return guardResult;
      },
      async acknowledgeTransportPresent() { return ackResult; },
      async acknowledgeRematerialized() { return ackResult; },
      async acknowledgePermanentFailure() { return ackResult; },
    });
    const common = {
      outbox_id: "outbox-1",
      claim_token: "claim-1",
      previous_transport_ref: "redis_stream:stream:1-0",
      previous_transport_epoch: "epoch-1",
      previous_transport_generation: 1,
      current_transport_epoch: "epoch-1",
      current_transport_generation: 1,
      probe_interval_ms: 60_000,
    } as const;
    const guardRequest = {
      request_id: "guard-exact-1",
      consumer_service: "trigger_processor",
      coverage_fingerprint: `sha256:${"1".repeat(64)}`,
      transport_epoch: "epoch-1",
      transport_generation: 1,
      required_remaining_ms: 5_000,
    } as const;
    await expect(
      store.claimSentForReconciliation({
        worker_id: "reconciler_1",
        limit: 17,
        lease_seconds: 30,
        current_transport_epoch: "epoch-1",
        current_transport_generation: 1,
      }),
    ).rejects.toThrow(/bounded contract/u);
    expect(claimCalls).toBe(0);
    await expect(
      store.verifyPeriodicFullAuditActive(guardRequest),
    ).rejects.toThrow(/guard ACK/u);
    guardResult = {
      acknowledged: true,
      status: "active",
      request_id: guardRequest.request_id,
      consumer_service: guardRequest.consumer_service,
      coverage_fingerprint: guardRequest.coverage_fingerprint,
      transport_epoch: guardRequest.transport_epoch,
      transport_generation: guardRequest.transport_generation,
      audit_fence: "1",
      checked_at: "2026-07-22T06:02:00.000Z",
      heartbeat_at: "2026-07-22T06:02:00.000Z",
      last_full_pass_completed_at: "2026-07-22T06:02:00.000Z",
      expires_at: "2026-07-22T06:03:00.000Z",
    };
    await expect(
      store.verifyPeriodicFullAuditActive(guardRequest),
    ).resolves.toMatchObject({ status: "active", audit_fence: "1" });
    await expect(
      store.verifyPeriodicFullAuditActive({
        ...guardRequest,
        request_id: "invalid guard request id",
      }),
    ).rejects.toThrow(/guard request/u);
    expect(guardCalls).toBe(2);
    await expect(store.acknowledgeTransportPresent(common)).rejects.toThrow(
      "did not confirm",
    );
    await expect(
      store.acknowledgeRematerialized({
        ...common,
        transport_ref: "redis_stream:stream:2-0",
        transport_epoch: "epoch-1",
        transport_generation: 1,
      }),
    ).rejects.toThrow("did not confirm");

    ackResult = { acknowledged: true, unexpected: true };
    await expect(store.acknowledgeTransportPresent(common)).rejects.toThrow(
      /fields are not exact/u,
    );
    ackResult = { acknowledged: true };
    await expect(store.acknowledgeTransportPresent(common)).resolves.toBeUndefined();

    deletedResult = { matched: 0, already_missing: 1, unexpected: true };
    await expect(
      store.recordDeletedTransportRefs({
        consumer_service: "trigger_processor",
        transport_refs: null,
        observed_transport_epoch: "epoch-1",
        observed_transport_generation: 1,
        observed_at: "2026-07-22T06:02:00.000Z",
      } as never),
    ).rejects.toThrow(/identity is invalid/u);
    await expect(
      store.recordDeletedTransportRefs({
        consumer_service: "trigger_processor",
        transport_refs: ["redis_stream:stream:1-0"],
        observed_transport_epoch: "epoch-1",
        observed_transport_generation: 1,
        observed_at: "2026-07-22T06:02:00.000Z",
      }),
    ).rejects.toThrow(/fields are not exact/u);

    const { probe_interval_ms: _probeIntervalMs, ...permanentCommon } = common;
    await expect(
      store.acknowledgePermanentFailure({
        ...permanentCommon,
        failure_code: "outbox_contract_violation",
        failure_message: "poisoned retained row",
        now: "2026-07-22T06:02:00.000Z",
      }),
    ).rejects.toThrow("quarantine ACK");
    ackResult = { acknowledged: true, status: "quarantined" };
    await expect(
      store.acknowledgePermanentFailure({
        ...permanentCommon,
        failure_code: "outbox_contract_violation",
        failure_message: "poisoned retained row",
        now: "2026-07-22T06:02:00.000Z",
      }),
    ).resolves.toEqual({ acknowledged: true, status: "quarantined" });
    void _probeIntervalMs;
  });

  it("maps verified owner writers into a redriver-only PostgreSQL store", async () => {
    const reconciliation = ownerEventingReconciliationContractV1(
      "trigger",
      "trigger_event_outbox",
    );
    const contract = {
      owner_service: "trigger_processor",
      schema: "trigger",
      outbox_tables: ["trigger_event_outbox"],
      function_signatures: reconciliation.function_signatures,
    } as never;
    const rowEnvelope = envelope("evt_owner_redriver_adapter");
    const calls: Array<{
      writer: string;
      arguments: Readonly<Record<string, unknown>>;
      expected_rows: 1 | "zero_or_more";
    }> = [];
    const transactions: Array<{
      operation: string;
      idempotency_key: string;
      trace_id: string;
      isolation: string;
      retry: string;
    }> = [];
    const repository = {
      contract,
      async executeWriter(_transaction: unknown, request: {
        writer: string;
        arguments: Readonly<Record<string, unknown>>;
        expected_rows: 1 | "zero_or_more";
      }) {
        calls.push(request);
        if (request.writer === "claim_trigger_event_outbox_reconciliation_v1") {
          return [
            {
              outbox_id: "outbox-owner-redriver",
              claim_token: "claim-owner-redriver",
              attempt_count: 1,
              target: "action_runtime",
              envelope: rowEnvelope,
              payload_hash: canonicalPayloadHashV1(rowEnvelope.payload),
              sent_at: "2026-07-22T06:00:00.000Z",
              transport_ref: "redis_stream:trigger:1-0",
              transport_epoch: "epoch-current",
              transport_generation: 6,
              active_transport_epoch: "epoch-current",
              active_transport_generation: 7,
              reconciliation_reason: "generation_mismatch",
            },
          ];
        }
        if (
          request.writer ===
          "ack_trigger_event_outbox_permanent_failure_v1"
        ) {
          return { acknowledged: true, status: "quarantined" };
        }
        return { acknowledged: true };
      },
    };
    const unitOfWork = {
      owner_service: "trigger_processor",
      async withTransaction(request: {
        operation: string;
        idempotency_key: string;
        trace_id: string;
        isolation: string;
        retry: string;
      }, work: (transaction: unknown, repositories: {
        owner: typeof repository;
      }) => Promise<unknown>) {
        transactions.push(request);
        return work(Object.freeze({ owner_service: "trigger_processor" }), {
          owner: repository,
        });
      },
    };
    const store = createPostgresOwnerSentOutboxRedriverStoreV1(
      repository as never,
      unitOfWork as never,
      "trigger_event_outbox",
    );
    expect("recordDeletedTransportRefs" in store).toBe(false);
    expect("verifyPeriodicFullAuditActive" in store).toBe(false);

    await expect(
      store.claimSentForReconciliation({
        worker_id: "redriver_001",
        limit: 1,
        lease_seconds: 30,
        current_transport_epoch: "epoch-current",
        current_transport_generation: 7,
      }),
    ).resolves.toHaveLength(1);
    expect(calls[0]).toMatchObject({
      writer: "claim_trigger_event_outbox_reconciliation_v1",
      expected_rows: "zero_or_more",
      arguments: {
        p_worker_id: "redriver_001",
        p_limit: 1,
        p_lease_seconds: 30,
        p_current_transport_epoch: "epoch-current",
        p_current_transport_generation: "7",
      },
    });
    await expect(
      store.acknowledgeTransportPresent({
        outbox_id: "outbox-owner-redriver",
        claim_token: "claim-owner-redriver",
        previous_transport_ref: "redis_stream:trigger:1-0",
        previous_transport_epoch: "epoch-current",
        previous_transport_generation: 6,
        current_transport_epoch: "epoch-current",
        current_transport_generation: 7,
        probe_interval_ms: 60_000,
      }),
    ).resolves.toBeUndefined();
    await expect(
      store.acknowledgeRematerialized({
        outbox_id: "outbox-owner-redriver",
        claim_token: "claim-owner-redriver",
        previous_transport_ref: "redis_stream:trigger:1-0",
        previous_transport_epoch: "epoch-current",
        previous_transport_generation: 6,
        transport_ref: "redis_stream:trigger:2-0",
        transport_epoch: "epoch-current",
        transport_generation: 7,
        current_transport_epoch: "epoch-current",
        current_transport_generation: 7,
        probe_interval_ms: 60_000,
      }),
    ).resolves.toBeUndefined();
    await expect(
      store.acknowledgePermanentFailure({
        outbox_id: "outbox-owner-redriver",
        claim_token: "claim-owner-redriver",
        previous_transport_ref: "redis_stream:trigger:1-0",
        previous_transport_epoch: "epoch-current",
        previous_transport_generation: 6,
        current_transport_epoch: "epoch-current",
        current_transport_generation: 7,
        failure_code: "outbox_contract_violation",
        failure_message: "poisoned retained row",
        now: "2026-07-22T06:02:00.000Z",
      }),
    ).resolves.toEqual({ acknowledged: true, status: "quarantined" });
    expect(calls.map(({ writer }) => writer)).toEqual([
      "claim_trigger_event_outbox_reconciliation_v1",
      "ack_trigger_event_outbox_transport_present_v1",
      "ack_trigger_event_outbox_rematerialized_v1",
      "ack_trigger_event_outbox_permanent_failure_v1",
    ]);
    expect(calls.at(-1)?.arguments).toMatchObject({
      p_previous_transport_generation: "6",
      p_current_transport_generation: "7",
      p_failure_code: "outbox_contract_violation",
    });
    expect(transactions).toHaveLength(4);
    expect(
      transactions.every(
        ({ idempotency_key, isolation, retry, trace_id }) =>
          /^sha256:[0-9a-f]{64}$/u.test(idempotency_key) &&
          isolation === "read_committed" &&
          retry === "none" &&
          trace_id.length <= 256,
      ),
    ).toBe(true);
  });

  it("snapshots PostgreSQL guard and deleted-reference requests across awaits", async () => {
    let releaseGuard!: () => void;
    const guardGate = new Promise<void>((resolve) => { releaseGuard = resolve; });
    let releaseDeleted!: () => void;
    const deletedGate = new Promise<void>((resolve) => { releaseDeleted = resolve; });
    let observedGuardGeneration: number | undefined;
    let observedDeletedRefs: readonly string[] = [];
    const store = createPostgresSentOutboxReconciliationStoreV1({
      async claimSentForReconciliation() { return []; },
      async recordDeletedTransportRefs(request) {
        await deletedGate;
        observedDeletedRefs = [...request.transport_refs];
        return { matched: request.transport_refs.length, already_missing: 0 };
      },
      async verifyPeriodicFullAuditActive(request) {
        await guardGate;
        observedGuardGeneration = request.transport_generation;
        return {
          acknowledged: true,
          status: "active",
          request_id: request.request_id,
          consumer_service: request.consumer_service,
          coverage_fingerprint: request.coverage_fingerprint,
          transport_epoch: request.transport_epoch,
          transport_generation: request.transport_generation,
          audit_fence: "1",
          checked_at: "2026-07-22T06:02:00.000Z",
          heartbeat_at: "2026-07-22T06:02:00.000Z",
          last_full_pass_completed_at: "2026-07-22T06:02:00.000Z",
          expires_at: "2026-07-22T06:03:00.000Z",
        };
      },
      async acknowledgeTransportPresent() { return { acknowledged: true }; },
      async acknowledgeRematerialized() { return { acknowledged: true }; },
      async acknowledgePermanentFailure() {
        return { acknowledged: true, status: "quarantined" };
      },
    });
    const guardRequest = {
      request_id: "guard-request-snapshot",
      consumer_service: "trigger_processor" as const,
      coverage_fingerprint: `sha256:${"1".repeat(64)}`,
      transport_epoch: "epoch-current",
      transport_generation: 1,
      required_remaining_ms: 5_000,
    };
    const guardVerification = store.verifyPeriodicFullAuditActive(guardRequest);
    Object.assign(guardRequest, {
      transport_epoch: "epoch-mutated",
      transport_generation: 999,
    });
    releaseGuard();
    await expect(guardVerification).resolves.toMatchObject({
      transport_epoch: "epoch-current",
      transport_generation: 1,
    });
    expect(observedGuardGeneration).toBe(1);

    const transportRefs = ["redis_stream:stream:trigger_events:9-0"];
    const deletedHandoff = store.recordDeletedTransportRefs({
      consumer_service: "trigger_processor",
      transport_refs: transportRefs,
      observed_transport_epoch: "epoch-current",
      observed_transport_generation: 1,
      observed_at: "2026-07-22T06:02:00.000Z",
    });
    transportRefs.push("redis_stream:stream:trigger_events:10-0");
    releaseDeleted();
    await expect(deletedHandoff).resolves.toEqual({
      matched: 1,
      already_missing: 0,
    });
    expect(observedDeletedRefs).toEqual([
      "redis_stream:stream:trigger_events:9-0",
    ]);
  });

  it("detects same-generation loss by periodic audit without an XAUTOCLAIM callback", async () => {
    const stored = row("evt_same_generation_loss");
    const store = new DurableReconciliationStoreFake([stored]);
    const clock = { now: new Date("2026-07-22T06:02:00.000Z") };
    const published: string[] = [];
    const presentRefs = new Set<string>();

    await expect(
      reconciler(store, clock, published, presentRefs).reconcileBatch(),
    ).resolves.toEqual({
      claimed: 1,
      probed: 1,
      present: 0,
      missing: 1,
      rematerialized: 1,
      retryable_failures: 0,
      permanent_failures: 0,
    });
    expect(published).toEqual(["evt_same_generation_loss"]);
    expect(stored.transport_ref).toBe("redis_stream:stream:trigger_events:2-0");

    await expect(
      reconciler(store, clock, published, presentRefs).reconcileBatch(),
    ).resolves.toMatchObject({ claimed: 0, rematerialized: 0 });
  });

  it("classifies poisoned retained envelopes as permanent without probing or publishing", async () => {
    const poisoned = row("evt_poisoned_contract", {
      envelope: {
        ...envelope("evt_poisoned_contract"),
        event_type: "trigger.unknown",
      } as never,
    });
    const store = new DurableReconciliationStoreFake([poisoned]);
    const clock = { now: new Date("2026-07-22T06:02:00.000Z") };
    const published: string[] = [];

    await expect(
      reconciler(store, clock, published, new Set()).reconcileBatch(),
    ).resolves.toMatchObject({
      claimed: 1,
      probed: 0,
      rematerialized: 0,
      retryable_failures: 0,
      permanent_failures: 1,
    });
    expect(published).toEqual([]);
    expect(poisoned).toMatchObject({
      quarantined: true,
      quarantine_code: "outbox_contract_violation",
    });
  });

  it("durably quarantines a poison claim so batch_size one cannot starve the next row", async () => {
    const poisoned = row("evt_poison_prefix", {
      payload_hash: `sha256:${"0".repeat(64)}`,
    });
    const valid = row("evt_after_poison");
    const store = new DurableReconciliationStoreFake([poisoned, valid]);
    const clock = { now: new Date("2026-07-22T06:02:00.000Z") };
    const presentRefs = new Set([valid.transport_ref]);
    const published: string[] = [];
    const makeReconciler = () =>
      createDurableSentOutboxReconcilerV1(
        store,
        {
          async probe(request) {
            return {
              status: presentRefs.has(request.transport_ref)
                ? "present" as const
                : "missing" as const,
            };
          },
        },
        {
          async publish(request) {
            published.push(request.envelope.event_id);
            return {
              transport_ref: "redis_stream:stream:trigger_events:99-0",
              transport_epoch: store.activeEpoch,
              transport_generation: store.activeGeneration,
            };
          },
        },
        {
          owner_service: "trigger_processor",
          worker_id: "redriver_001",
          batch_size: 1,
          lease_seconds: 30,
          probe_interval_ms: 60_000,
          current_transport_epoch: store.activeEpoch,
          current_transport_generation: store.activeGeneration,
        },
        { now: () => new Date(clock.now) },
      );

    await expect(makeReconciler().reconcileBatch()).resolves.toMatchObject({
      claimed: 1,
      permanent_failures: 1,
      retryable_failures: 0,
    });
    expect(poisoned.quarantined).toBe(true);
    await expect(makeReconciler().reconcileBatch()).resolves.toMatchObject({
      claimed: 1,
      present: 1,
      permanent_failures: 0,
    });
    expect(valid.next_probe_at).toBe("2026-07-22T06:03:00.000Z");
    expect(published).toEqual([]);
  });

  it("does not start a late rematerialization ACK after batch abort", async () => {
    const stored = row("evt_abort_late_publish");
    const store = new DurableReconciliationStoreFake([stored]);
    let publishEntered!: () => void;
    let releasePublish!: () => void;
    const entered = new Promise<void>((resolve) => {
      publishEntered = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    let observedSignal: AbortSignal | undefined;
    const worker = createDurableSentOutboxReconcilerV1(
      store,
      {
        async probe() {
          return { status: "missing" };
        },
      },
      {
        async publish(_request, signal) {
          observedSignal = signal;
          publishEntered();
          await blocked;
          return {
            transport_ref: "redis_stream:stream:trigger_events:late-1-0",
            transport_epoch: store.activeEpoch,
            transport_generation: store.activeGeneration,
          };
        },
      },
      {
        owner_service: "trigger_processor",
        worker_id: "redriver_abort_late",
        batch_size: 1,
        lease_seconds: 30,
        probe_interval_ms: 60_000,
        current_transport_epoch: store.activeEpoch,
        current_transport_generation: store.activeGeneration,
      },
      { now: () => new Date(store.databaseNow) },
    );
    const controller = new AbortController();
    const run = worker.reconcileBatch(controller.signal);
    await entered;

    controller.abort(new Error("reconciliation deadline exceeded"));
    releasePublish();

    await expect(run).rejects.toThrow("reconciliation deadline exceeded");
    expect(observedSignal).toBe(controller.signal);
    expect(stored.transport_ref).toBe(
      "redis_stream:stream:trigger_events:1-0",
    );
    expect(stored.claim_token).not.toBeNull();
  });

  it("survives a crash after publish, leases restart work, and tolerates duplicate delivery", async () => {
    const stored = row("evt_crash_restart");
    const store = new DurableReconciliationStoreFake([stored]);
    store.failNextRematerializedAck = true;
    const clock = { now: new Date("2026-07-22T06:02:00.000Z") };
    const published: string[] = [];
    const presentRefs = new Set<string>();

    await expect(
      reconciler(store, clock, published, presentRefs).reconcileBatch(),
    ).resolves.toMatchObject({
      claimed: 1,
      rematerialized: 0,
      retryable_failures: 1,
    });
    await expect(
      reconciler(store, clock, published, presentRefs).reconcileBatch(),
    ).resolves.toMatchObject({ claimed: 0 });

    clock.now = new Date("2026-07-22T06:02:31.000Z");
    await expect(
      reconciler(store, clock, published, presentRefs).reconcileBatch(),
    ).resolves.toMatchObject({ claimed: 1, rematerialized: 1 });
    expect(published).toEqual(["evt_crash_restart", "evt_crash_restart"]);
    expect(stored.transport_ref).toBe("redis_stream:stream:trigger_events:3-0");
  });

  it("rejects a stale generation CAS and rematerializes from the retained fact in the next generation", async () => {
    const stored = row("evt_generation_cas", {
      transport_epoch: "epoch_old",
      transport_generation: 1,
    });
    const store = new DurableReconciliationStoreFake([stored]);
    store.activeEpoch = "epoch_current";
    store.activeGeneration = 2;
    const clock = { now: new Date("2026-07-22T06:02:00.000Z") };
    const published: string[] = [];
    const presentRefs = new Set<string>();
    store.databaseNow = new Date(clock.now);
    const staleWorker = createDurableSentOutboxReconcilerV1(
      store,
      {
        async probe() {
          throw new Error("generation mismatch must rematerialize directly");
        },
      },
      {
        async publish(request) {
          const transportRef = "redis_stream:stream:trigger_events:2-0";
          published.push(request.envelope.event_id);
          presentRefs.add(transportRef);
          // Simulate the active generation changing after Redis accepted the
          // publish but before PostgreSQL installs its receipt. The captured
          // store method must observe this through its durable CAS, rather
          // than relying on a mutable adapter method being swapped in tests.
          store.activeGeneration = 3;
          return {
            transport_ref: transportRef,
            transport_epoch: request.current_transport_epoch,
            transport_generation: request.current_transport_generation,
          };
        },
      },
      {
        owner_service: "trigger_processor",
        worker_id: "redriver_001",
        batch_size: 10,
        lease_seconds: 30,
        probe_interval_ms: 60_000,
        current_transport_epoch: store.activeEpoch,
        current_transport_generation: store.activeGeneration,
      },
      { now: () => new Date(clock.now) },
    );

    await expect(staleWorker.reconcileBatch()).resolves.toMatchObject({
      claimed: 1,
      rematerialized: 0,
      retryable_failures: 1,
    });
    expect(stored.transport_generation).toBe(1);

    clock.now = new Date("2026-07-22T06:02:31.000Z");
    await expect(
      reconciler(store, clock, published, presentRefs).reconcileBatch(),
    ).resolves.toMatchObject({ claimed: 1, rematerialized: 1 });
    expect(stored.transport_generation).toBe(3);
    expect(published).toEqual(["evt_generation_cas", "evt_generation_cas"]);
  });

  it("keeps a valid row retryable when a post-publish exact ACK check fails", async () => {
    const stored = row("evt_exact_ack_ambiguous");
    const store = new DurableReconciliationStoreFake([stored]);
    let quarantineCalls = 0;
    store.acknowledgeRematerialized = async () => {
      throw new OutboxClaimContractErrorV1(
        "rematerialization writer returned a widened ACK",
      );
    };
    store.acknowledgePermanentFailure = async () => {
      quarantineCalls += 1;
      return { acknowledged: true, status: "quarantined" };
    };
    const clock = { now: new Date("2026-07-22T06:02:00.000Z") };
    const published: string[] = [];

    await expect(
      reconciler(store, clock, published, new Set()).reconcileBatch(),
    ).resolves.toMatchObject({
      claimed: 1,
      rematerialized: 0,
      retryable_failures: 1,
      permanent_failures: 0,
    });
    expect(published).toEqual(["evt_exact_ack_ambiguous"]);
    expect(quarantineCalls).toBe(0);
    expect(stored.quarantined).toBe(false);
  });

  it("durably and idempotently marks XAUTOCLAIM deleted ids before continuing", async () => {
    const stored = row("evt_deleted_signal", {
      transport_ref: "redis_stream:stream:trigger_events:9-0",
    });
    const store = new DurableReconciliationStoreFake([stored]);
    const delivery: DurableEventDeliveryConsumerPortV1 = {
      async readNew() { return []; },
      async reclaimPending() {
        return { next_start_id: "0-0", deliveries: [], deleted_ids: ["9-0"] };
      },
      async acknowledge() { return { acknowledged: 0 }; },
      transportRefForDeliveryId(deliveryId) {
        return `redis_stream:stream:trigger_events:${deliveryId}`;
      },
    };
    const worker = createDurableEventConsumerWorkerV1(
      delivery,
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() { return { status: "recorded" }; },
        },
        deleted_delivery_reconciliation: {
          recorder: store,
          transport_epoch: "epoch_current",
          transport_generation: 1,
          coverage_fingerprint: `sha256:${"1".repeat(64)}`,
          required_remaining_ms: 5_000,
          max_heartbeat_age_ms: 1_000,
          max_full_audit_lag_ms: 60_000,
          new_guard_request_id: () => "guard-deleted-signal",
        },
      },
    );
    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).resolves.toMatchObject({ deleted: 1 });
    expect(stored.missing).toBe(true);
    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).resolves.toMatchObject({ deleted: 1 });
    expect(stored.missing).toBe(true);
  });

  it("rejects partial deleted-reference handoff instead of losing the one-shot signal", async () => {
    const store = createPostgresSentOutboxReconciliationStoreV1({
      async claimSentForReconciliation() { return []; },
      async recordDeletedTransportRefs() {
        return { matched: 0, already_missing: 0 };
      },
      async verifyPeriodicFullAuditActive(request) {
        return {
          acknowledged: true,
          status: "active",
          request_id: request.request_id,
          consumer_service: request.consumer_service,
          coverage_fingerprint: request.coverage_fingerprint,
          transport_epoch: request.transport_epoch,
          transport_generation: request.transport_generation,
          audit_fence: "1",
          checked_at: "2026-07-22T06:02:00.000Z",
          heartbeat_at: "2026-07-22T06:02:00.000Z",
          last_full_pass_completed_at: "2026-07-22T06:02:00.000Z",
          expires_at: "2026-07-22T06:03:00.000Z",
        };
      },
      async acknowledgeTransportPresent() { return { acknowledged: true }; },
      async acknowledgeRematerialized() { return { acknowledged: true }; },
      async acknowledgePermanentFailure() {
        return { acknowledged: true, status: "quarantined" };
      },
    });
    await expect(
      store.recordDeletedTransportRefs({
        consumer_service: "trigger_processor",
        transport_refs: ["redis_stream:stream:trigger_events:9-0"],
        observed_transport_epoch: "epoch_current",
        observed_transport_generation: 1,
        observed_at: "2026-07-22T06:02:00.000Z",
      }),
    ).rejects.toThrow(/every requested reference/u);
  });

  it("refuses to invoke XAUTOCLAIM without durable deleted-reference handoff", async () => {
    let reclaimed = false;
    const worker = createDurableEventConsumerWorkerV1(
      {
        async readNew() { return []; },
        async reclaimPending() {
          reclaimed = true;
          return { next_start_id: "0-0", deliveries: [], deleted_ids: [] };
        },
        async acknowledge() { return { acknowledged: 0 }; },
      },
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() { return { status: "recorded" }; },
        },
      },
    );
    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).rejects.toThrow(/required before XAUTOCLAIM/u);
    expect(reclaimed).toBe(false);
  });

  it("does not issue XAUTOCLAIM when the PostgreSQL full-audit guard is inactive", async () => {
    let guardCalls = 0;
    let reclaimCalls = 0;
    const worker = createDurableEventConsumerWorkerV1(
      {
        async readNew() { return []; },
        async reclaimPending() {
          reclaimCalls += 1;
          return { next_start_id: "0-0", deliveries: [], deleted_ids: [] };
        },
        async acknowledge() { return { acknowledged: 0 }; },
        transportRefForDeliveryId(deliveryId) {
          return `redis_stream:stream:trigger_events:${deliveryId}`;
        },
      },
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() { return { status: "recorded" }; },
        },
        deleted_delivery_reconciliation: {
          recorder: {
            async verifyPeriodicFullAuditActive() {
              guardCalls += 1;
              return { acknowledged: false, status: "inactive" } as never;
            },
            async recordDeletedTransportRefs() {
              throw new Error("guard failure must prevent recorder calls");
            },
          },
          transport_epoch: "epoch_current",
          transport_generation: 1,
          coverage_fingerprint: `sha256:${"1".repeat(64)}`,
          required_remaining_ms: 5_000,
          max_heartbeat_age_ms: 1_000,
          max_full_audit_lag_ms: 60_000,
          new_guard_request_id: () => "guard-inactive-1",
        },
      },
    );

    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).rejects.toThrow(/guard ACK/u);
    expect({ guardCalls, reclaimCalls }).toEqual({ guardCalls: 1, reclaimCalls: 0 });
  });

  it("revalidates the durable audit guard before every XAUTOCLAIM page", async () => {
    let guardCalls = 0;
    let reclaimCalls = 0;
    let requestSequence = 0;
    const worker = createDurableEventConsumerWorkerV1(
      {
        async readNew() { return []; },
        async reclaimPending() {
          reclaimCalls += 1;
          return { next_start_id: "5-0", deliveries: [], deleted_ids: [] };
        },
        async acknowledge() { return { acknowledged: 0 }; },
        transportRefForDeliveryId(deliveryId) {
          return `redis_stream:stream:trigger_events:${deliveryId}`;
        },
      },
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() { return { status: "recorded" }; },
        },
        deleted_delivery_reconciliation: {
          recorder: {
            async verifyPeriodicFullAuditActive(request) {
              guardCalls += 1;
              if (guardCalls === 2) throw new Error("audit lease expired");
              return {
                acknowledged: true as const,
                status: "active" as const,
                request_id: request.request_id,
                consumer_service: request.consumer_service,
                coverage_fingerprint: request.coverage_fingerprint,
                transport_epoch: request.transport_epoch,
                transport_generation: request.transport_generation,
                audit_fence: "7",
                checked_at: "2026-07-22T06:02:00.000Z",
                heartbeat_at: "2026-07-22T06:02:00.000Z",
                last_full_pass_completed_at: "2026-07-22T06:02:00.000Z",
                expires_at: "2026-07-22T06:03:00.000Z",
              };
            },
            async recordDeletedTransportRefs() {
              throw new Error("no deleted ids expected");
            },
          },
          transport_epoch: "epoch_current",
          transport_generation: 1,
          coverage_fingerprint: `sha256:${"2".repeat(64)}`,
          required_remaining_ms: 5_000,
          max_heartbeat_age_ms: 1_000,
          max_full_audit_lag_ms: 60_000,
          new_guard_request_id: () => `guard-page-${++requestSequence}`,
        },
      },
    );

    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
        max_pages: 2,
      }),
    ).rejects.toThrow("audit lease expired");
    expect({ guardCalls, reclaimCalls }).toEqual({ guardCalls: 2, reclaimCalls: 1 });
  });

  it("recovers a lost XAUTOCLAIM deleted signal through the durable periodic due row", async () => {
    const stored = row("evt_deleted_recorder_crash", {
      transport_ref: "redis_stream:stream:trigger_events:9-0",
      next_probe_at: "2026-07-22T06:03:00.000Z",
    });
    const store = new DurableReconciliationStoreFake([stored]);
    store.failNextDeletedRecord = true;
    let reclaimCalls = 0;
    const worker = createDurableEventConsumerWorkerV1(
      {
        async readNew() { return []; },
        async reclaimPending() {
          reclaimCalls += 1;
          return { next_start_id: "0-0", deliveries: [], deleted_ids: ["9-0"] };
        },
        async acknowledge() { return { acknowledged: 0 }; },
        transportRefForDeliveryId(deliveryId) {
          return `redis_stream:stream:trigger_events:${deliveryId}`;
        },
      },
      { async apply() { return { status: "processed" }; } },
      {
        consumer_service: "trigger_processor",
        dead_letter: {
          async recordPermanentFailure() { return { status: "recorded" }; },
        },
        deleted_delivery_reconciliation: {
          recorder: store,
          transport_epoch: "epoch_current",
          transport_generation: 1,
          coverage_fingerprint: `sha256:${"3".repeat(64)}`,
          required_remaining_ms: 5_000,
          max_heartbeat_age_ms: 1_000,
          max_full_audit_lag_ms: 60_000,
          new_guard_request_id: () => "guard-recorder-crash-1",
        },
      },
    );

    await expect(
      worker.reclaimAndConsumeBatch({
        min_idle_ms: 30_000,
        count: 10,
        start_id: "0-0",
      }),
    ).rejects.toThrow("simulated recorder transaction failure");
    expect(reclaimCalls).toBe(1);
    expect(stored).toMatchObject({
      missing: false,
      next_probe_at: "2026-07-22T06:03:00.000Z",
      transport_ref: "redis_stream:stream:trigger_events:9-0",
    });

    const clock = { now: new Date("2026-07-22T06:02:59.000Z") };
    const published: string[] = [];
    const presentRefs = new Set<string>();
    await expect(
      reconciler(store, clock, published, presentRefs).reconcileBatch(),
    ).resolves.toMatchObject({ claimed: 0 });
    clock.now = new Date("2026-07-22T06:03:01.000Z");
    await expect(
      reconciler(store, clock, published, presentRefs).reconcileBatch(),
    ).resolves.toMatchObject({
      claimed: 1,
      missing: 1,
      rematerialized: 1,
      retryable_failures: 0,
    });
    expect(published).toEqual(["evt_deleted_recorder_crash"]);
    expect(stored.transport_ref).toBe("redis_stream:stream:trigger_events:2-0");
    expect(stored.next_probe_at).toBe("2026-07-22T06:04:01.000Z");
  });
});

describe("bounded Redis durability and exact reference probes", () => {
  it("fails closed for noeviction with unlimited maxmemory", () => {
    expect(() =>
      validateRedisStreamServerConfigurationV1("8.8.0", {
        appendonly: "yes",
        appendfsync: "everysec",
        maxmemory: "0",
        "maxmemory-policy": "noeviction",
      }),
    ).toThrow(/bounded durable PAI V1 baseline/u);
    expect(
      validateRedisStreamServerConfigurationV1("8.8.0", {
        appendonly: "yes",
        appendfsync: "everysec",
        maxmemory: `${512 * 1024 * 1024}`,
        "maxmemory-policy": "noeviction",
      }),
    ).toMatchObject({ maxmemory_bytes: 512 * 1024 * 1024 });
  });

  it("uses exact XRANGE probes and never performs uncheckpointed MAXLEN/XTRIM", async () => {
    const namespace = createRedisNamespaceV1({
      deployment_environment: "dev",
      release_channel: "stable",
      owner_service: "trigger_processor",
      stream_epoch: "epoch_current",
      stream_generation: 1,
    });
    const stream = namespacedRedisKeyV1(namespace, "stream:trigger_events");
    const commands: readonly string[][] = [];
    const mutableCommands = commands as string[][];
    const expectedEnvelope = envelope("evt_1");
    const expectedFields = Object.entries(
      buildRedisStreamMessageV1(expectedEnvelope),
    ).flat();
    const mutableProbeEnvelope = envelope("evt_mutable_probe");
    const mutableExpectedFields = Object.entries(
      buildRedisStreamMessageV1(mutableProbeEnvelope),
    ).flat();
    const probe = createRedisStreamReferenceProbeV1(
      {
        async sendCommand(args) {
          mutableCommands.push([...args]);
          if (args[2] === "1-0") return [["1-0", expectedFields]];
          if (args[2] === "3-0") {
            return [[
              "3-0",
              expectedFields.map((value) =>
                value === "evt_1" ? "evt_wrong" : value,
              ),
            ]];
          }
          if (args[2] === "4-0") {
            Object.assign(mutableProbeEnvelope, {
              event_id: "evt_mutated_after_xrange",
            });
            return [["4-0", mutableExpectedFields]];
          }
          if (args[2] === "5-0") {
            return [["5-0", expectedFields, "unexpected"]];
          }
          return [];
        },
      },
      {
        namespace,
        routes: { "trigger_processor.admission_audit": "stream:trigger_events" },
      },
    );
    await expect(
      probe.probe({
        target: "trigger_processor.admission_audit",
        transport_ref: `redis_stream:${stream}:1-0`,
        expected_envelope: expectedEnvelope,
        expected_payload_hash: canonicalPayloadHashV1(expectedEnvelope.payload),
      }),
    ).resolves.toEqual({ status: "present" });
    await expect(
      probe.probe({
        target: "trigger_processor.admission_audit",
        transport_ref: `redis_stream:${stream}:2-0`,
        expected_envelope: expectedEnvelope,
        expected_payload_hash: canonicalPayloadHashV1(expectedEnvelope.payload),
      }),
    ).resolves.toEqual({ status: "missing" });
    await expect(
      probe.probe({
        target: "trigger_processor.admission_audit",
        transport_ref: `redis_stream:${stream}:3-0`,
        expected_envelope: expectedEnvelope,
        expected_payload_hash: canonicalPayloadHashV1(expectedEnvelope.payload),
      }),
    ).resolves.toEqual({ status: "mismatched" });
    await expect(
      probe.probe({
        target: "trigger_processor.admission_audit",
        transport_ref: `redis_stream:${stream}:4-0`,
        expected_envelope: mutableProbeEnvelope,
        expected_payload_hash: canonicalPayloadHashV1(
          mutableProbeEnvelope.payload,
        ),
      }),
    ).resolves.toEqual({ status: "present" });
    await expect(
      probe.probe({
        target: "trigger_processor.admission_audit",
        transport_ref: `redis_stream:${stream}:5-0`,
        expected_envelope: expectedEnvelope,
        expected_payload_hash: canonicalPayloadHashV1(expectedEnvelope.payload),
      }),
    ).rejects.toThrow(/does not match the probed stream id/u);
    expect(commands).toEqual([
      ["XRANGE", stream, "1-0", "1-0", "COUNT", "1"],
      ["XRANGE", stream, "2-0", "2-0", "COUNT", "1"],
      ["XRANGE", stream, "3-0", "3-0", "COUNT", "1"],
      ["XRANGE", stream, "4-0", "4-0", "COUNT", "1"],
      ["XRANGE", stream, "5-0", "5-0", "COUNT", "1"],
    ]);
    expect(commands.flat()).not.toContain("MAXLEN");
    expect(commands.flat()).not.toContain("XTRIM");
  });
});
