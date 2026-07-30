import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  KnowThatWriteBatchResponseV1,
  KnowThatWriteBatchRequestV1,
  MemoryWriteBatchRequestV1,
} from "@pai/contracts";
import {
  createLocalKnowThatCompositionV1,
  knowThatScopeFingerprintV1,
  type KnowThatMemoryPrePromotionPortV1,
} from "@pai/knowthat";
import {
  createLocalMemoryCompositionV1,
  type MemoryPrincipalV1,
} from "@pai/memory";
import {
  createInMemoryMetaJobRepositoryV1,
  createMetaJobApplicationV1,
  resolveMetaCognitionConfigV1,
  type MetaJobCreateRequestV1,
  type MetaJobRepositoryPortV1,
  type MetaProviderOutputV1,
} from "@pai/meta-cognition";
import { canonicalJsonV1 } from "@pai/eventing";

const at = "2026-07-24T06:00:00.000Z";
const retention = "2026-07-24T07:00:00.000Z";
const scope = Object.freeze({
  workspace_id: "workspace-system-e2e",
  bot_id: "bot-system-e2e",
  owner_agent_id: "agent-system-e2e",
  deployment_environment: "dev",
  release_channel: "stable",
} as const);

function sha256Canonical(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function metaRequest(): MetaJobCreateRequestV1 {
  const snapshotHash = snapshotRead().snapshot_manifest.snapshot_hash;
  return {
    schema_version: "meta_job_create.v1",
    trigger_process_id: "process-system-e2e",
    ...scope,
    snapshot_ref: "snapshot:process-system-e2e:terminal",
    snapshot_version: 2,
    snapshot_hash: snapshotHash,
    snapshot_retention_until: retention,
    cooldown_until: at,
    boundary_system_event_ref: null,
    learnable_snapshot_ready: true,
    enqueue_reason: "cooldown_expired",
    idempotency_key: "process-system-e2e",
    trace_id: "trace-system-e2e",
  };
}

function snapshotRead() {
  const manifestWithoutHash = {
    schema_version: "trigger_process_snapshot.v1" as const,
    snapshot_id: "snapshot-system-e2e",
    snapshot_version: 2,
    trigger_process_id: "process-system-e2e",
    ...scope,
    phase: "closed" as const,
    trigger: {
      trigger_id: "trigger-system-e2e",
      source: "timer" as const,
      actor_type: "system" as const,
      actor_id: "timer_app",
      payload_ref: "trigger-payload:system-e2e",
      payload_hash: `sha256:${"2".repeat(64)}`,
      accepted_at: at,
    },
    context_snapshot: null,
    intent: null,
    runtime_run_id: null,
    policy_snapshot_id: null,
    runtime_state: null,
    action_trace: [],
    tool_results: [],
    event_trace: [
      {
        source_service: "trigger_processor" as const,
        source_event_id: "process-system-e2e-terminal",
        source_sequence_no: 1,
        append_sequence_no: 1,
        payload_ref: "trigger-event:process-system-e2e-terminal",
        payload_hash: `sha256:${"2".repeat(64)}`,
        created_at: at,
        event_type: "trigger_process.outcome_finalized",
        schema_version: "trigger_processor_event.v1",
        occurred_at: at,
        runtime_run_id: null,
        artifact_refs: [],
      },
    ],
    input_event_range: {
      first_append_sequence_no: 1,
      last_append_sequence_no: 1,
    },
    overflow_refs: [],
    last_append_sequence_no: 1,
    last_sequence_by_source: { trigger_processor: 1 },
    terminal_outcome: "executed" as const,
    terminal_outcome_finalized_at: at,
    canonical_process_id: "process-system-e2e",
    successor_process_id: null,
    superseded_by_process_id: null,
    snapshot_transfer_ref: null,
    boundary_system_event_ref: null,
    canonical_reason_code: "execution_completed",
    open_loops: [],
    created_at: "2026-07-24T05:59:00.000Z",
    updated_at: at,
    cooldown_until: at,
    snapshot_retention_until: retention,
  };
  const manifest = {
    ...manifestWithoutHash,
    snapshot_hash: sha256Canonical(manifestWithoutHash),
  };
  const inlineContent = {
    source_event_id: "process-system-e2e-terminal",
  };
  return {
    schema_version: "trigger_process_snapshot_read.v1" as const,
    snapshot_ref: "snapshot:process-system-e2e:terminal",
    snapshot_manifest: manifest,
    content_chunks: [
      {
        source_service: "trigger_processor" as const,
        first_append_sequence_no: 1,
        last_append_sequence_no: 1,
        checksum_algorithm: "sha256" as const,
        checksum: sha256Canonical(inlineContent),
        inline_content: inlineContent,
        retention_until: retention,
        redaction_state: "not_required" as const,
      },
    ],
    resolved_at: at,
  };
}

function providerOutput(): MetaProviderOutputV1 {
  const processRef = "trigger_process:process-system-e2e";
  return {
    schema_version: "meta_provider_output.v1",
    summary: "The durable system flow completed.",
    execution_summary: {
      completed_stage_count: 1,
    },
    reflection_summary: "Owner writes must remain idempotent.",
    evidence_refs: [processRef],
    quality_score: 0.95,
    memory_writes: [
      {
        item_id: "memory-system-e2e",
        payload: {
          client_item_id: "memory-system-e2e",
          content_summary: "The Day19 system flow completed durably.",
          subject_refs: [
            {
              subject_type: "project",
              canonical_id: "pai",
              primary: true,
            },
          ],
          human_agent_relation: [],
          keyword_tags: ["day19", "durability"],
          scene_tags: ["implementation"],
          emotion_tags: ["neutral"],
          source_info: {
            source_type: "trigger_snapshot",
            source_ref: processRef,
            actor_type: "system",
            trace_id: "trace-system-e2e",
          },
          confidence_score: 0.95,
          occurred_at: at,
        },
        evidence_refs: [processRef],
      },
    ],
    knowthat_candidates: [
      {
        item_id: "fact-system-e2e",
        payload: {
          client_item_id: "fact-system-e2e",
          text: "PAI Day19 system evidence is durable.",
          subject: "PAI Day19",
          predicate: "has_evidence_state",
          object: "durable",
          category: "project_fact",
          proposed_status: "candidate",
          direct_active_hint: false,
          risk_level: "low",
          explicitness: "inferred",
          confidence: 0.8,
          source: "meta_inference",
          source_ref: processRef,
          evidence_refs: [processRef],
          evidence_pending: false,
        },
        evidence_refs: [processRef],
      },
    ],
    skill_candidates: [],
    quality_signals: [],
  };
}

function ownerClients() {
  const memory = createLocalMemoryCompositionV1().application;
  const metaMemoryPrincipal: MemoryPrincipalV1 = {
    caller: "meta_cognition",
    capabilities: ["memory.write"],
    scope,
  };
  const knowThatMemoryPrincipal: MemoryPrincipalV1 = {
    caller: "knowthat",
    capabilities: [
      "memory.pre_promotion_check",
      "memory.promotion_reservation.ack",
      "memory.promotion_reservation.release",
    ],
    scope,
  };
  const promotion: KnowThatMemoryPrePromotionPortV1 = {
    check(request, _signal) {
      return memory.checkPrePromotion(
        knowThatMemoryPrincipal,
        request,
        new Date(at),
      );
    },
    validate(request, _signal) {
      return memory.validatePrePromotion(
        knowThatMemoryPrincipal,
        request,
        new Date(at),
      );
    },
    ack(request, _signal) {
      return memory.ackPromotionReservation(
        knowThatMemoryPrincipal,
        request,
      );
    },
    release(request, _signal) {
      return memory.releasePromotionReservation(
        knowThatMemoryPrincipal,
        request,
      );
    },
    async checkReadiness() {
      await memory.checkReadiness();
    },
  };
  const knowthat = createLocalKnowThatCompositionV1(promotion).application;
  let memoryWrites = 0;
  let knowThatWrites = 0;
  const memoryRequests: MemoryWriteBatchRequestV1[] = [];
  const knowThatRequests: KnowThatWriteBatchRequestV1[] = [];
  return {
    memory,
    knowthat,
    memoryRequests,
    knowThatRequests,
    counts() {
      return { memory: memoryWrites, knowthat: knowThatWrites };
    },
    memoryPort: {
      async writeBatch(
        request: MemoryWriteBatchRequestV1,
        signal: AbortSignal,
      ) {
        if (signal.aborted) throw signal.reason;
        memoryWrites += 1;
        memoryRequests.push(structuredClone(request));
        return memory.writeBatch(metaMemoryPrincipal, request, {
          raw_body_bytes: Buffer.byteLength(
            JSON.stringify(request),
            "utf8",
          ),
          now: new Date(at),
        });
      },
      async checkReadiness(signal: AbortSignal) {
        if (signal.aborted) throw signal.reason;
        await memory.checkReadiness();
      },
    },
    knowThatPort: {
      async writeBatch(
        request: KnowThatWriteBatchRequestV1,
        signal: AbortSignal,
      ) {
        if (signal.aborted) throw signal.reason;
        knowThatWrites += 1;
        knowThatRequests.push(structuredClone(request));
        return structuredClone(
          await knowthat.writeBatch(request, new Date(at)),
        ) as unknown as KnowThatWriteBatchResponseV1;
      },
      async checkReadiness(signal: AbortSignal) {
        if (signal.aborted) throw signal.reason;
        await knowthat.checkReadiness(signal);
      },
    },
  };
}

describe("Meta owner clients to Memory and KnowThat", () => {
  it("[Day19 P0 #6-meta, process-internal] restarts after a terminal commit disconnect without repeating either owner write", async () => {
    const clients = ownerClients();
    const repository = createInMemoryMetaJobRepositoryV1({
      id_factory: (() => {
        let sequence = 0;
        return () => `meta-owner-id-${(sequence += 1)}`;
      })(),
    });
    let disconnectAfterCommit = true;
    const repositoryPort: MetaJobRepositoryPortV1 = {
      ...repository,
      async commitCompleted(input) {
        const committed = await repository.commitCompleted(input);
        if (disconnectAfterCommit) {
          disconnectAfterCommit = false;
          throw new Error(
            "connection closed after Meta terminal owner commit",
          );
        }
        return committed;
      },
    };
    let providerCalls = 0;
    const dependencies = {
      repository: repositoryPort,
      snapshot_resolver: {
        async resolve() {
          return snapshotRead();
        },
        async checkReadiness() {},
      },
      provider: {
        async generate() {
          providerCalls += 1;
          return providerOutput();
        },
        async checkReadiness() {},
      },
      memory: clients.memoryPort,
      knowthat: clients.knowThatPort,
    };
    const createApplication = () =>
      createMetaJobApplicationV1(
        dependencies,
        resolveMetaCognitionConfigV1(),
        {
          now: () => new Date(at),
          random: () => 0,
        },
      );
    const application = createApplication();

    const created = await application.createJob(metaRequest());
    const duplicate = await application.createJob(
      structuredClone(metaRequest()),
    );
    expect(created.duplicate_replayed).toBe(false);
    expect(duplicate).toMatchObject({
      job_id: created.job_id,
      duplicate_replayed: true,
    });
    const lease = await application.acquireLease({
      job_id: created.job_id,
      owner_id: "meta-worker-system-e2e",
      expected_generation: 0,
      trace_id: "trace-meta-lease-system-e2e",
    });
    await expect(application.runJob(lease)).rejects.toThrow(
      "connection closed after Meta terminal owner commit",
    );
    expect((await application.readJob(created.job_id))?.status).toBe(
      "completed",
    );
    expect(clients.counts()).toEqual({ memory: 1, knowthat: 1 });
    expect(providerCalls).toBe(1);

    const restartedApplication = createApplication();
    const replay = await restartedApplication.runJob(lease);
    expect(replay.outcome).toBe("replayed");
    if (replay.outcome !== "replayed") {
      throw new Error("expected replayed Meta result");
    }
    expect(replay.result.payload.memory_write_result.status).toBe(
      "succeeded",
    );
    expect(replay.result.payload.knowthat_write_result.status).toBe(
      "succeeded",
    );
    expect(clients.counts()).toEqual({ memory: 1, knowthat: 1 });
    expect(providerCalls).toBe(1);
    expect(clients.memoryRequests[0]).toMatchObject({
      bot_id: scope.bot_id,
      trigger_process_id: "process-system-e2e",
      items: [{ client_item_id: "memory-system-e2e" }],
    });
    expect(clients.knowThatRequests[0]).toMatchObject({
      ...scope,
      trigger_process_id: "process-system-e2e",
      items: [{ client_item_id: "fact-system-e2e" }],
    });
    const inspection = repository.inspect();
    expect(inspection.results).toHaveLength(1);
    expect(inspection.events.map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "meta.memory.write_requested",
        "meta.knowthat.write_requested",
        "meta.result.finalized",
        "meta.job.completed",
      ]),
    );
  });

  it("[Day20 P1 promotion] replays a Memory reservation after validate commit-disconnect and trace rotation", async () => {
    const protocolNow = new Date();
    const memory = createLocalMemoryCompositionV1().application;
    const metaMemoryPrincipal: MemoryPrincipalV1 = {
      caller: "meta_cognition",
      capabilities: ["memory.write"],
      scope,
    };
    const knowThatMemoryPrincipal: MemoryPrincipalV1 = {
      caller: "knowthat",
      capabilities: [
        "memory.pre_promotion_check",
        "memory.promotion_reservation.ack",
        "memory.promotion_reservation.release",
      ],
      scope,
    };
    const writePoint = async (
      triggerProcessId: string,
      clientItemId: string,
    ): Promise<string> => {
      const request: MemoryWriteBatchRequestV1 = {
        schema_version: "memory.write_batch.v1",
        bot_id: scope.bot_id,
        trigger_process_id: triggerProcessId,
        source_meta_job_id: `meta-${triggerProcessId}`,
        idempotency_key: `memory-${triggerProcessId}`,
        items: [
          {
            client_item_id: clientItemId,
            content_summary: `Durable evidence from ${triggerProcessId}`,
            subject_refs: [
              {
                subject_type: "project",
                canonical_id: clientItemId,
                primary: true,
              },
            ],
            human_agent_relation: [],
            keyword_tags: ["promotion", clientItemId],
            scene_tags: ["implementation"],
            emotion_tags: ["neutral"],
            source_info: {
              source_type: "trigger_snapshot",
              source_ref: `trigger_process:${triggerProcessId}`,
              actor_type: "system",
              trace_id: `trace-${triggerProcessId}`,
            },
            confidence_score: 0.95,
            occurred_at: protocolNow.toISOString(),
          },
        ],
      };
      const response = await memory.writeBatch(
        metaMemoryPrincipal,
        request,
        {
          raw_body_bytes: Buffer.byteLength(
            JSON.stringify(request),
            "utf8",
          ),
          now: protocolNow,
        },
      );
      const result = response.item_results[0];
      if (
        result?.status !== "succeeded" ||
        result.memory_point_id === undefined
      ) {
        throw new Error("Memory evidence point was not created");
      }
      return result.memory_point_id;
    };
    const firstPointId = await writePoint(
      "process-promotion-a",
      "promotion-evidence-a",
    );
    const secondPointId = await writePoint(
      "process-promotion-b",
      "promotion-evidence-b",
    );

    let validateCalls = 0;
    let disconnectAfterReservationCommit = true;
    const promotion: KnowThatMemoryPrePromotionPortV1 = {
      check(request, signal) {
        if (signal.aborted) throw signal.reason;
        return memory.checkPrePromotion(
          knowThatMemoryPrincipal,
          request,
          protocolNow,
        );
      },
      async validate(request, signal) {
        if (signal.aborted) throw signal.reason;
        validateCalls += 1;
        const reservation = await memory.validatePrePromotion(
          knowThatMemoryPrincipal,
          request,
          protocolNow,
        );
        if (disconnectAfterReservationCommit) {
          disconnectAfterReservationCommit = false;
          throw new Error(
            "connection closed after Memory reservation commit",
          );
        }
        return reservation;
      },
      ack(request, signal) {
        if (signal.aborted) throw signal.reason;
        return memory.ackPromotionReservation(
          knowThatMemoryPrincipal,
          request,
        );
      },
      release(request, signal) {
        if (signal.aborted) throw signal.reason;
        return memory.releasePromotionReservation(
          knowThatMemoryPrincipal,
          request,
        );
      },
      async checkReadiness() {
        await memory.checkReadiness();
      },
    };
    const knowthat =
      createLocalKnowThatCompositionV1(promotion).application;
    const writeResponse = await knowthat.writeBatch(
      {
        schema_version: "knowthat.write_batch.v1",
        ...scope,
        trigger_process_id: "process-promotion-review",
        source_meta_job_id: "meta-promotion-review",
        idempotency_key: "knowthat-promotion-review",
        trace_id: "trace-promotion-write",
        items: [
          {
            client_item_id: "candidate-promotion-review",
            text: "Promotion protocol survives an ambiguous reservation commit.",
            subject: "promotion protocol",
            predicate: "commit_unknown_recovery",
            object: "durable",
            category: "project_fact",
            proposed_status: "candidate",
            direct_active_hint: false,
            risk_level: "low",
            explicitness: "inferred",
            confidence: 0.8,
            source: "meta_inference",
            source_ref: `memory_point:${firstPointId}`,
            evidence_refs: [
              `memory_point:${firstPointId}`,
              `memory_point:${secondPointId}`,
            ],
            evidence_pending: true,
            evidence_pending_reason: "awaiting promotion validation",
          },
        ],
      },
      protocolNow,
    );
    const candidateId = writeResponse.candidate_fact_ids[0];
    if (candidateId === undefined) {
      throw new Error("KnowThat candidate was not created");
    }
    const suggestionId = "promotion-commit-unknown";
    const sourceMetaJobId = "meta-promotion-commit-unknown";
    const sourcePayload = {
      candidate_id: candidateId,
      suggestion_id: suggestionId,
      source_meta_job_id: sourceMetaJobId,
    };
    const sourceIdempotencyKey =
      `meta-review:${sourceMetaJobId}:${suggestionId}`;
    const reviewRequest = {
      schema_version: "knowthat.candidate_review.v1",
      ...scope,
      candidate_id: candidateId,
      suggestion_id: suggestionId,
      source_meta_job_id: sourceMetaJobId,
      target_candidate_version: 1,
      suggested_action: "promote",
      reason: "independent Memory evidence passed",
      new_evidence_refs: [`memory_point:${firstPointId}`],
      risk_level: "low",
      confidence_delta: 0.1,
      validation_profile: "standard",
      idempotency_key: `candidate_review:${sourceMetaJobId}:${suggestionId}`,
      trace_id: "trace-promotion-first",
      source_event: {
        ...scope,
        source: "meta_cognition",
        event_id: `event-${suggestionId}`,
        idempotency_key: sourceIdempotencyKey,
        payload_hash: sha256Canonical(sourcePayload),
        semantic_hash: sha256Canonical({
          source: "meta_cognition",
          idempotency_key: sourceIdempotencyKey,
          payload: sourcePayload,
        }),
        scope_fingerprint: knowThatScopeFingerprintV1(scope),
        payload: sourcePayload,
      },
    };

    await expect(
      knowthat.reviewCandidate(
        candidateId,
        reviewRequest,
        new AbortController().signal,
        protocolNow,
      ),
    ).rejects.toMatchObject({
      code: "promotion_reservation_unavailable",
      retryable: true,
    });
    const recovered = await knowthat.reviewCandidate(
      candidateId,
      {
        ...reviewRequest,
        trace_id: "trace-promotion-retry",
      },
      new AbortController().signal,
      protocolNow,
    );
    expect(recovered).toMatchObject({
      status: "accepted",
      decision: "promote",
      reason_code: "promoted",
      duplicate_replayed: false,
    });
    expect(validateCalls).toBe(2);
  });
});
