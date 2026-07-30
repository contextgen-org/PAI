import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  MemoryConflictResolveRequestV1Schema,
  MemoryConflictResolveResponseV1Schema,
  assertMemoryConflictResolveRequestSemanticBindingsV1,
  assertMemoryConflictResolveResponseSemanticBindingsV1,
} from "../../src/memory/conflict.v1.js";
import {
  MemoryDeepRecallRequestV1Schema,
  MemoryDeepRecallResponseV1Schema,
  assertMemoryDeepRecallResponseSemanticBindingsV1,
} from "../../src/memory/deep-recall.v1.js";
import {
  MemoryDirectFeedbackRequestV1Schema,
  MemoryDirectFeedbackResponseV1Schema,
  assertMemoryDirectFeedbackRequestSemanticBindingsV1,
  assertMemoryDirectFeedbackResponseSemanticBindingsV1,
} from "../../src/memory/direct-feedback.v1.js";
import {
  MemoryGraphBuildRequestV1Schema,
  MemoryGraphBuildResponseV1Schema,
  assertMemoryGraphBuildResponseSemanticBindingsV1,
} from "../../src/memory/graph-build.v1.js";
import {
  MemoryIntegrationClaimV1Schema,
  MemoryIntegrationCheckpointRequestV1Schema,
  MemoryIntegrationFinishRequestV1Schema,
  MemoryIntegrationJobDetailsV1Schema,
  MemoryIntegrationRunRequestV1Schema,
  assertMemoryIntegrationFinishRequestSemanticBindingsV1,
  assertMemoryIntegrationCheckpointRequestSemanticBindingsV1,
  assertMemoryIntegrationJobSemanticBindingsV1,
} from "../../src/memory/integration-job.v1.js";
import {
  MEMORY_EVENT_CONSUMERS_V1,
  MEMORY_EVENT_PAYLOAD_SCHEMAS_V1,
  MEMORY_EVENT_TYPES_V1,
  MemoryEventEnvelopeV1Schema,
  assertMemoryEventConsumerV1,
  assertMemoryEventEnvelopeSemanticBindingsV1,
} from "../../src/memory/memory-event.v1.js";
import {
  MemoryPrePromotionCheckResponseV1Schema,
  MemoryPrePromotionValidateRequestV1Schema,
  MemoryPromotionReservationV1Schema,
  MemoryPromotionReservationAckRequestV1Schema,
  MemoryPromotionReservationAckResponseV1Schema,
  MemoryPromotionReservationReleaseRequestV1Schema,
  MemoryPromotionReservationReleaseResponseV1Schema,
  assertMemoryPrePromotionCheckResponseSemanticBindingsV1,
  assertMemoryPromotionReservationSemanticBindingsV1,
} from "../../src/memory/pre-promotion-check.v1.js";
import {
  MemoryQuerySeriesRequestV1Schema,
  MemoryQuerySeriesResponseV1Schema,
  assertMemoryQuerySeriesRequestSemanticBindingsV1,
  assertMemoryQuerySeriesResponseSemanticBindingsV1,
} from "../../src/memory/query-series.v1.js";

const sha256 = `sha256:${"a".repeat(64)}`;
const eventScope = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
} as const;

describe("Memory owner catalog contracts", () => {
  it("binds deep recall channel ranks and partial state", () => {
    const request = {
      schema_version: "memory.deep_recall.v1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      runtime_run_id: "run-1",
      trigger_process_id: "process-1",
      query: "why was PostgreSQL selected?",
      scope: { channels: ["semantic", "relationship"] },
      limit: 20,
      idempotency_key: "deep-1",
      policy_snapshot_id: "policy-1",
      policy_snapshot_hash: sha256,
      capability_token: "token-1",
      capability_token_id: "token-id-1",
      graph_profile_version: "memory.deep_recall_graph.v1",
    } as const;
    expect(Value.Check(MemoryDeepRecallRequestV1Schema, request)).toBe(true);
    expect(
      Value.Check(MemoryDeepRecallRequestV1Schema, {
        ...request,
        unexpected: true,
      }),
    ).toBe(false);

    const response = {
      code: "memory_deep_recall_completed",
      message: "completed",
      retryable: false,
      details: {
        request_id: "request-1",
        ranking_profile_version: "memory.deep_recall.rrf.v1",
        graph_profile_version: "memory.deep_recall_graph.v1",
        items: [
          {
            memory_point_id: "point-1",
            series_id: "series-1",
            topic_family_key: "family-1",
            content_summary: "PostgreSQL was selected.",
            matched_channels: ["semantic"],
            channel_ranks: { semantic: 1 },
            raw_rrf_score: 0.016,
            normalized_rrf_score: 1,
            importance_score: 0.9,
            recency_score: 0.8,
            final_score: 0.92,
            relationship_path: [],
            redaction_status: "not_required",
          },
        ],
        actual_graph_budget: {
          max_hops: 2,
          nodes_visited: 1,
          edges_visited: 0,
        },
        is_partial: true,
        completed_channels: ["semantic"],
        missing_channels: ["relationship"],
        second_query_executed: false,
        partial_reason: "graph_timeout",
      },
      trace_id: "trace-1",
    } as const;
    expect(Value.Check(MemoryDeepRecallResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertMemoryDeepRecallResponseSemanticBindingsV1(response),
    ).not.toThrow();
    expect(() =>
      assertMemoryDeepRecallResponseSemanticBindingsV1({
        ...response,
        details: {
          ...response.details,
          items: [
            {
              ...response.details.items[0],
              matched_channels: ["semantic", "timeline"],
            },
          ],
        },
      }),
    ).toThrow(/channel rank binding/);
  });

  it("binds pre-promotion evidence versions and short-lived fences", () => {
    const response = {
      schema_version: "memory.pre_promotion_check.v1",
      check_id: "check-1",
      check_generation: 1,
      candidate_fact_id: "candidate-1",
      overall_result: "passed",
      checked_at: "2026-07-24T00:00:00.000Z",
      expires_at: "2026-07-24T00:00:30.000Z",
      check_token: "check-token-1",
      check_policy_version: "memory.pre_promotion_policy.rev309",
      required_checks: [
        "point_exists",
        "state_allowed",
        "no_unresolved_conflict",
        "not_expired",
        "provenance_integrity",
      ],
      points: [
        {
          memory_point_id: "point-1",
          exists: true,
          state_version: 3,
          state_hash: sha256,
          status: "active",
          evidence_valid_until: null,
          unresolved_conflicts: [],
          expired: false,
          provenance_valid: true,
          source_trigger_process_id: "process-1",
          confidence_score: 0.9,
          user_explicit_confirmation: false,
          blocking_reasons: [],
        },
      ],
      summary: {
        active_count: 1,
        independent_trigger_process_count: 1,
        has_user_explicit_confirmation: false,
        blocking_reasons: [],
      },
      duplicate_replayed: false,
    } as const;
    expect(
      Value.Check(MemoryPrePromotionCheckResponseV1Schema, response),
    ).toBe(true);
    expect(() =>
      assertMemoryPrePromotionCheckResponseSemanticBindingsV1(response),
    ).not.toThrow();
    expect(() =>
      assertMemoryPrePromotionCheckResponseSemanticBindingsV1({
        ...response,
        overall_result: "needs_review",
        required_checks: [
          ...response.required_checks,
          "independent_sources",
        ],
        summary: {
          ...response.summary,
          blocking_reasons: ["insufficient_independent_sources"],
        },
      }),
    ).not.toThrow();

    const validation = {
      schema_version: "memory.pre_promotion_validate.v1",
      bot_id: "bot-1",
      check_token: "check-token-1",
      check_id: "check-1",
      check_generation: 1,
      candidate_fact_id: "candidate-1",
      expected_point_versions: [
        { memory_point_id: "point-1", state_version: 3, state_hash: sha256 },
      ],
      expected_conflict_versions: [
        { conflict_id: "conflict-1", conflict_version: 2 },
      ],
      idempotency_key: "validate-1",
    } as const;
    expect(
      Value.Check(MemoryPrePromotionValidateRequestV1Schema, validation),
    ).toBe(true);

    const reservation = {
      schema_version: "memory.promotion_reservation.v1",
      reservation_id: "reservation-1",
      check_id: "check-1",
      check_generation: 1,
      candidate_fact_id: "candidate-1",
      fencing_generation: 8,
      reserved_points: validation.expected_point_versions,
      reserved_conflicts: validation.expected_conflict_versions,
      reservation_token: "reservation-token-1",
      reserved_at: "2026-07-24T00:00:31.000Z",
      expires_at: "2026-07-24T00:00:46.000Z",
      status: "active",
    } as const;
    expect(Value.Check(MemoryPromotionReservationV1Schema, reservation)).toBe(
      true,
    );
    expect(() =>
      assertMemoryPromotionReservationSemanticBindingsV1(reservation),
    ).not.toThrow();
    expect(() =>
      assertMemoryPromotionReservationSemanticBindingsV1({
        ...reservation,
        expires_at: "2026-07-24T00:00:47.000Z",
      }),
    ).toThrow(/15 seconds/);

    const ack = {
      schema_version: "memory.promotion_reservation_ack.v1",
      bot_id: "bot-1",
      reservation_id: reservation.reservation_id,
      candidate_fact_id: reservation.candidate_fact_id,
      fencing_generation: reservation.fencing_generation,
      reservation_token_hash: `sha256:${"a".repeat(64)}`,
      promotion_revision_id: "revision-1",
      committed_at: "2026-07-24T00:00:32.000Z",
      idempotency_key: "ack-1",
      trace_id: "trace-1",
    } as const;
    expect(Value.Check(MemoryPromotionReservationAckRequestV1Schema, ack)).toBe(
      true,
    );
    expect(
      Value.Check(MemoryPromotionReservationAckRequestV1Schema, {
        ...ack,
        reservation_token: "must-never-cross-the-durable-boundary",
      }),
    ).toBe(false);
    expect(
      Value.Check(MemoryPromotionReservationAckRequestV1Schema, {
        ...ack,
        reservation_token_hash: "sha256:not-a-hash",
      }),
    ).toBe(false);
    expect(
      Value.Check(MemoryPromotionReservationAckResponseV1Schema, {
        schema_version: "memory.promotion_reservation_ack.v1",
        reservation_id: ack.reservation_id,
        candidate_fact_id: ack.candidate_fact_id,
        fencing_generation: ack.fencing_generation,
        status: "committed",
        promotion_revision_id: ack.promotion_revision_id,
        committed_at: ack.committed_at,
        duplicate_replayed: false,
      }),
    ).toBe(true);

    const release = {
      schema_version: "memory.promotion_reservation_release.v1",
      bot_id: "bot-1",
      reservation_id: reservation.reservation_id,
      candidate_fact_id: reservation.candidate_fact_id,
      fencing_generation: reservation.fencing_generation,
      reservation_token_hash: `sha256:${"a".repeat(64)}`,
      release_reason: "promotion_commit_failed",
      released_at: "2026-07-24T00:00:32.000Z",
      idempotency_key: "release-1",
      trace_id: "trace-1",
    } as const;
    expect(
      Value.Check(MemoryPromotionReservationReleaseRequestV1Schema, release),
    ).toBe(true);
    expect(
      Value.Check(MemoryPromotionReservationReleaseRequestV1Schema, {
        ...release,
        reservation_token: "must-never-cross-the-durable-boundary",
      }),
    ).toBe(false);
    expect(
      Value.Check(MemoryPromotionReservationReleaseResponseV1Schema, {
        schema_version: "memory.promotion_reservation_release.v1",
        reservation_id: release.reservation_id,
        candidate_fact_id: release.candidate_fact_id,
        fencing_generation: release.fencing_generation,
        status: "released",
        release_reason: release.release_reason,
        released_at: release.released_at,
        duplicate_replayed: false,
      }),
    ).toBe(true);
  });

  it("binds direct feedback actions to their CAS mutation result", () => {
    const request = {
      schema_version: "memory.direct_feedback.v1",
      bot_id: "bot-1",
      target_type: "memory_point",
      target_id: "point-1",
      action: "correct",
      expected_state_version: 3,
      idempotency_key: "feedback-1",
      reason: "The date is wrong.",
      correction: {
        content_summary: "The decision was made on 24 July.",
        occurred_at: "2026-07-24T00:00:00.000Z",
      },
      evidence_ref: "user_feedback:message-1",
    } as const;
    expect(Value.Check(MemoryDirectFeedbackRequestV1Schema, request)).toBe(
      true,
    );
    expect(() =>
      assertMemoryDirectFeedbackRequestSemanticBindingsV1(request),
    ).not.toThrow();
    expect(() =>
      assertMemoryDirectFeedbackRequestSemanticBindingsV1({
        ...request,
        correction: undefined,
      }),
    ).toThrow(/payload binding/);

    const response = {
      schema_version: "memory.direct_feedback.v1",
      feedback_id: "feedback-1",
      target_type: "memory_point",
      target_id: "point-1",
      previous_state_version: 3,
      state_version: 4,
      resulting_status: "active",
      revision_refs: [
        {
          aggregate_type: "memory_point",
          aggregate_id: "point-1",
          revision_id: "revision-1",
        },
      ],
      audit_ids: ["audit-1"],
      event_ids: ["event-1"],
      duplicate_replayed: false,
    } as const;
    expect(Value.Check(MemoryDirectFeedbackResponseV1Schema, response)).toBe(
      true,
    );
    expect(() =>
      assertMemoryDirectFeedbackResponseSemanticBindingsV1(response),
    ).not.toThrow();
    expect(() =>
      assertMemoryDirectFeedbackResponseSemanticBindingsV1({
        ...response,
        state_version: 5,
      }),
    ).toThrow(/increment by one/);
  });

  it("binds conflict decisions, four aggregate versions, and dry-run effects", () => {
    const request = {
      schema_version: "memory.conflict_resolve.v1",
      bot_id: "bot-1",
      decision: "keep_both",
      reason: "The facts apply to separate scopes.",
      evidence_refs: ["memory_point:point-1", "memory_point:point-2"],
      expected_conflict_version: 2,
      expected_versions: {
        old_series_state_version: 4,
        old_point_state_version: 3,
        new_series_state_version: 2,
        new_point_state_version: 1,
      },
      keep_both_plan: {
        mode: "split_scope_dual_active",
        old_scope_key: "production",
        new_scope_key: "staging",
      },
      dry_run: false,
      idempotency_key: "resolve-1",
      trace_id: "trace-1",
    } as const;
    expect(Value.Check(MemoryConflictResolveRequestV1Schema, request)).toBe(
      true,
    );
    expect(() =>
      assertMemoryConflictResolveRequestSemanticBindingsV1(request),
    ).not.toThrow();
    expect(() =>
      assertMemoryConflictResolveRequestSemanticBindingsV1({
        ...request,
        keep_both_plan: undefined,
      }),
    ).toThrow(/payload binding/);

    const response = {
      schema_version: "memory.conflict_resolve.v1",
      conflict_id: "conflict-1",
      previous_conflict_version: 2,
      conflict_version: 3,
      previous_status: "open",
      status: "resolved",
      resolution_code: "keep_both_split_scope",
      series_transitions: [],
      point_transitions: [],
      event_ids: ["event-1"],
      dry_run: false,
      duplicate_replayed: false,
    } as const;
    expect(Value.Check(MemoryConflictResolveResponseV1Schema, response)).toBe(
      true,
    );
    expect(() =>
      assertMemoryConflictResolveResponseSemanticBindingsV1(response),
    ).not.toThrow();
    expect(() =>
      assertMemoryConflictResolveResponseSemanticBindingsV1({
        ...response,
        dry_run: true,
      }),
    ).toThrow(/version binding/);
    expect(() =>
      assertMemoryConflictResolveResponseSemanticBindingsV1({
        ...response,
        previous_conflict_version: 2,
        conflict_version: 2,
        status: "feedback_requested",
        resolution_code: undefined,
        event_ids: [],
        dry_run: true,
      }),
    ).not.toThrow();
  });

  it("binds integration job state, lease generation, and terminal errors", () => {
    const request = {
      schema_version: "memory.integration_run.v1",
      bot_id: "bot-1",
      scope: { series_ids: ["series-1"] },
      mode: "deduplicate",
      dry_run: false,
      idempotency_key: "integration-1",
      expected_policy_version: "policy-1",
    } as const;
    expect(Value.Check(MemoryIntegrationRunRequestV1Schema, request)).toBe(
      true,
    );

    const job = {
      id: "job-1",
      scope: {
        workspace_id: "workspace-1",
        bot_id: "bot-1",
        owner_agent_id: "agent-1",
        deployment_environment: "prod",
        release_channel: "stable",
      },
      mode: "deduplicate",
      request_scope: { series_ids: ["series-1"] },
      dry_run: false,
      idempotency_key: "integration-1",
      request_hash: sha256,
      expected_policy_version: "policy-1",
      state_version: 2,
      status: "leased",
      checkpoint_ref: null,
      proposed_changes: [],
      applied_counts: {},
      failure_refs: [],
      error: null,
      created_at: "2026-07-24T00:00:00.000Z",
      updated_at: "2026-07-24T00:00:01.000Z",
    } as const;
    expect(Value.Check(MemoryIntegrationJobDetailsV1Schema, job)).toBe(true);
    expect(() => assertMemoryIntegrationJobSemanticBindingsV1(job)).not.toThrow();
    expect(
      Value.Check(MemoryIntegrationClaimV1Schema, {
        job,
        lease_id: "lease-1",
        lease_generation: 1,
        lease_expires_at: "2026-07-24T00:00:31.000Z",
      }),
    ).toBe(true);

    const checkpoint = {
      bot_id: "bot-1",
      integration_job_id: "job-1",
      lease_id: "lease-1",
      lease_generation: 1,
      checkpoint_ref: "checkpoint-1",
      proposed_changes: [
        {
          operation: "merge",
          target: {
            series_id: "series-1",
            evidence: ["memory_point:point-1"],
          },
        },
      ],
    } as const;
    expect(
      Value.Check(MemoryIntegrationCheckpointRequestV1Schema, checkpoint),
    ).toBe(true);
    expect(() =>
      assertMemoryIntegrationCheckpointRequestSemanticBindingsV1(checkpoint),
    ).not.toThrow();
    expect(() =>
      assertMemoryIntegrationCheckpointRequestSemanticBindingsV1({
        ...checkpoint,
        proposed_changes: [{ invalid: new Date() }],
      }),
    ).toThrow(/plain JSON objects/);

    const invalidFinish = {
      bot_id: "bot-1",
      integration_job_id: "job-1",
      lease_id: "lease-1",
      lease_generation: 1,
      status: "failed",
    } as const;
    expect(
      Value.Check(MemoryIntegrationFinishRequestV1Schema, invalidFinish),
    ).toBe(true);
    expect(() =>
      assertMemoryIntegrationFinishRequestSemanticBindingsV1(invalidFinish),
    ).toThrow(/error\/status/);
  });

  it("binds independently paged series collections to one snapshot", () => {
    const request = {
      schema_version: "memory.series.query.v1",
      bot_id: "bot-1",
      series_id: "series-1",
      include: ["points", "conflicts"],
      points_cursor: "points-cursor-1",
      snapshot_token: "snapshot-1",
    } as const;
    expect(Value.Check(MemoryQuerySeriesRequestV1Schema, request)).toBe(true);
    expect(() =>
      assertMemoryQuerySeriesRequestSemanticBindingsV1(request),
    ).not.toThrow();
    expect(() =>
      assertMemoryQuerySeriesRequestSemanticBindingsV1({
        ...request,
        snapshot_token: undefined,
      }),
    ).toThrow(/snapshot_token/);

    const response = {
      schema_version: "memory.series.query.v1",
      series: {
        id: "series-1",
        bot_id: "bot-1",
        topic_key: "topic-1",
        topic_family_key: "family-1",
        status: "active",
        state_version: 4,
      },
      points: [
        {
          memory_point_id: "point-2",
          version_no: 2,
          state_version: 1,
          status: "active",
          content_summary: "new",
          occurred_at: "2026-07-24T00:00:01.000Z",
          source_refs: ["trigger-2"],
          redaction_status: "not_required",
        },
        {
          memory_point_id: "point-1",
          version_no: 1,
          state_version: 2,
          status: "superseded",
          content_summary: "old",
          occurred_at: "2026-07-24T00:00:00.000Z",
          source_refs: ["trigger-1"],
          redaction_status: "not_required",
        },
      ],
      conflicts: [],
      page: {
        points: { returned: 2 },
        conflicts: { returned: 0 },
      },
      snapshot_token: "snapshot-1",
    } as const;
    expect(Value.Check(MemoryQuerySeriesResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertMemoryQuerySeriesResponseSemanticBindingsV1(response),
    ).not.toThrow();
    expect(() =>
      assertMemoryQuerySeriesResponseSemanticBindingsV1({
        ...response,
        points: [...response.points].reverse(),
      }),
    ).toThrow(/ordering/);
  });

  it("binds graph edges and paths to the returned immutable artifact", () => {
    const request = {
      schema_version: "memory.association_graph.v1",
      bot_id: "bot-1",
      seed_memory_point_ids: ["point-1"],
      seed_series_ids: ["series-1"],
      edge_types: ["supports"],
      max_hops: 2,
      max_nodes: 100,
      max_edges: 200,
      idempotency_key: "graph-1",
      policy_snapshot_id: "policy-1",
      capability_token: "token-1",
    } as const;
    expect(Value.Check(MemoryGraphBuildRequestV1Schema, request)).toBe(true);

    const response = {
      schema_version: "memory.association_graph.v1",
      graph_id: "graph-1",
      graph_revision: 1,
      nodes: [
        { type: "memory_point", id: "point-1", redaction_status: "not_required" },
        { type: "memory_series", id: "series-1", redaction_status: "not_required" },
      ],
      edges: [
        {
          edge_id: "edge-1",
          type: "supports",
          from: "point-1",
          to: "series-1",
          confidence: 0.9,
        },
      ],
      paths: [
        {
          node_ids: ["point-1", "series-1"],
          edge_ids: ["edge-1"],
          hop_count: 1,
          path_score: 0.9,
        },
      ],
      actual_budget: {
        max_hops: 2,
        nodes_visited: 2,
        edges_visited: 1,
      },
      truncated: false,
      duplicate_replayed: false,
    } as const;
    expect(Value.Check(MemoryGraphBuildResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertMemoryGraphBuildResponseSemanticBindingsV1(response),
    ).not.toThrow();
    expect(() =>
      assertMemoryGraphBuildResponseSemanticBindingsV1({
        ...response,
        edges: [{ ...response.edges[0], to: "missing-node" }],
      }),
    ).toThrow(/identity binding/);
  });

  it("enforces the exact 8-field Memory event envelope and consumer matrix", () => {
    const event = {
      event_id: "event-1",
      schema_version: "memory.event.v1",
      producer: "memory",
      occurred_at: "2026-07-24T00:00:00.000Z",
      idempotency_key: "point:point-1:v1",
      trace_id: "trace-1",
      event_type: "memory.point.created",
      payload: {
        ...eventScope,
        aggregate_id: "point-1",
        aggregate_version: 1,
        aggregate_type: "memory_point",
        memory_point_id: "point-1",
        series_id: "series-1",
        topic_key: "topic-1",
        state_version: 1,
        source_trigger_process_id: "process-1",
        write_batch_id: "batch-1",
        redaction_status: "not_required",
      },
    } as const;
    expect(Object.keys(event)).toHaveLength(8);
    expect(Object.keys(MEMORY_EVENT_PAYLOAD_SCHEMAS_V1)).toEqual(
      MEMORY_EVENT_TYPES_V1,
    );
    expect(
      Value.Check(
        MEMORY_EVENT_PAYLOAD_SCHEMAS_V1[event.event_type],
        event.payload,
      ),
    ).toBe(true);
    expect(Value.Check(MemoryEventEnvelopeV1Schema, event)).toBe(true);
    expect(() =>
      assertMemoryEventEnvelopeSemanticBindingsV1(event),
    ).not.toThrow();
    expect(MEMORY_EVENT_CONSUMERS_V1["memory.point.created"]).toEqual([
      "meta",
      "memory_projection",
    ]);
    expect(() =>
      assertMemoryEventConsumerV1("memory.point.created", "feedback_router"),
    ).toThrow(/not allowed/);
    expect(() =>
      assertMemoryEventEnvelopeSemanticBindingsV1({
        ...event,
        idempotency_key: "point:point-1:v2",
      }),
    ).toThrow(/idempotency key/);
    expect(
      Value.Check(MemoryEventEnvelopeV1Schema, {
        ...event,
        scope: { bot_id: "bot-1" },
      }),
    ).toBe(false);
  });
});
