import { describe, expect, it, vi } from "vitest";

import type { MetaMemoryWritePortV1 } from "../src/index.js";
import {
  createAndLease,
  createHarness,
  createRequest,
  providerOutput,
  validSnapshotRead,
} from "./fixtures.js";

describe("Meta Cognition job lifecycle", () => {
  it("fails readiness closed when any owner dependency omits its probe", async () => {
    const incomplete = createHarness({
      snapshot_resolver: {
        async resolve() {
          return validSnapshotRead();
        },
      },
    });
    await expect(
      incomplete.application.checkReadiness(
        new AbortController().signal,
      ),
    ).rejects.toThrow("readiness probes are required");

    await expect(
      createHarness().application.checkReadiness(
        new AbortController().signal,
      ),
    ).resolves.toBeUndefined();
  });

  it("heartbeats the lease while a long provider call is in flight", async () => {
    vi.useFakeTimers();
    try {
      let releaseProvider!: () => void;
      let providerEntered!: () => void;
      const entered = new Promise<void>((resolve) => {
        providerEntered = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseProvider = resolve;
      });
      const harness = createHarness({
        config: {
          lease_ttl_ms: 5_000,
          heartbeat_interval_ms: 250,
          takeover_grace_ms: 1_000,
        },
        provider: {
          async generate() {
            providerEntered();
            await release;
            return providerOutput();
          },
        },
      });
      const { lease } = await createAndLease(harness);
      const run = harness.application.runJob(lease);
      await entered;
      await vi.advanceTimersByTimeAsync(251);
      expect(
        harness.repository
          .inspect()
          .audits.some((audit) => audit.action === "heartbeat"),
      ).toBe(true);
      releaseProvider();
      await expect(run).resolves.toMatchObject({ outcome: "completed" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("pins one lease fence before the first owner await", async () => {
    let blockRead = false;
    let entered!: () => void;
    let release!: () => void;
    const readEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const readRelease = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = createHarness({
      repository_port_factory(repository) {
        return {
          ...repository,
          async readJob(jobId) {
            if (blockRead) {
              entered();
              await readRelease;
            }
            return repository.readJob(jobId);
          },
        };
      },
    });
    const { lease } = await createAndLease(harness);
    const originalFence = structuredClone(lease);
    const mutableFence = structuredClone(lease);
    blockRead = true;
    const run = harness.application.runJob(mutableFence);
    await readEntered;
    mutableFence.job_id = "job-mutated";
    mutableFence.lease_id = "lease-mutated";
    mutableFence.owner_id = "owner-mutated";
    mutableFence.lease_generation += 100;
    release();
    await expect(run).resolves.toMatchObject({
      outcome: "completed",
      job: { id: originalFence.job_id },
    });
    expect(
      harness.repository
        .inspect()
        .audits.filter(
          (audit) =>
            audit.meta_job_id === originalFence.job_id &&
            audit.action === "completed",
        ),
    ).toHaveLength(1);
  });

  it("rejects Proxy owner rows before they can cross the run-job trust boundary", async () => {
    let poisonRead = false;
    const harness = createHarness({
      repository_port_factory(repository) {
        return {
          ...repository,
          async readJob(jobId) {
            const job = await repository.readJob(jobId);
            return poisonRead && job !== undefined
              ? new Proxy(job, {})
              : job;
          },
        };
      },
    });
    const { lease } = await createAndLease(harness);
    poisonRead = true;
    await expect(
      harness.application.runJob(lease),
    ).rejects.toMatchObject({ code: "commit_drift" });
    expect(harness.counts()).toMatchObject({
      provider: 0,
      memory: 0,
      knowthat: 0,
    });
  });

  it.each([
    [
      "cooldown_expired",
      "2026-07-23T00:10:00.000Z",
      null,
    ],
    ["user_retracted", null, "system-event:user-retracted"],
    ["system_interrupted", null, "system-event:interrupted"],
    ["failed_with_learnable_snapshot", null, null],
  ] as const)(
    "accepts the canonical %s enqueue boundary",
    async (enqueueReason, cooldownUntil, boundarySystemEventRef) => {
      const harness = createHarness();
      await expect(
        harness.application.createJob(
          createRequest({
            enqueue_reason: enqueueReason,
            cooldown_until: cooldownUntil,
            boundary_system_event_ref: boundarySystemEventRef,
          }),
        ),
      ).resolves.toMatchObject({ duplicate_replayed: false });
    },
  );

  it("creates/reuses one job and rejects idempotency drift", async () => {
    const harness = createHarness();
    const created = await harness.application.createJob(createRequest());
    const replay = await harness.application.createJob(
      createRequest({ trace_id: "trace-retry" }),
    );
    expect(created.duplicate_replayed).toBe(false);
    expect(replay.duplicate_replayed).toBe(true);
    expect(replay.job_id).toBe(created.job_id);
    await expect(
      harness.application.createJob(
        createRequest({ snapshot_version: 2 }),
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(
      harness.repository
        .inspect()
        .events.filter((event) => event.event_type === "meta.job.created"),
    ).toHaveLength(1);
    await expect(
      harness.application.createJob(createRequest({ bot_id: "bot-2" })),
    ).rejects.toMatchObject({ code: "authorization_scope_mismatch" });
    const otherProcess = await harness.application.createJob(
      createRequest({
        trigger_process_id: "process-2",
        idempotency_key: "process-2",
      }),
    );
    expect(otherProcess.job_id).not.toBe(created.job_id);
  });

  it("runs queued -> leased -> running -> completed and commit replay is side-effect free", async () => {
    const harness = createHarness();
    const { created, lease } = await createAndLease(harness);
    expect((await harness.application.readJob(created.job_id))?.status).toBe(
      "leased",
    );
    const completed = await harness.application.runJob(lease);
    expect(completed.outcome).toBe("completed");
    expect(completed.job.status).toBe("completed");
    expect(harness.counts()).toEqual({
      provider: 1,
      memory: 1,
      knowthat: 0,
      skill: 0,
    });
    const replay = await harness.application.runJob(lease);
    expect(replay.outcome).toBe("replayed");
    expect(harness.counts()).toEqual({
      provider: 1,
      memory: 1,
      knowthat: 0,
      skill: 0,
    });
    const inspection = harness.repository.inspect();
    expect(inspection.experiences).toHaveLength(1);
    expect(inspection.results).toHaveLength(1);
    expect(
      inspection.events.map((event) => event.event_type),
    ).toEqual(
      expect.arrayContaining([
        "meta.job.created",
        "meta.job.started",
        "meta.memory.write_requested",
        "meta.experience.created",
        "meta.result.finalized",
        "meta.job.completed",
      ]),
    );
    expect(JSON.stringify(inspection)).not.toContain("runtime.token");
  });

  it("converges after terminal commit succeeds but the caller disconnects", async () => {
    let disconnectAfterCommit = true;
    const harness = createHarness({
      repository_port_factory(repository) {
        return {
          ...repository,
          async commitCompleted(input) {
            const committed = await repository.commitCompleted(input);
            if (disconnectAfterCommit) {
              disconnectAfterCommit = false;
              throw new Error("simulated commit-then-disconnect");
            }
            return committed;
          },
        };
      },
    });
    const { lease } = await createAndLease(harness);
    await expect(harness.application.runJob(lease)).rejects.toThrow(
      "simulated commit-then-disconnect",
    );
    expect((await harness.application.readJob(lease.job_id))?.status).toBe(
      "completed",
    );
    const replay = await harness.application.runJob(lease);
    expect(replay.outcome).toBe("replayed");
    expect(harness.counts()).toEqual({
      provider: 1,
      memory: 1,
      knowthat: 0,
      skill: 0,
    });
    expect(harness.repository.inspect().results).toHaveLength(1);
  });

  it("heartbeats the same generation and fences a stale worker after takeover", async () => {
    const harness = createHarness();
    const { created, lease } = await createAndLease(harness);
    harness.advance(5_000);
    const heartbeat = await harness.application.heartbeatLease({
      fence: lease,
      trace_id: "heartbeat-1",
    });
    expect(heartbeat.lease_generation).toBe(1);
    expect(Date.parse(heartbeat.lease_expires_at)).toBeGreaterThan(
      Date.parse(lease.lease_expires_at),
    );
    harness.advance(harness.config.lease_ttl_ms + harness.config.takeover_grace_ms);
    const takeover = await harness.application.acquireLease({
      job_id: created.job_id,
      owner_id: "worker-2",
      expected_generation: 1,
      trace_id: "takeover-2",
    });
    expect(takeover).toMatchObject({
      lease_generation: 2,
      owner_id: "worker-2",
      takeover: true,
    });
    const stale = await harness.application.runJob(lease);
    expect(stale.outcome).toBe("stale");
    expect(harness.counts().provider).toBe(0);
    expect(
      harness.repository.inspect().audits.at(-1),
    ).toMatchObject({
      action: "stale_worker_rejected",
      previous_status: "leased",
      next_status: "leased",
    });
  });

  it("converts a partial Memory failure into a KnowThat evidence_pending candidate", async () => {
    const memory: MetaMemoryWritePortV1 = {
      async writeBatch(request) {
        const rejectedItems = request.items.map((item) => ({
          client_item_id: item.client_item_id,
          status: "rejected" as const,
          code: "memory_item_rejected",
          message: "memory item rejected",
        }));
        return {
          schema_version: "memory.write_batch.v1",
          write_batch_id: "memory-batch-rejected",
          batch_status: "partial_failed",
          item_results: rejectedItems,
          accepted_point_ids: [],
          rejected_items: rejectedItems,
          conflict_ids: [],
          warnings: [],
          duplicate_replayed: false,
        };
      },
    };
    const harness = createHarness({ memory });
    const { lease } = await createAndLease(harness);
    const response = await harness.application.runJob(lease);
    expect(response.outcome).toBe("completed");
    if (response.outcome !== "completed") throw new Error("expected complete");
    expect(response.result.partial_failures).toEqual([
      expect.objectContaining({
        source: "memory",
        item_id: "memory-1",
        mode: "nonblocking",
        compensation_required: false,
      }),
    ]);
    expect(harness.knowthatRequests).toHaveLength(1);
    expect(harness.knowthatRequests[0]?.items).toEqual([
      expect.objectContaining({
        client_item_id: "memory_evidence_pending:memory-1",
        evidence_pending: true,
        evidence_pending_reason: "memory_item_rejected",
      }),
    ]);
  });

  it("maps a blocking compensation failure to durable retry_wait then failed", async () => {
    let providerCalls = 0;
    const harness = createHarness({
      provider: {
        async generate() {
          providerCalls += 1;
          return providerOutput({
            memory_writes: [],
            knowthat_candidates: [
              {
                item_id: "fact-1",
                payload: {
                  client_item_id: "fact-1",
                  text: "candidate",
                  subject: "project-1",
                  predicate: "has_fact",
                  object: "candidate",
                  category: "project_fact",
                  proposed_status: "candidate",
                  direct_active_hint: false,
                  risk_level: "medium",
                  explicitness: "inferred",
                  confidence: 0.7,
                  source: "meta_inference",
                  source_ref: "trigger_process:process-1",
                  evidence_refs: ["trigger_process:process-1"],
                  evidence_pending: false,
                },
                evidence_refs: ["trigger_process:process-1"],
              },
            ],
          });
        },
      },
      knowthat: {
        async writeBatch(request) {
          const rejectedItems = request.items.map((item) => ({
            client_item_id: item.client_item_id,
            status: "rejected" as const,
            code: "knowthat_unavailable",
            message: "KnowThat unavailable",
          }));
          return {
            schema_version: "knowthat.write_batch.v1",
            write_batch_id: "knowthat-batch-failed",
            batch_status: "partial_failed",
            item_results: rejectedItems,
            active_fact_ids: [],
            candidate_fact_ids: [],
            rejected_items: rejectedItems,
            conflict_ids: [],
            linkage_check_ids: [],
            duplicate_replayed: false,
          };
        },
      },
      config: { max_job_attempts: 2 },
    });
    const first = await createAndLease(harness);
    const retry = await harness.application.runJob(first.lease);
    expect(retry).toMatchObject({
      outcome: "retry_wait",
      job: { status: "retry_wait", attempt_count: 1 },
    });
    expect(harness.repository.inspect().compensation_commands).toHaveLength(1);
    harness.advance(harness.config.retry_base_ms + harness.config.takeover_grace_ms);
    const secondLease = await harness.application.acquireLease({
      job_id: first.created.job_id,
      owner_id: "worker-2",
      expected_generation: 1,
      trace_id: "retry-2",
    });
    const failed = await harness.application.runJob(secondLease);
    expect(failed).toMatchObject({
      outcome: "failed",
      job: { status: "failed", attempt_count: 2 },
    });
    expect(providerCalls).toBe(1);
    expect(
      harness.repository.inspect().events.map((event) => event.event_type),
    ).toEqual(
      expect.arrayContaining(["meta.job.retry_wait", "meta.job.failed"]),
    );
    const commands = harness.repository.inspect().compensation_commands;
    // The retry attempt owns one fenced work item. Once the job exhausts its
    // retry budget, no new compensation command is published; the older
    // generation is rejected by downstream fencing.
    expect(commands).toHaveLength(1);
    expect(commands[0]?.lease_generation).toBe(1);
  });

  it("fails closed when a downstream owner response drifts from the request identity", async () => {
    const harness = createHarness({
      memory: {
        async writeBatch() {
          return {
            schema_version: "memory.write_batch.v1",
            write_batch_id: "memory-batch-wrong-item",
            batch_status: "completed",
            item_results: [
              {
                client_item_id: "other-item",
                status: "succeeded",
                decision: "new_series",
                memory_point_id: "other-point",
                series_id: "other-series",
                topic_key: "other-topic",
                version_no: 1,
                conflict_ids: [],
              },
            ],
            accepted_point_ids: ["other-point"],
            rejected_items: [],
            conflict_ids: [],
            warnings: [],
            duplicate_replayed: false,
          };
        },
      },
    });
    const { lease } = await createAndLease(harness);
    const response = await harness.application.runJob(lease);
    expect(response).toMatchObject({
      outcome: "failed",
      failure: {
        code: "downstream_invalid",
        source: "memory",
        retryable: false,
      },
    });
    expect(harness.repository.inspect().results).toHaveLength(0);
    expect(
      harness.repository.inspect().events.map((event) => event.event_type),
    ).toEqual(
      expect.arrayContaining(["meta.memory.write_requested", "meta.job.failed"]),
    );
  });
});
