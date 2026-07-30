import type {
  KnowThatWriteBatchRequestV1,
  MemoryWriteBatchRequestV1,
} from "@pai/contracts";
import { createHash } from "node:crypto";

import {
  canonicalJsonV1,
  createInMemoryMetaJobRepositoryV1,
  createMetaJobApplicationV1,
  resolveMetaCognitionConfigV1,
  type MetaCognitionConfigV1,
  type MetaJobCreateRequestV1,
  type MetaJobRepositoryPortV1,
  type MetaKnowThatCandidatePortV1,
  type MetaMemoryWritePortV1,
  type MetaProviderOutputV1,
  type StructuredMetaProviderPortV1,
  type TriggerProcessSnapshotResolverPortV1,
} from "../src/index.js";

export const AT = "2026-07-23T00:00:00.000Z";
export const RETENTION = "2026-07-23T01:00:00.000Z";

function baseSnapshotWithoutHashV1(): Record<string, unknown> {
  return {
    schema_version: "trigger_process_snapshot.v1",
    snapshot_id: "snapshot-1",
    snapshot_version: 1,
    trigger_process_id: "process-1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    phase: "admission",
    trigger: {
      trigger_id: "trigger-1",
      source: "chat",
      actor_type: "user",
      actor_id: "user-1",
      payload_ref: "trigger-payload-1",
      payload_hash: `sha256:${"2".repeat(64)}`,
      accepted_at: AT,
    },
    context_snapshot: null,
    intent: null,
    runtime_run_id: null,
    policy_snapshot_id: null,
    runtime_state: null,
    action_trace: [],
    tool_results: [],
    event_trace: [],
    input_event_range: {
      first_append_sequence_no: 0,
      last_append_sequence_no: 0,
    },
    overflow_refs: [],
    last_append_sequence_no: 0,
    last_sequence_by_source: {},
    terminal_outcome: null,
    terminal_outcome_finalized_at: null,
    canonical_process_id: null,
    successor_process_id: null,
    superseded_by_process_id: null,
    snapshot_transfer_ref: null,
    boundary_system_event_ref: null,
    canonical_reason_code: null,
    open_loops: [],
    created_at: AT,
    updated_at: AT,
    cooldown_until: "2026-07-23T00:10:00.000Z",
    snapshot_retention_until: RETENTION,
  };
}

export function snapshotHashForFixtureV1(
  snapshot: Readonly<Record<string, unknown>>,
): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(
      canonicalJsonV1(
        Object.fromEntries(
          Object.entries(snapshot).filter(([key]) => key !== "snapshot_hash"),
        ),
      ),
      "utf8",
    )
    .digest("hex")}`;
}

export const SNAPSHOT_HASH =
  snapshotHashForFixtureV1(baseSnapshotWithoutHashV1());

export function createRequest(
  overrides: Partial<MetaJobCreateRequestV1> = {},
): MetaJobCreateRequestV1 {
  return {
    schema_version: "meta_job_create.v1",
    trigger_process_id: "process-1",
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "dev",
    release_channel: "stable",
    snapshot_ref: "snapshot-ref-1",
    snapshot_version: 1,
    snapshot_hash: SNAPSHOT_HASH,
    snapshot_retention_until: RETENTION,
    cooldown_until: "2026-07-23T00:10:00.000Z",
    boundary_system_event_ref: null,
    learnable_snapshot_ready: true,
    enqueue_reason: "cooldown_expired",
    idempotency_key: "process-1",
    trace_id: "trace-1",
    ...overrides,
  };
}

export function validSnapshotRead(
  overrides: Readonly<{
    read?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
  }> = {},
): any {
  const snapshot = {
    ...baseSnapshotWithoutHashV1(),
    snapshot_hash: SNAPSHOT_HASH,
    ...(overrides.snapshot ?? {}),
  };
  return {
    schema_version: "trigger_process_snapshot_read.v1",
    snapshot_ref: "snapshot-ref-1",
    snapshot_manifest: snapshot,
    content_chunks: [],
    resolved_at: AT,
    ...(overrides.read ?? {}),
  };
}

export function providerOutput(
  overrides: Partial<MetaProviderOutputV1> = {},
): MetaProviderOutputV1 {
  return {
    schema_version: "meta_provider_output.v1",
    summary: "summary",
    execution_summary: { completed_stage_count: 1 },
    reflection_summary: "reflection",
    evidence_refs: ["trigger_process:process-1"],
    quality_score: 0.9,
    memory_writes: [
      {
        item_id: "memory-1",
        payload: {
          client_item_id: "memory-1",
          content_summary: "learned",
          subject_refs: [{ subject_type: "user", canonical_id: "user-1" }],
          human_agent_relation: [],
          keyword_tags: ["learned"],
          scene_tags: ["implementation"],
          emotion_tags: ["neutral"],
          source_info: {
            source_type: "trigger_snapshot",
            source_ref: "trigger_process:process-1",
            actor_type: "system",
          },
          confidence_score: 0.9,
          occurred_at: AT,
        },
        evidence_refs: ["trigger_process:process-1"],
      },
    ],
    knowthat_candidates: [],
    skill_candidates: [],
    quality_signals: [],
    ...overrides,
  };
}

function memorySuccessResult(request: MemoryWriteBatchRequestV1) {
  return {
    schema_version: "memory.write_batch.v1" as const,
    write_batch_id: `memory-batch:${request.source_meta_job_id}`,
    batch_status: "completed" as const,
    item_results: request.items.map((item, index) => ({
      client_item_id: item.client_item_id,
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

function knowthatSuccessResult(request: KnowThatWriteBatchRequestV1) {
  return {
    schema_version: "knowthat.write_batch.v1" as const,
    write_batch_id: `knowthat-batch:${request.source_meta_job_id}`,
    batch_status: "completed" as const,
    item_results: request.items.map((item, index) => ({
      client_item_id: item.client_item_id,
      status: "succeeded" as const,
      semantic_key: `${request.bot_id}:${item.category}:${item.subject}:${item.predicate}`,
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

export function createHarness(
  overrides: Readonly<{
    snapshot_resolver?: TriggerProcessSnapshotResolverPortV1;
    provider?: StructuredMetaProviderPortV1;
    memory?: MetaMemoryWritePortV1;
    knowthat?: MetaKnowThatCandidatePortV1;
    repository_port_factory?: (
      repository: ReturnType<typeof createInMemoryMetaJobRepositoryV1>,
    ) => MetaJobRepositoryPortV1;
    config?: Partial<MetaCognitionConfigV1>;
    now?: string;
  }> = {},
) {
  let milliseconds = Date.parse(overrides.now ?? AT);
  let providerCalls = 0;
  let memoryCalls = 0;
  let knowthatCalls = 0;
  const knowthatRequests: KnowThatWriteBatchRequestV1[] = [];
  const repository = createInMemoryMetaJobRepositoryV1({
    id_factory: (() => {
      let id = 0;
      return () => `id-${(id += 1)}`;
    })(),
  });
  const repositoryPort =
    overrides.repository_port_factory?.(repository) ?? repository;
  const snapshotResolver =
    overrides.snapshot_resolver ??
    ({
      async resolve() {
        return validSnapshotRead();
      },
      async checkReadiness() {},
    } satisfies TriggerProcessSnapshotResolverPortV1);
  const provider =
    overrides.provider ??
    ({
      async generate() {
        providerCalls += 1;
        return providerOutput();
      },
      async checkReadiness() {},
    } satisfies StructuredMetaProviderPortV1);
  const memory =
    overrides.memory ??
    ({
      async writeBatch(request) {
        memoryCalls += 1;
        return memorySuccessResult(request);
      },
      async checkReadiness() {},
    } satisfies MetaMemoryWritePortV1);
  const knowthat =
    overrides.knowthat ??
    ({
      async writeBatch(request) {
        knowthatCalls += 1;
        knowthatRequests.push(request);
        return knowthatSuccessResult(request);
      },
      async checkReadiness() {},
    } satisfies MetaKnowThatCandidatePortV1);
  const config = resolveMetaCognitionConfigV1(overrides.config ?? {});
  const application = createMetaJobApplicationV1(
    {
      repository: repositoryPort,
      snapshot_resolver: snapshotResolver,
      provider,
      memory,
      knowthat,
    },
    config,
    { now: () => new Date(milliseconds) },
  );
  return {
    application,
    repository,
    config,
    now: () => new Date(milliseconds),
    advance(millisecondsToAdd: number) {
      milliseconds += millisecondsToAdd;
    },
    counts() {
      return {
        provider: providerCalls,
        memory: memoryCalls,
        knowthat: knowthatCalls,
        skill: 0,
      };
    },
    knowthatRequests,
  };
}

export async function createAndLease(
  harness: ReturnType<typeof createHarness>,
) {
  const created = await harness.application.createJob(createRequest());
  const lease = await harness.application.acquireLease({
    job_id: created.job_id,
    owner_id: "worker-1",
    expected_generation: 0,
    trace_id: "trace-lease-1",
  });
  return { created, lease };
}
