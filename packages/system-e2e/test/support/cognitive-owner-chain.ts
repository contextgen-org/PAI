import { createHash } from "node:crypto";

import type {
  KnowThatWriteBatchRequestV1,
  KnowThatWriteBatchResponseV1,
  MemoryWriteBatchRequestV1,
} from "@pai/contracts";
import { canonicalJsonV1 } from "@pai/eventing";
import {
  createLocalKnowThatCompositionV1,
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
  type MetaProviderOutputV1,
} from "@pai/meta-cognition";
import {
  createTriggerProcessSnapshotReadApplicationV1,
} from "@pai/trigger-processor";

export interface CognitiveOwnerChainInputV1 {
  readonly artifact_ref: string;
  readonly runtime_run_id: string;
  readonly trigger_process_id: string;
  readonly trace_id: string;
  readonly now: string;
  readonly retention_until: string;
  readonly scope: Readonly<{
    workspace_id: string;
    bot_id: string;
    owner_agent_id: string;
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
  }>;
}

function sha256Canonical(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex")}`;
}

function snapshotArtifacts(input: CognitiveOwnerChainInputV1) {
  const artifactEventId =
    `${input.runtime_run_id}:artifact:available`;
  const manifestWithoutHash = {
    schema_version: "trigger_process_snapshot.v1" as const,
    snapshot_id: `snapshot:${input.trigger_process_id}:terminal`,
    snapshot_version: 2,
    trigger_process_id: input.trigger_process_id,
    ...input.scope,
    phase: "closed" as const,
    trigger: {
      trigger_id: `trigger:${input.trigger_process_id}`,
      source: "timer" as const,
      actor_type: "system" as const,
      actor_id: "timer_app",
      payload_ref: `trigger-payload:${input.trigger_process_id}`,
      payload_hash: sha256Canonical({
        trigger_process_id: input.trigger_process_id,
      }),
      accepted_at: input.now,
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
        source_service: "action_runtime" as const,
        source_event_id: artifactEventId,
        source_sequence_no: 2,
        append_sequence_no: 1,
        payload_ref: `runtime_event:${artifactEventId}`,
        payload_hash: sha256Canonical({
          runtime_run_id: input.runtime_run_id,
          artifact_ref: input.artifact_ref,
        }),
        created_at: input.now,
        event_type: "runtime.artifact.created",
        schema_version: "runtime_event.v1",
        occurred_at: input.now,
        runtime_run_id: input.runtime_run_id,
        artifact_refs: [input.artifact_ref],
      },
    ],
    input_event_range: {
      first_append_sequence_no: 1,
      last_append_sequence_no: 1,
    },
    overflow_refs: [],
    last_append_sequence_no: 1,
    last_sequence_by_source: { action_runtime: 2 },
    terminal_outcome: "executed" as const,
    terminal_outcome_finalized_at: input.now,
    canonical_process_id: input.trigger_process_id,
    successor_process_id: null,
    superseded_by_process_id: null,
    snapshot_transfer_ref: null,
    boundary_system_event_ref: null,
    canonical_reason_code: "execution_completed",
    open_loops: [],
    created_at: input.now,
    updated_at: input.now,
    cooldown_until: input.now,
    snapshot_retention_until: input.retention_until,
  };
  const snapshotHash = sha256Canonical(manifestWithoutHash);
  const manifest = {
    ...manifestWithoutHash,
    snapshot_hash: snapshotHash,
  };
  const inlineContent = {
    runtime_run_id: input.runtime_run_id,
    artifact_ref: input.artifact_ref,
    artifact_status: "available",
  };
  const contentChunks = [
    {
      source_service: "action_runtime" as const,
      first_append_sequence_no: 1,
      last_append_sequence_no: 1,
      checksum_algorithm: "sha256" as const,
      checksum: sha256Canonical(inlineContent),
      inline_content: inlineContent,
      retention_until: input.retention_until,
      redaction_state: "complete" as const,
    },
  ];
  return {
    snapshot_ref: `snapshot:${input.trigger_process_id}:terminal`,
    snapshot_hash: snapshotHash,
    manifest,
    content_chunks: contentChunks,
  };
}

function providerOutput(
  input: CognitiveOwnerChainInputV1,
): MetaProviderOutputV1 {
  const artifactEvidenceRef = `artifact:${input.artifact_ref}`;
  return {
    schema_version: "meta_provider_output.v1",
    summary: "The Runtime artifact was durably observed by Meta.",
    execution_summary: {
      completed_stage_count: 1,
      runtime_run_id: input.runtime_run_id,
      terminal_artifact_ref: input.artifact_ref,
    },
    reflection_summary:
      "The exact available Runtime artifact was propagated to owner writes.",
    evidence_refs: [artifactEvidenceRef],
    quality_score: 0.95,
    memory_writes: [
      {
        item_id: "memory-runtime-artifact-system-e2e",
        payload: {
          client_item_id: "memory-runtime-artifact-system-e2e",
          content_summary:
            "The Day19 Runtime artifact completed and was consumed by Meta.",
          subject_refs: [
            {
              subject_type: "project",
              canonical_id: "pai",
              primary: true,
            },
          ],
          human_agent_relation: [],
          keyword_tags: ["day19", "runtime-artifact"],
          scene_tags: ["implementation"],
          emotion_tags: ["neutral"],
          source_info: {
            source_type: "tool_result",
            source_ref: artifactEvidenceRef,
            actor_type: "system",
            trace_id: input.trace_id,
          },
          confidence_score: 0.95,
          occurred_at: input.now,
        },
        evidence_refs: [artifactEvidenceRef],
      },
    ],
    knowthat_candidates: [
      {
        item_id: "fact-runtime-artifact-system-e2e",
        payload: {
          client_item_id: "fact-runtime-artifact-system-e2e",
          text: "The PAI Day19 Runtime artifact has durable owner evidence.",
          subject: "PAI Day19 Runtime artifact",
          predicate: "has_evidence_state",
          object: "durable",
          category: "project_fact",
          proposed_status: "candidate",
          direct_active_hint: false,
          risk_level: "low",
          explicitness: "inferred",
          confidence: 0.8,
          source: "meta_inference",
          source_ref: artifactEvidenceRef,
          evidence_refs: [artifactEvidenceRef],
          evidence_pending: false,
        },
        evidence_refs: [artifactEvidenceRef],
      },
    ],
    skill_candidates: [],
    quality_signals: [],
  };
}

export async function runCognitiveOwnerChainV1(
  input: CognitiveOwnerChainInputV1,
) {
  const snapshot = snapshotArtifacts(input);
  const snapshotOwner =
    createTriggerProcessSnapshotReadApplicationV1(
      {
        async readExactSnapshot(request) {
          if (
            request.trigger_process_id !==
              input.trigger_process_id ||
            request.snapshot_ref !== snapshot.snapshot_ref
          ) {
            return { outcome: "not_found" as const };
          }
          return {
            outcome: "found" as const,
            metadata: {
              snapshot_id: snapshot.manifest.snapshot_id,
              trigger_process_id: input.trigger_process_id,
              ...input.scope,
              schema_version: "trigger_process_snapshot.v1",
              snapshot_version: 2,
              snapshot_hash: snapshot.snapshot_hash,
              snapshot_ref: snapshot.snapshot_ref,
              first_append_sequence_no: 1,
              last_append_sequence_no: 1,
              status: "current" as const,
              retention_until: input.retention_until,
              overflow_refs: [],
            },
          };
        },
      },
      {
        async materialize() {
          return {
            snapshot_manifest: snapshot.manifest,
            content_chunks: snapshot.content_chunks,
          };
        },
      },
      { now: () => new Date(input.now) },
    );
  const memory = createLocalMemoryCompositionV1().application;
  const metaMemoryPrincipal: MemoryPrincipalV1 = {
    caller: "meta_cognition",
    capabilities: ["memory.write"],
    scope: input.scope,
  };
  const knowThatMemoryPrincipal: MemoryPrincipalV1 = {
    caller: "knowthat",
    capabilities: [
      "memory.pre_promotion_check",
      "memory.promotion_reservation.ack",
      "memory.promotion_reservation.release",
    ],
    scope: input.scope,
  };
  const promotion: KnowThatMemoryPrePromotionPortV1 = {
    check(request, signal) {
      if (signal?.aborted === true) throw signal.reason;
      return memory.checkPrePromotion(
        knowThatMemoryPrincipal,
        request,
        new Date(input.now),
      );
    },
    validate(request, signal) {
      if (signal?.aborted === true) throw signal.reason;
      return memory.validatePrePromotion(
        knowThatMemoryPrincipal,
        request,
        new Date(input.now),
      );
    },
    ack(request, signal) {
      if (signal?.aborted === true) throw signal.reason;
      return memory.ackPromotionReservation(
        knowThatMemoryPrincipal,
        request,
      );
    },
    release(request, signal) {
      if (signal?.aborted === true) throw signal.reason;
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
  const memoryRequests: MemoryWriteBatchRequestV1[] = [];
  const knowThatRequests: KnowThatWriteBatchRequestV1[] = [];
  let providerCalls = 0;
  const repository = createInMemoryMetaJobRepositoryV1({
    id_factory: (() => {
      let sequence = 0;
      return () => `meta-artifact-id-${(sequence += 1)}`;
    })(),
  });
  const application = createMetaJobApplicationV1(
    {
      repository,
      snapshot_resolver: {
        async resolve(request) {
          return snapshotOwner.resolve(
            {
              service_id: "meta_cognition",
              capability: "trigger.process.snapshot.resolve",
              scope: input.scope,
            },
            request,
          );
        },
        async checkReadiness() {},
      },
      provider: {
        async generate(prompt) {
          providerCalls += 1;
          if (!prompt.includes(input.artifact_ref)) {
            throw new Error(
              "Meta did not receive the exact available Runtime artifact",
            );
          }
          return providerOutput(input);
        },
        async checkReadiness() {},
      },
      memory: {
        async writeBatch(
          request: MemoryWriteBatchRequestV1,
          signal: AbortSignal,
        ) {
          if (signal.aborted) throw signal.reason;
          memoryRequests.push(structuredClone(request));
          return memory.writeBatch(metaMemoryPrincipal, request, {
            raw_body_bytes: Buffer.byteLength(
              JSON.stringify(request),
              "utf8",
            ),
            now: new Date(input.now),
          });
        },
        async checkReadiness(signal: AbortSignal) {
          if (signal.aborted) throw signal.reason;
          await memory.checkReadiness();
        },
      },
      knowthat: {
        async writeBatch(
          request: KnowThatWriteBatchRequestV1,
          signal: AbortSignal,
        ) {
          if (signal.aborted) throw signal.reason;
          knowThatRequests.push(structuredClone(request));
          return structuredClone(
            await knowthat.writeBatch(
              request,
              new Date(input.now),
            ),
          ) as unknown as KnowThatWriteBatchResponseV1;
        },
        async checkReadiness(signal: AbortSignal) {
          if (signal.aborted) throw signal.reason;
          await knowthat.checkReadiness(signal);
        },
      },
    },
    resolveMetaCognitionConfigV1(),
    {
      now: () => new Date(input.now),
      random: () => 0,
    },
  );
  const created = await application.createJob({
    schema_version: "meta_job_create.v1",
    trigger_process_id: input.trigger_process_id,
    ...input.scope,
    snapshot_ref: `snapshot:${input.trigger_process_id}:terminal`,
    snapshot_version: 2,
    snapshot_hash: snapshot.snapshot_hash,
    snapshot_retention_until: input.retention_until,
    cooldown_until: input.now,
    boundary_system_event_ref: null,
    learnable_snapshot_ready: true,
    enqueue_reason: "cooldown_expired",
    idempotency_key: input.trigger_process_id,
    trace_id: input.trace_id,
  });
  const lease = await application.acquireLease({
    job_id: created.job_id,
    owner_id: "meta-runtime-artifact-system-e2e",
    expected_generation: 0,
    trace_id: `${input.trace_id}:meta-lease`,
  });
  const result = await application.runJob(lease);
  return Object.freeze({
    created,
    result,
    provider_calls: providerCalls,
    memory_requests: Object.freeze(memoryRequests),
    knowthat_requests: Object.freeze(knowThatRequests),
    inspection: repository.inspect(),
  });
}
