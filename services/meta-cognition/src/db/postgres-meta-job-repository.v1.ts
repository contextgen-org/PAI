import { createHash } from "node:crypto";

import type { MetaCognitionDomainEventV1, MetaLlmRunMetadataV1, MetaSolidifiedEventRefV1 } from "@pai/contracts";
import type { VerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import { sha256CanonicalV1 } from "../canonical.v1.js";
import {
  MetaCognitionErrorV1,
  type MetaCompensationCommandV1,
  type MetaExperienceRecordV1,
  type MetaFailureV1,
  type MetaJobCreateRequestV1,
  type MetaJobRecordV1,
  type MetaLeaseFenceV1,
  type MetaLeaseGrantV1,
  type MetaProviderOutputV1,
  type MetaResultV1,
} from "../meta-types.v1.js";
import type {
  MetaCreateOrReuseResultV1,
  MetaJobRepositoryPortV1,
  MetaProviderOutputCheckpointV1,
  MetaTerminalArtifactsV1,
} from "../meta-job-repository.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "./permission-manifest.v1.js";

type MetaPostgresCompositionV1 = Pick<
  VerifiedOwnerPostgresCompositionV1<
    typeof META_COGNITION_REPOSITORY_CONTRACT_V1
  >,
  "postgres" | "unit_of_work" | "checkReadiness"
>;

type DatabaseRowV1 = Readonly<Record<string, unknown>>;

type MetaCreateOrReuseInputV1 = Parameters<MetaJobRepositoryPortV1["createOrReuse"]>[0];
type MetaCheckpointInputV1 = Parameters<MetaJobRepositoryPortV1["checkpointProviderOutput"]>[0];
type MetaAcquireLeaseInputV1 = Parameters<MetaJobRepositoryPortV1["acquireLease"]>[0];
type MetaHeartbeatLeaseInputV1 = Parameters<MetaJobRepositoryPortV1["heartbeatLease"]>[0];
type MetaStartJobInputV1 = Parameters<MetaJobRepositoryPortV1["startJob"]>[0];
type MetaOutboundCheckpointInputV1 = Parameters<MetaJobRepositoryPortV1["checkpointOutboundEvents"]>[0];
type MetaStaleAttemptInputV1 = Parameters<MetaJobRepositoryPortV1["recordStaleAttempt"]>[0];
type MetaRetryWaitInputV1 = Parameters<MetaJobRepositoryPortV1["commitRetryWait"]>[0];
type MetaCommitFailedInputV1 = Parameters<MetaJobRepositoryPortV1["commitFailed"]>[0];
type MetaCommitCompletedInputV1 = Parameters<MetaJobRepositoryPortV1["commitCompleted"]>[0];

function textV1(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Meta PostgreSQL ${label} is invalid`);
  }
  return value;
}

function nullableTextV1(value: unknown, label: string): string | null {
  return value === null ? null : textV1(value, label);
}

function integerV1(value: unknown, label: string, minimum = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`Meta PostgreSQL ${label} is invalid`);
  }
  return parsed;
}

function timestampV1(value: unknown, label: string): string {
  const timestamp = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error(`Meta PostgreSQL ${label} is invalid`);
  }
  return timestamp.toISOString();
}

function jsonObjectV1(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Meta PostgreSQL ${label} is invalid`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function jsonArrayV1(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`Meta PostgreSQL ${label} is invalid`);
  return value;
}

function hashV1(value: unknown, label: string): `sha256:${string}` {
  const result = textV1(value, label);
  if (!/^sha256:[0-9a-f]{64}$/u.test(result)) {
    throw new Error(`Meta PostgreSQL ${label} is invalid`);
  }
  return result as `sha256:${string}`;
}

function failureFromJsonV1(value: unknown, label: string): MetaFailureV1 {
  const failure = jsonObjectV1(value, label);
  const code = textV1(failure.code, `${label}.code`);
  const message = textV1(failure.message, `${label}.message`);
  if (typeof failure.retryable !== "boolean") {
    throw new Error(`Meta PostgreSQL ${label}.retryable is invalid`);
  }
  const source = textV1(failure.source, `${label}.source`);
  if (!["snapshot", "provider", "memory", "knowthat", "skill", "job"].includes(source)) {
    throw new Error(`Meta PostgreSQL ${label}.source is invalid`);
  }
  return Object.freeze({
    code,
    message,
    retryable: failure.retryable,
    source: source as MetaFailureV1["source"],
  });
}

function jobFromRowV1(row: DatabaseRowV1): MetaJobRecordV1 {
  const status = textV1(row.status, "meta_jobs.status");
  if (![
    "queued", "leased", "running", "retry_wait", "completed", "failed",
  ].includes(status)) {
    throw new Error("Meta PostgreSQL meta_jobs.status drifted");
  }
  const errorValue = row.error;
  const error = errorValue === null
    ? null
    : failureFromJsonV1(errorValue, "meta_jobs.error");
  if (row.learnable_snapshot_ready !== true) {
    throw new Error("Meta PostgreSQL meta_jobs.learnable_snapshot_ready drifted");
  }
  const common = {
    id: textV1(row.id, "meta_jobs.id"),
    schema_version: textV1(row.request_schema_version, "meta_jobs.request_schema_version") as MetaJobCreateRequestV1["schema_version"],
    trigger_process_id: textV1(row.trigger_process_id, "meta_jobs.trigger_process_id"),
    workspace_id: textV1(row.workspace_id, "meta_jobs.workspace_id"),
    bot_id: textV1(row.bot_id, "meta_jobs.bot_id"),
    owner_agent_id: textV1(row.owner_agent_id, "meta_jobs.owner_agent_id"),
    deployment_environment: textV1(row.deployment_environment, "meta_jobs.deployment_environment") as MetaJobRecordV1["deployment_environment"],
    release_channel: textV1(row.release_channel, "meta_jobs.release_channel") as MetaJobRecordV1["release_channel"],
    snapshot_ref: textV1(row.snapshot_ref, "meta_jobs.snapshot_ref"),
    snapshot_version: integerV1(row.snapshot_version, "meta_jobs.snapshot_version", 1),
    snapshot_hash: hashV1(row.snapshot_hash, "meta_jobs.snapshot_hash"),
    snapshot_retention_until: timestampV1(row.snapshot_retention_until, "meta_jobs.snapshot_retention_until"),
    learnable_snapshot_ready: true,
    idempotency_key: textV1(row.idempotency_key, "meta_jobs.idempotency_key"),
    trace_id: textV1(row.trace_id, "meta_jobs.trace_id"),
    request_hash: hashV1(row.request_hash, "meta_jobs.request_hash"),
    status: status as MetaJobRecordV1["status"],
    // The source schema records the authoritative live lease separately.  A
    // returned leased row has necessarily just transitioned from one of these
    // states; callers only use this field as lifecycle context, never as a
    // fence.
    lease_previous_status: row.lease_previous_status === null
      ? null
      : textV1(row.lease_previous_status, "meta_jobs.lease_previous_status") as MetaJobRecordV1["lease_previous_status"],
    attempt_count: integerV1(row.attempt_count, "meta_jobs.attempt_count"),
    next_retry_at: row.next_retry_at === null ? null : timestampV1(row.next_retry_at, "meta_jobs.next_retry_at"),
    error,
    created_at: timestampV1(row.created_at, "meta_jobs.created_at"),
    updated_at: timestampV1(row.updated_at, "meta_jobs.updated_at"),
  } as const;
  const enqueueReason = textV1(row.enqueue_reason, "meta_jobs.enqueue_reason");
  if (enqueueReason === "cooldown_expired") {
    if (row.boundary_system_event_ref !== null || row.cooldown_until === null) {
      throw new Error("Meta PostgreSQL cooldown job boundary drifted");
    }
    return Object.freeze({
      ...common,
      cooldown_until: timestampV1(row.cooldown_until, "meta_jobs.cooldown_until"),
      enqueue_reason: "cooldown_expired" as const,
      boundary_system_event_ref: null,
    });
  }
  if (enqueueReason === "user_retracted" || enqueueReason === "system_interrupted") {
    if (row.cooldown_until !== null || row.boundary_system_event_ref === null) {
      throw new Error("Meta PostgreSQL interrupted job boundary drifted");
    }
    return Object.freeze({
      ...common,
      cooldown_until: null,
      enqueue_reason: enqueueReason,
      boundary_system_event_ref: textV1(row.boundary_system_event_ref, "meta_jobs.boundary_system_event_ref"),
    });
  }
  if (enqueueReason === "failed_with_learnable_snapshot") {
    if (row.cooldown_until !== null || row.boundary_system_event_ref !== null) {
      throw new Error("Meta PostgreSQL failed job boundary drifted");
    }
    return Object.freeze({
      ...common,
      cooldown_until: null,
      enqueue_reason: "failed_with_learnable_snapshot" as const,
      boundary_system_event_ref: null,
    });
  }
  throw new Error("Meta PostgreSQL meta_jobs.enqueue_reason drifted");
}

function resultFromRowV1(row: DatabaseRowV1): MetaResultV1 {
  const payload = jsonObjectV1(row.payload, "meta_results.payload");
  const status = textV1(payload.result_status, "meta_results.payload.result_status");
  if (status !== "complete" && status !== "partial_pending" && status !== "partial_failed") {
    throw new Error("Meta PostgreSQL meta_results status drifted");
  }
  const stringList = (value: unknown, label: string) =>
    jsonArrayV1(value, label).map((item) => textV1(item, label));
  return Object.freeze({
    id: textV1(row.id, "meta_results.id"),
    meta_job_id: textV1(row.meta_job_id, "meta_results.meta_job_id"),
    trigger_process_id: textV1(row.trigger_process_id, "meta_results.trigger_process_id"),
    workspace_id: textV1(row.workspace_id, "meta_results.workspace_id"),
    bot_id: textV1(row.bot_id, "meta_results.bot_id"),
    owner_agent_id: textV1(row.owner_agent_id, "meta_results.owner_agent_id"),
    deployment_environment: textV1(row.deployment_environment, "meta_results.deployment_environment") as MetaResultV1["deployment_environment"],
    release_channel: textV1(row.release_channel, "meta_results.release_channel") as MetaResultV1["release_channel"],
    result_version: integerV1(row.result_version, "meta_results.result_version", 1),
    result_status: status,
    memory_write_refs: stringList(row.memory_write_refs, "meta_results.memory_write_refs"),
    knowthat_write_refs: stringList(row.knowthat_write_refs, "meta_results.knowthat_write_refs"),
    skill_candidate_refs: stringList(row.skill_candidate_refs, "meta_results.skill_candidate_refs"),
    quality_signal_refs: stringList(row.quality_signal_refs, "meta_results.quality_signal_refs"),
    partial_failures: jsonArrayV1(payload.partial_failures, "meta_results.payload.partial_failures") as MetaResultV1["partial_failures"],
    payload: payload as MetaResultV1["payload"],
    finalized_at: row.finalized_at === null ? null : timestampV1(row.finalized_at, "meta_results.finalized_at"),
  });
}

function eventRowV1(
  event: MetaCognitionDomainEventV1,
  job: MetaJobRecordV1,
  leaseGeneration: number | null,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id: event.event_id,
    meta_job_id: job.id,
    trigger_process_id: job.trigger_process_id,
    workspace_id: job.workspace_id,
    bot_id: job.bot_id,
    owner_agent_id: job.owner_agent_id,
    deployment_environment: job.deployment_environment,
    release_channel: job.release_channel,
    event_type: event.event_type,
    idempotency_key: event.idempotency_key,
    target: "trigger_processor",
    payload: event,
    payload_hash: sha256CanonicalV1(event),
    lease_generation: leaseGeneration === null ? null : String(leaseGeneration),
    request_hash: job.request_hash,
    status: "pending",
    attempt_count: 0,
    next_retry_at: null,
    created_at: event.occurred_at,
    updated_at: event.occurred_at,
  });
}

function auditRowV1(input: Readonly<{
  job: MetaJobRecordV1;
  previous_status: MetaJobRecordV1["status"] | null;
  next_status: MetaJobRecordV1["status"] | null;
  owner_id: string | null;
  action: string;
  reason_code: string;
  trace_id: string;
  now: Date;
  error?: MetaFailureV1 | null;
}>): Readonly<Record<string, unknown>> {
  const digest = createHash("sha256")
    .update(`${input.job.id}:${input.action}:${input.reason_code}:${input.now.toISOString()}`, "utf8")
    .digest("hex");
  return Object.freeze({
    id: `meta_audit:${input.job.id}:${input.action}:${digest.slice(0, 24)}`,
    meta_job_id: input.job.id,
    previous_status: input.previous_status,
    next_status: input.next_status,
    previous_recovery_state: null,
    next_recovery_state: null,
    owner_id: input.owner_id,
    actor: "meta_cognition",
    trace_id: input.trace_id,
    scope: {
      workspace_id: input.job.workspace_id,
      bot_id: input.job.bot_id,
      owner_agent_id: input.job.owner_agent_id,
      deployment_environment: input.job.deployment_environment,
      release_channel: input.job.release_channel,
    },
    expanded_fields: [],
    source_kind: "meta_job",
    source_service: "meta_cognition",
    source_ref: `meta_job:${input.job.id}`,
    audit_action: input.action,
    reason_code: input.reason_code,
    reason: null,
    error: input.error ?? null,
    evidence_refs: [],
    schema_version: "meta_job_audit.v1",
    created_at: input.now.toISOString(),
  });
}

function skillCandidateRowsV1(
  job: MetaJobRecordV1,
  artifacts: MetaTerminalArtifactsV1,
  now: Date,
): readonly Readonly<Record<string, unknown>>[] {
  return artifacts.skill_candidates.map(({ candidate, evidence_artifacts }) => {
    if (
      candidate.status !== "proposed" ||
      candidate.delivery_id !== null ||
      candidate.application_id !== null ||
      candidate.downstream_ref !== null ||
      candidate.attempt_count !== 0 ||
      candidate.last_error !== null ||
      candidate.workspace_id !== job.workspace_id ||
      candidate.bot_id !== job.bot_id ||
      candidate.owner_agent_id !== job.owner_agent_id ||
      candidate.deployment_environment !== job.deployment_environment ||
      candidate.release_channel !== job.release_channel ||
      candidate.evidence_refs.length !== evidence_artifacts.length ||
      evidence_artifacts.some(
        ({ ref, hash }, index) =>
          candidate.evidence_refs[index] !== ref ||
          !/^sha256:[0-9a-f]{64}$/u.test(hash),
      )
    ) {
      throw new MetaCognitionErrorV1(
        "commit_drift",
        "Meta Skill candidate is not a new, hash-bound proposal",
        false,
      );
    }
    return Object.freeze({
      id: candidate.candidate_id,
      workspace_id: candidate.workspace_id,
      bot_id: candidate.bot_id,
      owner_agent_id: candidate.owner_agent_id,
      deployment_environment: candidate.deployment_environment,
      release_channel: candidate.release_channel,
      trigger_process_id: job.trigger_process_id,
      meta_job_id: job.id,
      candidate_type:
        candidate.candidate_type === "deprecation"
          ? "skill_deprecation"
          : candidate.candidate_type,
      skill_key: candidate.skill_key,
      // The external proposal reference/hash is the contract of record.  The
      // provider value is preserved verbatim for audit rather than inventing a
      // second proposal representation.
      title: candidate.skill_key,
      proposal_payload: candidate,
      proposal_hash: candidate.proposal_hash,
      baseline_catalog_version: candidate.baseline_catalog_version,
      reason: "meta_provider_skill_candidate",
      evidence_refs: candidate.evidence_refs,
      evidence_artifacts,
      status: "proposed",
      downstream_status: "not_started",
      idempotency_key: `meta_skill_candidate:${job.id}:${candidate.candidate_id}`,
      review_version: candidate.review_version,
      review_idempotency_key: null,
      review_request_hash: null,
      review_response_payload: null,
      review_owner_service: "skill_registry",
      reviewed_by: null,
      reviewed_at: null,
      review_reason: null,
      registry_application_id: null,
      downstream_ref: null,
      delivery_attempt_count: 0,
      delivery_last_error: null,
      superseded_by_candidate_id: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  });
}

function providerBindingV1(metadata: MetaLlmRunMetadataV1): Readonly<Record<string, unknown>> {
  const call = metadata.calls.at(-1);
  if (call === undefined) {
    throw new MetaCognitionErrorV1("commit_drift", "Meta provider checkpoint is missing model call metadata", false);
  }
  return Object.freeze({
    model_provider: call.model_provider,
    model_name: call.model_name,
    model_version: call.model_version ?? null,
    adapter_version: call.adapter_version,
    parser_version: call.parser_version,
    input_hash: call.input_hash,
    schema_version: call.schema_version,
  });
}

function providerCheckpointFromRowV1(row: DatabaseRowV1): MetaProviderOutputCheckpointV1 {
  return Object.freeze({
    request_hash: hashV1(row.request_hash, "meta_provider_output_checkpoints.request_hash"),
    output_hash: hashV1(row.output_hash, "meta_provider_output_checkpoints.output_hash"),
    output: jsonObjectV1(row.output, "meta_provider_output_checkpoints.output") as unknown as MetaProviderOutputV1,
    solidified_event_range: jsonObjectV1(row.solidified_event_range, "meta_provider_output_checkpoints.solidified_event_range") as MetaProviderOutputCheckpointV1["solidified_event_range"],
    llm_run_metadata: jsonObjectV1(row.llm_run_metadata, "meta_provider_output_checkpoints.llm_run_metadata") as MetaLlmRunMetadataV1,
    solidified_event_refs: jsonArrayV1(row.solidified_event_refs, "meta_provider_output_checkpoints.solidified_event_refs") as readonly MetaSolidifiedEventRefV1[],
    evidence_artifacts: jsonArrayV1(row.evidence_artifacts, "meta_provider_output_checkpoints.evidence_artifacts") as MetaProviderOutputCheckpointV1["evidence_artifacts"],
  });
}

function translateWriterErrorV1(error: unknown): never {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  if (code === "23505") {
    throw new MetaCognitionErrorV1("idempotency_conflict", "Meta owner writer rejected an idempotency replay", false, { cause: error });
  }
  if (code === "40001") {
    throw new MetaCognitionErrorV1("stale_lease", "Meta owner fence changed", true, { cause: error });
  }
  throw new MetaCognitionErrorV1("commit_drift", "Meta owner writer failed", false, { cause: error });
}

export function createPostgresMetaJobRepositoryV1(
  composition: MetaPostgresCompositionV1,
): MetaJobRepositoryPortV1 {
  const readJob = async (jobId: string): Promise<MetaJobRecordV1 | undefined> => {
    const result = await composition.postgres.query<DatabaseRowV1>(
    "SELECT id, trigger_process_id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, snapshot_ref, snapshot_version, snapshot_hash, snapshot_retention_until, cooldown_until, boundary_system_event_ref, learnable_snapshot_ready, enqueue_reason, idempotency_key, trace_id, request_schema_version, request_hash, input_revision, status, lease_previous_status, attempt_count, next_retry_at, error, created_at, updated_at FROM meta_cognition.meta_jobs WHERE id = $1",
      [jobId],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : jobFromRowV1(row);
  };

  const transition = async (input: Readonly<{
    job: MetaJobRecordV1;
    next_status: MetaJobRecordV1["status"];
    next_retry_at: string | null;
    error: MetaFailureV1 | null;
    events: readonly MetaCognitionDomainEventV1[];
    fence?: MetaLeaseFenceV1;
    reason_code: string;
    now: Date;
  }>): Promise<MetaJobRecordV1> => {
    if (input.events.length === 0) {
      throw new MetaCognitionErrorV1("commit_drift", "Meta state transition requires at least one durable event", false);
    }
    const nextUpdatedAt = input.now.toISOString();
    try {
      await composition.unit_of_work.withTransaction(
        {
          operation: "meta_job_transition",
          idempotency_key: `${input.job.id}:${input.reason_code}:${input.events.map(({ idempotency_key }) => idempotency_key).join(",")}`,
          trace_id: input.job.trace_id,
          isolation: "serializable",
          retry: "serialization_failures",
        },
        async (transaction, { owner }) => owner.executeWriter<unknown, "transition_meta_job_v1">(transaction, {
          writer: "transition_meta_job_v1",
          arguments: {
            p_job_id: input.job.id,
            p_expected_status: input.job.status,
            p_expected_input_revision: "1",
            p_expected_updated_at: input.job.updated_at,
            p_next_status: input.next_status,
            p_result: {
              meta_jobs: {
                status: input.next_status,
                lease_previous_status: input.next_status === "leased"
                  ? input.job.lease_previous_status
                  : null,
                next_retry_at: input.next_retry_at,
                error: input.error,
                updated_at: nextUpdatedAt,
              },
              meta_job_audit_logs: [auditRowV1({
                job: input.job,
                previous_status: input.job.status,
                next_status: input.next_status,
                owner_id: input.fence?.owner_id ?? null,
                action: input.reason_code,
                reason_code: input.reason_code,
                trace_id: input.job.trace_id,
                now: input.now,
                error: input.error,
              })],
              meta_event_outbox: input.events.map((event) => eventRowV1(
                event,
                input.job,
                input.fence?.lease_generation ?? null,
              )),
            },
            p_request_hash: input.job.request_hash,
            p_trace_id: input.job.trace_id,
          },
          expected_rows: 1,
        }),
      );
    } catch (error) {
      translateWriterErrorV1(error);
    }
    const committed = await readJob(input.job.id);
    if (committed === undefined) throw new MetaCognitionErrorV1("job_not_found", "Meta job disappeared after transition", false);
    return committed;
  };

  return Object.freeze({
    async createOrReuse(input: MetaCreateOrReuseInputV1): Promise<MetaCreateOrReuseResultV1> {
      const existingByKey = await composition.postgres.query<DatabaseRowV1>(
        "SELECT id, trigger_process_id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, snapshot_ref, snapshot_version, snapshot_hash, snapshot_retention_until, cooldown_until, boundary_system_event_ref, learnable_snapshot_ready, enqueue_reason, idempotency_key, trace_id, request_schema_version, request_hash, input_revision, status, lease_previous_status, attempt_count, next_retry_at, error, created_at, updated_at FROM meta_cognition.meta_jobs WHERE idempotency_key = $1",
        [input.request.idempotency_key],
      );
      const existingRow = existingByKey.rows[0];
      if (existingRow !== undefined) {
        const existing = jobFromRowV1(existingRow);
        if (existing.request_hash !== input.request_hash) {
          throw new MetaCognitionErrorV1("idempotency_conflict", "Meta job request hash drifted", false);
        }
        return Object.freeze({ outcome: "reused", job: existing });
      }
      const jobRow = {
        id: input.job_id,
        ...input.request,
        request_hash: input.request_hash,
        input_revision: 1,
        status: "queued",
        attempt_count: 0,
        next_retry_at: null,
        error: null,
        created_at: input.now.toISOString(),
        updated_at: input.now.toISOString(),
      };
      const sourceEvent = {
        event_id: `trigger_meta_create:${input.job_id}`,
        event_type: "trigger.meta_job_requested",
        schema_version: "trigger_meta_job_request.v1",
        producer: "trigger_processor",
        occurred_at: input.now.toISOString(),
        idempotency_key: input.request.idempotency_key,
        trace_id: input.request.trace_id,
        payload: {
          trigger_process_id: input.request.trigger_process_id,
          meta_job_id: input.job_id,
          snapshot_ref: input.request.snapshot_ref,
          snapshot_version: input.request.snapshot_version,
          snapshot_hash: input.request.snapshot_hash,
        },
      };
      const processEvent = {
        id: `meta_process_event:${input.job_id}:1`,
        trigger_process_id: input.request.trigger_process_id,
        workspace_id: input.request.workspace_id,
        bot_id: input.request.bot_id,
        owner_agent_id: input.request.owner_agent_id,
        deployment_environment: input.request.deployment_environment,
        release_channel: input.request.release_channel,
        sequence_no: 1,
        event_type: "meta.job.created",
        idempotency_key: input.created_event.idempotency_key,
        payload: input.created_event,
        created_at: input.now.toISOString(),
      };
      try {
        await composition.unit_of_work.withTransaction(
          {
            operation: "enqueue_meta_job",
            idempotency_key: input.request.idempotency_key,
            trace_id: input.request.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) => owner.executeWriter<unknown, "enqueue_meta_job_from_trigger_event_v1">(transaction, {
            writer: "enqueue_meta_job_from_trigger_event_v1",
            arguments: {
              p_job_id: input.job_id,
              p_process_event_id: processEvent.id,
              p_job: {
                meta_jobs: jobRow,
                meta_job_audit_logs: [auditRowV1({
                  job: { ...jobRow, lease_previous_status: null } as MetaJobRecordV1,
                  previous_status: null,
                  next_status: "queued",
                  owner_id: null,
                  action: "created",
                  reason_code: "meta_job_created",
                  trace_id: input.request.trace_id,
                  now: input.now,
                })],
                meta_event_outbox: [eventRowV1(
                  input.created_event,
                  { ...jobRow, lease_previous_status: null } as MetaJobRecordV1,
                  null,
                )],
              },
              p_process_event: { trigger_process_events: processEvent },
              p_source_event: sourceEvent,
              p_idempotency_key: input.request.idempotency_key,
              p_payload_hash: sha256CanonicalV1(sourceEvent),
              p_semantic_hash: sha256CanonicalV1({
                trigger_process_id: input.request.trigger_process_id,
                snapshot_ref: input.request.snapshot_ref,
                snapshot_version: input.request.snapshot_version,
                snapshot_hash: input.request.snapshot_hash,
              }),
              p_scope_fingerprint: sha256CanonicalV1({
                workspace_id: input.request.workspace_id,
                bot_id: input.request.bot_id,
                owner_agent_id: input.request.owner_agent_id,
                deployment_environment: input.request.deployment_environment,
                release_channel: input.request.release_channel,
              }),
              p_trace_id: input.request.trace_id,
            },
            expected_rows: 1,
          }),
        );
      } catch (error) {
        const after = await readJob(input.job_id);
        if (after !== undefined && after.request_hash === input.request_hash) {
          return Object.freeze({ outcome: "reused", job: after });
        }
        translateWriterErrorV1(error);
      }
      const created = await readJob(input.job_id);
      if (created === undefined) throw new MetaCognitionErrorV1("commit_drift", "Meta enqueue writer returned no durable job", false);
      return Object.freeze({ outcome: "created", job: created });
    },

    readJob,

    async readResult(jobId: string) {
      const result = await composition.postgres.query<DatabaseRowV1>(
        "SELECT id, meta_job_id, trigger_process_id, workspace_id, bot_id, owner_agent_id, deployment_environment, release_channel, result_version, memory_write_refs, knowthat_write_refs, skill_candidate_refs, quality_signal_refs, payload, finalized_at FROM meta_cognition.meta_results WHERE meta_job_id = $1",
        [jobId],
      );
      const row = result.rows[0];
      return row === undefined ? undefined : resultFromRowV1(row);
    },

    async readProviderOutput(jobId: string) {
      const result = await composition.postgres.query<DatabaseRowV1>(
        "SELECT meta_job_id, lease_id, lease_generation, request_hash, output_hash, output, evidence_artifacts, solidified_event_range, llm_run_metadata, solidified_event_refs, provider_binding, created_at FROM meta_cognition.meta_provider_output_checkpoints WHERE meta_job_id = $1",
        [jobId],
      );
      const row = result.rows[0];
      return row === undefined ? undefined : providerCheckpointFromRowV1(row);
    },

    async checkpointProviderOutput(input: MetaCheckpointInputV1) {
      const job = await readJob(input.fence.job_id);
      if (job === undefined) {
        throw new MetaCognitionErrorV1("job_not_found", "Meta job was not found", false);
      }
      let response: unknown;
      try {
        response = await composition.unit_of_work.withTransaction(
          {
            operation: "checkpoint_meta_provider_output",
            idempotency_key: `${input.fence.job_id}:provider:g${input.fence.lease_generation}`,
            trace_id: job.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) => owner.executeWriter<unknown, "checkpoint_meta_provider_output_v1">(transaction, {
            writer: "checkpoint_meta_provider_output_v1",
            arguments: {
              p_job_id: input.fence.job_id,
              p_lease_id: input.fence.lease_id,
              p_expected_lease_generation: String(input.fence.lease_generation),
              p_request_hash: job.request_hash,
              p_output_hash: input.output_hash,
              p_output: input.output,
              p_solidified_event_range: input.solidified_event_range,
              p_llm_run_metadata: input.llm_run_metadata,
              p_solidified_event_refs: input.solidified_event_refs,
              p_evidence_artifacts: input.evidence_artifacts,
              p_provider_binding: providerBindingV1(input.llm_run_metadata),
              p_trace_id: job.trace_id,
            },
            expected_rows: 1,
          }),
        );
      } catch (error) {
        translateWriterErrorV1(error);
      }
      const checkpoint = await this.readProviderOutput(input.fence.job_id);
      if (checkpoint === undefined) throw new MetaCognitionErrorV1("commit_drift", "Meta provider checkpoint writer returned no row", false);
      const record = jsonObjectV1(response, "meta provider checkpoint writer response");
      const outcome = record.outcome;
      if (outcome !== "stored" && outcome !== "replayed") {
        throw new MetaCognitionErrorV1("commit_drift", "Meta provider checkpoint writer outcome drifted", false);
      }
      return Object.freeze({ outcome, checkpoint });
    },

    async acquireLease(input: MetaAcquireLeaseInputV1) {
      const job = await readJob(input.job_id);
      if (job === undefined) throw new MetaCognitionErrorV1("job_not_found", "Meta job was not found", false);
      const leaseUntil = new Date(input.now.getTime() + input.lease_ttl_ms).toISOString();
      let writerResult: unknown;
      try {
        writerResult = await composition.unit_of_work.withTransaction(
          {
            operation: "acquire_meta_job_lease",
            idempotency_key: `${input.job_id}:lease:g${input.expected_generation + 1}`,
            trace_id: input.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) => owner.executeWriter<unknown, "cas_meta_job_lease_v1">(transaction, {
            writer: "cas_meta_job_lease_v1",
            arguments: {
              p_job_id: input.job_id,
              p_expected_fence_generation: String(input.expected_generation),
              p_holder_id: input.owner_id,
              p_lease_until: leaseUntil,
              p_takeover_grace_ms: input.takeover_grace_ms,
              p_trace_id: input.trace_id,
            },
            expected_rows: 1,
          }),
        );
      } catch (error) {
        translateWriterErrorV1(error);
      }
      const row = jsonObjectV1(writerResult, "Meta lease writer response");
      const generation = integerV1(row.lease_generation, "Meta lease writer generation", 1);
      return Object.freeze({
        job_id: input.job_id,
        lease_id: textV1(row.lease_id, "Meta lease writer lease_id"),
        lease_generation: generation,
        owner_id: textV1(row.owner_id, "Meta lease writer owner_id"),
        lease_expires_at: timestampV1(row.lease_expires_at, "Meta lease writer lease_expires_at"),
        heartbeat_at: timestampV1(row.heartbeat_at, "Meta lease writer heartbeat_at"),
        attempt: integerV1(row.attempt, "Meta lease writer attempt", 1),
        takeover: input.expected_generation > 0,
      });
    },

    async heartbeatLease(input: MetaHeartbeatLeaseInputV1) {
      let writerResult: unknown;
      try {
        writerResult = await composition.unit_of_work.withTransaction(
          {
            operation: "renew_meta_job_lease",
            idempotency_key: `${input.fence.job_id}:heartbeat:g${input.fence.lease_generation}:${input.now.toISOString()}`,
            trace_id: input.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) => owner.executeWriter<unknown, "renew_meta_job_lease_v1">(transaction, {
            writer: "renew_meta_job_lease_v1",
            arguments: {
              p_job_id: input.fence.job_id,
              p_lease_id: input.fence.lease_id,
              p_expected_fence_generation: String(input.fence.lease_generation),
              p_holder_id: input.fence.owner_id,
              p_lease_until: new Date(input.now.getTime() + input.lease_ttl_ms).toISOString(),
              p_trace_id: input.trace_id,
            },
            expected_rows: 1,
          }),
        );
      } catch (error) {
        translateWriterErrorV1(error);
      }
      const row = jsonObjectV1(writerResult, "Meta lease renewal response");
      return Object.freeze({
        job_id: input.fence.job_id,
        lease_id: textV1(row.lease_id, "Meta lease renewal lease_id"),
        lease_generation: integerV1(row.lease_generation, "Meta lease renewal generation", 1),
        owner_id: textV1(row.owner_id, "Meta lease renewal owner_id"),
        lease_expires_at: timestampV1(row.lease_expires_at, "Meta lease renewal lease_expires_at"),
        heartbeat_at: timestampV1(row.heartbeat_at, "Meta lease renewal heartbeat_at"),
        attempt: integerV1(row.attempt, "Meta lease renewal attempt", 1),
        takeover: false,
      });
    },

    async startJob(input: MetaStartJobInputV1) {
      const job = await readJob(input.fence.job_id);
      if (job === undefined) throw new MetaCognitionErrorV1("job_not_found", "Meta job was not found", false);
      if (job.status === "running") return job;
      return transition({
        job,
        next_status: "running",
        next_retry_at: null,
        error: null,
        events: [input.event],
        fence: input.fence,
        reason_code: "meta_job_started",
        now: input.now,
      });
    },

    async checkpointOutboundEvents(input: MetaOutboundCheckpointInputV1) {
      const job = await readJob(input.fence.job_id);
      if (job === undefined) throw new MetaCognitionErrorV1("job_not_found", "Meta job was not found", false);
      await transition({
        job,
        next_status: job.status,
        next_retry_at: job.next_retry_at,
        error: job.error,
        events: input.events,
        fence: input.fence,
        reason_code: "meta_outbound_checkpointed",
        now: input.now,
      });
      return Object.freeze([...input.events]);
    },

    async isLeaseCurrent(fence: MetaLeaseFenceV1, now: Date) {
      const result = await composition.postgres.query<DatabaseRowV1>(
        "SELECT lease_id, lease_generation, owner_id, lease_expires_at, recovery_state FROM meta_cognition.meta_job_leases WHERE job_id = $1",
        [fence.job_id],
      );
      const row = result.rows[0];
      return row !== undefined &&
        row.lease_id === fence.lease_id &&
        integerV1(row.lease_generation, "meta_job_leases.lease_generation", 1) === fence.lease_generation &&
        row.owner_id === fence.owner_id &&
        row.recovery_state === "active" &&
        Date.parse(timestampV1(row.lease_expires_at, "meta_job_leases.lease_expires_at")) > now.getTime();
    },

    async recordStaleAttempt(input: MetaStaleAttemptInputV1) {
      const job = await readJob(input.job_id);
      if (job === undefined) {
        throw new MetaCognitionErrorV1("job_not_found", "Meta job was not found", false);
      }
      const idempotencyKey = `meta_stale:${createHash("sha256")
        .update(`${input.job_id}:${input.owner_id}:${input.lease_generation}:${input.reason_code}`, "utf8")
        .digest("hex")}`;
      try {
        await composition.unit_of_work.withTransaction(
          {
            operation: "record_meta_stale_attempt",
            idempotency_key: idempotencyKey,
            trace_id: input.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) => owner.executeWriter<unknown, "record_meta_stale_attempt_v1">(transaction, {
            writer: "record_meta_stale_attempt_v1",
            arguments: {
              p_job_id: input.job_id,
              p_owner_id: input.owner_id,
              p_observed_lease_generation: String(input.lease_generation),
              p_reason_code: input.reason_code,
              p_idempotency_key: idempotencyKey,
              p_request_hash: job.request_hash,
              p_trace_id: input.trace_id,
            },
            expected_rows: 1,
          }),
        );
      } catch (error) {
        translateWriterErrorV1(error);
      }
    },

    async commitRetryWait(input: MetaRetryWaitInputV1) {
      const job = await readJob(input.fence.job_id);
      if (job === undefined) throw new MetaCognitionErrorV1("job_not_found", "Meta job was not found", false);
      if (input.result_artifacts !== undefined) {
        return this.commitCompleted({
          fence: input.fence,
          artifacts: input.result_artifacts,
          now: input.now,
          trace_id: input.trace_id,
        }).then(({ job: committed }) => committed);
      }
      return transition({
        job,
        next_status: "retry_wait",
        next_retry_at: input.next_retry_at.toISOString(),
        error: input.failure,
        events: input.events,
        fence: input.fence,
        reason_code: input.failure.code,
        now: input.now,
      });
    },

    async commitFailed(input: MetaCommitFailedInputV1) {
      const job = await readJob(input.fence.job_id);
      if (job === undefined) throw new MetaCognitionErrorV1("job_not_found", "Meta job was not found", false);
      if (input.result_artifacts !== undefined) {
        return this.commitCompleted({
          fence: input.fence,
          artifacts: input.result_artifacts,
          now: input.now,
          trace_id: input.trace_id,
        }).then(({ job: committed }) => committed);
      }
      return transition({
        job,
        next_status: "failed",
        next_retry_at: null,
        error: input.failure,
        events: input.events,
        fence: input.fence,
        reason_code: input.failure.code,
        now: input.now,
      });
    },

    async commitCompleted(input: MetaCommitCompletedInputV1) {
      const existing = await this.readResult(input.fence.job_id);
      if (existing !== undefined) {
        if (sha256CanonicalV1({
          result: existing,
          experience: input.artifacts.experience,
          events: input.artifacts.events,
          compensation_commands: input.artifacts.compensation_commands,
        }) !== input.artifacts.commit_hash) {
          throw new MetaCognitionErrorV1("commit_drift", "Meta result replay commit hash drifted", false);
        }
        const job = await readJob(input.fence.job_id);
        if (job === undefined) throw new MetaCognitionErrorV1("job_not_found", "Meta job was not found", false);
        return Object.freeze({ outcome: "replayed" as const, job, result: existing });
      }
      if (input.artifacts.compensation_commands.length > 0) {
        throw new MetaCognitionErrorV1("commit_drift", "Meta compensation handoff requires the dedicated command-outbox writer", false);
      }
      const job = await readJob(input.fence.job_id);
      if (job === undefined) throw new MetaCognitionErrorV1("job_not_found", "Meta job was not found", false);
      const result = input.artifacts.result;
      const nextStatus = result.result_status === "partial_pending" ? "retry_wait" : result.result_status === "partial_failed" ? "failed" : "completed";
      const qualitySignals = result.payload.quality_signals.map((signal, index) => ({
        id: result.quality_signal_refs[index] ?? `quality_signal:${job.id}:${index + 1}`,
        trigger_process_id: job.trigger_process_id,
        workspace_id: job.workspace_id,
        bot_id: job.bot_id,
        owner_agent_id: job.owner_agent_id,
        deployment_environment: job.deployment_environment,
        release_channel: job.release_channel,
        ...signal,
        evidence_refs: signal.evidence_refs,
        created_at: input.now.toISOString(),
      }));
      const skillCandidates = skillCandidateRowsV1(
        job,
        input.artifacts,
        input.now,
      );
      try {
        await composition.unit_of_work.withTransaction(
          {
            operation: "finalize_meta_result",
            idempotency_key: result.id,
            trace_id: input.trace_id,
            isolation: "serializable",
            retry: "serialization_failures",
          },
          async (transaction, { owner }) => owner.executeWriter<unknown, "finalize_meta_result_v1">(transaction, {
            writer: "finalize_meta_result_v1",
            arguments: {
              p_result_id: result.id,
              p_job_id: job.id,
              p_expected_job_status: job.status,
              p_expected_job_updated_at: job.updated_at,
              p_result: {
                meta_results: {
                  ...result,
                  candidate_review_refs: [],
                  personality_suggestion_refs: [],
                  created_at: input.now.toISOString(),
                  updated_at: input.now.toISOString(),
                },
                meta_jobs: {
                  status: nextStatus,
                  next_retry_at: nextStatus === "retry_wait" ? job.next_retry_at : null,
                  error: nextStatus === "failed" ? job.error : null,
                  updated_at: input.now.toISOString(),
                },
                meta_job_audit_logs: [auditRowV1({
                  job,
                  previous_status: job.status,
                  next_status: nextStatus,
                  owner_id: input.fence.owner_id,
                  action: "meta_result_finalized",
                  reason_code: "meta_result_finalized",
                  trace_id: input.trace_id,
                  now: input.now,
                })],
                meta_event_outbox: input.artifacts.events.map((event) => eventRowV1(event, job, input.fence.lease_generation)),
              },
              p_experience_record: {
                experience_records: {
                  ...input.artifacts.experience,
                  evidence_refs: input.artifacts.experience.evidence_refs,
                } satisfies MetaExperienceRecordV1,
              },
              p_quality_signals: { quality_signals: qualitySignals },
              p_skill_candidates: { skill_candidates: skillCandidates },
              p_idempotency_key: result.id,
              p_request_hash: input.artifacts.commit_hash,
              p_trace_id: input.trace_id,
            },
            expected_rows: 1,
          }),
        );
      } catch (error) {
        translateWriterErrorV1(error);
      }
      const committedJob = await readJob(job.id);
      const committedResult = await this.readResult(job.id);
      if (committedJob === undefined || committedResult === undefined) {
        throw new MetaCognitionErrorV1("commit_drift", "Meta result writer did not persist its terminal state", false);
      }
      return Object.freeze({ outcome: "completed" as const, job: committedJob, result: committedResult });
    },

    async checkReadiness(signal: AbortSignal): Promise<void> {
      await composition.checkReadiness(signal);
      signal.throwIfAborted();
      await composition.postgres.query<DatabaseRowV1>(
        "SELECT 1 AS meta_provider_checkpoint_ready FROM meta_cognition.meta_provider_output_checkpoints LIMIT 1",
      );
    },
  });
}
