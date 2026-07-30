import type {
  KnowThatWriteItemV1,
  MetaCognitionDomainEventV1,
  MetaJobCreateRequestV1,
  MetaJobCreateResponseV1,
  MetaDurableCommandV1,
  MetaResultPayloadV1,
  MetaSkillCandidateV1,
  MemoryWriteItemV1,
  QualitySignalV1,
  TriggerProcessSnapshotReadContractV1,
  TriggerProcessSnapshotResolveRequestV1,
  TypedEvidenceRefV1,
} from "@pai/contracts";

import type {
  MetaDownstreamNameV1,
  MetaPartialFailureModeV1,
} from "./config.v1.js";

export type MetaDeploymentEnvironmentV1 =
  | "local"
  | "dev"
  | "staging"
  | "prod";
export type MetaReleaseChannelV1 = "stable" | "canary";

export interface MetaBotScopeV1 {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: MetaDeploymentEnvironmentV1;
  readonly release_channel: MetaReleaseChannelV1;
}

export type MetaEnqueueReasonV1 =
  | "cooldown_expired"
  | "user_retracted"
  | "system_interrupted"
  | "failed_with_learnable_snapshot";

export type { MetaJobCreateRequestV1, MetaJobCreateResponseV1 };

export type MetaJobStatusV1 =
  | "queued"
  | "leased"
  | "running"
  | "retry_wait"
  | "completed"
  | "failed";

export type MetaJobRecordV1 = MetaJobCreateRequestV1 & {
  readonly id: string;
  readonly request_hash: `sha256:${string}`;
  readonly status: MetaJobStatusV1;
  readonly lease_previous_status:
    | "queued"
    | "running"
    | "retry_wait"
    | null;
  readonly attempt_count: number;
  readonly next_retry_at: string | null;
  readonly error: MetaFailureV1 | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export interface MetaLeaseFenceV1 {
  readonly job_id: string;
  readonly lease_id: string;
  readonly lease_generation: number;
  readonly owner_id: string;
}

export interface MetaLeaseGrantV1 extends MetaLeaseFenceV1 {
  readonly lease_expires_at: string;
  readonly heartbeat_at: string;
  readonly attempt: number;
  readonly takeover: boolean;
}

export interface MetaFailureV1 {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly source: "snapshot" | "provider" | MetaDownstreamNameV1 | "job";
}

export interface MetaPartialFailureV1 extends MetaFailureV1 {
  readonly item_id: string;
  readonly mode: MetaPartialFailureModeV1;
  readonly compensation_required: boolean;
}

export interface MetaEvidenceBoundItemV1<
  TPayload extends object = Readonly<
    Record<string, unknown>
  >,
> {
  readonly item_id: string;
  readonly payload: TPayload;
  readonly evidence_refs: readonly TypedEvidenceRefV1[];
}

// A ref is not sufficient to authorize a cross-owner side effect.  The hash
// binds it to the immutable Trigger snapshot payload that Meta actually read.
export interface MetaEvidenceArtifactV1 {
  readonly ref: TypedEvidenceRefV1;
  readonly hash: `sha256:${string}`;
}

export interface MetaProviderOutputV1 {
  readonly schema_version: "meta_provider_output.v1";
  readonly summary: string;
  readonly execution_summary: MetaResultPayloadV1["experience_summary"]["execution_summary"];
  readonly reflection_summary: string;
  readonly evidence_refs: readonly TypedEvidenceRefV1[];
  readonly quality_score: number;
  readonly memory_writes: readonly MetaEvidenceBoundItemV1<MemoryWriteItemV1>[];
  readonly knowthat_candidates: readonly MetaEvidenceBoundItemV1<KnowThatWriteItemV1>[];
  readonly skill_candidates: readonly MetaEvidenceBoundItemV1<MetaSkillCandidateV1>[];
  readonly quality_signals: readonly MetaEvidenceBoundItemV1<QualitySignalV1>[];
}

export interface MetaExperienceRecordV1 extends MetaBotScopeV1 {
  readonly id: string;
  readonly trigger_process_id: string;
  readonly summary: string;
  readonly execution_summary: MetaResultPayloadV1["experience_summary"]["execution_summary"];
  readonly reflection_summary: string;
  readonly evidence_refs: readonly TypedEvidenceRefV1[];
  readonly quality_score: number;
  readonly snapshot_ref: string;
  readonly snapshot_version: number;
  readonly snapshot_hash: string;
  readonly created_at: string;
}

export interface MetaResultV1 extends MetaBotScopeV1 {
  readonly id: string;
  readonly meta_job_id: string;
  readonly trigger_process_id: string;
  readonly result_version: number;
  readonly result_status: "complete" | "partial_pending" | "partial_failed";
  readonly memory_write_refs: readonly string[];
  readonly knowthat_write_refs: readonly string[];
  readonly skill_candidate_refs: readonly string[];
  readonly quality_signal_refs: readonly string[];
  readonly partial_failures: readonly MetaPartialFailureV1[];
  readonly payload: MetaResultPayloadV1;
  readonly finalized_at: string | null;
}

export type { MetaCognitionDomainEventV1 };

export interface MetaCompensationCommandV1 extends MetaBotScopeV1 {
  readonly command_id: string;
  readonly meta_job_id: string;
  readonly target_service: "memory" | "knowthat";
  readonly idempotency_key: string;
  readonly lease_generation: number;
  readonly request_payload: Extract<
    MetaDurableCommandV1,
    { kind: "compensation" }
  >["payload"];
  readonly request_payload_hash: `sha256:${string}`;
  readonly trace_id: string;
  readonly created_at: string;
}

export interface MetaJobAuditV1 {
  readonly audit_id: string;
  readonly meta_job_id: string;
  readonly previous_status: MetaJobStatusV1;
  readonly next_status: MetaJobStatusV1;
  readonly owner_id: string | null;
  readonly lease_generation: number | null;
  readonly action:
    | "created"
    | "reused"
    | "leased"
    | "taken_over"
    | "heartbeat"
    | "started"
    | "outbound_checkpointed"
    | "retry_wait"
    | "completed"
    | "failed"
    | "stale_worker_rejected";
  readonly reason_code: string;
  readonly trace_id: string;
  readonly created_at: string;
}

export type MetaRunJobResponseV1 =
  | Readonly<{
      outcome: "completed" | "replayed";
      job: MetaJobRecordV1;
      result: MetaResultV1;
    }>
  | Readonly<{
      outcome: "retry_wait" | "failed";
      job: MetaJobRecordV1;
      failure: MetaFailureV1;
    }>
  | Readonly<{
      outcome: "stale";
      job: MetaJobRecordV1;
    }>;

export interface TriggerProcessSnapshotResolverPortV1 {
  resolve(
    request: TriggerProcessSnapshotResolveRequestV1,
    signal: AbortSignal,
  ): Promise<TriggerProcessSnapshotReadContractV1>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

export class MetaCognitionErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "invalid_request"
      | "authorization_scope_mismatch"
      | "idempotency_conflict"
      | "job_not_found"
      | "job_not_due"
      | "lease_busy"
      | "stale_lease"
      | "invalid_job_state"
      | "snapshot_invalid"
      | "provider_invalid"
      | "evidence_invalid"
      | "downstream_invalid"
      | "commit_drift",
    message: string,
    public readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MetaCognitionErrorV1";
  }
}
