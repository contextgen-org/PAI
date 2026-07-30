import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";

import {
  assertMetaCognitionDomainEventSemanticBindingsV1,
  META_COGNITION_DOMAIN_EVENT_TYPES_V1,
  MetaCognitionDomainEventV1Schema,
} from "../../src/meta/events.v1.js";

const occurredAt = "2026-07-23T12:00:00.000Z";
const scope = Object.freeze({
  workspace_id: "workspace_1",
  bot_id: "bot_1",
  owner_agent_id: "agent_1",
  deployment_environment: "prod",
  release_channel: "stable",
  meta_job_id: "meta_job_1",
  trigger_process_id: "trigger_process_1",
});

function event(event_type: string, payload: Readonly<Record<string, unknown>>) {
  return {
    event_id: `event_${event_type}`,
    event_type,
    schema_version: "meta_cognition_event.v1",
    producer: "meta_cognition",
    occurred_at: occurredAt,
    idempotency_key: `idem_${event_type}`,
    trace_id: "trace_1",
    payload: { ...scope, ...payload },
  };
}

const fixtures = [
  event("meta.job.created", {
    previous_meta_status: null,
    next_meta_status: "queued",
    projection_version: 1,
    reason_code: "meta_job_created",
    snapshot_ref: "snapshot_1",
    snapshot_hash:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    snapshot_version: 1,
    attempt_count: 0,
  }),
  event("meta.job.started", {
    previous_meta_status: "queued",
    next_meta_status: "running",
    projection_version: 2,
    reason_code: "worker_started",
    lease_id: "lease_1",
    lease_generation: 1,
    attempt: 1,
    started_at: occurredAt,
  }),
  event("meta.job.retry_wait", {
    previous_meta_status: "running",
    next_meta_status: "retry_wait",
    projection_version: 3,
    reason_code: "provider_retryable",
    next_retry_at: "2026-07-23T12:01:00.000Z",
    attempt_count: 1,
    error_code: "provider_timeout",
  }),
  event("meta.experience.created", {
    experience_record_id: "experience_1",
    solidified_event_range: {
      first_append_sequence_no: 1,
      last_append_sequence_no: 10,
    },
    quality_score: null,
  }),
  event("meta.memory.write_requested", {
    memory_write_request_id: "memory_request_1",
    split_plan_id: "split_plan_1",
    plan_version: 1,
    chunk_no: 1,
    chunk_hash:
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    request_payload_ref: "object_meta_memory_1",
    request_payload_hash:
      "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    idempotency_key: "idem_meta.memory.write_requested",
    source_meta_job_id: "meta_job_1",
    source_trigger_process_id: "trigger_process_1",
  }),
  event("meta.knowthat.write_requested", {
    knowthat_write_request_id: "knowthat_request_1",
    request_payload_ref: "object_meta_knowthat_1",
    request_payload_hash:
      "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    idempotency_key: "idem_meta.knowthat.write_requested",
    source_meta_job_id: "meta_job_1",
  }),
  event("meta.candidate.review_requested", {
    candidate_id: "candidate_1",
    suggestion_id: "suggestion_1",
    target_candidate_version: 1,
    suggested_action: "promote",
    request_payload_ref: "object_candidate_review_1",
    request_payload_hash:
      "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    idempotency_key: "idem_meta.candidate.review_requested",
  }),
  event("meta.candidate.reviewed", {
    candidate_id: "candidate_1",
    suggestion_id: "suggestion_1",
    target_candidate_version: 1,
    review_id: "review_1",
    status: "completed",
    decision: "promoted",
    reason_code: "evidence_accepted",
    candidate_version_after: 2,
    linkage_check_ids: ["linkage_1"],
  }),
  event("meta.skill.candidate_application_requested", {
    candidate_id: "candidate_2",
    review_version: 1,
    application_id: "application_1",
    candidate_type: "skill",
    skill_key: "skill_example",
    application_payload_ref: "object_skill_application_1",
    application_payload_hash:
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    baseline_catalog_version: "catalog-1",
    reviewer_principal_id: "principal_1",
    idempotency_key: "idem_meta.skill.candidate_application_requested",
    trace_id: "trace_1",
    command_schema_version: "skill_candidate_application.v1",
  }),
  event("meta.feedback.required", {
    feedback_request_id: "feedback_request_1",
    dedupe_scope_ref: "candidate:candidate_1",
    question_key: "confirm_candidate",
    candidate_id: "candidate_1",
    delivery_mode: "active_or_internal",
    delivery_version: 1,
    question_payload_ref: "object_question_1",
    question_payload_hash:
      "sha256:abababababababababababababababababababababababababababababababab",
    expires_at: "2026-07-24T12:00:00.000Z",
    status: "open",
  }),
  event("meta.result.updated", {
    meta_result_id: "meta_result_1",
    previous_result_version: 0,
    result_version: 1,
    previous_result_status: null,
    result_status: "partial_pending",
    changed_failure_ids: ["failure_1"],
    active_compensation_count: 1,
    active_repair_count: 0,
    meta_summary_ref: "object_meta_summary_1",
    updated_at: occurredAt,
  }),
  event("meta.result.finalized", {
    meta_result_id: "meta_result_1",
    result_version: 3,
    result_status: "complete",
    finalized_at: occurredAt,
    previous_meta_status: "completed",
    next_meta_status: "completed",
    projection_version: 4,
    meta_enqueue_reason: "cooldown_expired",
    active_compensation_count: 0,
    active_repair_count: 0,
    meta_summary_ref: "object_meta_summary_1",
  }),
  event("meta.job.completed", {
    previous_meta_status: "running",
    next_meta_status: "completed",
    projection_version: 4,
    reason_code: "job_completed",
    meta_result_id: "meta_result_1",
    result_version: 1,
    result_status: "partial_pending",
    completed_at: occurredAt,
    partial_failures_count: 1,
    meta_enqueue_reason: "cooldown_expired",
    active_compensation_count: 1,
    active_repair_count: 0,
    meta_summary_ref: "object_meta_summary_1",
    result_finalized_at: null,
  }),
  event("meta.job.failed", {
    previous_meta_status: "running",
    next_meta_status: "failed",
    projection_version: 4,
    reason_code: "provider_invalid",
    failed_at: occurredAt,
    attempt_count: 1,
    error: {
      code: "provider_invalid",
      message: "Provider output failed validation",
      retryable: false,
      source: "provider",
    },
    result_disposition: "not_created",
    failure_stage: "provider_validation",
    no_result_reason: "provider_invalid",
    active_compensation: false,
    meta_enqueue_reason: "system_interrupted",
  }),
] as const;

describe("MetaCognitionDomainEventV1", () => {
  it("covers the complete owner event union with strict wire envelopes", () => {
    expect(fixtures.map((fixture) => fixture.event_type)).toEqual(
      META_COGNITION_DOMAIN_EVENT_TYPES_V1,
    );
    for (const fixture of fixtures) {
      expect(Value.Check(MetaCognitionDomainEventV1Schema, fixture)).toBe(true);
      assertMetaCognitionDomainEventSemanticBindingsV1(fixture);
    }
  });

  it("rejects lifted business identifiers and legacy payload hashes", () => {
    const fixture = fixtures[0];
    expect(
      Value.Check(MetaCognitionDomainEventV1Schema, {
        ...fixture,
        meta_job_id: "meta_job_1",
      }),
    ).toBe(false);
    expect(
      Value.Check(MetaCognitionDomainEventV1Schema, {
        ...fixture,
        payload_hash:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    ).toBe(false);
  });

  it("rejects the ambiguous legacy failed-event result shape", () => {
    const failed = fixtures.at(-1)!;
    expect(
      Value.Check(MetaCognitionDomainEventV1Schema, {
        ...failed,
        payload: {
          ...failed.payload,
          result_status: "partial_failed",
        },
      }),
    ).toBe(false);
  });

  it("enforces duplicated request identity and monotonic result versions", () => {
    expect(() =>
      assertMetaCognitionDomainEventSemanticBindingsV1({
        ...fixtures[4],
        payload: {
          ...fixtures[4].payload,
          idempotency_key: "drifted",
        },
      }),
    ).toThrow(/semantic binding mismatch/u);
    expect(() =>
      assertMetaCognitionDomainEventSemanticBindingsV1({
        ...fixtures[10],
        payload: {
        ...fixtures[10].payload,
          result_version: 0,
        },
      }),
    ).toThrow(/semantic binding mismatch/u);
  });
});
