export const hashA =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const hashB =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const at = "2026-07-23T00:00:00.000Z";
export const later = "2026-07-23T00:01:00.000Z";

export const scope = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;

export function qualitySignal(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "quality_signal.v1",
    signal_type: "snapshot_missing",
    severity: "error",
    source_kind: "service",
    source_service: "trigger_processor",
    source_ref: "tp-audit-1",
    evidence_refs: ["trigger_process:process-1"],
    recommended_action: "repair snapshot",
    payload: {},
    ...overrides,
  };
}

export function partialFailure(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "partial_failure.v1",
    failure_id: "failure-1",
    stage: "memory_write",
    target_service: "memory",
    operation: "write_batch",
    blocking: false,
    retryable: true,
    status: "retrying",
    attempt_count: 1,
    next_retry_at: later,
    compensation_owner: "meta_cognition",
    compensation_outbox_id: "outbox-1",
    error_ref: "error-1",
    ...overrides,
  };
}

export function feedbackRequest(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "feedback_request.v1",
    feedback_request_id: "feedback-1",
    ...scope,
    source_kind: "meta_job",
    meta_job_id: "job-1",
    trigger_process_id: "process-1",
    dedupe_scope_ref: {
      kind: "candidate",
      ref: "candidate:candidate-1",
    },
    question_key: "confirm_fact",
    question_payload_ref: "question-1",
    question_payload_hash: hashA,
    status: "open",
    delivery_mode: "internal_queue",
    target_actor_ref: "developer-1",
    target_binding_ref: null,
    delivery_channel: null,
    delivery_status: "not_applicable",
    delivery_version: 1,
    created_at: at,
    updated_at: at,
    expires_at: "2026-07-30T00:00:00.000Z",
    answered_by_trigger_id: null,
    answer_payload: null,
    ...overrides,
  };
}

export function metaResultPayload(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "urn:pai:meta:result-payload:v1",
    result_status: "complete",
    experience_summary: {
      summary: "A factual execution summary",
      execution_summary: {
        completed_stage_count: 1,
      },
      evidence_refs: ["trigger_process:process-1"],
    },
    solidified_event_refs: [
      {
        event_ref: "event-ref-1",
        event_type: "runtime.completed",
        append_sequence_no: 1,
        source_service: "action_runtime",
        source_event_id: "event-1",
        source_sequence_no: 1,
        occurred_at: at,
        payload_ref: "payload-1",
        payload_hash: hashA,
      },
    ],
    memory_candidates: [],
    memory_write_result: {
      status: "noop",
      reason_code: "no_memory_candidates",
    },
    knowthat_candidates: [],
    knowthat_write_result: {
      status: "noop",
      reason_code: "no_knowthat_candidates",
    },
    candidate_review_suggestions: [],
    candidate_review_results: [],
    skill_candidates: [],
    personality_suggestions: [],
    quality_signals: [],
    linkage_check_refs: [],
    partial_failures: [],
    llm_run_metadata: {
      snapshot_id: "snapshot-1",
      snapshot_ref: "snapshot-ref-1",
      snapshot_hash: hashA,
      snapshot_version: 1,
      input_event_range: {
        first_append_sequence_no: 1,
        last_append_sequence_no: 1,
      },
      runtime_run_id: null,
      context_snapshot_ref: null,
      intent_ref: null,
      runtime_state: null,
      cooldown_until: null,
      policy_snapshot_id: null,
      solidified_event_range: {
        first_append_sequence_no: 1,
        last_append_sequence_no: 1,
      },
      calls: [],
    },
    ...overrides,
  };
}
