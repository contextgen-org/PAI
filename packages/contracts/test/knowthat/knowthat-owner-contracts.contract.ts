import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  KnowThatCandidateReviewResultV1Schema,
  assertKnowThatCandidateReviewResultSemanticBindingsV1,
} from "../../src/knowthat/candidate-review-result.v1.js";
import { KnowThatEventEnvelopeV1Schema } from "../../src/knowthat/knowthat-event.v1.js";
import {
  KnowThatLinkageRecoveryResponseV1Schema,
  KnowThatLinkageRecoveryV1Schema,
} from "../../src/knowthat/linkage-recovery.v1.js";
import {
  KnowThatCandidateReviewRequestV1Schema,
  assertKnowThatCandidateReviewRequestV1,
} from "../../src/knowthat/candidate-review.v1.js";
import {
  KnowThatPromotionSuggestionV1Schema,
  assertKnowThatPromotionSuggestionSemanticBindingsV1,
} from "../../src/knowthat/promotion-suggestion.v1.js";
import { KnowThatQueryRequestV1Schema } from "../../src/knowthat/query-request.v1.js";
import { KnowThatQueryResponseV1Schema } from "../../src/knowthat/query-response.v1.js";
import {
  KnowThatWriteBatchRequestV1Schema,
  KnowThatWriteBatchResponseV1Schema,
  assertKnowThatWriteBatchResponseSemanticBindingsV1,
  assertKnowThatWriteBatchSemanticBindingsV1,
} from "../../src/knowthat/write-batch.v1.js";

const scope = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;

const writeRequest = {
  schema_version: "knowthat.write_batch.v1",
  ...scope,
  trigger_process_id: "process-1",
  source_meta_job_id: "meta-1",
  idempotency_key: "batch-1",
  trace_id: "trace-1",
  items: [
    {
      client_item_id: "item-1",
      text: "The deployment region is Shanghai",
      subject: "deployment",
      predicate: "region",
      object: "Shanghai",
      category: "project_fact",
      proposed_status: "active",
      direct_active_hint: true,
      direct_active_reason: "low_risk",
      risk_level: "low",
      explicitness: "explicit_statement",
      confidence: 0.95,
      source: "approved_artifact",
      source_ref: "artifact:release-1",
      evidence_refs: ["artifact:release-1"],
      evidence_pending: false,
    },
  ],
} as const;

describe("KnowThat write-batch owner contract", () => {
  it("accepts the canonical request and rejects caller rank/authority fields", () => {
    expect(Value.Check(KnowThatWriteBatchRequestV1Schema, writeRequest)).toBe(
      true,
    );
    expect(() =>
      assertKnowThatWriteBatchSemanticBindingsV1(writeRequest),
    ).not.toThrow();
    expect(
      Value.Check(KnowThatWriteBatchRequestV1Schema, {
        ...writeRequest,
        items: [
          {
            ...writeRequest.items[0],
            source_rank: 999,
            authority_gate_passed: true,
          },
        ],
      }),
    ).toBe(false);

    const response = {
      duplicate_replayed: false,
      linkage_job: {
        id: "linkage-1",
        fact_id: "fact-1",
        ...scope,
        check_type: "post_promotion_linkage_propagation",
        target_service: "memory",
        operation: "append_version",
        status: "pending",
        attempt_count: 1,
        next_retry_at: null,
        job_version: 5,
        updated_at: "2026-07-24T00:00:00.000Z",
      },
    } as const;
    expect(
      Value.Check(KnowThatLinkageRecoveryResponseV1Schema, response),
    ).toBe(true);
    expect(
      Value.Check(KnowThatLinkageRecoveryResponseV1Schema, {
        ...response,
        linkage_job: {
          ...response.linkage_job,
          claim_token: "must-not-leak",
        },
      }),
    ).toBe(false);
  });

  it("enforces evidence/direct-active/pending semantic bindings", () => {
    expect(() =>
      assertKnowThatWriteBatchSemanticBindingsV1({
        ...writeRequest,
        items: [
          {
            ...writeRequest.items[0],
            evidence_refs: ["artifact:other"],
          },
        ],
      }),
    ).toThrow(/semantic binding/);
    expect(() =>
      assertKnowThatWriteBatchSemanticBindingsV1({
        ...writeRequest,
        items: [
          {
            ...writeRequest.items[0],
            proposed_status: "candidate",
            evidence_pending: true,
            direct_active_hint: false,
            direct_active_reason: undefined,
            evidence_pending_reason: undefined,
          },
        ],
      }),
    ).toThrow(/semantic binding/);
  });

  it("binds response projections to item results", () => {
    const response = {
      schema_version: "knowthat.write_batch.v1",
      write_batch_id: "batch-1",
      batch_status: "completed",
      item_results: [
        {
          client_item_id: "item-1",
          status: "succeeded",
          semantic_key: "sk_v1_abc",
          final_status: "active",
          fact_id: "fact-1",
          decision_reason: "eligible",
          representative_client_item_id: "item-1",
          group_role: "representative",
          linkage_check_ids: ["linkage-1"],
          duplicate_replayed: false,
        },
      ],
      active_fact_ids: ["fact-1"],
      candidate_fact_ids: [],
      rejected_items: [],
      conflict_ids: [],
      linkage_check_ids: ["linkage-1"],
      duplicate_replayed: false,
    } as const;
    expect(Value.Check(KnowThatWriteBatchResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertKnowThatWriteBatchResponseSemanticBindingsV1(response),
    ).not.toThrow();
    expect(() =>
      assertKnowThatWriteBatchResponseSemanticBindingsV1({
        ...response,
        active_fact_ids: [],
      }),
    ).toThrow(/projection mismatch/);
  });
});

describe("KnowThat snapshot query owner contracts", () => {
  it("keeps first and next page request shapes mutually exclusive", () => {
    expect(
      Value.Check(KnowThatQueryRequestV1Schema, {
        schema_version: "knowthat_query.v1",
        ...scope,
        categories: ["rule", "project_fact"],
        query: "postgres",
        limit: 50,
      }),
    ).toBe(true);
    expect(
      Value.Check(KnowThatQueryRequestV1Schema, {
        schema_version: "knowthat_query.v1",
        ...scope,
        snapshot_token: "snapshot-token-12345",
        cursor: "cursor-token-123456",
        limit: 25,
      }),
    ).toBe(true);
    expect(
      Value.Check(KnowThatQueryRequestV1Schema, {
        schema_version: "knowthat_query.v1",
        ...scope,
        snapshot_token: "snapshot-token-12345",
        cursor: "cursor-token-123456",
        query: "drift",
      }),
    ).toBe(false);
  });

  it("requires snapshot revision/as_of in every response", () => {
    expect(
      Value.Check(KnowThatQueryResponseV1Schema, {
        schema_version: "knowthat_query.v1",
        snapshot_token: "snapshot-token-12345",
        query_revision: 7,
        as_of: "2026-07-24T00:00:00.000Z",
        facts: [],
      }),
    ).toBe(true);
  });
});

describe("KnowThat candidate review owner contracts", () => {
  it("binds promotion suggestion idempotency and forbids owner-internal fields", () => {
    const suggestion = {
      suggestion_id: "suggestion-1",
      source_meta_job_id: "meta-1",
      candidate_id: "candidate-1",
      target_candidate_version: 3,
      suggested_action: "promote",
      reason: "new independent evidence",
      new_evidence_refs: ["memory_point:point-2"],
      risk_level: "low",
      confidence_delta: 0,
      validation_profile: "standard",
      idempotency_key: "candidate_review:meta-1:suggestion-1",
    } as const;
    expect(Value.Check(KnowThatPromotionSuggestionV1Schema, suggestion)).toBe(
      true,
    );
    expect(() =>
      assertKnowThatPromotionSuggestionSemanticBindingsV1(suggestion),
    ).not.toThrow();
    expect(
      Value.Check(KnowThatPromotionSuggestionV1Schema, {
        ...suggestion,
        validation_profile: "ordinary",
      }),
    ).toBe(false);
    expect(
      Value.Check(KnowThatPromotionSuggestionV1Schema, {
        ...suggestion,
        memory_check_token: "forbidden",
      }),
    ).toBe(false);
  });

  it("binds the path candidate and Meta source event to the review request", () => {
    const payload = {
      candidate_id: "candidate-1",
      suggestion_id: "suggestion-1",
      source_meta_job_id: "meta-1",
    };
    const request = {
      schema_version: "knowthat.candidate_review.v1",
      ...scope,
      candidate_id: payload.candidate_id,
      suggestion_id: payload.suggestion_id,
      source_meta_job_id: payload.source_meta_job_id,
      target_candidate_version: 3,
      suggested_action: "promote",
      reason: "new independent evidence",
      new_evidence_refs: ["memory_point:point-2"],
      risk_level: "low",
      confidence_delta: 0,
      validation_profile: "standard",
      idempotency_key: "candidate_review:meta-1:suggestion-1",
      trace_id: "trace-review-1",
      source_event: {
        ...scope,
        source: "meta_cognition",
        event_id: "event-review-1",
        idempotency_key: "meta-review:meta-1:suggestion-1",
        payload_hash: `sha256:${"a".repeat(64)}`,
        semantic_hash: `sha256:${"b".repeat(64)}`,
        scope_fingerprint: `sha256:${"c".repeat(64)}`,
        payload,
      },
    } as const;
    expect(Value.Check(KnowThatCandidateReviewRequestV1Schema, request)).toBe(
      true,
    );
    expect(() => assertKnowThatCandidateReviewRequestV1(request)).not.toThrow();
    expect(() =>
      assertKnowThatCandidateReviewRequestV1({
        ...request,
        source_event: {
          ...request.source_event,
          payload: { ...payload, candidate_id: "candidate-other" },
        },
      }),
    ).toThrow(/source event binding mismatch/u);
  });

  it("binds request_feedback to the canonical dedupe scope", () => {
    const result = {
      review_id: "review-1",
      suggestion_id: "suggestion-1",
      candidate_id: "candidate-1",
      target_candidate_version: 3,
      status: "accepted",
      decision: "request_feedback",
      linkage_check_ids: [],
      feedback_request_suggestion: {
        candidate_id: "candidate-1",
        conflict_id: "conflict-1",
        dedupe_scope_ref: "conflict:conflict-1",
        question_key: "knowthat_candidate_resolution.v1",
        question_payload: { candidate_id: "candidate-1" },
        reason: "conflicting authoritative evidence",
        evidence_refs: ["artifact:release-1"],
      },
      candidate_version_after: 4,
      duplicate_replayed: false,
      reason_code: "open_conflict",
    } as const;
    expect(Value.Check(KnowThatCandidateReviewResultV1Schema, result)).toBe(
      true,
    );
    expect(() =>
      assertKnowThatCandidateReviewResultSemanticBindingsV1(result),
    ).not.toThrow();
  });
});

describe("KnowThat linkage recovery and durable event contracts", () => {
  it("uses the documented recovery_action and rejects the legacy action alias", () => {
    const request = {
      schema_version: "knowthat.linkage_recovery.v1",
      ...scope,
      linkage_job_id: "linkage-1",
      expected_job_version: 4,
      recovery_action: "replay",
      reason: "transient Memory outage",
      idempotency_key: "recovery-1",
      request_hash:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      trace_id: "trace-1",
    } as const;
    expect(Value.Check(KnowThatLinkageRecoveryV1Schema, request)).toBe(true);
    const { recovery_action: _recoveryAction, ...withoutRecoveryAction } =
      request;
    expect(
      Value.Check(KnowThatLinkageRecoveryV1Schema, {
        ...withoutRecoveryAction,
        action: "replay",
      }),
    ).toBe(false);
  });

  it("accepts only the exact 8-field KnowThat event envelope", () => {
    const envelope = {
      event_id: "event-1",
      event_type: "knowthat.fact.created",
      schema_version: "knowthat_event.v1",
      producer: "knowthat",
      occurred_at: "2026-07-24T00:00:00.000Z",
      idempotency_key: "knowthat.fact.created:bot-1:fact-1:revision-1",
      trace_id: "trace-1",
      payload: {
        ...scope,
        fact_id: "fact-1",
        semantic_key: "sk_v1_abc",
        category: "project_fact",
        current_status: "active",
        revision_id: "revision-1",
        source_ref: "artifact:release-1",
      },
    } as const;
    expect(Value.Check(KnowThatEventEnvelopeV1Schema, envelope)).toBe(true);
    expect(
      Value.Check(KnowThatEventEnvelopeV1Schema, {
        ...envelope,
        target: "observation_gateway",
      }),
    ).toBe(false);
    expect(
      Value.Check(KnowThatEventEnvelopeV1Schema, {
        ...envelope,
        payload: { ...envelope.payload, raw_user_text: "forbidden" },
      }),
    ).toBe(false);
  });
});
