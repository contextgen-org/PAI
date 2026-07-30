import { createHash } from "node:crypto";

import {
  assertKnowThatWriteBatchRequestV1,
  assertKnowThatWriteBatchResponseV1,
  assertMemoryWriteBatchRequestSemanticBindingsV1,
  assertMemoryWriteBatchResponseSemanticBindingsV1,
  assertMetaCognitionDomainEventSemanticBindingsV1,
  assertMetaResultPayloadSemanticBindingsV1,
  assertPartialFailureSemanticBindingsV1,
  MemoryWriteBatchRequestV1Schema,
  MemoryWriteBatchResponseV1Schema,
  MetaCognitionDomainEventV1Schema,
  MetaResultPayloadV1Schema,
  TRIGGER_PROCESS_SNAPSHOT_RESOLVE_ERROR_CODES_V1,
  type KnowThatWriteBatchRequestV1,
  type KnowThatWriteBatchResponseV1,
  type KnowThatWriteItemV1,
  type MetaLlmRunMetadataV1,
  type MetaMemoryWriteStageResultV1,
  type MetaKnowThatWriteStageResultV1,
  type MetaResultPayloadV1,
  type MetaSolidifiedEventRefV1,
  type MemoryWriteBatchRequestV1,
  type MemoryWriteBatchResponseV1,
  type MemoryWriteItemV1,
  type PartialFailureV1,
  type TriggerProcessSnapshotV1,
  type MetaCognitionDomainEventV1,
} from "@pai/contracts";
import { Value } from "@sinclair/typebox/value";

import {
  assertBoundedMetaJsonV1,
  assertNoRuntimeTokenV1,
  sha256CanonicalV1,
  snapshotCanonicalJsonV1,
} from "./canonical.v1.js";
import {
  resolveMetaCognitionConfigV1,
  type MetaCognitionConfigV1,
  type MetaDownstreamNameV1,
} from "./config.v1.js";
import {
  type MetaJobRepositoryPortV1,
  type MetaTerminalArtifactsV1,
} from "./meta-job-repository.v1.js";
import type {
  MetaKnowThatCandidatePortV1,
  MetaMemoryWritePortV1,
} from "./ports.v1.js";
import {
  snapshotResolveRequestForJobV1,
  validateSnapshotLearningInputV1,
} from "./snapshot-learning-input.v1.js";
import type { StructuredMetaProviderPortV1 } from "./structured-provider.v1.js";
import {
  MetaCognitionErrorV1,
  type MetaBotScopeV1,
  type MetaCompensationCommandV1,
  type MetaEvidenceArtifactV1,
  type MetaEvidenceBoundItemV1,
  type MetaExperienceRecordV1,
  type MetaFailureV1,
  type MetaJobCreateRequestV1,
  type MetaJobCreateResponseV1,
  type MetaJobRecordV1,
  type MetaLeaseFenceV1,
  type MetaLeaseGrantV1,
  type MetaPartialFailureV1,
  type MetaProviderOutputV1,
  type MetaResultV1,
  type MetaRunJobResponseV1,
  type TriggerProcessSnapshotResolverPortV1,
} from "./meta-types.v1.js";
import {
  parseMetaJobCreateRequestV1,
  sameMetaScopeV1,
} from "./validation.v1.js";

export interface MetaJobApplicationDependenciesV1 {
  readonly repository: MetaJobRepositoryPortV1;
  readonly snapshot_resolver: TriggerProcessSnapshotResolverPortV1;
  readonly provider: StructuredMetaProviderPortV1;
  readonly memory: MetaMemoryWritePortV1;
  readonly knowthat: MetaKnowThatCandidatePortV1;
}

interface MetaDownstreamItemResultV1 {
  readonly item_id: string;
  readonly outcome: "succeeded" | "failed";
  readonly downstream_ref: string | null;
  readonly reason_code: string | null;
  readonly retryable: boolean;
  readonly failure_kind:
    | "none"
    | "commit_unknown"
    | "explicit_rejection";
}

export interface MetaJobApplicationV1 {
  createJob(value: unknown): Promise<MetaJobCreateResponseV1>;
  acquireLease(input: Readonly<{
    job_id: string;
    owner_id: string;
    expected_generation: number;
    trace_id: string;
  }>): Promise<MetaLeaseGrantV1>;
  heartbeatLease(input: Readonly<{
    fence: MetaLeaseFenceV1;
    trace_id: string;
  }>): Promise<MetaLeaseGrantV1>;
  runJob(
    fence: MetaLeaseFenceV1,
    signal?: AbortSignal,
  ): Promise<MetaRunJobResponseV1>;
  readJob(jobId: string): Promise<MetaJobRecordV1 | undefined>;
  checkReadiness(signal: AbortSignal): Promise<void>;
}

function deterministicId(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256")
    .update(sha256CanonicalV1(value), "utf8")
    .digest("hex")
    .slice(0, 32)}`;
}

function snapshotMetaOwnerValueV1<T>(value: T, label: string): T {
  try {
    return snapshotCanonicalJsonV1(value);
  } catch (error) {
    throw new MetaCognitionErrorV1(
      "commit_drift",
      `${label} is outside the canonical JSON trust boundary`,
      false,
      { cause: error },
    );
  }
}

function snapshotMetaResolverValueV1<T>(value: T): T {
  try {
    return snapshotCanonicalJsonV1(value);
  } catch (error) {
    throw new MetaCognitionErrorV1(
      "snapshot_invalid",
      "Meta snapshot resolver returned data outside the canonical JSON boundary",
      false,
      { cause: error },
    );
  }
}

function snapshotMetaDateV1(value: Date, label: string): Date {
  let milliseconds: number;
  try {
    milliseconds = Date.prototype.getTime.call(value);
  } catch (error) {
    throw new MetaCognitionErrorV1(
      "commit_drift",
      `${label} is not an intrinsic Date`,
      false,
      { cause: error },
    );
  }
  if (!Number.isFinite(milliseconds)) {
    throw new MetaCognitionErrorV1(
      "commit_drift",
      `${label} is not a finite instant`,
      false,
    );
  }
  return new Date(milliseconds);
}

function snapshotMetaFenceV1(value: MetaLeaseFenceV1): MetaLeaseFenceV1 {
  const fence = snapshotMetaOwnerValueV1(
    value,
    "Meta lease fence",
  );
  if (
    typeof fence.job_id !== "string" ||
    fence.job_id.length === 0 ||
    typeof fence.lease_id !== "string" ||
    fence.lease_id.length === 0 ||
    typeof fence.owner_id !== "string" ||
    fence.owner_id.length === 0 ||
    !Number.isSafeInteger(fence.lease_generation) ||
    fence.lease_generation < 1
  ) {
    throw new MetaCognitionErrorV1(
      "invalid_job_state",
      "Meta lease fence is invalid",
      false,
    );
  }
  return Object.freeze({
    job_id: fence.job_id,
    lease_id: fence.lease_id,
    lease_generation: fence.lease_generation,
    owner_id: fence.owner_id,
  });
}

function snapshotMetaLeaseGrantV1(
  value: MetaLeaseGrantV1,
  label: string,
  expected: Readonly<{
    job_id: string;
    owner_id: string;
    lease_id?: string;
    lease_generation?: number;
  }>,
): MetaLeaseGrantV1 {
  const grant = snapshotMetaOwnerValueV1(value, label);
  if (
    typeof grant.job_id !== "string" ||
    grant.job_id.length === 0 ||
    typeof grant.lease_id !== "string" ||
    grant.lease_id.length === 0 ||
    typeof grant.owner_id !== "string" ||
    grant.owner_id.length === 0 ||
    !Number.isSafeInteger(grant.lease_generation) ||
    grant.lease_generation < 1 ||
    typeof grant.lease_expires_at !== "string" ||
    !Number.isFinite(Date.parse(grant.lease_expires_at)) ||
    typeof grant.heartbeat_at !== "string" ||
    !Number.isFinite(Date.parse(grant.heartbeat_at)) ||
    !Number.isSafeInteger(grant.attempt) ||
    grant.attempt < 1 ||
    typeof grant.takeover !== "boolean" ||
    grant.job_id !== expected.job_id ||
    grant.owner_id !== expected.owner_id ||
    (expected.lease_id !== undefined &&
      grant.lease_id !== expected.lease_id) ||
    (expected.lease_generation !== undefined &&
      grant.lease_generation !== expected.lease_generation)
  ) {
    throw new MetaCognitionErrorV1(
      "commit_drift",
      `${label} changed or violated the lease identity`,
      false,
    );
  }
  return grant;
}

function scope(value: MetaBotScopeV1): MetaBotScopeV1 {
  return {
    workspace_id: value.workspace_id,
    bot_id: value.bot_id,
    owner_agent_id: value.owner_agent_id,
    deployment_environment: value.deployment_environment,
    release_channel: value.release_channel,
  };
}

function createRequestHash(
  request: MetaJobCreateRequestV1,
): `sha256:${string}` {
  return sha256CanonicalV1({
    schema_version: request.schema_version,
    trigger_process_id: request.trigger_process_id,
    ...scope(request),
    snapshot_ref: request.snapshot_ref,
    snapshot_version: request.snapshot_version,
    snapshot_hash: request.snapshot_hash,
    snapshot_retention_until: request.snapshot_retention_until,
    cooldown_until: request.cooldown_until,
    boundary_system_event_ref: request.boundary_system_event_ref,
    learnable_snapshot_ready: request.learnable_snapshot_ready,
    enqueue_reason: request.enqueue_reason,
    idempotency_key: request.idempotency_key,
  });
}

function jobProjectionVersion(
  attemptCount: number,
  stage: "started" | "settled",
): number {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1) {
    throw new MetaCognitionErrorV1(
      "commit_drift",
      "Meta job attempt cannot produce a projection version",
      false,
    );
  }
  const version = attemptCount * 2 + (stage === "settled" ? 1 : 0);
  if (!Number.isSafeInteger(version)) {
    throw new MetaCognitionErrorV1(
      "commit_drift",
      "Meta job projection version is exhausted",
      false,
    );
  }
  return version;
}

function durableEvent(
  job: MetaJobRecordV1 | (MetaJobCreateRequestV1 & { readonly id: string }),
  eventType: MetaCognitionDomainEventV1["event_type"],
  payload: Readonly<Record<string, unknown>>,
  occurredAt: Date,
  suffix: string,
): MetaCognitionDomainEventV1 {
  assertNoRuntimeTokenV1(payload);
  const event = {
    event_id: deterministicId("meta_event", {
      job_id: job.id,
      event_type: eventType,
      suffix,
    }),
    event_type: eventType,
    schema_version: "meta_cognition_event.v1",
    producer: "meta_cognition",
    occurred_at: occurredAt.toISOString(),
    idempotency_key: `${job.id}:${eventType}:${suffix}`,
    trace_id: job.trace_id,
    payload: Object.freeze({
      ...scope(job),
      meta_job_id: job.id,
      trigger_process_id: job.trigger_process_id,
      ...payload,
    }),
  };
  assertBoundedMetaJsonV1(event);
  if (!Value.Check(MetaCognitionDomainEventV1Schema, event)) {
    throw new MetaCognitionErrorV1(
      "commit_drift",
      `Meta durable event ${eventType} violates its owner contract`,
      false,
    );
  }
  assertMetaCognitionDomainEventSemanticBindingsV1(event);
  return Object.freeze(event);
}

function compensationCommand(
  job: MetaJobRecordV1,
  fence: MetaLeaseFenceV1,
  failure: MetaPartialFailureV1 & {
    readonly source: "memory" | "knowthat";
  },
  sourceRequest:
    | MemoryWriteBatchRequestV1
    | KnowThatWriteBatchRequestV1,
  failureKind: Exclude<
    MetaDownstreamItemResultV1["failure_kind"],
    "none"
  >,
  createdAt: Date,
): MetaCompensationCommandV1 {
  const sourceItem = sourceRequest.items.find(
    ({ client_item_id }) => client_item_id === failure.item_id,
  );
  if (sourceItem === undefined) {
    throw new MetaCognitionErrorV1(
      "commit_drift",
      "Meta compensation lost its failed owner item binding",
      false,
    );
  }
  const sourceOwnerRequestHash = sha256CanonicalV1(sourceRequest);
  const dispatchMode =
    failureKind === "commit_unknown"
      ? "original_request_replay"
      : "single_item_retry";
  const retryIdempotencyKey = deterministicId("meta_retry", {
    meta_job_id: job.id,
    target_service: failure.source,
    item_id: failure.item_id,
    source_owner_request_hash: sourceOwnerRequestHash,
  });
  const ownerRequest =
    dispatchMode === "original_request_replay"
      ? sourceRequest
      : Object.freeze({
          ...sourceRequest,
          idempotency_key: retryIdempotencyKey,
          items: Object.freeze([sourceItem]),
        });
  const requestPayload =
    failure.source === "memory"
      ? Object.freeze({
          schema_version: "meta_compensation_request.v1" as const,
          target_service: "memory" as const,
          item_id: failure.item_id,
          reason_code: failure.code,
          retryable: true as const,
          dispatch_mode: dispatchMode,
          failed_item: Object.freeze({
            client_item_id: failure.item_id,
            item_hash: sha256CanonicalV1(sourceItem),
            source_owner_request_hash: sourceOwnerRequestHash,
            source_idempotency_key: sourceRequest.idempotency_key,
          }),
          owner_request:
            ownerRequest as MemoryWriteBatchRequestV1,
          owner_request_hash: sha256CanonicalV1(ownerRequest),
        })
      : Object.freeze({
          schema_version: "meta_compensation_request.v1" as const,
          target_service: "knowthat" as const,
          item_id: failure.item_id,
          reason_code: failure.code,
          retryable: true as const,
          dispatch_mode: dispatchMode,
          failed_item: Object.freeze({
            client_item_id: failure.item_id,
            item_hash: sha256CanonicalV1(sourceItem),
            source_owner_request_hash: sourceOwnerRequestHash,
            source_idempotency_key: sourceRequest.idempotency_key,
          }),
          owner_request:
            ownerRequest as KnowThatWriteBatchRequestV1,
          owner_request_hash: sha256CanonicalV1(ownerRequest),
        });
  const command: MetaCompensationCommandV1 = {
    command_id: deterministicId("meta_command", {
      job_id: job.id,
      target: failure.source,
      item_id: failure.item_id,
      code: failure.code,
      lease_generation: fence.lease_generation,
    }),
    meta_job_id: job.id,
    target_service: failure.source,
    idempotency_key: `${job.id}:compensate:${failure.source}:${failure.item_id}:g${fence.lease_generation}`,
    lease_generation: fence.lease_generation,
    request_payload: requestPayload,
    request_payload_hash: sha256CanonicalV1(requestPayload),
    trace_id: job.trace_id,
    created_at: createdAt.toISOString(),
    ...scope(job),
  };
  assertNoRuntimeTokenV1(command);
  return Object.freeze(command);
}

function validateMemoryResponse(
  request: MemoryWriteBatchRequestV1,
  response: MemoryWriteBatchResponseV1,
): readonly MetaDownstreamItemResultV1[] {
  try {
    assertBoundedMetaJsonV1(response);
    if (!Value.Check(MemoryWriteBatchResponseV1Schema, response)) {
      throw new Error("Memory response schema mismatch");
    }
    assertMemoryWriteBatchResponseSemanticBindingsV1(response);
  } catch (error) {
    throw new MetaCognitionErrorV1(
      "downstream_invalid",
      "Memory returned an invalid owner response",
      false,
      { cause: error },
    );
  }
  const expected = request.items.map((item) => item.client_item_id).sort();
  const actual = response.item_results
    .map((item) => item.client_item_id)
    .sort();
  if (
    expected.length !== actual.length ||
    expected.some((itemId, index) => itemId !== actual[index])
  ) {
    throw new MetaCognitionErrorV1(
      "downstream_invalid",
      "Memory response does not cover the exact request item set",
      false,
    );
  }
  return Object.freeze(
    response.item_results.map((item) =>
      Object.freeze(
        item.status === "succeeded"
          ? {
              item_id: item.client_item_id,
              outcome: "succeeded" as const,
              downstream_ref:
                item.memory_point_id === undefined
                  ? `memory_series:${item.series_id}`
                  : `memory_point:${item.memory_point_id}`,
              reason_code: null,
              retryable: false,
              failure_kind: "none" as const,
            }
          : {
              item_id: item.client_item_id,
              outcome: "failed" as const,
              downstream_ref: null,
              reason_code: item.code,
              retryable: item.code !== "schema_validation_failed",
              failure_kind: "explicit_rejection" as const,
            },
      ),
    ),
  );
}

function validateKnowThatResponse(
  request: KnowThatWriteBatchRequestV1,
  response: KnowThatWriteBatchResponseV1,
): readonly MetaDownstreamItemResultV1[] {
  try {
    assertBoundedMetaJsonV1(response);
    assertKnowThatWriteBatchResponseV1(response);
  } catch (error) {
    throw new MetaCognitionErrorV1(
      "downstream_invalid",
      "KnowThat returned an invalid owner response",
      false,
      { cause: error },
    );
  }
  const expected = request.items.map((item) => item.client_item_id).sort();
  const actual = response.item_results
    .map((item) => item.client_item_id)
    .sort();
  if (
    expected.length !== actual.length ||
    expected.some((itemId, index) => itemId !== actual[index])
  ) {
    throw new MetaCognitionErrorV1(
      "downstream_invalid",
      "KnowThat response does not cover the exact request item set",
      false,
    );
  }
  return Object.freeze(
    response.item_results.map((item) =>
      Object.freeze(
        item.status === "succeeded"
          ? {
              item_id: item.client_item_id,
              outcome: "succeeded" as const,
              downstream_ref: `knowthat_fact:${item.fact_id}`,
              reason_code: null,
              retryable: false,
              failure_kind: "none" as const,
            }
          : {
              item_id: item.client_item_id,
              outcome: "failed" as const,
              downstream_ref: null,
              reason_code: item.code,
              retryable: item.code !== "schema_validation_failed",
              failure_kind: "explicit_rejection" as const,
            },
      ),
    ),
  );
}

function outputEvidenceRefs(
  output: MetaProviderOutputV1,
): readonly string[] {
  return [
    ...output.evidence_refs,
    ...output.memory_writes.flatMap((item) => item.evidence_refs),
    ...output.knowthat_candidates.flatMap((item) => item.evidence_refs),
    ...output.skill_candidates.flatMap((item) => item.evidence_refs),
    ...output.quality_signals.flatMap((item) => item.evidence_refs),
  ];
}

function learningCheckpoint(
  snapshot: TriggerProcessSnapshotV1,
  snapshotRef: string,
): Readonly<{
  llm_run_metadata: MetaLlmRunMetadataV1;
  solidified_event_refs: readonly MetaSolidifiedEventRefV1[];
}> {
  const solidifiedEventRefs = snapshot.event_trace.map((event) => {
      if (event.source_sequence_no === undefined) {
        throw new MetaCognitionErrorV1(
          "snapshot_invalid",
          "A solidified durable event is missing source_sequence_no",
          false,
        );
      }
      return {
        event_ref: `system_event:${event.source_service}:${event.source_event_id}`,
        event_type: event.event_type,
        append_sequence_no: event.append_sequence_no,
        source_service: event.source_service,
        source_event_id: event.source_event_id,
        source_sequence_no: event.source_sequence_no,
        occurred_at: event.occurred_at,
        payload_ref: event.payload_ref,
        payload_hash: event.payload_hash,
      };
    });
  const skillCatalog = snapshot.context_snapshot?.skill_catalog ?? null;
  const llmRunMetadata: MetaLlmRunMetadataV1 = {
    snapshot_id: snapshot.snapshot_id,
    snapshot_ref: snapshotRef,
    snapshot_hash: snapshot.snapshot_hash,
    snapshot_version: snapshot.snapshot_version,
    input_event_range: { ...snapshot.input_event_range },
    runtime_run_id: snapshot.runtime_run_id,
    context_snapshot_ref:
      snapshot.context_snapshot === null
        ? null
        : `context_snapshot:${snapshot.trigger_process_id}:${snapshot.context_snapshot.context_version}:${snapshot.context_snapshot.snapshot_hash}`,
    intent_ref:
      snapshot.intent === null
        ? null
        : `intent:${snapshot.trigger_process_id}:${snapshot.snapshot_version}`,
    runtime_state: snapshot.runtime_state?.status ?? null,
    cooldown_until: snapshot.cooldown_until,
    policy_snapshot_id: snapshot.policy_snapshot_id,
    solidified_event_range: { ...snapshot.input_event_range },
    ...(skillCatalog === null
      ? {}
      : {
          skill_catalog_version: skillCatalog.catalog_version,
          skill_catalog_as_of: skillCatalog.catalog_as_of,
        }),
    calls: [],
  };
  return Object.freeze({
    llm_run_metadata: llmRunMetadata,
    solidified_event_refs: solidifiedEventRefs,
  });
}

function assertEvidenceBindings(
  output: MetaProviderOutputV1,
  allowed: ReadonlySet<string>,
): void {
  try {
    assertNoRuntimeTokenV1(output);
  } catch (error) {
    throw new MetaCognitionErrorV1(
      "provider_invalid",
      "Meta provider output contains forbidden runtime data",
      false,
      { cause: error },
    );
  }
  const refs = outputEvidenceRefs(output);
  if (
    refs.length < 1 ||
    refs.some((ref) => !allowed.has(ref))
  ) {
    throw new MetaCognitionErrorV1(
      "evidence_invalid",
      "Meta provider evidence is not bound to the fixed snapshot",
      false,
    );
  }
}

function memoryFallbackCandidate(
  item: MetaEvidenceBoundItemV1<MemoryWriteItemV1>,
  failure: MetaDownstreamItemResultV1,
): MetaEvidenceBoundItemV1<KnowThatWriteItemV1> {
  const primarySubject =
    item.payload.subject_refs.find((subject) => subject.primary === true) ??
    item.payload.subject_refs[0];
  if (primarySubject === undefined) {
    throw new MetaCognitionErrorV1(
      "provider_invalid",
      "Memory fallback cannot bind a subject",
      false,
    );
  }
  const subject =
    primarySubject.canonical_id ??
    primarySubject.label ??
    "unknown_subject";
  const fallbackItemId = `memory_evidence_pending:${item.item_id}`;
  const fallbackPayload: KnowThatWriteItemV1 = {
    client_item_id: fallbackItemId,
    text: item.payload.content_summary,
    subject,
    predicate: "memory_evidence_pending",
    object: item.payload.content_summary,
    category: "project_fact",
    proposed_status: "candidate",
    direct_active_hint: false,
    risk_level: "medium",
    explicitness: "inferred",
    confidence: item.payload.confidence_score,
    source: "meta_inference",
    source_ref: item.evidence_refs[0]!,
    evidence_refs: [...item.evidence_refs],
    evidence_pending: true,
    evidence_pending_reason:
      failure.reason_code ?? "memory_write_failed",
  };
  return Object.freeze({
    item_id: fallbackItemId,
    payload: fallbackPayload,
    evidence_refs: item.evidence_refs,
  });
}

function partialFailure(
  target: MetaDownstreamNameV1,
  item: MetaDownstreamItemResultV1,
  config: MetaCognitionConfigV1,
  compensationRequired: boolean,
): MetaPartialFailureV1 {
  return Object.freeze({
    code: item.reason_code ?? `${target}_failed`,
    message: `${target} item ${item.item_id} failed`,
    retryable: item.retryable,
    source: target,
    item_id: item.item_id,
    mode: config.downstream_failure_mode[target],
    compensation_required: compensationRequired && item.retryable,
  });
}

function failureFromError(error: unknown): MetaFailureV1 {
  if (error instanceof MetaCognitionErrorV1) {
    const message =
      error.code === "snapshot_invalid"
        ? "Meta snapshot validation failed"
        : error.code === "provider_invalid"
          ? "Meta provider output validation failed"
          : error.code === "evidence_invalid"
            ? "Meta provider evidence validation failed"
            : "Meta job execution failed";
    return {
      code: error.code,
      message,
      retryable: error.retryable,
      source:
        error.code === "snapshot_invalid"
          ? "snapshot"
          : error.code === "provider_invalid" ||
              error.code === "evidence_invalid"
            ? "provider"
            : "job",
    };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    TRIGGER_PROCESS_SNAPSHOT_RESOLVE_ERROR_CODES_V1.includes(
      error.code as (typeof TRIGGER_PROCESS_SNAPSHOT_RESOLVE_ERROR_CODES_V1)[number],
    )
  ) {
    const retryable =
      error.code === "snapshot_not_found" ||
      error.code === "snapshot_overflow_unreadable";
    return {
      code: error.code,
      message: "Trigger Process snapshot resolver rejected the snapshot",
      retryable,
      source: "snapshot",
    };
  }
  return {
    code: "meta_job_failed",
    message: "Meta job execution failed",
    retryable: true,
    source: "job",
  };
}

function retryDelayMs(
  attempt: number,
  config: MetaCognitionConfigV1,
  random: () => number,
): number {
  const ceiling = Math.min(
    config.retry_max_ms,
    config.retry_base_ms * 2 ** Math.max(0, attempt - 1),
  );
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new MetaCognitionErrorV1(
      "commit_drift",
      "Meta retry jitter source returned an invalid sample",
      false,
    );
  }
  return Math.floor(sample * (ceiling + 1));
}

export function createMetaJobApplicationV1(
  dependencies: MetaJobApplicationDependenciesV1,
  configInput: MetaCognitionConfigV1 | undefined = undefined,
  options: Readonly<{ now?: () => Date; random?: () => number }> = {},
): MetaJobApplicationV1 {
  const config =
    configInput === undefined
      ? resolveMetaCognitionConfigV1()
      : resolveMetaCognitionConfigV1(configInput);
  const now = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;
  const currentTime = (label: string): Date =>
    snapshotMetaDateV1(now(), label);

  const snapshotJob = (
    value: MetaJobRecordV1,
    label: string,
    expectedJobId?: string,
  ): MetaJobRecordV1 => {
    const job = snapshotMetaOwnerValueV1(value, label);
    if (
      (expectedJobId !== undefined && job.id !== expectedJobId) ||
      job.request_hash !== createRequestHash(job)
    ) {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        `${label} is not bound to the requested Meta job`,
        false,
      );
    }
    return job;
  };
  const assertCommittedJobState = (
    committed: MetaJobRecordV1,
    expected: MetaJobRecordV1,
    expectedStatus: MetaJobRecordV1["status"],
    label: string,
  ): void => {
    if (
      committed.status !== expectedStatus ||
      committed.id !== expected.id ||
      committed.request_hash !== expected.request_hash ||
      committed.trigger_process_id !==
        expected.trigger_process_id ||
      !sameMetaScopeV1(committed, expected)
    ) {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        `${label} changed the Meta job identity or state`,
        false,
      );
    }
  };
  const checkpointEvents = async (
    fence: MetaLeaseFenceV1,
    events: readonly MetaCognitionDomainEventV1[],
    traceId: string,
    label: string,
  ): Promise<readonly MetaCognitionDomainEventV1[]> => {
    const checkpointed = snapshotMetaOwnerValueV1(
      await dependencies.repository.checkpointOutboundEvents({
        fence,
        events,
        now: currentTime(`${label} clock`),
        trace_id: traceId,
      }),
      `${label} owner response`,
    );
    const checkpointIdentity = (
      event: MetaCognitionDomainEventV1 | undefined,
    ): `sha256:${string}` => {
      if (event === undefined) return sha256CanonicalV1(null);
      const { occurred_at: _occurredAt, ...identity } = event;
      return sha256CanonicalV1(identity);
    };
    if (
      checkpointed.length !== events.length ||
      checkpointed.some(
        (event, index) =>
          checkpointIdentity(event) !== checkpointIdentity(events[index]),
      )
    ) {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        `${label} changed a durable event identity`,
        false,
      );
    }
    return checkpointed;
  };

  const staleResponse = async (
    fence: MetaLeaseFenceV1,
    reasonCode: string,
  ): Promise<MetaRunJobResponseV1> => {
    const at = currentTime("Meta stale-attempt clock");
    await dependencies.repository.recordStaleAttempt({
      job_id: fence.job_id,
      owner_id: fence.owner_id,
      lease_generation: fence.lease_generation,
      now: at,
      trace_id: `${fence.job_id}:stale`,
      reason_code: reasonCode,
    });
    const jobValue = await dependencies.repository.readJob(fence.job_id);
    if (jobValue === undefined) {
      throw new MetaCognitionErrorV1(
        "job_not_found",
        "Meta job was not found",
        false,
      );
    }
    const job = snapshotJob(
      jobValue,
      "Meta stale-attempt owner row",
      fence.job_id,
    );
    return { outcome: "stale", job };
  };

  const requireCurrent = async (
    fence: MetaLeaseFenceV1,
  ): Promise<boolean> => {
    const current = await dependencies.repository.isLeaseCurrent(
      fence,
      currentTime("Meta lease-current clock"),
    );
    if (typeof current !== "boolean") {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        "Meta lease-current owner response is invalid",
        false,
      );
    }
    return current;
  };

  const withLeaseHeartbeat = async <T>(
    fence: MetaLeaseFenceV1,
    parentSignal: AbortSignal,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> => {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort(parentSignal.reason);
    if (parentSignal.aborted) onParentAbort();
    else parentSignal.addEventListener("abort", onParentAbort, { once: true });

    let heartbeatInFlight: Promise<void> | undefined;
    let heartbeatFailure: unknown;
    const heartbeat = () => {
      if (heartbeatInFlight !== undefined || controller.signal.aborted) return;
      heartbeatInFlight = dependencies.repository
        .heartbeatLease({
          fence,
          now: currentTime("Meta heartbeat clock"),
          lease_ttl_ms: config.lease_ttl_ms,
          trace_id: `${fence.job_id}:heartbeat:g${fence.lease_generation}`,
        })
        .then((grant) => {
          snapshotMetaLeaseGrantV1(
            grant,
            "Meta heartbeat owner response",
            fence,
          );
        })
        .catch((error: unknown) => {
          heartbeatFailure = error;
          controller.abort(error);
        })
        .finally(() => {
          heartbeatInFlight = undefined;
        });
    };
    const timer = setInterval(heartbeat, config.heartbeat_interval_ms);
    timer.unref();
    try {
      const result = await operation(controller.signal);
      if (heartbeatFailure !== undefined) throw heartbeatFailure;
      return result;
    } finally {
      clearInterval(timer);
      parentSignal.removeEventListener("abort", onParentAbort);
      await heartbeatInFlight;
    }
  };

  const finalizeFailure = async (
    job: MetaJobRecordV1,
    fence: MetaLeaseFenceV1,
    failure: MetaFailureV1,
    commands: readonly MetaCompensationCommandV1[] = [],
    priorEvents: readonly MetaCognitionDomainEventV1[] = [],
  ): Promise<MetaRunJobResponseV1> => {
    if (!(await requireCurrent(fence))) {
      return staleResponse(fence, "stale_before_failure_commit");
    }
    const at = currentTime("Meta failure-finalization clock");
    const canRetry =
      failure.retryable && job.attempt_count < config.max_job_attempts;
    const retryDelay = canRetry
      ? retryDelayMs(job.attempt_count, config, random)
      : null;
    const eventType = canRetry ? "meta.job.retry_wait" : "meta.job.failed";
    const event = durableEvent(
      job,
      eventType,
      canRetry
        ? {
            previous_meta_status: "running",
            next_meta_status: "retry_wait",
            projection_version: jobProjectionVersion(
              job.attempt_count,
              "settled",
            ),
            reason_code: failure.code,
            next_retry_at: new Date(
              at.getTime() + retryDelay!,
            ).toISOString(),
            attempt_count: job.attempt_count,
            error_code: failure.code,
          }
        : {
            previous_meta_status: "running",
            next_meta_status: "failed",
            projection_version: jobProjectionVersion(
              job.attempt_count,
              "settled",
            ),
            reason_code: failure.code,
            failed_at: at.toISOString(),
            attempt_count: job.attempt_count,
            error: failure,
            result_disposition: "not_created",
            failure_stage: failure.source,
            no_result_reason: failure.code,
            active_compensation: false,
            meta_enqueue_reason: job.enqueue_reason,
          },
      at,
      `${job.attempt_count}`,
    );
    if (canRetry) {
      const nextRetryAt = new Date(
        at.getTime() + retryDelay!,
      );
      const retryJob = snapshotJob(
        await dependencies.repository.commitRetryWait({
        fence,
        failure,
        next_retry_at: nextRetryAt,
        events: [...priorEvents, event],
        compensation_commands: commands,
        now: at,
        trace_id: job.trace_id,
        }),
        "Meta retry-wait owner response",
        job.id,
      );
      return { outcome: "retry_wait", job: retryJob, failure };
    }
    const failedJob = snapshotJob(
      await dependencies.repository.commitFailed({
        fence,
        failure,
        events: [...priorEvents, event],
        compensation_commands: [],
        now: at,
        trace_id: job.trace_id,
      }),
      "Meta failed owner response",
      job.id,
    );
    return { outcome: "failed", job: failedJob, failure };
  };

  return Object.freeze({
    async createJob(value: unknown): Promise<MetaJobCreateResponseV1> {
      const at = currentTime("Meta create-job clock");
      const request = parseMetaJobCreateRequestV1(value, at);
      const requestHash = createRequestHash(request);
      const jobId = deterministicId("mj", {
        idempotency_key: request.idempotency_key,
      });
      const event = durableEvent(
        { ...request, id: jobId },
        "meta.job.created",
        {
          previous_meta_status: null,
          next_meta_status: "queued",
          projection_version: 1,
          reason_code: "meta_job_created",
          snapshot_ref: request.snapshot_ref,
          snapshot_version: request.snapshot_version,
          snapshot_hash: request.snapshot_hash,
          attempt_count: 0,
        },
        at,
        "created",
      );
      const result = snapshotMetaOwnerValueV1(
        await dependencies.repository.createOrReuse({
          job_id: jobId,
          request,
          request_hash: requestHash,
          created_event: event,
          now: at,
        }),
        "Meta create-or-reuse owner response",
      );
      const createdJob = snapshotJob(
        result.job,
        "Meta create-or-reuse job",
        jobId,
      );
      if (
        (result.outcome !== "created" && result.outcome !== "reused") ||
        createdJob.request_hash !== requestHash
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta create-or-reuse response changed the request identity",
          false,
        );
      }
      return Object.freeze({
        job_id: createdJob.id,
        status: createdJob.status,
        duplicate_replayed: result.outcome === "reused",
        created_at: createdJob.created_at,
      });
    },

    async acquireLease(
      input: Parameters<MetaJobApplicationV1["acquireLease"]>[0],
    ) {
      const request = snapshotMetaOwnerValueV1(
        input,
        "Meta acquire-lease request",
      );
      const grant = snapshotMetaLeaseGrantV1(
        await dependencies.repository.acquireLease({
        ...request,
        now: currentTime("Meta acquire-lease clock"),
        lease_ttl_ms: config.lease_ttl_ms,
        takeover_grace_ms: config.takeover_grace_ms,
        }),
        "Meta acquire-lease owner response",
        request,
      );
      if (grant.lease_generation <= request.expected_generation) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta lease grant changed the requested identity",
          false,
        );
      }
      return grant;
    },

    async heartbeatLease(
      input: Parameters<MetaJobApplicationV1["heartbeatLease"]>[0],
    ) {
      const request = snapshotMetaOwnerValueV1(
        input,
        "Meta heartbeat request",
      );
      const fence = snapshotMetaFenceV1(request.fence);
      const grant = snapshotMetaLeaseGrantV1(
        await dependencies.repository.heartbeatLease({
        ...request,
        fence,
        now: currentTime("Meta heartbeat clock"),
        lease_ttl_ms: config.lease_ttl_ms,
        }),
        "Meta heartbeat owner response",
        fence,
      );
      return grant;
    },

    async runJob(
      fenceValue: MetaLeaseFenceV1,
      signal = new AbortController().signal,
    ): Promise<MetaRunJobResponseV1> {
      const fence = snapshotMetaFenceV1(fenceValue);
      const jobValue = await dependencies.repository.readJob(fence.job_id);
      if (jobValue === undefined) {
        throw new MetaCognitionErrorV1(
          "job_not_found",
          "Meta job was not found",
          false,
        );
      }
      let job = snapshotJob(
        jobValue,
        "Meta run-job owner row",
        fence.job_id,
      );
      if (job.status === "completed") {
        const resultValue = await dependencies.repository.readResult(job.id);
        if (resultValue === undefined) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Completed Meta job has no durable result",
            false,
          );
        }
        const result = snapshotMetaOwnerValueV1(
          resultValue,
          "Meta replay result owner row",
        );
        if (
          !Number.isSafeInteger(result.result_version) ||
          result.result_version < 1 ||
          result.meta_job_id !== job.id ||
          result.trigger_process_id !== job.trigger_process_id ||
          !sameMetaScopeV1(result, job)
        ) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta replay result is not bound to the job",
            false,
          );
        }
        return { outcome: "replayed", job, result };
      }
      if (job.status === "failed") {
        return {
          outcome: "failed",
          job,
          failure:
            job.error ?? {
              code: "meta_job_failed",
              message: "Meta job is terminal",
              retryable: false,
              source: "job",
            },
        };
      }
      if (!(await requireCurrent(fence))) {
        return staleResponse(fence, "stale_before_start");
      }
      if (job.status === "leased") {
        const at = currentTime("Meta start-job clock");
        job = snapshotJob(
          await dependencies.repository.startJob({
            fence,
            now: at,
            trace_id: job.trace_id,
            event: durableEvent(
              job,
              "meta.job.started",
              {
                previous_meta_status:
                  job.lease_previous_status ?? "queued",
                next_meta_status: "running",
                projection_version: jobProjectionVersion(
                  job.attempt_count,
                  "started",
                ),
                reason_code: "meta_job_started",
                lease_id: fence.lease_id,
                lease_generation: fence.lease_generation,
                attempt: job.attempt_count,
                started_at: at.toISOString(),
              },
              at,
              `${job.attempt_count}`,
            ),
          }),
          "Meta start-job owner response",
          job.id,
        );
      }
      if (job.status !== "running") {
        throw new MetaCognitionErrorV1(
          "invalid_job_state",
          "Meta job must be running before execution",
          false,
        );
      }

      const existingCheckpointValue =
        await dependencies.repository.readProviderOutput(job.id);
      const existingCheckpoint =
        existingCheckpointValue === undefined
          ? undefined
          : snapshotMetaOwnerValueV1(
              existingCheckpointValue,
              "Meta provider checkpoint owner row",
            );
      let output = existingCheckpoint?.output;
      let solidifiedEventRange =
        existingCheckpoint?.solidified_event_range;
      let llmRunMetadata = existingCheckpoint?.llm_run_metadata;
      let solidifiedEventRefs =
        existingCheckpoint?.solidified_event_refs;
      let evidenceArtifacts = existingCheckpoint?.evidence_artifacts;
      try {
        if (
          existingCheckpoint !== undefined &&
          (existingCheckpoint.request_hash !== job.request_hash ||
            existingCheckpoint.output_hash !==
              sha256CanonicalV1(existingCheckpoint.output))
        ) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta provider output checkpoint is not bound to the job",
            false,
          );
        }
        if (output !== undefined) {
          try {
            assertNoRuntimeTokenV1(output);
          } catch (error) {
            throw new MetaCognitionErrorV1(
              "commit_drift",
              "Meta provider output checkpoint contains forbidden data",
              false,
              { cause: error },
            );
          }
        }
        if (output === undefined) {
          const read = snapshotMetaResolverValueV1(
            await withLeaseHeartbeat(
              fence,
              signal,
              (leaseSignal) =>
                dependencies.snapshot_resolver.resolve(
                  snapshotResolveRequestForJobV1(job),
                  leaseSignal,
                ),
            ),
          );
          const learningInput = validateSnapshotLearningInputV1(
            job,
            read,
            config,
            currentTime("Meta snapshot-validation clock"),
          );
          evidenceArtifacts = learningInput.evidence_artifacts;
          const checkpointLearning = learningCheckpoint(
            learningInput.read.snapshot_manifest,
            job.snapshot_ref,
          );
          llmRunMetadata = checkpointLearning.llm_run_metadata;
          solidifiedEventRefs = checkpointLearning.solidified_event_refs;
          solidifiedEventRange = Object.freeze({
            first_append_sequence_no:
              learningInput.read.snapshot_manifest.input_event_range
                .first_append_sequence_no,
            last_append_sequence_no:
              learningInput.read.snapshot_manifest.input_event_range
                .last_append_sequence_no,
          });
          const candidateOutput = snapshotMetaOwnerValueV1(
            await withLeaseHeartbeat(
              fence,
              signal,
              (leaseSignal) =>
                dependencies.provider.generate(
                  learningInput.prompt,
                  leaseSignal,
                ),
            ),
            "Meta structured-provider response",
          );
          assertEvidenceBindings(
            candidateOutput,
            learningInput.allowed_evidence_refs,
          );
          if (
            candidateOutput.skill_candidates.length > 0 &&
            (llmRunMetadata.skill_catalog_version === undefined ||
              llmRunMetadata.skill_catalog_as_of === undefined)
          ) {
            throw new MetaCognitionErrorV1(
              "provider_invalid",
              "Skill candidates require the frozen snapshot Catalog identity",
              false,
            );
          }
          if (!(await requireCurrent(fence))) {
            return staleResponse(fence, "stale_before_provider_checkpoint");
          }
          const storedCheckpoint = snapshotMetaOwnerValueV1(
            await dependencies.repository.checkpointProviderOutput({
              fence,
              output: candidateOutput,
              output_hash: sha256CanonicalV1(candidateOutput),
              solidified_event_range: solidifiedEventRange,
              llm_run_metadata: llmRunMetadata,
              solidified_event_refs: solidifiedEventRefs,
              evidence_artifacts: evidenceArtifacts,
              now: currentTime("Meta provider-checkpoint clock"),
            }),
            "Meta provider-checkpoint owner response",
          );
          if (
            storedCheckpoint.checkpoint.request_hash !== job.request_hash ||
            storedCheckpoint.checkpoint.output_hash !==
              sha256CanonicalV1(storedCheckpoint.checkpoint.output)
          ) {
            throw new MetaCognitionErrorV1(
              "commit_drift",
              "Meta stored provider checkpoint is not bound to the job",
              false,
            );
          }
          output = storedCheckpoint.checkpoint.output;
          solidifiedEventRange =
            storedCheckpoint.checkpoint.solidified_event_range;
          llmRunMetadata = storedCheckpoint.checkpoint.llm_run_metadata;
          solidifiedEventRefs =
            storedCheckpoint.checkpoint.solidified_event_refs;
          evidenceArtifacts = storedCheckpoint.checkpoint.evidence_artifacts;
        }
      } catch (error) {
        return finalizeFailure(job, fence, failureFromError(error));
      }

      if (!(await requireCurrent(fence))) {
        return staleResponse(fence, "stale_before_downstream");
      }
      if (
        solidifiedEventRange === undefined ||
        llmRunMetadata === undefined ||
        solidifiedEventRefs === undefined ||
        evidenceArtifacts === undefined
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta provider checkpoint is missing its frozen learning metadata",
          false,
        );
      }

      const partialFailures: MetaPartialFailureV1[] = [];
      const memoryRefs: string[] = [];
      const knowthatRefs: string[] = [];
      const requestedEvents: MetaCognitionDomainEventV1[] = [];

      let memoryResults: readonly MetaDownstreamItemResultV1[] = [];
      let memoryResponse: MemoryWriteBatchResponseV1 | undefined;
      let memoryOwnerRequest:
        | MemoryWriteBatchRequestV1
        | undefined;
      let memoryStageIdentity:
        | Readonly<{
            split_plan_id: string;
            plan_version: 1;
            chunk_no: 1;
            chunk_hash: `sha256:${string}`;
            idempotency_key: string;
            memory_write_request_id: string;
            request_payload_ref: string;
            request_payload_hash: `sha256:${string}`;
            compensation_outbox_id: string;
          }>
        | undefined;
      if (output.memory_writes.length > 0) {
        const chunkHash = sha256CanonicalV1({
          schema_version: "memory.write_batch.v1",
          bot_id: job.bot_id,
          trigger_process_id: job.trigger_process_id,
          source_meta_job_id: job.id,
          items: output.memory_writes.map((item) => item.payload),
        });
        const memoryRequest: MemoryWriteBatchRequestV1 = {
          schema_version: "memory.write_batch.v1",
          bot_id: job.bot_id,
          trigger_process_id: job.trigger_process_id,
          source_meta_job_id: job.id,
          idempotency_key: `memory_write:${job.id}:1:1:${chunkHash}`,
          items: output.memory_writes.map((item) => item.payload),
        };
        memoryOwnerRequest = memoryRequest;
        try {
          if (!Value.Check(MemoryWriteBatchRequestV1Schema, memoryRequest)) {
            throw new Error("Memory owner request schema mismatch");
          }
          assertMemoryWriteBatchRequestSemanticBindingsV1(memoryRequest);
        } catch (error) {
          return finalizeFailure(job, fence, {
            code: "schema_validation_failed",
            message: "Meta memory candidates violate the Memory owner contract",
            retryable: false,
            source: "provider",
          });
        }
        const splitPlanId = deterministicId("meta_memory_split_plan", {
          meta_job_id: job.id,
          chunk_hash: chunkHash,
        });
        const memoryWriteRequestId = deterministicId("meta_memory_chunk", {
          split_plan_id: splitPlanId,
          plan_version: 1,
          chunk_no: 1,
          chunk_hash: chunkHash,
        });
        const memorySuffix = "plan_1_chunk_1";
        const memoryRequestedEvent = durableEvent(
          job,
          "meta.memory.write_requested",
          {
            memory_write_request_id: memoryWriteRequestId,
            split_plan_id: splitPlanId,
            plan_version: 1,
            chunk_no: 1,
            chunk_hash: chunkHash,
            request_payload_ref: `meta_memory_split_chunk:${memoryWriteRequestId}`,
            request_payload_hash: chunkHash,
            idempotency_key: `${job.id}:meta.memory.write_requested:${memorySuffix}`,
            source_meta_job_id: job.id,
            source_trigger_process_id: job.trigger_process_id,
          },
          currentTime("Meta Memory request-event clock"),
          memorySuffix,
        );
        const [checkpointedMemoryEvent] =
          await checkpointEvents(
            fence,
            [memoryRequestedEvent],
            job.trace_id,
            "Meta Memory event checkpoint",
          );
        if (checkpointedMemoryEvent === undefined) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta memory event checkpoint returned no durable event",
            false,
          );
        }
        requestedEvents.push(checkpointedMemoryEvent);
        memoryStageIdentity = Object.freeze({
          split_plan_id: splitPlanId,
          plan_version: 1,
          chunk_no: 1,
          chunk_hash: chunkHash,
          idempotency_key: memoryRequest.idempotency_key,
          memory_write_request_id: memoryWriteRequestId,
          request_payload_ref: `meta_memory_split_chunk:${memoryWriteRequestId}`,
          request_payload_hash: chunkHash,
          compensation_outbox_id: checkpointedMemoryEvent.event_id,
        });
        try {
          memoryResponse = snapshotMetaOwnerValueV1(
            await withLeaseHeartbeat(
              fence,
              signal,
              (leaseSignal) =>
                dependencies.memory.writeBatch(
                  memoryRequest,
                  leaseSignal,
                ),
            ),
            "Meta Memory owner response",
          );
          memoryResults = validateMemoryResponse(
            memoryRequest,
            memoryResponse,
          );
        } catch (error) {
          if (
            error instanceof MetaCognitionErrorV1 &&
            error.code === "downstream_invalid"
          ) {
            return finalizeFailure(
              job,
              fence,
              {
                code: error.code,
                message: "Memory returned an invalid owner response",
                retryable: false,
                source: "memory",
              },
              [],
              requestedEvents,
            );
          }
          memoryResults = output.memory_writes.map((item) => ({
            item_id: item.item_id,
            outcome: "failed" as const,
            downstream_ref: null,
            reason_code:
              error instanceof MetaCognitionErrorV1
                ? error.code
                : "memory_batch_failed",
            retryable:
              !(error instanceof MetaCognitionErrorV1) || error.retryable,
            failure_kind: "commit_unknown" as const,
          }));
        }
        if (!(await requireCurrent(fence))) {
          return staleResponse(fence, "stale_after_memory");
        }
        memoryRefs.push(
          ...memoryResults.flatMap((item) =>
            item.outcome === "succeeded" && item.downstream_ref !== null
              ? [item.downstream_ref]
              : [],
          ),
        );
      }

      const memoryFailures = memoryResults.filter(
        (item) => item.outcome === "failed",
      );
      const memoryItems = new Map(
        output.memory_writes.map((item) => [item.item_id, item]),
      );
      const fallbackItems = memoryFailures.map((failure) => {
        const item = memoryItems.get(failure.item_id);
        if (item === undefined) {
          throw new MetaCognitionErrorV1(
            "downstream_invalid",
            "Memory result referenced an unknown item",
            false,
          );
        }
        return memoryFallbackCandidate(item, failure);
      });
      const knowthatItems = Object.freeze([
        ...output.knowthat_candidates,
        ...fallbackItems,
      ]);
      let knowthatResults: readonly MetaDownstreamItemResultV1[] = [];
      let knowthatResponse: KnowThatWriteBatchResponseV1 | undefined;
      let knowthatOwnerRequest:
        | KnowThatWriteBatchRequestV1
        | undefined;
      let knowthatWriteRequestId: string | undefined;
      let knowthatCompensationOutboxId: string | undefined;
      if (knowthatItems.length > 0) {
        if (!(await requireCurrent(fence))) {
          return staleResponse(fence, "stale_before_knowthat");
        }
        const knowthatRequest: KnowThatWriteBatchRequestV1 = {
          schema_version: "knowthat.write_batch.v1",
          ...scope(job),
          trigger_process_id: job.trigger_process_id,
          source_meta_job_id: job.id,
          idempotency_key: `knowthat_write:${job.id}:1`,
          trace_id: job.trace_id,
          items: knowthatItems.map((item) => item.payload),
        };
        knowthatOwnerRequest = knowthatRequest;
        try {
          assertKnowThatWriteBatchRequestV1(knowthatRequest);
        } catch {
          return finalizeFailure(job, fence, {
            code: "schema_validation_failed",
            message:
              "Meta KnowThat candidates violate the KnowThat owner contract",
            retryable: false,
            source: "provider",
          });
        }
        const knowthatPayloadHash = sha256CanonicalV1(knowthatRequest);
        knowthatWriteRequestId = deterministicId(
          "meta_knowthat_write",
          {
            meta_job_id: job.id,
            request_payload_hash: knowthatPayloadHash,
          },
        );
        const knowthatSuffix = "write_batch_1";
        const knowthatRequestedEvent = durableEvent(
          job,
          "meta.knowthat.write_requested",
          {
            knowthat_write_request_id: knowthatWriteRequestId,
            request_payload_ref: `meta_knowthat_write:${knowthatWriteRequestId}`,
            request_payload_hash: knowthatPayloadHash,
            idempotency_key: `${job.id}:meta.knowthat.write_requested:${knowthatSuffix}`,
            source_meta_job_id: job.id,
          },
          currentTime("Meta KnowThat request-event clock"),
          knowthatSuffix,
        );
        const [checkpointedKnowThatEvent] =
          await checkpointEvents(
            fence,
            [knowthatRequestedEvent],
            job.trace_id,
            "Meta KnowThat event checkpoint",
          );
        if (checkpointedKnowThatEvent === undefined) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta KnowThat event checkpoint returned no durable event",
            false,
          );
        }
        requestedEvents.push(checkpointedKnowThatEvent);
        knowthatCompensationOutboxId = checkpointedKnowThatEvent.event_id;
        try {
          knowthatResponse = snapshotMetaOwnerValueV1(
            await withLeaseHeartbeat(
              fence,
              signal,
              (leaseSignal) =>
                dependencies.knowthat.writeBatch(
                  knowthatRequest,
                  leaseSignal,
                ),
            ),
            "Meta KnowThat owner response",
          );
          knowthatResults = validateKnowThatResponse(
            knowthatRequest,
            knowthatResponse,
          );
        } catch (error) {
          if (
            error instanceof MetaCognitionErrorV1 &&
            error.code === "downstream_invalid"
          ) {
            return finalizeFailure(
              job,
              fence,
              {
                code: error.code,
                message: "KnowThat returned an invalid owner response",
                retryable: false,
                source: "knowthat",
              },
              [],
              requestedEvents,
            );
          }
          knowthatResults = knowthatItems.map((item) => ({
            item_id: item.item_id,
            outcome: "failed" as const,
            downstream_ref: null,
            reason_code:
              error instanceof MetaCognitionErrorV1
                ? error.code
                : "knowthat_batch_failed",
            retryable:
              !(error instanceof MetaCognitionErrorV1) || error.retryable,
            failure_kind: "commit_unknown" as const,
          }));
        }
        if (!(await requireCurrent(fence))) {
          return staleResponse(fence, "stale_after_knowthat");
        }
        knowthatRefs.push(
          ...knowthatResults.flatMap((item) =>
            item.outcome === "succeeded" && item.downstream_ref !== null
              ? [item.downstream_ref]
              : [],
          ),
        );
      }

      const fallbackOutcomeByOriginal = new Map(
        memoryFailures.map((failure) => [
          failure.item_id,
          knowthatResults.find(
            (result) =>
              result.item_id ===
              `memory_evidence_pending:${failure.item_id}`,
          ),
        ]),
      );
      for (const failure of memoryFailures) {
        partialFailures.push(
          partialFailure(
            "memory",
            failure,
            config,
            fallbackOutcomeByOriginal.get(failure.item_id)?.outcome !==
              "succeeded",
          ),
        );
      }
      for (const failure of knowthatResults.filter(
        (item) => item.outcome === "failed",
      )) {
        partialFailures.push(
          partialFailure("knowthat", failure, config, true),
        );
      }

      const compensationCommands = Object.freeze(
        partialFailures
          .filter(
            (
              failure,
            ): failure is MetaPartialFailureV1 & {
              readonly source: "memory" | "knowthat";
            } =>
              failure.compensation_required &&
              (failure.source === "memory" ||
                failure.source === "knowthat"),
          )
          .map((failure) => {
            const ownerRequest =
              failure.source === "memory"
                ? memoryOwnerRequest
                : knowthatOwnerRequest;
            const ownerResult =
              failure.source === "memory"
                ? memoryResults.find(
                    (result) => result.item_id === failure.item_id,
                  )
                : knowthatResults.find(
                    (result) => result.item_id === failure.item_id,
                  );
            if (
              ownerRequest === undefined ||
              ownerResult === undefined ||
              ownerResult.failure_kind === "none"
            ) {
              throw new MetaCognitionErrorV1(
                "commit_drift",
                "Meta compensation lost its owner request/result binding",
                false,
              );
            }
            return compensationCommand(
              job,
              fence,
              failure,
              ownerRequest,
              ownerResult.failure_kind,
              currentTime("Meta compensation-command clock"),
            );
          }),
      );
      const blockingFailures = partialFailures.filter(
        (failure) => failure.mode === "blocking",
      );
      const compensationForFailure = (
        failure: MetaPartialFailureV1,
      ) =>
        compensationCommands.find(
          (command) =>
            command.target_service === failure.source &&
            command.request_payload.item_id === failure.item_id,
        );
      let blockingCommitUnknownTransition:
        | Readonly<{
            failure: MetaFailureV1;
            can_retry: boolean;
            retry_delay_ms: number | null;
          }>
        | undefined;
      if (blockingFailures.length > 0) {
        const blockingCommitUnknown = blockingFailures.find(
          (failure) =>
            compensationForFailure(failure)?.request_payload
              .dispatch_mode === "original_request_replay",
        );
        if (blockingCommitUnknown === undefined) {
          const primary = blockingFailures[0]!;
          return finalizeFailure(
            job,
            fence,
            {
              code: primary.code,
              message: "A blocking Meta downstream operation failed",
              retryable: blockingFailures.some(
                (failure) => failure.retryable,
              ),
              source: primary.source,
            },
            compensationCommands,
            requestedEvents,
          );
        }
        const terminalBlocking = blockingFailures.find(
          (failure) => compensationForFailure(failure) === undefined,
        );
        const primary = terminalBlocking ?? blockingCommitUnknown;
        const failure: MetaFailureV1 = {
          code: primary.code,
          message: "A blocking Meta downstream operation failed",
          retryable:
            terminalBlocking === undefined &&
            blockingFailures.some((failure) => failure.retryable),
          source: primary.source,
        };
        const canRetry =
          failure.retryable &&
          job.attempt_count < config.max_job_attempts;
        blockingCommitUnknownTransition = Object.freeze({
          failure,
          can_retry: canRetry,
          retry_delay_ms: canRetry
            ? retryDelayMs(job.attempt_count, config, random)
            : null,
        });
      }
      if (!(await requireCurrent(fence))) {
        return staleResponse(fence, "stale_before_terminal_commit");
      }

      const finalizedAt = currentTime("Meta terminal-finalization clock");
      const failureIds = Object.freeze(
        partialFailures.map((failure) =>
          deterministicId("meta_failure", {
            meta_job_id: job.id,
            source: failure.source,
            item_id: failure.item_id,
            code: failure.code,
          }),
        ),
      );
      const activeCompensationCommands =
        blockingCommitUnknownTransition?.can_retry === false
          ? Object.freeze([] as MetaCompensationCommandV1[])
          : compensationCommands;
      const resultStatus =
        activeCompensationCommands.length > 0
          ? "partial_pending"
          : partialFailures.length > 0
            ? "partial_failed"
            : "complete";
      const ownerPartialFailures = Object.freeze(
        partialFailures.map((failure, index): PartialFailureV1 => {
          const compensation = activeCompensationCommands.find(
            (command) =>
              command.target_service === failure.source &&
              command.request_payload.item_id === failure.item_id,
          );
          const active = compensation !== undefined;
          const targetService =
            failure.source === "skill"
              ? "skill_registry"
              : failure.source === "memory" ||
                  failure.source === "knowthat"
                ? failure.source
                : "meta_cognition";
          const ownerFailure: PartialFailureV1 = Object.freeze({
            schema_version: "partial_failure.v1",
            failure_id: failureIds[index]!,
            stage: `${failure.source}_write`,
            target_service: targetService,
            operation: "write_batch",
            blocking: failure.mode === "blocking",
            retryable: failure.retryable,
            status: active ? "pending" : "failed",
            attempt_count: 0,
            compensation_owner: "meta_cognition",
            ...(compensation === undefined
              ? {}
              : {
                  compensation_outbox_id: compensation.command_id,
                  compensation_ref: compensation.command_id,
                }),
            ...(active
              ? {}
              : {
                  terminal_reason: failure.code,
                  resolved_at: finalizedAt.toISOString(),
                }),
            error_ref: deterministicId("meta_error", {
              failure_id: failureIds[index],
              code: failure.code,
            }),
          });
          assertPartialFailureSemanticBindingsV1(ownerFailure);
          return ownerFailure;
        }),
      );
      const failureIdFor = (
        source: MetaDownstreamNameV1,
        itemId: string,
      ): string | undefined => {
        const index = partialFailures.findIndex(
          (failure) =>
            failure.source === source && failure.item_id === itemId,
        );
        return index < 0 ? undefined : failureIds[index];
      };
      const memoryFailureIds = memoryResults.flatMap((item) => {
          if (item.outcome !== "failed") return [];
          const failureId = failureIdFor("memory", item.item_id);
          return failureId === undefined ? [] : [failureId];
        });
      const memoryWriteResult: MetaMemoryWriteStageResultV1 =
        output.memory_writes.length === 0
          ? {
              status: "noop",
              reason_code: "no_memory_candidates",
            }
          : memoryStageIdentity === undefined
            ? {
                status: "failed",
                batch_results: [],
                failure_ids: memoryFailureIds,
              }
            : memoryResponse === undefined
              ? {
                  status: "unknown",
                  batch_results: [
                    {
                      ...memoryStageIdentity,
                      status: "unknown",
                      failure_ids: memoryFailureIds,
                    },
                  ],
                  failure_ids: memoryFailureIds,
                }
              : memoryResponse.batch_status === "completed"
                ? {
                    status: "succeeded",
                    batch_results: [
                      {
                        ...memoryStageIdentity,
                        status: "succeeded",
                        write_batch_id: memoryResponse.write_batch_id,
                        item_results: memoryResponse.item_results,
                        failure_ids: [],
                      },
                    ],
                    item_results: memoryResponse.item_results,
                  }
                : {
                    status: "partial_failed",
                    batch_results: [
                      {
                        ...memoryStageIdentity,
                        status: "partial_failed",
                        write_batch_id: memoryResponse.write_batch_id,
                        item_results: memoryResponse.item_results,
                        failure_ids: memoryFailureIds,
                      },
                    ],
                    item_results: memoryResponse.item_results,
                    failure_ids: memoryFailureIds,
                  };
      const knowthatFailureIds = knowthatResults.flatMap((item) => {
          if (item.outcome !== "failed") return [];
          const failureId = failureIdFor("knowthat", item.item_id);
          return failureId === undefined ? [] : [failureId];
        });
      const knowthatWriteResult: MetaKnowThatWriteStageResultV1 =
        knowthatItems.length === 0
          ? {
              status: "noop",
              reason_code: "no_knowthat_candidates",
            }
          : knowthatResponse === undefined
            ? {
                status: "unknown",
                failure_ids: knowthatFailureIds,
                ...(knowthatCompensationOutboxId === undefined
                  ? {}
                  : {
                      downstream_ref: knowthatCompensationOutboxId,
                    }),
              }
            : knowthatResponse.batch_status === "completed"
              ? {
                  status: "succeeded",
                  result: knowthatResponse,
                }
              : {
                  status: "partial_failed",
                  result: knowthatResponse,
                  failure_ids: knowthatFailureIds,
                };
      const resultPayload: MetaResultPayloadV1 = {
        schema_version: "urn:pai:meta:result-payload:v1",
        result_status: resultStatus,
        experience_summary: {
          summary: output.summary,
          execution_summary: output.execution_summary,
          reflection_summary: output.reflection_summary,
          evidence_refs: [...output.evidence_refs],
        },
        solidified_event_refs: [...solidifiedEventRefs],
        memory_candidates: output.memory_writes.map((item) => item.payload),
        memory_write_result: memoryWriteResult,
        knowthat_candidates: knowthatItems.map((item) => item.payload),
        knowthat_write_result: knowthatWriteResult,
        candidate_review_suggestions: [],
        candidate_review_results: [],
        skill_candidates: output.skill_candidates.map((item) => item.payload),
        personality_suggestions: [],
        quality_signals: output.quality_signals.map((item) => item.payload),
        linkage_check_refs: (knowthatResponse?.linkage_check_ids ?? []).map(
            (linkageCheckId) =>
              ({
                linkage_check_id: linkageCheckId,
                source_stage: "knowthat_write_batch" as const,
              }),
          ),
        partial_failures: [...ownerPartialFailures],
        llm_run_metadata: llmRunMetadata,
      };
      const evidenceByRef = new Map<string, MetaEvidenceArtifactV1>(
        evidenceArtifacts.map((entry) => [entry.ref, entry]),
      );
      const skillCandidateArtifacts = output.skill_candidates.map((item) => {
        const boundArtifacts = item.evidence_refs.map((ref) => {
          const binding = evidenceByRef.get(ref);
          if (binding === undefined) {
            throw new MetaCognitionErrorV1(
              "evidence_invalid",
              "Skill candidate references an artifact without a frozen hash binding",
              false,
            );
          }
          return binding;
        });
        return Object.freeze({
          candidate: item.payload,
          evidence_artifacts: Object.freeze(boundArtifacts),
        });
      });
      if (!Value.Check(MetaResultPayloadV1Schema, resultPayload)) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta result payload violates its owner schema",
          false,
        );
      }
      assertMetaResultPayloadSemanticBindingsV1(resultPayload);
      const experience: MetaExperienceRecordV1 = Object.freeze({
        id: deterministicId("meta_experience", { job_id: job.id, version: 1 }),
        trigger_process_id: job.trigger_process_id,
        ...scope(job),
        summary: output.summary,
        execution_summary: output.execution_summary,
        reflection_summary: output.reflection_summary,
        evidence_refs: Object.freeze([...output.evidence_refs]),
        quality_score: output.quality_score,
        snapshot_ref: job.snapshot_ref,
        snapshot_version: job.snapshot_version,
        snapshot_hash: job.snapshot_hash,
        created_at: finalizedAt.toISOString(),
      });
      const result: MetaResultV1 = Object.freeze({
        id: deterministicId("meta_result", { job_id: job.id, version: 1 }),
        meta_job_id: job.id,
        trigger_process_id: job.trigger_process_id,
        ...scope(job),
        result_version: 1,
        result_status: resultStatus,
        memory_write_refs: Object.freeze(memoryRefs),
        knowthat_write_refs: Object.freeze(knowthatRefs),
        skill_candidate_refs: Object.freeze(
          output.skill_candidates.map((item) => item.payload.candidate_id),
        ),
        quality_signal_refs: Object.freeze(
          output.quality_signals.map(
            (item) => `quality_signal:${job.id}:${item.item_id}`,
          ),
        ),
        partial_failures: Object.freeze(partialFailures),
        payload: resultPayload,
        finalized_at:
          resultStatus === "partial_pending"
            ? null
            : finalizedAt.toISOString(),
      });
      const projectionVersion = jobProjectionVersion(
        job.attempt_count,
        "settled",
      );
      const metaSummaryRef = experience.id;
      const resultMetaStatus =
        blockingCommitUnknownTransition === undefined
          ? "completed"
          : blockingCommitUnknownTransition.can_retry
            ? "retry_wait"
            : "failed";
      const retryAt =
        resultMetaStatus === "retry_wait"
          ? new Date(
              finalizedAt.getTime() +
                blockingCommitUnknownTransition!.retry_delay_ms!,
            )
          : null;
      const terminalEvents = [
        ...requestedEvents,
        durableEvent(
          job,
          "meta.experience.created",
          {
            experience_record_id: experience.id,
            solidified_event_range: {
              first_append_sequence_no:
                solidifiedEventRange.first_append_sequence_no,
              last_append_sequence_no:
                solidifiedEventRange.last_append_sequence_no,
            },
            quality_score: null,
          },
          finalizedAt,
          "experience",
        ),
        durableEvent(
          job,
          "meta.result.updated",
          {
            meta_result_id: result.id,
            previous_result_version: 0,
            result_version: result.result_version,
            previous_result_status: null,
            result_status: result.result_status,
            changed_failure_ids: failureIds,
            active_compensation_count:
              activeCompensationCommands.length,
            active_repair_count: 0,
            meta_summary_ref: metaSummaryRef,
            updated_at: finalizedAt.toISOString(),
          },
          finalizedAt,
          `result_updated:${result.result_version}`,
        ),
        ...(result.finalized_at === null
          ? []
          : [
              durableEvent(
                job,
                "meta.result.finalized",
                {
                  meta_result_id: result.id,
                  result_version: result.result_version,
                  result_status: result.result_status,
                  finalized_at: result.finalized_at,
                  previous_meta_status:
                    resultMetaStatus === "failed"
                      ? "failed"
                      : "completed",
                  next_meta_status:
                    resultMetaStatus === "failed"
                      ? "failed"
                      : "completed",
                  projection_version: projectionVersion,
                  meta_enqueue_reason: job.enqueue_reason,
                  active_compensation_count: 0,
                  active_repair_count: 0,
                  meta_summary_ref: metaSummaryRef,
                },
                finalizedAt,
                `result_finalized:${result.result_version}`,
              ),
            ]),
        resultMetaStatus === "retry_wait"
          ? durableEvent(
              job,
              "meta.job.retry_wait",
              {
                previous_meta_status: "running",
                next_meta_status: "retry_wait",
                projection_version: projectionVersion,
                reason_code:
                  blockingCommitUnknownTransition!.failure.code,
                next_retry_at: retryAt!.toISOString(),
                attempt_count: job.attempt_count,
                error_code:
                  blockingCommitUnknownTransition!.failure.code,
              },
              finalizedAt,
              `${job.attempt_count}`,
            )
          : resultMetaStatus === "failed"
            ? durableEvent(
                job,
                "meta.job.failed",
                {
                  previous_meta_status: "running",
                  next_meta_status: "failed",
                  projection_version: projectionVersion,
                  reason_code:
                    blockingCommitUnknownTransition!.failure.code,
                  failed_at: finalizedAt.toISOString(),
                  attempt_count: job.attempt_count,
                  error: blockingCommitUnknownTransition!.failure,
                  result_disposition: "finalized",
                  meta_result_id: result.id,
                  result_version: result.result_version,
                  result_status: "partial_failed",
                  result_finalized_at: result.finalized_at!,
                  active_compensation: false,
                  meta_enqueue_reason: job.enqueue_reason,
                },
                finalizedAt,
                `${job.attempt_count}`,
              )
            : durableEvent(
                job,
                "meta.job.completed",
                {
                  previous_meta_status: "running",
                  next_meta_status: "completed",
                  projection_version: projectionVersion,
                  reason_code: "meta_job_completed",
                  meta_result_id: result.id,
                  result_version: result.result_version,
                  result_status: result.result_status,
                  completed_at: finalizedAt.toISOString(),
                  partial_failures_count: partialFailures.length,
                  meta_enqueue_reason: job.enqueue_reason,
                  active_compensation_count:
                    activeCompensationCommands.length,
                  active_repair_count: 0,
                  meta_summary_ref: metaSummaryRef,
                  result_finalized_at: result.finalized_at,
                },
                finalizedAt,
                "completed",
              ),
      ];
      const artifactsWithoutHash = {
        result,
        experience,
        skill_candidates: Object.freeze(skillCandidateArtifacts),
        events: Object.freeze(terminalEvents),
        compensation_commands: activeCompensationCommands,
      };
      const artifacts: MetaTerminalArtifactsV1 = Object.freeze({
        ...artifactsWithoutHash,
        commit_hash: sha256CanonicalV1(artifactsWithoutHash),
      });
      assertNoRuntimeTokenV1(artifacts);
      if (
        resultMetaStatus === "retry_wait" &&
        retryAt !== null &&
        blockingCommitUnknownTransition !== undefined
      ) {
        let retryJobValue: MetaJobRecordV1;
        try {
          retryJobValue =
            await dependencies.repository.commitRetryWait({
              fence,
              failure: blockingCommitUnknownTransition.failure,
              next_retry_at: retryAt,
              events: artifacts.events,
              compensation_commands:
                artifacts.compensation_commands,
              result_artifacts: artifacts,
              now: finalizedAt,
              trace_id: job.trace_id,
            });
        } catch (commitError) {
          const [authoritativeJobValue, authoritativeResultValue] =
            await Promise.all([
              dependencies.repository.readJob(job.id),
              dependencies.repository.readResult(job.id),
            ]);
          if (
            authoritativeJobValue === undefined ||
            authoritativeResultValue === undefined
          ) {
            throw commitError;
          }
          const authoritativeJob = snapshotJob(
            authoritativeJobValue,
            "Meta retry commit-unknown job owner row",
            job.id,
          );
          const authoritativeResult = snapshotMetaOwnerValueV1(
            authoritativeResultValue,
            "Meta retry commit-unknown result owner row",
          );
          assertCommittedJobState(
            authoritativeJob,
            job,
            "retry_wait",
            "Meta retry commit-unknown owner row",
          );
          if (
            authoritativeJob.next_retry_at !==
              retryAt.toISOString() ||
            sha256CanonicalV1(authoritativeJob.error) !==
              sha256CanonicalV1(
                blockingCommitUnknownTransition.failure,
              ) ||
            sha256CanonicalV1(authoritativeResult) !==
              sha256CanonicalV1(result)
          ) {
            throw commitError;
          }
          retryJobValue = authoritativeJob;
        }
        const retryJob = snapshotJob(
          retryJobValue,
          "Meta blocking compensation retry owner response",
          job.id,
        );
        assertCommittedJobState(
          retryJob,
          job,
          "retry_wait",
          "Meta blocking compensation retry owner response",
        );
        if (
          retryJob.next_retry_at !== retryAt.toISOString() ||
          sha256CanonicalV1(retryJob.error) !==
            sha256CanonicalV1(
              blockingCommitUnknownTransition.failure,
            )
        ) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta blocking compensation retry owner response changed the retry transition",
            false,
          );
        }
        return {
          outcome: "retry_wait",
          job: retryJob,
          failure: blockingCommitUnknownTransition.failure,
        };
      }
      if (
        resultMetaStatus === "failed" &&
        blockingCommitUnknownTransition !== undefined
      ) {
        let failedJobValue: MetaJobRecordV1;
        try {
          failedJobValue =
            await dependencies.repository.commitFailed({
              fence,
              failure: blockingCommitUnknownTransition.failure,
              events: artifacts.events,
              compensation_commands: [],
              result_artifacts: artifacts,
              now: finalizedAt,
              trace_id: job.trace_id,
            });
        } catch (commitError) {
          const [authoritativeJobValue, authoritativeResultValue] =
            await Promise.all([
              dependencies.repository.readJob(job.id),
              dependencies.repository.readResult(job.id),
            ]);
          if (
            authoritativeJobValue === undefined ||
            authoritativeResultValue === undefined
          ) {
            throw commitError;
          }
          const authoritativeJob = snapshotJob(
            authoritativeJobValue,
            "Meta failure commit-unknown job owner row",
            job.id,
          );
          const authoritativeResult = snapshotMetaOwnerValueV1(
            authoritativeResultValue,
            "Meta failure commit-unknown result owner row",
          );
          assertCommittedJobState(
            authoritativeJob,
            job,
            "failed",
            "Meta failure commit-unknown owner row",
          );
          if (
            authoritativeJob.next_retry_at !== null ||
            sha256CanonicalV1(authoritativeJob.error) !==
              sha256CanonicalV1(
                blockingCommitUnknownTransition.failure,
              ) ||
            sha256CanonicalV1(authoritativeResult) !==
              sha256CanonicalV1(result)
          ) {
            throw commitError;
          }
          failedJobValue = authoritativeJob;
        }
        const failedJob = snapshotJob(
          failedJobValue,
          "Meta blocking compensation failure owner response",
          job.id,
        );
        assertCommittedJobState(
          failedJob,
          job,
          "failed",
          "Meta blocking compensation failure owner response",
        );
        if (
          failedJob.next_retry_at !== null ||
          sha256CanonicalV1(failedJob.error) !==
            sha256CanonicalV1(
              blockingCommitUnknownTransition.failure,
            )
        ) {
          throw new MetaCognitionErrorV1(
            "commit_drift",
            "Meta blocking compensation failure owner response changed the terminal transition",
            false,
          );
        }
        return {
          outcome: "failed",
          job: failedJob,
          failure: blockingCommitUnknownTransition.failure,
        };
      }
      const committed = snapshotMetaOwnerValueV1(
        await dependencies.repository.commitCompleted({
          fence,
          artifacts,
          now: finalizedAt,
          trace_id: job.trace_id,
        }),
        "Meta terminal owner response",
      );
      const committedJob = snapshotJob(
        committed.job,
        "Meta terminal job owner row",
        job.id,
      );
      const committedResult = snapshotMetaOwnerValueV1(
        committed.result,
        "Meta terminal result owner row",
      );
      assertCommittedJobState(
        committedJob,
        job,
        "completed",
        "Meta terminal owner response",
      );
      if (
        (committed.outcome !== "completed" &&
          committed.outcome !== "replayed") ||
        !Number.isSafeInteger(committedResult.result_version) ||
        committedResult.result_version < 1 ||
        committedResult.meta_job_id !== job.id ||
        committedResult.id !== result.id ||
        committedResult.trigger_process_id !== job.trigger_process_id ||
        !sameMetaScopeV1(committedResult, job) ||
        sha256CanonicalV1(committedResult) !==
          sha256CanonicalV1(result)
      ) {
        throw new MetaCognitionErrorV1(
          "commit_drift",
          "Meta terminal owner response changed the committed artifacts",
          false,
        );
      }
      return {
        outcome: committed.outcome,
        job: committedJob,
        result: committedResult,
      };
    },

    async readJob(jobId: string) {
      const value = await dependencies.repository.readJob(jobId);
      return value === undefined
        ? undefined
        : snapshotJob(value, "Meta read-job owner row", jobId);
    },

    async checkReadiness(signal: AbortSignal): Promise<void> {
      const ports = [
        dependencies.repository,
        dependencies.snapshot_resolver,
        dependencies.provider,
        dependencies.memory,
        dependencies.knowthat,
      ];
      for (const port of ports) {
        if (port.checkReadiness === undefined) {
          throw new Error(
            "Meta repository, snapshot, provider, Memory and KnowThat readiness probes are required",
          );
        }
        await port.checkReadiness(signal);
      }
    },
  });
}
