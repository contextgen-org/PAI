import { createHash } from "node:crypto";

import { canonicalJsonV1 } from "@pai/eventing";
import { describe, expect, it } from "vitest";

import {
  createTriggerProcessLifecycleRecoveryHandlerV1,
  createTriggerProcessRecoveryWorkerV1,
  createTriggerProcessRecoveryRunnerV1,
  createTriggerProcessSnapshotRepairHandlerV1,
  createTriggerSnapshotGapRecoveryWorkerV1,
  type TriggerProcessRecoveryClaimV1,
} from "../src/application/trigger-recovery.v1.js";
import type { TriggerProcessorOwnerDatabaseV1 } from "../src/application/trigger-admission.v1.js";
import type { TriggerLifecycleApplicationV1 } from "../src/application/trigger-lifecycle.v1.js";

const hash = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(canonicalJsonV1(value)).digest("hex")}`;

const contextRequest = {
  schema_version: "context_compose_request.v1",
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
  trigger: { trigger_id: "trigger-1", source: "chat", actor_type: "user" },
  context_version: 1,
  source_policy: {
    required_sources: ["environment"],
    allowed_sources: ["environment"],
    skip_decisions: [],
  },
  idempotency_key: "process-1:context:1",
  trace_id: "trace-1",
} as const;

const expectedProcessState = {
  phase: "context",
  status: "running",
  wait_reason: null,
  terminal_reason: null,
} as const;

function stageRetryPayload() {
  return {
    schema_version: "trigger_stage_retry_work.v1",
    trigger_process_id: "process-1",
    expected_process_state: expectedProcessState,
    expected_process_state_version: 1,
    immutable_input_hash: hash(contextRequest),
    trace_id: "trace-1",
    target_stage: "context",
    failed_stage: "context",
    reason_code: "dependency_unavailable",
    retry_attempt: 1,
    next_retry_at: "2026-07-31T00:00:00.000Z",
    request: contextRequest,
  } as const;
}

function claim(
  overrides: Partial<TriggerProcessRecoveryClaimV1> = {},
): TriggerProcessRecoveryClaimV1 {
  const merged = {
    work_item_id: "work-1",
    trigger_process_id: "process-1",
    work_kind: "stage_retry",
    claim_token: "claim-1",
    lease_owner: "worker-1",
    lease_generation: 3,
    expected_process_state_version: 1,
    database_now: "2026-07-31T00:00:00.000Z",
    lease_until: "2026-07-31T00:01:00.000Z",
    attempt_count: 1,
    payload: stageRetryPayload(),
    ...overrides,
  };
  return {
    ...merged,
    payload_hash: overrides.payload_hash ?? hash(merged.payload),
  } as TriggerProcessRecoveryClaimV1;
}

function database(
  claims: readonly TriggerProcessRecoveryClaimV1[],
  acknowledgements: Array<Record<string, unknown>>,
  ackResponse: (args: Readonly<Record<string, unknown>>) => unknown = (args) => ({
    acknowledged: true,
    work_item_id: args.p_work_item_id,
    outcome: args.p_outcome,
    result_hash: args.p_result_hash,
  }),
  claimRequests: Array<Readonly<Record<string, unknown>>> = [],
): TriggerProcessorOwnerDatabaseV1 {
  return {
    deployment: {} as never,
    repository: {} as never,
    unit_of_work: {
      owner_service: "trigger_processor",
      async withTransaction(_request, work) {
        return work({} as never, {
          owner: {
            async executeWriter(_transaction: unknown, request: Readonly<{
              writer: string;
              arguments: Readonly<Record<string, unknown>>;
            }>) {
              if (request.writer === "claim_trigger_process_work_v1") {
                claimRequests.push(request.arguments);
                return claims;
              }
              acknowledgements.push({ ...request.arguments });
              return ackResponse(request.arguments);
            },
          } as never,
        });
      },
    },
  } as TriggerProcessorOwnerDatabaseV1;
}

describe("Trigger Process recovery worker", () => {
  it("advances only an eligible pending source gap through its fenced owner writer", async () => {
    const writes: Array<Readonly<Record<string, unknown>>> = [];
    const worker = createTriggerSnapshotGapRecoveryWorkerV1(
      {
        async listEligible(limit) {
          expect(limit).toBe(16);
          return [{
            pending_event_id: "pending-1",
            status: "pending",
            updated_at: "2026-08-07T00:00:15.000000Z",
          }];
        },
      },
      database([], writes),
      { worker_id: "worker-1:snapshot-gap" },
    );

    await expect(worker.runOnce()).resolves.toMatchObject({
      claimed: 1,
      transitioned: 1,
      raced: 0,
    });
    expect(writes).toEqual([
      expect.objectContaining({
        p_pending_event_id: "pending-1",
        p_expected_status: "pending",
        p_expected_updated_at: "2026-08-07T00:00:15.000000Z",
        p_next_status: "gap_skipped",
        p_worker_id: "worker-1:snapshot-gap",
        p_retry_delay_ms: null,
        p_last_error: expect.objectContaining({
          reason_code: "source_sequence_gap_timeout",
        }),
      }),
    ]);
  });

  it("keeps the default claim batch within the durable writer bound", async () => {
    const claimRequests: Array<Readonly<Record<string, unknown>>> = [];
    const worker = createTriggerProcessRecoveryWorkerV1(
      database([], [], undefined, claimRequests),
      { async handle() { return "owner_writer_committed" as const; } },
      { worker_id: "worker-1" },
    );

    await expect(worker.runOnce()).resolves.toMatchObject({ claimed: 0 });
    expect(claimRequests).toEqual([
      expect.objectContaining({ p_limit: 16 }),
    ]);
  });

  it("dispatches snapshot repair through one fenced owner transaction", async () => {
    const writes: Array<
      Readonly<{
        writer: string;
        arguments: Readonly<Record<string, unknown>>;
        expected_rows?: number;
      }>
    > = [];
    const repairDatabase = {
      deployment: {} as never,
      repository: {} as never,
      unit_of_work: {
        owner_service: "trigger_processor",
        async withTransaction(_request: unknown, work: (transaction: unknown, context: unknown) => Promise<unknown>) {
          return work({ transaction: true }, {
            owner: {
              async executeWriter(
                _transaction: unknown,
                request: Readonly<{
                  writer: string;
                  arguments: Readonly<Record<string, unknown>>;
                  expected_rows?: number;
                }>,
              ) {
                writes.push(request);
                return {
                  dispatched: true,
                  repair_job_id: request.arguments.p_repair_job_id,
                  work_item_id: request.arguments.p_work_item_id,
                  result_hash: request.arguments.p_result_hash,
                };
              },
            },
          });
        },
      },
    } as TriggerProcessorOwnerDatabaseV1;
    const handler = createTriggerProcessSnapshotRepairHandlerV1(repairDatabase);
    const payload = {
      schema_version: "trigger_snapshot_repair_work.v1",
      trigger_process_id: "process-1",
      expected_process_state: expectedProcessState,
      expected_process_state_version: 1,
      immutable_input_hash: `sha256:${"c".repeat(64)}`,
      trace_id: "trace-1",
      repair_job_id: "repair-1",
      snapshot_manifest_ref: "snapshot-manifest:1",
      snapshot_version: 1,
      snapshot_hash: `sha256:${"d".repeat(64)}`,
      missing_first_append_sequence_no: 1,
      missing_last_append_sequence_no: 2,
      retention_until: "2026-08-30T00:00:00.000Z",
      source_refs: ["runtime-event:1", "runtime-event:2"],
    } as const;
    const repairClaim = claim({
      work_kind: "snapshot_repair",
      payload,
      payload_hash: hash(payload),
    });

    await expect(
      handler.repair(repairClaim, payload, new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      writer: "dispatch_trigger_snapshot_repair_v1",
      expected_rows: 1,
      arguments: {
        p_repair_job_id: "repair-1",
        p_process_id: "process-1",
        p_work_item_id: "work-1",
        p_claim_token: "claim-1",
        p_lease_generation: "3",
        p_lease_owner: "worker-1",
        p_expected_process_state_version: "1",
        p_request_hash: hash(payload),
      },
    });
  });

  it("executes every durable work kind through an exact lifecycle or repair boundary", async () => {
    const calls: string[] = [];
    const contextRequests: unknown[] = [];
    const lifecycle: TriggerLifecycleApplicationV1 = {
      async composeContext(request) {
        calls.push("context");
        contextRequests.push(request);
        return {} as never;
      },
      async synthesizeIntent() {
        calls.push("intent");
        return {} as never;
      },
      async reserveRuntimeStart() {
        calls.push("runtime_start");
      },
      async appendRuntimeEvent() {
        throw new Error("unused");
      },
      async enqueueMeta() {
        calls.push("meta_enqueue");
      },
    };
    const handler = createTriggerProcessLifecycleRecoveryHandlerV1(
      lifecycle,
      {
        async repair() {
          calls.push("snapshot_repair");
        },
      },
    );
    const signal = new AbortController().signal;
    for (const work_kind of ["stage_execute", "stage_retry"] as const) {
      const common = {
        trigger_process_id: "process-1",
        expected_process_state: expectedProcessState,
        expected_process_state_version: 1,
        immutable_input_hash: hash(contextRequest),
        trace_id: "trace-1",
        target_stage: "context" as const,
        request: contextRequest,
      };
      await handler.handle(
        claim({
          work_kind,
          payload:
            work_kind === "stage_execute"
              ? {
                  schema_version: "trigger_stage_execute_work.v1",
                  ...common,
                }
              : {
                  schema_version: "trigger_stage_retry_work.v1",
                  ...common,
                  failed_stage: "context",
                  reason_code: "dependency_unavailable",
                  retry_attempt: 1,
                  next_retry_at: "2026-07-31T00:00:00.000Z",
                },
        }),
        signal,
      );
    }
    const artifactHash = `sha256:${"c".repeat(64)}` as const;
    const scope = {
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev" as const,
      release_channel: "stable" as const,
    };
    const policySnapshot = {
      schema_version: "intent_policy_input_snapshot.v1" as const,
      snapshot_ref: "intent-policy:1",
      ...scope,
      bot_policy_revision_id: "policy-r1",
      personality_ref: "personality:1",
      personality_version: 1,
      personality_hash: artifactHash,
      safety_boundaries_ref: "safety:1",
      safety_boundaries_version: 1,
      safety_boundaries_hash: artifactHash,
      tool_permission_profile_ref: "tool-profile:1",
      tool_permission_profile_revision: 1,
      tool_permission_profile_hash: artifactHash,
      tool_policy_epoch: 1,
      catalog_version: "catalog-1",
      catalog_as_of: "2026-07-30T00:00:00.000Z",
      security_revocation_epoch: 1,
      skill_permission_summary_ref: "skill-permissions:1",
      skill_permission_summary_hash: artifactHash,
      snapshot_hash: artifactHash,
    };
    const runtimeRequest = {
      schema_version: "runtime_start.v1.2" as const,
      trigger_process_id: "process-1",
      runtime_run_id: "run-1",
      ...scope,
      start_attempt_no: 1,
      start_fence_token: "fence-1",
      intent_ref: "intent:1",
      intent_version: 1,
      structured_intent_hash: artifactHash,
      structured_intent: {
        goal: "respond",
        user_need: "response",
        response_style: "concise",
        action_plan: [{ step: 1, action_type: "respond" as const, action: "respond" }],
        required_skills: [],
        memory_followups: [],
        safety_notes: [],
        requires_confirmation: false,
      },
      context_snapshot_ref: "context:1",
      context_snapshot_version: 1,
      context_snapshot_hash: artifactHash,
      intent_policy_snapshot_ref: policySnapshot.snapshot_ref,
      intent_policy_snapshot_hash: policySnapshot.snapshot_hash,
      intent_policy_snapshot: policySnapshot,
      expected_catalog_version: policySnapshot.catalog_version,
      catalog_as_of: policySnapshot.catalog_as_of,
      allowed_tools: [],
      allowed_skills: [],
      planned_skills: [],
      policy_input_ref: "policy-input:1",
      policy_input_hash: artifactHash,
      policy: {
        schema_version: "runtime_policy_input.v1" as const,
        intent_policy_snapshot_ref: policySnapshot.snapshot_ref,
        intent_policy_snapshot_hash: policySnapshot.snapshot_hash,
        created_at: "2026-07-30T00:00:00.000Z",
        expires_at: "2026-07-30T01:00:00.000Z",
      },
      confirmation_ref: null,
      confirmation_hash: null,
      preempt_token: "preempt-1",
      idempotency_key: "process-1:start:1",
      trace_id: "trace-1",
    };
    await handler.handle(
      claim({
        work_kind: "runtime_start_recompose",
        payload: {
          schema_version: "trigger_runtime_start_recompose_work.v1",
          trigger_process_id: "process-1",
          expected_process_state: expectedProcessState,
          expected_process_state_version: 1,
          immutable_input_hash: hash(runtimeRequest),
          trace_id: "trace-1",
          old_start_attempt_no: 1,
          old_start_fence_generation: 1,
          catalog_conflict_ref: "catalog-conflict:1",
          no_run_proof_ref: "no-run-proof:1",
          previous_context_snapshot_ref: "context:1",
          previous_context_snapshot_hash: artifactHash,
          previous_intent_ref: "intent:1",
          previous_intent_hash: artifactHash,
          request: {
            ...contextRequest,
            context_version: 2,
            idempotency_key: "process-1:context:2",
          },
        },
      }),
      signal,
    );
    const metaRequest = {
      schema_version: "meta_job_create.v1",
      trigger_process_id: "process-1",
      ...scope,
      snapshot_ref: "snapshot:1",
      snapshot_version: 1,
      snapshot_hash: artifactHash,
      snapshot_retention_until: "2026-08-30T00:00:00.000Z",
      learnable_snapshot_ready: true,
      cooldown_until: null,
      enqueue_reason: "failed_with_learnable_snapshot",
      boundary_system_event_ref: null,
      idempotency_key: "process-1",
      trace_id: "trace-1",
    } as const;
    await handler.handle(
      claim({
        work_kind: "meta_enqueue",
        payload: {
          schema_version: "trigger_meta_enqueue_work.v1",
          trigger_process_id: "process-1",
          expected_process_state: expectedProcessState,
          expected_process_state_version: 1,
          immutable_input_hash: hash(metaRequest),
          trace_id: "trace-1",
          snapshot_ref: metaRequest.snapshot_ref,
          snapshot_version: metaRequest.snapshot_version,
          snapshot_hash: metaRequest.snapshot_hash,
          snapshot_retention_until: metaRequest.snapshot_retention_until,
          enqueue_reason: metaRequest.enqueue_reason,
          boundary_system_event_ref: null,
          meta_request_hash: hash(metaRequest),
          request: metaRequest,
        },
      }),
      signal,
    );
    await handler.handle(
      claim({
        work_kind: "snapshot_repair",
        payload: {
          schema_version: "trigger_snapshot_repair_work.v1",
          trigger_process_id: "process-1",
          expected_process_state: expectedProcessState,
          expected_process_state_version: 1,
          immutable_input_hash: artifactHash,
          trace_id: "trace-1",
          repair_job_id: "repair-1",
          snapshot_manifest_ref: "snapshot-manifest:1",
          snapshot_version: 1,
          snapshot_hash: artifactHash,
          missing_first_append_sequence_no: 1,
          missing_last_append_sequence_no: 2,
          retention_until: "2026-08-30T00:00:00.000Z",
          source_refs: ["runtime-event:1", "runtime-event:2"],
        },
      }),
      signal,
    );
    expect(calls).toEqual([
      "context",
      "context",
      "context",
      "meta_enqueue",
      "snapshot_repair",
    ]);
    expect(contextRequests[2]).toMatchObject({
      schema_version: "context_compose_request.v1",
      context_version: 2,
      idempotency_key: "process-1:context:2",
    });

    await expect(
      handler.handle(
        claim({
          work_kind: "stage_execute",
          payload: {
            schema_version: "trigger_stage_execute_work.v1",
            trigger_process_id: "process-1",
            expected_process_state: expectedProcessState,
            expected_process_state_version: 1,
            immutable_input_hash: hash(contextRequest),
            trace_id: "trace-1",
            target_stage: "context",
            request: { ...contextRequest, trigger_process_id: "process-other" },
          },
        }),
        signal,
      ),
    ).rejects.toThrow("recovery_process_binding_mismatch");
  });

  it("claims durable work and relies on the narrow owner writer for atomic completion", async () => {
    const acknowledgements: Array<Record<string, unknown>> = [];
    const handled: TriggerProcessRecoveryClaimV1[] = [];
    const worker = createTriggerProcessRecoveryWorkerV1(
      database([claim()], acknowledgements),
      {
        async handle(work) {
          handled.push(work);
          return "owner_writer_committed";
        },
      },
      { worker_id: "worker-1" },
    );
    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 1,
      completed: 1,
      retried: 0,
      failed: 0,
      lease_expired: 0,
    });
    expect(handled).toHaveLength(1);
    expect(acknowledgements).toEqual([]);
  });

  it("terminally quarantines an invalid legacy payload without starving valid work in its lease batch", async () => {
    const acknowledgements: Array<Record<string, unknown>> = [];
    const handled: TriggerProcessRecoveryClaimV1[] = [];
    const legacyPayload = {
      ...stageRetryPayload(),
      schema_version: "trigger_meta_enqueue_work.v0",
    } as const;
    const worker = createTriggerProcessRecoveryWorkerV1(
      database(
        [
          claim({
            work_item_id: "legacy-work-1",
            work_kind: "meta_enqueue",
            payload: legacyPayload,
            payload_hash: hash(legacyPayload),
          }),
          claim({ work_item_id: "valid-work-1", claim_token: "claim-2" }),
        ],
        acknowledgements,
      ),
      {
        async handle(work) {
          handled.push(work);
          return "owner_writer_committed" as const;
        },
      },
      { worker_id: "worker-1" },
    );

    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 2,
      completed: 1,
      retried: 0,
      failed: 1,
      lease_expired: 0,
    });
    expect(handled.map((work) => work.work_item_id)).toEqual(["valid-work-1"]);
    expect(acknowledgements).toEqual([
      expect.objectContaining({
        p_work_item_id: "legacy-work-1",
        p_outcome: "failed",
        p_retry_delay_ms: null,
        p_error: { reason_code: "invalid_recovery_payload" },
      }),
    ]);
  });

  it("durably schedules retry and fails only after the bounded attempt budget", async () => {
    const retryAcks: Array<Record<string, unknown>> = [];
    const retryWorker = createTriggerProcessRecoveryWorkerV1(
      database([claim({ attempt_count: 2 })], retryAcks),
      { async handle() { throw new Error("dependency_unavailable"); } },
      {
        worker_id: "worker-1",
        max_attempts: 3,
        retry_delay_ms: () => 5_000,
      },
    );
    await expect(retryWorker.runOnce()).resolves.toMatchObject({ retried: 1 });
    expect(retryAcks[0]).toMatchObject({
      p_outcome: "retry_wait",
      p_retry_delay_ms: 5_000,
      p_error: { reason_code: "dependency_unavailable" },
    });

    const failedAcks: Array<Record<string, unknown>> = [];
    const failedWorker = createTriggerProcessRecoveryWorkerV1(
      database([claim({ attempt_count: 3 })], failedAcks),
      { async handle() { throw new Error("dependency_unavailable"); } },
      { worker_id: "worker-1", max_attempts: 3 },
    );
    await expect(failedWorker.runOnce()).resolves.toMatchObject({ failed: 1 });
    expect(failedAcks[0]).toMatchObject({
      p_outcome: "failed",
      p_retry_delay_ms: null,
    });
  });

  it("persists an allowlisted lifecycle reason without persisting its cause", async () => {
    const acknowledgements: Array<Record<string, unknown>> = [];
    const worker = createTriggerProcessRecoveryWorkerV1(
      database([claim()], acknowledgements),
      {
        async handle() {
          throw Object.assign(new Error("intent stage failed"), {
            reason_code: "intent_provider_unavailable",
            cause: new Error("provider diagnostic must not be persisted"),
          });
        },
      },
      { worker_id: "worker-1", retry_delay_ms: () => 5_000 },
    );

    await expect(worker.runOnce()).resolves.toMatchObject({ retried: 1 });
    expect(acknowledgements[0]).toMatchObject({
      p_error: { reason_code: "intent_provider_unavailable" },
    });
  });

  it("rejects expired claims and stale/no-op acknowledgements", async () => {
    const handler = {
      async handle() {
        return "owner_writer_committed" as const;
      },
    };
    const expired = createTriggerProcessRecoveryWorkerV1(
      database(
        [claim({ lease_until: "2026-07-30T23:59:59.000Z" })],
        [],
      ),
      handler,
      { worker_id: "worker-1" },
    );
    await expect(expired.runOnce()).rejects.toThrow(/claim is invalid/u);

    const stale = createTriggerProcessRecoveryWorkerV1(
      database([claim()], [], () => ({ acknowledged: false })),
      { async handle() { throw new Error("dependency_unavailable"); } },
      { worker_id: "worker-1" },
    );
    await expect(stale.runOnce()).rejects.toThrow(/fenced contract/u);
  });

  it("never issues a generic completed ACK after the narrow owner writer commits", async () => {
    const acknowledgements: Array<Record<string, unknown>> = [];
    const worker = createTriggerProcessRecoveryWorkerV1(
      database([claim()], acknowledgements),
      {
        async handle() {
          return "owner_writer_committed";
        },
      },
      { worker_id: "worker-1" },
    );

    await expect(worker.runOnce()).resolves.toMatchObject({ completed: 1 });
    expect(acknowledgements).toEqual([]);
  });

  it("starts every claim in the DB lease batch without serial starvation", async () => {
    const acknowledgements: Array<Record<string, unknown>> = [];
    let started = 0;
    let release!: () => void;
    const allStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    const worker = createTriggerProcessRecoveryWorkerV1(
      database(
        [claim(), claim({ work_item_id: "work-2", claim_token: "claim-2" })],
        acknowledgements,
      ),
      {
        async handle() {
          started += 1;
          if (started === 2) release();
          await allStarted;
          return "owner_writer_committed";
        },
      },
      { worker_id: "worker-1" },
    );

    await expect(worker.runOnce()).resolves.toMatchObject({
      claimed: 2,
      completed: 2,
      lease_expired: 0,
    });
    expect(acknowledgements).toHaveLength(0);
  });

  it("does not start side effects when claim round-trip consumed the lease", async () => {
    const handled: TriggerProcessRecoveryClaimV1[] = [];
    const acknowledgements: Array<Record<string, unknown>> = [];
    const worker = createTriggerProcessRecoveryWorkerV1(
      database(
        [
          claim({
            database_now: "2026-07-31T00:00:00.000Z",
            lease_until: "2026-07-31T00:00:00.200Z",
          }),
        ],
        acknowledgements,
      ),
      {
        async handle(work) {
          handled.push(work);
          return "owner_writer_committed";
        },
      },
      { worker_id: "worker-1" },
    );

    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 1,
      completed: 0,
      retried: 0,
      failed: 0,
      lease_expired: 1,
    });
    expect(handled).toHaveLength(0);
    expect(acknowledgements).toHaveLength(0);
  });

  it("runs recovery immediately at startup, never overlaps, and stops cleanly", async () => {
    let release!: () => void;
    const firstRun = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const runner = createTriggerProcessRecoveryRunnerV1(
      {
        async runOnce() {
          calls += 1;
          if (calls === 1) await firstRun;
          return {
            claimed: 0,
            completed: 0,
            retried: 0,
            failed: 0,
            lease_expired: 0,
          };
        },
      },
      { poll_interval_ms: 10, stop_timeout_ms: 1_000 },
    );
    runner.start();
    await Promise.resolve();
    expect(calls).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(calls).toBe(1);
    const stopping = runner.stop();
    release();
    await stopping;
    expect(runner.state).toBe("stopped");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(1);
  });
});
