import {
  MetaCognitionDomainEventV1Schema,
  type FeedbackRequestV1,
  type MetaDurableCommandV1,
  type MetaSkillCandidateV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  InMemoryMetaOwnerOperationsV1,
  MetaOwnerCommandDispatcherV1,
  MetaOwnerOperationsErrorV1,
  type MetaOperationsPrincipalV1,
} from "../src/meta-owner-operations.v1.js";
import { sha256CanonicalV1 } from "../src/canonical.v1.js";
import {
  AT,
  SNAPSHOT_HASH,
  createAndLease,
  createHarness,
  createRequest,
  providerOutput,
} from "./fixtures.js";

const scope = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;

function principal(
  caller: MetaOperationsPrincipalV1["caller"],
  capability: string,
  principalId = "principal-1",
): MetaOperationsPrincipalV1 {
  return {
    caller,
    capabilities: [capability],
    principal_id: principalId,
    scope,
  };
}

function rejectedMemory(request: {
  readonly items: readonly Readonly<{ client_item_id: string }>[];
}) {
  const rejected = request.items.map(({ client_item_id }) => ({
    client_item_id,
    status: "rejected" as const,
    code: "memory_unavailable",
    message: "Memory unavailable",
  }));
  return {
    schema_version: "memory.write_batch.v1" as const,
    write_batch_id: "memory-batch-rejected",
    batch_status: "partial_failed" as const,
    item_results: rejected,
    accepted_point_ids: [],
    rejected_items: rejected,
    conflict_ids: [],
    warnings: [],
    duplicate_replayed: false,
  };
}

function successfulMemory(request: {
  readonly source_meta_job_id: string;
  readonly items: readonly Readonly<{ client_item_id: string }>[];
}) {
  return {
    schema_version: "memory.write_batch.v1" as const,
    write_batch_id: `memory-batch:${request.source_meta_job_id}`,
    batch_status: "completed" as const,
    item_results: request.items.map(({ client_item_id }, index) => ({
      client_item_id,
      status: "succeeded" as const,
      decision: "new_series" as const,
      memory_point_id: `memory-point-${index + 1}`,
      series_id: `memory-series-${index + 1}`,
      topic_key: `topic-${index + 1}`,
      version_no: 1,
      conflict_ids: [],
    })),
    accepted_point_ids: request.items.map(
      (_item, index) => `memory-point-${index + 1}`,
    ),
    rejected_items: [],
    conflict_ids: [],
    warnings: [],
    duplicate_replayed: false,
  };
}

function rejectedKnowThat(request: {
  readonly items: readonly Readonly<{ client_item_id: string }>[];
}) {
  const rejected = request.items.map(({ client_item_id }) => ({
    client_item_id,
    status: "rejected" as const,
    code: "knowthat_unavailable",
    message: "KnowThat unavailable",
  }));
  return {
    schema_version: "knowthat.write_batch.v1" as const,
    write_batch_id: "knowthat-batch-rejected",
    batch_status: "partial_failed" as const,
    item_results: rejected,
    active_fact_ids: [],
    candidate_fact_ids: [],
    rejected_items: rejected,
    conflict_ids: [],
    linkage_check_ids: [],
    duplicate_replayed: false,
  };
}

function successfulKnowThat(request: {
  readonly bot_id: string;
  readonly source_meta_job_id: string;
  readonly items: readonly Readonly<{
    client_item_id: string;
    category: string;
    subject: string;
    predicate: string;
  }>[];
}) {
  return {
    schema_version: "knowthat.write_batch.v1" as const,
    write_batch_id: `knowthat-batch:${request.source_meta_job_id}`,
    batch_status: "completed" as const,
    item_results: request.items.map((item, index) => ({
      client_item_id: item.client_item_id,
      status: "succeeded" as const,
      semantic_key:
        `${request.bot_id}:${item.category}:${item.subject}:${item.predicate}`,
      final_status: "candidate" as const,
      fact_id: `knowthat-fact-${index + 1}`,
      decision_reason: "candidate_created",
      representative_client_item_id: item.client_item_id,
      group_role: "representative" as const,
      linkage_check_ids: [],
      duplicate_replayed: false,
    })),
    active_fact_ids: [],
    candidate_fact_ids: request.items.map(
      (_item, index) => `knowthat-fact-${index + 1}`,
    ),
    rejected_items: [],
    conflict_ids: [],
    linkage_check_ids: [],
    duplicate_replayed: false,
  };
}

function successfulSkillOwnerDispatcher() {
  return {
    async dispatch(command: MetaDurableCommandV1) {
      if (
        command.kind !== "skill_candidate_application" ||
        command.target_service !== "skill_registry"
      ) {
        throw new Error("unexpected Skill owner command");
      }
      const ownerResponse = {
        code: "skill_candidate_application_updated" as const,
        message: "application received",
        retryable: false as const,
        details: {
          application_id: command.payload.application_id,
          status: "received" as const,
          response_ref:
            `skill_response:${command.payload.application_id}`,
          response_hash: `sha256:${"9".repeat(64)}`,
          duplicate_replayed: false,
        },
        trace_id: command.payload.trace_id,
      };
      return {
        outcome: "succeeded" as const,
        result_ref: ownerResponse.details.response_ref,
        error_code: null,
        next_retry_at: null,
        target_service: "skill_registry" as const,
        owner_request: command.payload,
        owner_request_hash: command.payload_hash,
        source_owner_request_hash: command.payload_hash,
        owner_response: ownerResponse,
        owner_response_hash: sha256CanonicalV1(ownerResponse),
      };
    },
  };
}

function feedback(
  id: string,
  createdAt = AT,
): FeedbackRequestV1 {
  return {
    schema_version: "feedback_request.v1",
    feedback_request_id: id,
    ...scope,
    source_kind: "meta_job",
    meta_job_id: "job-1",
    trigger_process_id: "process-1",
    dedupe_scope_ref: {
      kind: "candidate",
      ref: `candidate:${id}`,
    },
    question_key: `question:${id}`,
    question_payload_ref: `question_payload:${id}`,
    question_payload_hash: `sha256:${"2".repeat(64)}`,
    status: "open",
    delivery_mode: "internal_queue",
    target_actor_ref: "operator-1",
    target_binding_ref: null,
    delivery_channel: null,
    delivery_status: "not_applicable",
    delivery_version: 1,
    created_at: createdAt,
    updated_at: createdAt,
    expires_at: "2026-07-23T02:00:00.000Z",
    answered_by_trigger_id: null,
    answer_payload: null,
  };
}

const candidate: MetaSkillCandidateV1 = {
  candidate_id: "skill-candidate-1",
  candidate_type: "new_skill",
  skill_key: "skill-key-1",
  ...scope,
  baseline_catalog_version: "catalog-1",
  proposal_ref: "proposal-1",
  proposal_hash: `sha256:${"3".repeat(64)}`,
  evidence_refs: ["trigger_process:process-1"],
  status: "proposed",
  review_version: 1,
  delivery_id: null,
  application_id: null,
  downstream_ref: null,
  downstream_status: "pending",
  attempt_count: 0,
  last_error: null,
};

describe("Meta owner operations", () => {
  it("requires live Memory and KnowThat probes before compensation dispatch", async () => {
    const missing = new MetaOwnerCommandDispatcherV1({
      memory: {
        async writeBatch(request) {
          return successfulMemory(request);
        },
      },
      knowthat: {
        async writeBatch(request) {
          return successfulKnowThat(request);
        },
      },
    });
    await expect(missing.checkReadiness()).rejects.toThrow(
      "readiness probes are required",
    );

    const complete = new MetaOwnerCommandDispatcherV1({
      memory: {
        async writeBatch(request) {
          return successfulMemory(request);
        },
        async checkReadiness() {},
      },
      knowthat: {
        async writeBatch(request) {
          return successfulKnowThat(request);
        },
        async checkReadiness() {},
      },
    });
    await expect(complete.checkReadiness()).resolves.toBeUndefined();
  });

  it("answers/lists feedback with scope-bound replay and repairs snapshots under a CAS fence", async () => {
    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date(AT),
    });
    operations.seedFeedbackRequest(feedback("feedback-1"));
    operations.seedFeedbackRequest(feedback("feedback:2"));
    operations.seedJob(
      {
        ...createRequest(),
        id: "job-1",
        request_hash: `sha256:${"4".repeat(64)}`,
        status: "failed",
        lease_previous_status: null,
        attempt_count: 1,
        next_retry_at: null,
        error: {
          code: "snapshot_missing",
          message: "snapshot missing",
          retryable: true,
          source: "snapshot",
        },
        created_at: AT,
        updated_at: AT,
      },
      1,
    );

    const listed = await operations.listFeedback(
      principal(
        "observation_gateway",
        "meta.feedback_requests.read",
        "operator-1",
      ),
      {
        status: "open",
        assignee: "operator-1",
        limit: 1,
        trace_id: "trace-list",
      },
    );
    expect(listed.items.map((item) => item.feedback_request_id)).toEqual([
      "feedback-1",
    ]);
    expect(listed.has_more).toBe(true);
    await expect(
      operations.listFeedback(
        principal(
          "observation_gateway",
          "meta.feedback_requests.read",
          "operator-1",
        ),
        {
          status: "open",
          assignee: "operator-1",
          cursor: listed.next_cursor!,
          limit: 1,
          trace_id: "trace-list-page-2",
        },
      ),
    ).resolves.toMatchObject({
      items: [{ feedback_request_id: "feedback:2" }],
      has_more: false,
    });

    const answer = {
      schema_version: "meta_feedback_answer.v1",
      feedback_request_id: "feedback-1",
      trigger_id: "trigger-2",
      bot_id: "bot-1",
      answer_payload: { answer: "yes" },
      trace_id: "trace-answer-1",
    } as const;
    await expect(
      operations.answerFeedback(
        principal("trigger_processor", "meta.feedback.answer"),
        "feedback-1",
        answer,
      ),
    ).resolves.toMatchObject({
      status: "answered",
      duplicate_replayed: false,
    });
    await expect(
      operations.answerFeedback(
        principal("trigger_processor", "meta.feedback.answer"),
        "feedback-1",
        { ...answer, trace_id: "trace-answer-retry" },
      ),
    ).resolves.toMatchObject({ duplicate_replayed: true });

    const repair = {
      schema_version: "meta_snapshot_repair.v1",
      repair_id: "repair-1",
      meta_job_id: "job-1",
      trigger_process_id: "process-1",
      previous_snapshot_ref: "snapshot-ref-1",
      previous_snapshot_version: 1,
      previous_snapshot_hash: SNAPSHOT_HASH,
      next_snapshot_ref: "snapshot-ref-2",
      next_snapshot_version: 2,
      next_snapshot_hash: `sha256:${"5".repeat(64)}`,
      snapshot_retention_until: "2026-07-23T03:00:00.000Z",
      reason_code: "snapshot_missing",
      idempotency_key: "repair-1",
      trace_id: "trace-repair-1",
    } as const;
    await expect(
      operations.repairSnapshot(
        principal("trigger_processor", "meta.snapshot_repair"),
        "job-1",
        repair,
      ),
    ).resolves.toMatchObject({
      status: "accepted",
      input_revision: 2,
      snapshot_version: 2,
      duplicate_replayed: false,
    });
    await expect(
      operations.repairSnapshot(
        principal("trigger_processor", "meta.snapshot_repair"),
        "job-1",
        { ...repair, trace_id: "trace-repair-retry" },
      ),
    ).resolves.toMatchObject({ duplicate_replayed: true });
  });

  it("pins direct owner principal, request and clock before the lock await", async () => {
    const sharedClock = new Date(AT);
    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => sharedClock,
    });
    operations.seedFeedbackRequest(feedback("feedback-boundary"));
    const mutablePrincipal = {
      ...principal("trigger_processor", "meta.feedback.answer"),
      capabilities: ["meta.feedback.answer"],
      scope: { ...scope },
    };
    const request = {
      schema_version: "meta_feedback_answer.v1",
      feedback_request_id: "feedback-boundary",
      trigger_id: "trigger-original",
      bot_id: "bot-1",
      answer_payload: { answer: "original" },
      trace_id: "trace-boundary",
    };
    const answerPromise = operations.answerFeedback(
      mutablePrincipal,
      "feedback-boundary",
      request,
    );
    mutablePrincipal.caller = "observation_gateway";
    mutablePrincipal.capabilities.length = 0;
    mutablePrincipal.scope.bot_id = "bot-mutated";
    request.feedback_request_id = "feedback-mutated";
    request.trigger_id = "trigger-mutated";
    request.answer_payload.answer = "mutated";
    sharedClock.setUTCFullYear(2099);
    await expect(answerPromise).resolves.toMatchObject({
      feedback_request_id: "feedback-boundary",
      status: "answered",
      answered_by_trigger_id: "trigger-original",
    });
    expect(
      operations.inspect().feedback_requests.find(
        ({ feedback_request_id }) =>
          feedback_request_id === "feedback-boundary",
      ),
    ).toMatchObject({
      status: "answered",
      answered_by_trigger_id: "trigger-original",
      answer_payload: { answer: "original" },
      updated_at: AT,
    });

    const proxyPrincipal = new Proxy(
      principal("trigger_processor", "meta.feedback.answer"),
      {},
    );
    await expect(
      operations.answerFeedback(
        proxyPrincipal,
        "feedback-boundary",
        request,
      ),
    ).rejects.toMatchObject<Partial<MetaOwnerOperationsErrorV1>>({
      code: "invalid_request",
    });
    let getterCalls = 0;
    const accessorRequest: Record<string, unknown> = {
      ...request,
      feedback_request_id: "feedback-boundary",
      trigger_id: "trigger-accessor",
    };
    Object.defineProperty(accessorRequest, "answer_payload", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return { answer: "secret" };
      },
    });
    await expect(
      operations.answerFeedback(
        principal("trigger_processor", "meta.feedback.answer"),
        "feedback-boundary",
        accessorRequest,
      ),
    ).rejects.toMatchObject<Partial<MetaOwnerOperationsErrorV1>>({
      code: "invalid_request",
    });
    expect(getterCalls).toBe(0);
  });

  it("reviews a skill candidate once and durably emits the exact Skill application request", async () => {
    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date(AT),
    });
    operations.seedJob({
      ...createRequest(),
      id: "job-1",
      request_hash: `sha256:${"4".repeat(64)}`,
      status: "completed",
      lease_previous_status: null,
      attempt_count: 1,
      next_retry_at: null,
      error: null,
      created_at: AT,
      updated_at: AT,
    });
    operations.seedSkillCandidate(
      candidate,
      "job-1",
      AT,
      [
        {
          ref: "trigger_process:process-1",
          hash: `sha256:${"6".repeat(64)}`,
        },
      ],
    );
    const request = {
      schema_version: "meta_skill_candidate_review.v1",
      candidate_id: candidate.candidate_id,
      expected_status: "proposed",
      expected_review_version: 1,
      expected_updated_at: AT,
      decision: "accept",
      reviewer_principal_id: "reviewer-1",
      reason_code: "review_accepted",
      idempotency_key: "review-1",
      trace_id: "trace-review",
    } as const;
    await expect(
      operations.reviewSkillCandidate(
        principal(
          "meta_cognition",
          "meta.skill_candidate.review",
          "reviewer-1",
        ),
        candidate.candidate_id,
        request,
      ),
    ).resolves.toMatchObject({
      status: "accepted",
      review_version: 2,
      duplicate_replayed: false,
    });
    await expect(
      operations.reviewSkillCandidate(
        principal(
          "meta_cognition",
          "meta.skill_candidate.review",
          "reviewer-1",
        ),
        candidate.candidate_id,
        { ...request, trace_id: "trace-review-retry" },
      ),
    ).resolves.toMatchObject({ duplicate_replayed: true });

    const inspection = operations.inspect();
    expect(inspection.commands).toHaveLength(1);
    expect(inspection.commands[0]).toMatchObject({
      kind: "skill_candidate_application",
      target_service: "skill_registry",
      payload: {
        schema_version: "skill_candidate_application.v1",
        candidate_id: candidate.candidate_id,
        review_version: 2,
        reviewer_principal_id: "reviewer-1",
        evidence_refs: [
          {
            ref: "trigger_process:process-1",
            hash: `sha256:${"6".repeat(64)}`,
          },
        ],
      },
    });
    expect(inspection.outbox).toHaveLength(1);
    expect(inspection.outbox[0]?.event_type).toBe(
      "meta.skill.candidate_application_requested",
    );
    expect(
      Value.Check(
        MetaCognitionDomainEventV1Schema,
        inspection.outbox[0],
      ),
    ).toBe(true);
    const worker = principal(
      "meta_cognition",
      "meta.command.dispatch",
      "worker-1",
    );
    const dispatcher = new MetaOwnerCommandDispatcherV1({
      memory: {
        async writeBatch(ownerRequest) {
          return successfulMemory(ownerRequest);
        },
      },
      knowthat: {
        async writeBatch(ownerRequest) {
          return successfulKnowThat(ownerRequest);
        },
      },
      skill_dispatcher: successfulSkillOwnerDispatcher(),
      now: () => new Date(AT),
    });
    await operations.reconcilePendingCommands(
      worker,
      dispatcher,
      {
        worker_id: "worker-1",
        limit: 1,
        lease_seconds: 60,
        trace_id: "trace-skill-reconcile",
      },
    );
    expect(operations.inspect().candidates[0]).toMatchObject({
      downstream_status: "received",
      downstream_ref:
        "skill_response:skill_candidate_application:skill-candidate-1:2",
      attempt_count: 1,
      last_error: null,
    });

    await expect(
      operations.reviewSkillCandidate(
        principal(
          "meta_cognition",
          "meta.skill_candidate.review",
          "reviewer-1",
        ),
        candidate.candidate_id,
        { ...request, idempotency_key: "review-drift" },
      ),
    ).rejects.toMatchObject<Partial<MetaOwnerOperationsErrorV1>>({
      code: "idempotency_conflict",
    });
  });

  it("replays retry settlements after disconnect and converges partial_pending exactly once", async () => {
    const rejectedKnowThat = {
      async writeBatch(request: {
        readonly items: readonly Readonly<{
          client_item_id: string;
        }>[];
      }) {
        const rejected = request.items.map(({ client_item_id }) => ({
          client_item_id,
          status: "rejected" as const,
          code: "knowthat_unavailable",
          message: "KnowThat unavailable",
        }));
        return {
          schema_version: "knowthat.write_batch.v1" as const,
          write_batch_id: "knowthat-batch-failed",
          batch_status: "partial_failed" as const,
          item_results: rejected,
          active_fact_ids: [],
          candidate_fact_ids: [],
          rejected_items: rejected,
          conflict_ids: [],
          linkage_check_ids: [],
          duplicate_replayed: false,
        };
      },
    };
    const harness = createHarness({
      provider: {
        async generate() {
          return providerOutput();
        },
      },
      memory: {
        async writeBatch(request) {
          const rejected = request.items.map(
            ({ client_item_id }) => ({
              client_item_id,
              status: "rejected" as const,
              code: "memory_unavailable",
              message: "Memory unavailable",
            }),
          );
          return {
            schema_version: "memory.write_batch.v1",
            write_batch_id: "memory-batch-failed",
            batch_status: "partial_failed",
            item_results: rejected,
            accepted_point_ids: [],
            rejected_items: rejected,
            conflict_ids: [],
            warnings: [],
            duplicate_replayed: false,
          };
        },
      },
      knowthat: rejectedKnowThat,
      config: {
        downstream_failure_mode: {
          memory: "nonblocking",
          knowthat: "nonblocking",
          skill: "nonblocking",
        },
      },
    });
    const { lease } = await createAndLease(harness);
    const completed = await harness.application.runJob(lease);
    expect(completed.outcome).toBe("completed");
    if (completed.outcome !== "completed") {
      throw new Error("expected completed partial result");
    }
    expect(completed.result.result_status).toBe("partial_pending");

    let nowMs = Date.parse(AT);
    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date(nowMs),
    });
    const inspection = harness.repository.inspect();
    const job = inspection.jobs[0]!;
    operations.seedResult(job, completed.result);
    for (const command of inspection.compensation_commands) {
      operations.seedCompensationCommand(command);
    }
    expect(inspection.compensation_commands.length).toBeGreaterThan(0);

    const worker = principal(
      "meta_cognition",
      "meta.command.dispatch",
      "worker-1",
    );
    await expect(
      operations.claimCommands(worker, {
        worker_id: "forged-worker",
        limit: 1,
        lease_seconds: 60,
        trace_id: "trace-forged-claim",
      }),
    ).rejects.toMatchObject<Partial<MetaOwnerOperationsErrorV1>>({
      code: "authorization_scope_mismatch",
    });
    const [first] = await operations.claimCommands(worker, {
      worker_id: "worker-1",
      limit: 1,
      lease_seconds: 60,
      trace_id: "trace-claim-1",
    });
    expect(first).toBeDefined();
    await expect(
      operations.settleCommand(worker, first!.command_id, {
        worker_id: "worker-1",
        lease_generation: first!.lease_generation,
        settlement_id: `${first!.command_id}:opaque-success`,
        outcome: "succeeded",
        result_ref: `forged:${first!.command_id}`,
        error_code: null,
        next_retry_at: null,
        trace_id: "trace-opaque-success",
      }),
    ).rejects.toMatchObject<Partial<MetaOwnerOperationsErrorV1>>({
      code: "invalid_request",
    });
    expect(
      operations
        .inspect()
        .commands.find(
          ({ command_id }) => command_id === first!.command_id,
        ),
    ).toMatchObject({
      status: "claimed",
      settlement_id: null,
      result_ref: null,
    });
    const queuedPastLeaseSettlement = operations.settleCommand(
      worker,
      first!.command_id,
      {
        worker_id: "worker-1",
        lease_generation: first!.lease_generation,
        settlement_id: `${first!.command_id}:expired-fence`,
        outcome: "retry_wait",
        result_ref: null,
        error_code: "dependency_unavailable",
        next_retry_at: "2026-07-23T00:02:00.000Z",
        trace_id: "trace-expired-fence",
      },
    );
    nowMs += 60_001;
    await expect(queuedPastLeaseSettlement).rejects.toMatchObject<
      Partial<MetaOwnerOperationsErrorV1>
    >({
      code: "stale_fence",
    });
    nowMs = Date.parse(AT);
    const retry = {
      worker_id: "worker-1",
      lease_generation: first!.lease_generation,
      settlement_id: `${first!.command_id}:retry:1`,
      outcome: "retry_wait",
      result_ref: null,
      error_code: "dependency_unavailable",
      next_retry_at: "2026-07-23T00:00:01.000Z",
      trace_id: "trace-settle-retry",
    } as const;
    const firstSettlement = await operations.settleCommand(
      worker,
      first!.command_id,
      retry,
    );
    expect(firstSettlement).toMatchObject({
      status: "retry_wait",
      result_status: "partial_pending",
      duplicate_replayed: false,
    });
    const versionAfterRetry = operations.inspect().results[0]!.result_version;
    await expect(
      operations.settleCommand(worker, first!.command_id, {
        ...retry,
        trace_id: "trace-after-commit-disconnect",
      }),
    ).resolves.toMatchObject({
      duplicate_replayed: true,
      result_version: versionAfterRetry,
    });
    expect(operations.inspect().results[0]!.result_version).toBe(
      versionAfterRetry,
    );

    const verifiedDispatcher = new MetaOwnerCommandDispatcherV1({
      memory: {
        async writeBatch(request) {
          return successfulMemory(request);
        },
      },
      knowthat: {
        async writeBatch(request) {
          return successfulKnowThat(request);
        },
      },
      now: () => new Date(nowMs),
    });
    await operations.reconcilePendingCommands(
      worker,
      verifiedDispatcher,
      {
        worker_id: "worker-1",
        limit: 200,
        lease_seconds: 60,
        trace_id: "trace-reconcile-pending",
      },
    );
    nowMs += 1_000;
    await operations.reconcilePendingCommands(
      worker,
      verifiedDispatcher,
      {
        worker_id: "worker-1",
        limit: 200,
        lease_seconds: 60,
        trace_id: "trace-reconcile-retry",
      },
    );
    expect(
      operations
        .inspect()
        .commands.find(
          ({ command_id }) => command_id === first!.command_id,
        )?.status,
    ).toBe("succeeded");

    const converged = operations.inspect();
    expect(converged.results[0]).toMatchObject({
      result_status: "complete",
      finalized_at: "2026-07-23T00:00:01.000Z",
    });
    expect(
      converged.results[0]!.payload.partial_failures.every(
        ({ status }) => status === "succeeded",
      ),
    ).toBe(true);
    expect(
      converged.outbox.every((event) =>
        Value.Check(MetaCognitionDomainEventV1Schema, event),
      ),
    ).toBe(true);
    expect(converged.outbox.at(-1)?.event_type).toBe(
      "meta.result.finalized",
    );
  });

  it("allows only the controlled owner dispatcher and retries one explicitly rejected item under a new identity", async () => {
    const harness = createHarness({
      memory: {
        async writeBatch(request) {
          return rejectedMemory(request);
        },
      },
      knowthat: {
        async writeBatch(request) {
          return rejectedKnowThat(request);
        },
      },
      config: {
        downstream_failure_mode: {
          memory: "nonblocking",
          knowthat: "nonblocking",
          skill: "nonblocking",
        },
      },
    });
    const { lease } = await createAndLease(harness);
    const completed = await harness.application.runJob(lease);
    if (completed.outcome !== "completed") {
      throw new Error("expected a partial result");
    }
    const repositoryState = harness.repository.inspect();
    let nowMs = Date.parse(AT);
    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date(nowMs),
    });
    operations.seedResult(repositoryState.jobs[0]!, completed.result);
    for (const command of repositoryState.compensation_commands) {
      operations.seedCompensationCommand(command);
    }
    const memorySeed = repositoryState.compensation_commands.find(
      ({ target_service }) => target_service === "memory",
    )!;
    expect(memorySeed.request_payload).toMatchObject({
      target_service: "memory",
      dispatch_mode: "single_item_retry",
      retryable: true,
      failed_item: {
        client_item_id: memorySeed.request_payload.item_id,
      },
    });
    expect(memorySeed.request_payload.owner_request.items).toHaveLength(1);
    expect(
      memorySeed.request_payload.owner_request.idempotency_key,
    ).not.toBe(
      memorySeed.request_payload.failed_item.source_idempotency_key,
    );
    expect(memorySeed.request_payload.owner_request_hash).not.toBe(
      memorySeed.request_payload.failed_item.source_owner_request_hash,
    );

    const worker = principal(
      "meta_cognition",
      "meta.command.dispatch",
      "worker-1",
    );
    await expect(
      operations.reconcilePendingCommands(
        worker,
        {
          async dispatch() {
            return {
              outcome: "succeeded",
              result_ref: "forged-success",
              error_code: null,
              next_retry_at: null,
            };
          },
        } as unknown as MetaOwnerCommandDispatcherV1,
        {
          worker_id: "worker-1",
          limit: 200,
          lease_seconds: 60,
          trace_id: "opaque-dispatcher",
        },
      ),
    ).rejects.toMatchObject<Partial<MetaOwnerOperationsErrorV1>>({
      code: "invalid_request",
    });
    expect(
      operations.inspect().commands.every(
        ({ status }) => status === "pending",
      ),
    ).toBe(true);

    const driftDispatcher = new MetaOwnerCommandDispatcherV1({
      memory: {
        async writeBatch(request) {
          const [first] = request.items;
          return successfulMemory({
            ...request,
            items: [
              {
                ...first!,
                client_item_id: "wrong-memory-item",
              },
            ],
          });
        },
      },
      knowthat: {
        async writeBatch(request) {
          return successfulKnowThat(request);
        },
      },
      now: () => new Date(nowMs),
    });
    const verifiedDispatcher = new MetaOwnerCommandDispatcherV1({
      memory: {
        async writeBatch(request) {
          return successfulMemory(request);
        },
      },
      knowthat: {
        async writeBatch(request) {
          return successfulKnowThat(request);
        },
      },
      now: () => new Date(nowMs),
    });
    await operations.reconcilePendingCommands(
      worker,
      driftDispatcher,
      {
        worker_id: "worker-1",
        limit: 200,
        lease_seconds: 60,
        trace_id: "settle-drift-checked",
      },
    );
    expect(
      operations
        .inspect()
        .commands.find(
          (command) => command.target_service === "memory",
        ),
    ).toMatchObject({
      status: "retry_wait",
      last_error: "owner_response_invalid",
    });
    expect(operations.inspect().results[0]?.result_status).toBe(
      "partial_pending",
    );
    nowMs += 1_000;
    await operations.reconcilePendingCommands(
      worker,
      verifiedDispatcher,
      {
        worker_id: "worker-1",
        limit: 200,
        lease_seconds: 60,
        trace_id: "verified-retry",
      },
    );
    expect(operations.inspect().results[0]).toMatchObject({
      result_status: "complete",
      finalized_at: "2026-07-23T00:00:01.000Z",
    });
  });

  it("rejects controlled-success evidence when the complete owner response hash drifts", async () => {
    const harness = createHarness({
      memory: {
        async writeBatch(request) {
          return rejectedMemory(request);
        },
      },
      knowthat: {
        async writeBatch(request) {
          return rejectedKnowThat(request);
        },
      },
      config: {
        downstream_failure_mode: {
          memory: "nonblocking",
          knowthat: "nonblocking",
          skill: "nonblocking",
        },
      },
    });
    const { lease } = await createAndLease(harness);
    const completed = await harness.application.runJob(lease);
    if (completed.outcome !== "completed") {
      throw new Error("expected a partial result");
    }
    const state = harness.repository.inspect();
    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date(AT),
    });
    operations.seedResult(state.jobs[0]!, completed.result);
    for (const command of state.compensation_commands) {
      operations.seedCompensationCommand(command);
    }
    class HashDriftDispatcher extends MetaOwnerCommandDispatcherV1 {
      public override async dispatch(
        command: MetaDurableCommandV1,
        signal?: AbortSignal,
      ) {
        const outcome = await super.dispatch(command, signal);
        return outcome.outcome === "succeeded"
          ? {
              ...outcome,
              owner_response_hash:
                `sha256:${"0".repeat(64)}` as const,
            }
          : outcome;
      }
    }
    const dispatcher = new HashDriftDispatcher({
      memory: {
        async writeBatch(request) {
          return successfulMemory(request);
        },
      },
      knowthat: {
        async writeBatch(request) {
          return successfulKnowThat(request);
        },
      },
      now: () => new Date(AT),
    });
    await expect(
      operations.reconcilePendingCommands(
        principal(
          "meta_cognition",
          "meta.command.dispatch",
          "worker-1",
        ),
        dispatcher,
        {
          worker_id: "worker-1",
          limit: 1,
          lease_seconds: 60,
          trace_id: "owner-response-hash-drift",
        },
      ),
    ).rejects.toThrow("hash or target drift");
    expect(
      operations
        .inspect()
        .commands.find(({ status }) => status === "claimed"),
    ).toMatchObject({
      status: "claimed",
      settlement_id: null,
      result_ref: null,
    });
    expect(operations.inspect().results[0]?.result_version).toBe(1);
  });

  it("replays the original owner identity after commit-unknown and converges after disconnect", async () => {
    const committedMemory = new Map<string, ReturnType<typeof successfulMemory>>();
    const seenMemoryKeys: string[] = [];
    const memory = {
      async writeBatch(request: Parameters<typeof successfulMemory>[0]) {
        seenMemoryKeys.push(
          (request as { readonly idempotency_key: string })
            .idempotency_key,
        );
        const idempotencyKey = (
          request as { readonly idempotency_key: string }
        ).idempotency_key;
        const existing = committedMemory.get(idempotencyKey);
        if (existing !== undefined) {
          return { ...existing, duplicate_replayed: true };
        }
        const response = successfulMemory(request);
        committedMemory.set(idempotencyKey, response);
        throw new Error("connection lost after owner commit");
      },
    };
    const harness = createHarness({
      memory,
      knowthat: {
        async writeBatch(request) {
          return rejectedKnowThat(request);
        },
      },
      config: {
        downstream_failure_mode: {
          memory: "nonblocking",
          knowthat: "nonblocking",
          skill: "nonblocking",
        },
      },
    });
    const { lease } = await createAndLease(harness);
    const completed = await harness.application.runJob(lease);
    if (completed.outcome !== "completed") {
      throw new Error("expected a partial result");
    }
    const repositoryState = harness.repository.inspect();
    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date(AT),
    });
    operations.seedResult(
      repositoryState.jobs[0]!,
      completed.result,
    );
    for (const command of repositoryState.compensation_commands) {
      operations.seedCompensationCommand(command);
    }
    const memoryCommand = repositoryState.compensation_commands.find(
      ({ target_service }) => target_service === "memory",
    )!;
    expect(memoryCommand.request_payload.dispatch_mode).toBe(
      "original_request_replay",
    );
    expect(
      memoryCommand.request_payload.owner_request.idempotency_key,
    ).toBe(
      memoryCommand.request_payload.failed_item.source_idempotency_key,
    );
    const dispatcher = new MetaOwnerCommandDispatcherV1({
      memory,
      knowthat: {
        async writeBatch(request) {
          return successfulKnowThat(request);
        },
      },
      now: () => new Date(AT),
    });
    await operations.reconcilePendingCommands(
      principal(
        "meta_cognition",
        "meta.command.dispatch",
        "worker-1",
      ),
      dispatcher,
      {
        worker_id: "worker-1",
        limit: 200,
        lease_seconds: 60,
        trace_id: "commit-unknown-reconcile",
      },
    );
    expect(seenMemoryKeys.at(-1)).toBe(
      memoryCommand.request_payload.owner_request.idempotency_key,
    );
    expect(operations.inspect().results[0]?.result_status).toBe(
      "complete",
    );
  });

  it("persists blocking commit-unknown as retry_wait/partial_pending until the reconciler settles it", async () => {
    let disconnectAfterRetryCommit = true;
    const harness = createHarness({
      provider: {
        async generate() {
          return providerOutput({
            memory_writes: [],
            knowthat_candidates: [
              {
                item_id: "fact-blocking-retry",
                payload: {
                  client_item_id: "fact-blocking-retry",
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
              {
                item_id: "fact-blocking-retry-2",
                payload: {
                  client_item_id: "fact-blocking-retry-2",
                  text: "candidate two",
                  subject: "project-1",
                  predicate: "has_fact",
                  object: "candidate-two",
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
        async writeBatch() {
          throw new Error("commit outcome unknown");
        },
      },
      repository_port_factory(repository) {
        return {
          ...repository,
          async commitRetryWait(input) {
            const committed =
              await repository.commitRetryWait(input);
            if (disconnectAfterRetryCommit) {
              disconnectAfterRetryCommit = false;
              throw new Error(
                "simulated retry commit-then-disconnect",
              );
            }
            return committed;
          },
        };
      },
      config: { max_job_attempts: 2 },
    });
    const { created, lease } = await createAndLease(harness);
    const retry = await harness.application.runJob(lease);
    expect(retry).toMatchObject({
      outcome: "retry_wait",
      job: { status: "retry_wait" },
    });
    const repositoryState = harness.repository.inspect();
    expect(repositoryState.results[0]).toMatchObject({
      result_status: "partial_pending",
      finalized_at: null,
    });
    expect(repositoryState.compensation_commands).toHaveLength(2);
    expect(
      repositoryState.compensation_commands.every(
        (command) =>
          command.request_payload.dispatch_mode ===
          "original_request_replay",
      ),
    ).toBe(true);
    const claimFenceOperations =
      new InMemoryMetaOwnerOperationsV1({
        now: () => new Date(AT),
      });
    claimFenceOperations.seedResult(
      repositoryState.jobs[0]!,
      repositoryState.results[0]!,
    );
    for (const command of repositoryState.compensation_commands) {
      claimFenceOperations.seedCompensationCommand(command);
    }
    const firstJobClaim =
      await claimFenceOperations.claimCommands(
        principal(
          "meta_cognition",
          "meta.command.dispatch",
          "claim-worker-1",
        ),
        {
          worker_id: "claim-worker-1",
          limit: 200,
          lease_seconds: 60,
          trace_id: "single-inflight-claim-1",
        },
      );
    expect(firstJobClaim).toHaveLength(1);
    await expect(
      claimFenceOperations.claimCommands(
        principal(
          "meta_cognition",
          "meta.command.dispatch",
          "claim-worker-2",
        ),
        {
          worker_id: "claim-worker-2",
          limit: 200,
          lease_seconds: 60,
          trace_id: "single-inflight-claim-2",
        },
      ),
    ).resolves.toEqual([]);
    await expect(
      harness.application.acquireLease({
        job_id: created.job_id,
        owner_id: "wrong-executor",
        expected_generation: 1,
        trace_id: "blocking-retry-must-be-reconciler-owned",
      }),
    ).rejects.toThrow("reconciler-owned");

    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date(AT),
      max_command_attempts: 1,
    });
    operations.seedResult(
      repositoryState.jobs[0]!,
      repositoryState.results[0]!,
    );
    for (const command of repositoryState.compensation_commands) {
      operations.seedCompensationCommand(command);
    }
    const unavailableDispatcher = new MetaOwnerCommandDispatcherV1({
      memory: {
        async writeBatch() {
          throw new Error("memory unavailable");
        },
      },
      knowthat: {
        async writeBatch() {
          throw new Error("knowthat unavailable");
        },
      },
      now: () => new Date(AT),
    });
    await operations.reconcilePendingCommands(
      principal(
        "meta_cognition",
        "meta.command.dispatch",
        "worker-1",
      ),
      unavailableDispatcher,
      {
        worker_id: "worker-1",
        limit: 200,
        lease_seconds: 60,
        trace_id: "blocking-retry-exhausted",
      },
    );
    expect(operations.inspect().jobs[0]).toMatchObject({
      status: "failed",
      next_retry_at: null,
    });
    expect(operations.inspect().results[0]).toMatchObject({
      result_status: "partial_failed",
      finalized_at: AT,
    });
    expect(
      operations
        .inspect()
        .results[0]?.payload.partial_failures.map(
          ({ status }) => status,
        )
        .sort(),
    ).toEqual(["abandoned", "failed"]);
    expect(
      operations
        .inspect()
        .commands.every(({ status }) => status === "failed"),
    ).toBe(true);
  });

  it("finalizes a retry-exhausted blocking commit-unknown as failed/partial_failed", async () => {
    const committed = new Map<
      string,
      ReturnType<typeof successfulKnowThat>
    >();
    const seenIdempotencyKeys: string[] = [];
    const knowthat = {
      async writeBatch(
        request: Parameters<typeof successfulKnowThat>[0] & {
          readonly idempotency_key: string;
        },
      ) {
        seenIdempotencyKeys.push(request.idempotency_key);
        const existing = committed.get(request.idempotency_key);
        if (existing !== undefined) {
          return { ...existing, duplicate_replayed: true };
        }
        committed.set(
          request.idempotency_key,
          successfulKnowThat(request),
        );
        throw new Error("connection lost after final-attempt owner commit");
      },
    };
    const harness = createHarness({
      provider: {
        async generate() {
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
      knowthat,
      config: { max_job_attempts: 1 },
    });
    const { lease } = await createAndLease(harness);
    const failed = await harness.application.runJob(lease);
    expect(failed).toMatchObject({
      outcome: "failed",
      job: {
        status: "failed",
        attempt_count: 1,
      },
    });

    const repositoryState = harness.repository.inspect();
    expect(repositoryState.results[0]).toMatchObject({
      result_status: "partial_failed",
      finalized_at: AT,
    });
    expect(repositoryState.jobs[0]).toMatchObject({
      status: "failed",
      attempt_count: 1,
    });
    expect(repositoryState.compensation_commands).toHaveLength(0);
    expect(
      repositoryState.events.map(({ event_type }) => event_type),
    ).toContain("meta.job.failed");
    expect(
      repositoryState.events.map(({ event_type }) => event_type),
    ).not.toContain("meta.job.completed");
    expect(
      repositoryState.events.map(({ event_type }) => event_type),
    ).toContain("meta.result.finalized");
    expect(seenIdempotencyKeys).toHaveLength(1);
  });

  it("rolls back an orphan compensation settlement instead of acknowledging the command", async () => {
    const harness = createHarness({
      memory: {
        async writeBatch(request) {
          return rejectedMemory(request);
        },
      },
      knowthat: {
        async writeBatch(request) {
          return rejectedKnowThat(request);
        },
      },
      config: {
        downstream_failure_mode: {
          memory: "nonblocking",
          knowthat: "nonblocking",
          skill: "nonblocking",
        },
      },
    });
    const { lease } = await createAndLease(harness);
    const completed = await harness.application.runJob(lease);
    if (completed.outcome !== "completed") {
      throw new Error("expected a partial result");
    }
    const [orphanCommand] =
      harness.repository.inspect().compensation_commands;
    expect(orphanCommand).toBeDefined();

    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date(AT),
    });
    operations.seedJob(harness.repository.inspect().jobs[0]!);
    operations.seedCompensationCommand(orphanCommand!);
    const worker = principal(
      "meta_cognition",
      "meta.command.dispatch",
      "worker-1",
    );
    const dispatcher = new MetaOwnerCommandDispatcherV1({
      memory: {
        async writeBatch(request) {
          return successfulMemory(request);
        },
      },
      knowthat: {
        async writeBatch(request) {
          return successfulKnowThat(request);
        },
      },
      now: () => new Date(AT),
    });
    await expect(
      operations.reconcilePendingCommands(worker, dispatcher, {
        worker_id: "worker-1",
        limit: 1,
        lease_seconds: 60,
        trace_id: "reconcile-orphan-compensation",
      }),
    ).rejects.toThrow(
      "compensation settlement lost its Meta result owner binding",
    );
    expect(operations.inspect().commands[0]).toMatchObject({
      status: "claimed",
      result_ref: null,
      settlement_id: null,
    });
    expect(operations.inspect().results).toHaveLength(0);
  });

  it("fails active compensation atomically when verified owner delivery exhausts the retry budget", async () => {
    const harness = createHarness({
      memory: {
        async writeBatch(request) {
          return rejectedMemory(request);
        },
      },
      knowthat: {
        async writeBatch(request) {
          return rejectedKnowThat(request);
        },
      },
      config: {
        downstream_failure_mode: {
          memory: "nonblocking",
          knowthat: "nonblocking",
          skill: "nonblocking",
        },
      },
    });
    const { lease } = await createAndLease(harness);
    const completed = await harness.application.runJob(lease);
    if (completed.outcome !== "completed") {
      throw new Error("expected a partial result");
    }
    let nowMs = Date.parse(AT);
    const operations = new InMemoryMetaOwnerOperationsV1({
      now: () => new Date(nowMs),
      max_command_attempts: 2,
    });
    const repositoryState = harness.repository.inspect();
    operations.seedResult(repositoryState.jobs[0]!, completed.result);
    for (const command of repositoryState.compensation_commands) {
      operations.seedCompensationCommand(command);
    }
    const dispatcher = new MetaOwnerCommandDispatcherV1({
      memory: {
        async writeBatch() {
          throw new Error("memory unavailable");
        },
      },
      knowthat: {
        async writeBatch() {
          throw new Error("knowthat unavailable");
        },
      },
      now: () => new Date(nowMs),
    });
    const worker = principal(
      "meta_cognition",
      "meta.command.dispatch",
      "worker-1",
    );
    await operations.reconcilePendingCommands(worker, dispatcher, {
      worker_id: "worker-1",
      limit: 200,
      lease_seconds: 60,
      trace_id: "retry-budget-1",
    });
    expect(operations.inspect().results[0]?.result_status).toBe(
      "partial_pending",
    );
    nowMs += 1_000;
    await operations.reconcilePendingCommands(worker, dispatcher, {
      worker_id: "worker-1",
      limit: 200,
      lease_seconds: 60,
      trace_id: "retry-budget-2",
    });
    const finalState = operations.inspect();
    expect(finalState.results[0]?.result_status).toBe(
      "partial_failed",
    );
    expect(
      finalState.results[0]?.payload.partial_failures.every(
        ({ status }) => status === "failed",
      ),
    ).toBe(true);
    expect(
      finalState.commands.every(({ status }) => status === "failed"),
    ).toBe(true);
  });

  it("keeps the production fallback fail-closed without version-pinned PostgreSQL", async () => {
    const operations = new InMemoryMetaOwnerOperationsV1({
      deployment_mode: "production",
    });
    await expect(operations.checkReadiness()).rejects.toThrow(
      "version-pinned PostgreSQL",
    );
  });
});
