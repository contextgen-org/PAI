import type {
  MemoryPrePromotionCheckRequestV1,
  MemoryPrePromotionCheckResponseV1,
  MemoryPrePromotionValidateRequestV1,
  MemoryPromotionReservationV1,
  MemoryPromotionReservationAckRequestV1,
  MemoryPromotionReservationAckResponseV1,
  MemoryPromotionReservationReleaseRequestV1,
  MemoryPromotionReservationReleaseResponseV1,
  TypedEvidenceRefV1,
} from "@pai/contracts";

export type KnowThatDeploymentEnvironmentV1 =
  | "local"
  | "dev"
  | "staging"
  | "prod";
export type KnowThatReleaseChannelV1 = "stable" | "canary";

export interface KnowThatScopeV1 {
  readonly workspace_id: string;
  readonly bot_id: string;
  readonly owner_agent_id: string;
  readonly deployment_environment: KnowThatDeploymentEnvironmentV1;
  readonly release_channel: KnowThatReleaseChannelV1;
}

export type KnowThatCategoryV1 =
  | "user_profile"
  | "relationship_state"
  | "world_state"
  | "self_state"
  | "project_fact"
  | "preference"
  | "rule";
export type KnowThatFactStatusV1 =
  | "candidate"
  | "active"
  | "rejected"
  | "expired";
export type KnowThatSourceV1 =
  | "explicit_feedback"
  | "super_user_explicit"
  | "approved_artifact"
  | "system_event_tool_result"
  | "user_explicit"
  | "developer_note"
  | "agent_observation"
  | "meta_inference";
export type KnowThatRiskLevelV1 = "low" | "medium" | "high" | "critical";
export type KnowThatExplicitnessV1 =
  | "explicit_statement"
  | "strong_implication"
  | "weak_implication"
  | "inferred";

export interface KnowThatWriteItemV1 {
  readonly client_item_id: string;
  readonly text: string;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly category: KnowThatCategoryV1;
  readonly semantic_key_candidate?: string;
  readonly proposed_status: "candidate" | "active";
  readonly direct_active_hint: boolean;
  readonly direct_active_reason?:
    | "user_explicit"
    | "low_risk"
    | "multi_source"
    | "system_event";
  readonly risk_level: KnowThatRiskLevelV1;
  readonly explicitness: KnowThatExplicitnessV1;
  readonly confidence: number;
  readonly source: KnowThatSourceV1;
  readonly source_ref: TypedEvidenceRefV1;
  readonly evidence_refs: readonly TypedEvidenceRefV1[];
  readonly valid_from?: string;
  readonly valid_until?: string;
  readonly evidence_pending: boolean;
  readonly evidence_pending_reason?: string;
}

export interface KnowThatWriteBatchRequestV1 extends KnowThatScopeV1 {
  readonly schema_version: "knowthat.write_batch.v1";
  readonly trigger_process_id: string;
  readonly source_meta_job_id: string;
  readonly idempotency_key: string;
  readonly trace_id: string;
  readonly items: readonly KnowThatWriteItemV1[];
}

export interface KnowThatAcceptedItemV1 {
  readonly client_item_id: string;
  readonly status: "succeeded";
  readonly semantic_key: string;
  readonly final_status: "active" | "candidate";
  readonly fact_id: string;
  readonly decision_reason: string;
  readonly representative_client_item_id: string;
  readonly group_role: "representative" | "merged" | "conflict";
  readonly conflict_id?: string;
  readonly linkage_check_ids: readonly string[];
  readonly duplicate_replayed: boolean;
}

export interface KnowThatRejectedItemV1 {
  readonly client_item_id: string;
  readonly status: "rejected";
  readonly code: string;
  readonly message: string;
  readonly field_path?: string;
}

export interface KnowThatWriteBatchResponseV1 {
  readonly schema_version: "knowthat.write_batch.v1";
  readonly write_batch_id: string;
  readonly batch_status: "completed" | "partial_failed";
  readonly item_results: readonly (
    | KnowThatAcceptedItemV1
    | KnowThatRejectedItemV1
  )[];
  readonly active_fact_ids: readonly string[];
  readonly candidate_fact_ids: readonly string[];
  readonly rejected_items: readonly KnowThatRejectedItemV1[];
  readonly conflict_ids: readonly string[];
  readonly linkage_check_ids: readonly string[];
  readonly duplicate_replayed: boolean;
}

export interface KnowThatFactV1 extends KnowThatScopeV1 {
  readonly id: string;
  readonly text: string;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly normalized_object: string;
  readonly object_hash: `sha256:${string}`;
  readonly canonicalization_version: "knowthat.semantic_key.v1";
  readonly semantic_key_display: string;
  readonly semantic_key: string;
  readonly category: KnowThatCategoryV1;
  readonly status: KnowThatFactStatusV1;
  readonly confidence: number;
  readonly source: KnowThatSourceV1;
  readonly source_ref: TypedEvidenceRefV1;
  readonly evidence_refs: readonly TypedEvidenceRefV1[];
  readonly valid_from: string | null;
  readonly valid_until: string | null;
  readonly evidence_pending: boolean;
  readonly evidence_pending_reason: string | null;
  readonly risk_level: KnowThatRiskLevelV1;
  readonly explicitness: KnowThatExplicitnessV1;
  readonly origin_write_batch_id: string;
  readonly origin_client_item_id: string;
  readonly state_version: number;
  readonly candidate_version: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface KnowThatFactRevisionV1 {
  readonly id: string;
  readonly fact_id: string;
  readonly revision_no: number;
  readonly patch: Readonly<Record<string, unknown>>;
  readonly reason: string;
  readonly actor: string;
  readonly created_at: string;
}

export interface KnowThatConflictV1 extends KnowThatScopeV1 {
  readonly id: string;
  readonly conflict_key: string;
  readonly semantic_key: string;
  readonly left_fact_id: string;
  readonly right_fact_id: string;
  readonly conflict_type: "value_contradiction" | "source_contradiction";
  readonly source_priority_snapshot: Readonly<Record<string, unknown>>;
  readonly confidence_delta: number;
  readonly evidence_refs: readonly TypedEvidenceRefV1[];
  readonly status:
    | "open"
    | "auto_resolved"
    | "feedback_requested"
    | "resolved"
    | "ignored";
  readonly proposed_resolution: Readonly<Record<string, unknown>>;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface KnowThatQueryFirstPageRequestV1 extends KnowThatScopeV1 {
  readonly schema_version: "knowthat_query.v1";
  readonly categories?: readonly KnowThatCategoryV1[];
  readonly query?: string;
  readonly limit?: number;
}

export interface KnowThatQueryNextPageRequestV1 extends KnowThatScopeV1 {
  readonly schema_version: "knowthat_query.v1";
  readonly snapshot_token: string;
  readonly cursor: string;
  readonly limit?: number;
}

export type KnowThatQueryRequestV1 =
  | KnowThatQueryFirstPageRequestV1
  | KnowThatQueryNextPageRequestV1;

export interface KnowThatQueryFactV1 {
  readonly id: string;
  readonly semantic_key: string;
  readonly category: KnowThatCategoryV1;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidence: number;
  readonly valid_from?: string;
  readonly valid_until?: string;
  readonly updated_at: string;
}

export interface KnowThatQueryResponseV1 {
  readonly schema_version: "knowthat_query.v1";
  readonly snapshot_token: string;
  readonly query_revision: number;
  readonly as_of: string;
  readonly facts: readonly KnowThatQueryFactV1[];
  readonly next_cursor?: string;
}

export interface KnowThatSourceEventV1 extends KnowThatScopeV1 {
  readonly source: "meta_cognition";
  readonly event_id: string;
  readonly idempotency_key: string;
  readonly payload_hash: `sha256:${string}`;
  readonly semantic_hash: `sha256:${string}`;
  readonly scope_fingerprint: `sha256:${string}`;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface KnowThatCandidateReviewRequestV1 extends KnowThatScopeV1 {
  readonly schema_version: "knowthat.candidate_review.v1";
  readonly candidate_id: string;
  readonly suggestion_id: string;
  readonly source_meta_job_id: string;
  readonly target_candidate_version: number;
  readonly suggested_action:
    | "promote"
    | "keep_candidate"
    | "reject"
    | "expire"
    | "request_feedback";
  readonly reason: string;
  readonly new_evidence_refs: readonly TypedEvidenceRefV1[];
  readonly risk_level: KnowThatRiskLevelV1;
  readonly confidence_delta: number;
  readonly validation_profile: "standard" | "confirmed_low_risk";
  readonly idempotency_key: string;
  readonly trace_id: string;
  readonly source_event: KnowThatSourceEventV1;
}

export interface KnowThatCandidateReviewResultV1 {
  readonly review_id: string;
  readonly suggestion_id: string;
  readonly candidate_id: string;
  readonly target_candidate_version: number;
  readonly status: "accepted" | "rejected" | "stale_candidate_version";
  readonly decision:
    | "promote"
    | "keep_candidate"
    | "reject"
    | "expire"
    | "request_feedback";
  readonly linkage_check_ids: readonly string[];
  readonly feedback_request_suggestion?: Readonly<{
    candidate_id: string;
    conflict_id?: string;
    dedupe_scope_ref: string;
    question_key: string;
    question_payload: Readonly<Record<string, unknown>>;
    reason: string;
    evidence_refs: readonly TypedEvidenceRefV1[];
  }>;
  readonly candidate_version_after?: number;
  readonly duplicate_replayed: boolean;
  readonly reason_code: string;
}

export interface KnowThatMemoryPrePromotionPortV1 {
  check(
    request: MemoryPrePromotionCheckRequestV1,
    signal: AbortSignal,
    scope?: KnowThatScopeV1,
  ): Promise<MemoryPrePromotionCheckResponseV1>;
  validate(
    request: MemoryPrePromotionValidateRequestV1,
    signal: AbortSignal,
    scope?: KnowThatScopeV1,
  ): Promise<MemoryPromotionReservationV1>;
  ack(
    request: MemoryPromotionReservationAckRequestV1,
    signal: AbortSignal,
    scope?: KnowThatScopeV1,
  ): Promise<MemoryPromotionReservationAckResponseV1>;
  release(
    request: MemoryPromotionReservationReleaseRequestV1,
    signal: AbortSignal,
    scope?: KnowThatScopeV1,
  ): Promise<MemoryPromotionReservationReleaseResponseV1>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

export interface KnowThatEventV1 extends KnowThatScopeV1 {
  readonly event_id: string;
  readonly event_type:
    | "knowthat.fact.created"
    | "knowthat.fact.updated"
    | "knowthat.candidate.promoted"
    | "knowthat.candidate.rejected"
    | "knowthat.fact.expired"
    | "knowthat.conflict.detected"
    | "knowthat.linkage_check.requested";
  readonly schema_version: "knowthat_event.v1";
  readonly producer: "knowthat";
  readonly occurred_at: string;
  readonly idempotency_key: string;
  readonly trace_id: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payload_hash: `sha256:${string}`;
  readonly target: "knowthat.projection" | "memory.linkage";
  readonly status: "pending" | "dispatching" | "sent" | "retry_wait" | "failed";
  readonly attempt_count: number;
  readonly next_retry_at: string | null;
  readonly claim_token: string | null;
  readonly locked_until: string | null;
}

export interface KnowThatEventEnvelopeV1 {
  readonly event_id: string;
  readonly event_type: KnowThatEventV1["event_type"];
  readonly schema_version: "knowthat_event.v1";
  readonly producer: "knowthat";
  readonly occurred_at: string;
  readonly idempotency_key: string;
  readonly trace_id: string;
  readonly payload: Readonly<Record<string, unknown>> & KnowThatScopeV1;
}

export type KnowThatDurableFailureV1 =
  | Readonly<{
      failure_code: "promotion_ack_unavailable";
      safe_summary: "Memory promotion acknowledgement is unavailable";
    }>
  | Readonly<{
      failure_code: "promotion_release_unavailable";
      safe_summary: "Memory promotion reservation release is unavailable";
    }>
  | Readonly<{
      failure_code: "linkage_retry_required";
      safe_summary: "Memory linkage update requires retry";
    }>
  | Readonly<{
      failure_code: "linkage_failed";
      safe_summary: "Memory linkage update failed";
    }>;

export function knowThatDurableFailureV1(
  failureCode: KnowThatDurableFailureV1["failure_code"],
): KnowThatDurableFailureV1 {
  switch (failureCode) {
    case "promotion_ack_unavailable":
      return Object.freeze({
        failure_code: failureCode,
        safe_summary: "Memory promotion acknowledgement is unavailable",
      });
    case "promotion_release_unavailable":
      return Object.freeze({
        failure_code: failureCode,
        safe_summary: "Memory promotion reservation release is unavailable",
      });
    case "linkage_retry_required":
      return Object.freeze({
        failure_code: failureCode,
        safe_summary: "Memory linkage update requires retry",
      });
    case "linkage_failed":
      return Object.freeze({
        failure_code: failureCode,
        safe_summary: "Memory linkage update failed",
      });
  }
}

export interface KnowThatLinkageJobV1 extends KnowThatScopeV1 {
  readonly id: string;
  readonly fact_id: string;
  readonly check_type: "post_promotion_linkage_propagation";
  readonly target_service: "memory";
  readonly operation:
    | "downgrade"
    | "mark_historical"
    | "append_version"
    | "feedback_required"
    | "no_op";
  readonly evidence_refs: readonly TypedEvidenceRefV1[];
  readonly idempotency_key: string;
  readonly status:
    | "pending"
    | "running"
    | "retry_wait"
    | "completed"
    | "failed"
    | "skipped";
  readonly attempt_count: number;
  readonly next_retry_at: string | null;
  readonly lease_generation: number;
  readonly claim_token: string | null;
  readonly locked_by: string | null;
  readonly locked_until: string | null;
  readonly last_error: KnowThatDurableFailureV1 | null;
  readonly job_version: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface KnowThatLinkageFenceV1 {
  readonly linkage_job_id: string;
  readonly lease_generation: number;
  readonly claim_token: string;
  readonly worker_id: string;
}

export interface KnowThatLinkageRecoveryRequestV1 extends KnowThatScopeV1 {
  readonly schema_version: "knowthat.linkage_recovery.v1";
  readonly linkage_job_id: string;
  readonly expected_job_version: number;
  readonly recovery_action: "replay" | "repair";
  readonly reason: string;
  readonly idempotency_key: string;
  readonly request_hash: `sha256:${string}`;
  readonly trace_id: string;
}

export class KnowThatErrorV1 extends Error {
  public constructor(
    public readonly code:
      | "schema_validation_failed"
      | "payload_too_large"
      | "too_many_items"
      | "item_too_large"
      | "idempotency_conflict"
      | "fact_not_found"
      | "candidate_not_found"
      | "stale_candidate_version"
      | "snapshot_expired"
      | "invalid_cursor"
      | "scope_mismatch"
      | "inbox_drift"
      | "lease_busy"
      | "stale_lease"
      | "invalid_state"
      | "pre_promotion_check_unavailable"
      | "promotion_reservation_unavailable"
      | "promotion_retry_required"
      | "promotion_ack_unavailable"
      | "recovery_conflict",
    message: string,
    public readonly retryable: boolean,
    public readonly field_path?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "KnowThatErrorV1";
  }
}
