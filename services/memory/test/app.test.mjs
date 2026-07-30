import assert from "node:assert/strict";
import test from "node:test";

import { buildMemoryApp } from "../dist/app.js";
import {
  InMemoryMemoryStateRepositoryV1,
  MemoryApplicationV1,
} from "../dist/memory-application.v1.js";

const token = "aaa.bbb.ccc";
const scope = Object.freeze({
  workspace_id: "workspace_1",
  bot_id: "bot_1",
  owner_agent_id: "agent_1",
  deployment_environment: "dev",
  release_channel: "stable",
});

function credential(sub, capabilities) {
  return {
    claims: {
      iss: "pai-workload",
      sub,
      aud: "memory",
      jti: "credential_1",
      iat: 100,
      nbf: 100,
      exp: 200,
      capability: capabilities,
      scope_kind: "bot",
      ...scope,
    },
    protectedHeader: { alg: "EdDSA", kid: "key_1", typ: "JWT" },
  };
}

function application() {
  return new MemoryApplicationV1(
    new InMemoryMemoryStateRepositoryV1(),
    {
      async checkReadiness() {},
      async embed(inputs) {
        return inputs.map(() => [
          1,
          ...Array.from({ length: 2_047 }, () => 0),
        ]);
      },
    },
  );
}

const sha256 = `sha256:${"a".repeat(64)}`;

function ownerApplication(calls = []) {
  return Object.assign(application(), {
    async deepRecall(principal, request) {
      calls.push(["deepRecall", principal.caller, request]);
      return {
        code: "memory_deep_recall_completed",
        message: "completed",
        retryable: false,
        details: {
          request_id: "deep_request_1",
          ranking_profile_version: "memory.deep_recall.rrf.v1",
          graph_profile_version: "memory.deep_recall_graph.v1",
          items: [],
          actual_graph_budget: {
            max_hops: 2,
            nodes_visited: 0,
            edges_visited: 0,
          },
          is_partial: false,
          completed_channels: request.scope.channels,
          missing_channels: [],
          second_query_executed: false,
          partial_reason: null,
        },
        trace_id: "trace_deep_1",
      };
    },
    async checkPrePromotion(principal, request) {
      calls.push(["checkPrePromotion", principal.caller, request]);
      return {
        schema_version: "memory.pre_promotion_check.v1",
        check_id: "check_1",
        check_generation: 1,
        candidate_fact_id: request.candidate_fact_id,
        overall_result: "passed",
        checked_at: "2026-07-24T00:00:00.000Z",
        expires_at: "2026-07-24T00:00:30.000Z",
        check_token: "check_token_1",
        check_policy_version: "memory.pre_promotion_policy.rev309",
        required_checks: request.required_checks ?? [
          "point_exists",
          "state_allowed",
          "no_unresolved_conflict",
          "not_expired",
          "provenance_integrity",
        ],
        points: request.memory_point_ids.map((memory_point_id) => ({
          memory_point_id,
          exists: true,
          state_version: 1,
          state_hash: sha256,
          status: "active",
          evidence_valid_until: null,
          unresolved_conflicts: [],
          expired: false,
          provenance_valid: true,
          source_trigger_process_id: "process_1",
          confidence_score: 0.9,
          user_explicit_confirmation: false,
          blocking_reasons: [],
        })),
        summary: {
          active_count: request.memory_point_ids.length,
          independent_trigger_process_count: 1,
          has_user_explicit_confirmation: false,
          blocking_reasons: [],
        },
        duplicate_replayed: false,
      };
    },
    async validatePrePromotion(principal, request) {
      calls.push(["validatePrePromotion", principal.caller, request]);
      return {
        schema_version: "memory.promotion_reservation.v1",
        reservation_id: "reservation_1",
        check_id: "check_1",
        check_generation: 1,
        candidate_fact_id: request.candidate_fact_id,
        fencing_generation: 1,
        reserved_points: request.expected_point_versions,
        reserved_conflicts: request.expected_conflict_versions,
        reservation_token: "reservation_token_1",
        reserved_at: "2026-07-24T00:00:31.000Z",
        expires_at: "2026-07-24T00:00:36.000Z",
        status: "active",
      };
    },
    async ackPromotionReservation(principal, request) {
      calls.push(["ackPromotionReservation", principal.caller, request]);
      return {
        schema_version: "memory.promotion_reservation_ack.v1",
        reservation_id: request.reservation_id,
        candidate_fact_id: request.candidate_fact_id,
        fencing_generation: request.fencing_generation,
        status: "committed",
        promotion_revision_id: request.promotion_revision_id,
        committed_at: request.committed_at,
        duplicate_replayed: false,
      };
    },
    async releasePromotionReservation(principal, request) {
      calls.push(["releasePromotionReservation", principal.caller, request]);
      return {
        schema_version: "memory.promotion_reservation_release.v1",
        reservation_id: request.reservation_id,
        candidate_fact_id: request.candidate_fact_id,
        fencing_generation: request.fencing_generation,
        status: "released",
        release_reason: request.release_reason,
        released_at: request.released_at,
        duplicate_replayed: false,
      };
    },
    async submitDirectFeedback(principal, request) {
      calls.push(["submitDirectFeedback", principal.caller, request]);
      return {
        schema_version: "memory.direct_feedback.v1",
        feedback_id: "feedback_1",
        target_type: request.target_type,
        target_id: request.target_id,
        previous_state_version: request.expected_state_version,
        state_version: request.expected_state_version + 1,
        resulting_status: "active",
        revision_refs: [
          {
            aggregate_type:
              request.target_type === "memory_point"
                ? "memory_point"
                : "memory_series",
            aggregate_id: request.target_id,
            revision_id: "revision_1",
          },
        ],
        audit_ids: ["audit_1"],
        event_ids: ["event_1"],
        duplicate_replayed: false,
      };
    },
    async resolveConflict(principal, conflictId, request) {
      calls.push(["resolveConflict", principal.caller, conflictId, request]);
      return {
        schema_version: "memory.conflict_resolve.v1",
        conflict_id: conflictId,
        previous_conflict_version: request.expected_conflict_version,
        conflict_version: request.expected_conflict_version + 1,
        previous_status: "open",
        status: "resolved",
        resolution_code: "prefer_old",
        series_transitions: [],
        point_transitions: [],
        event_ids: ["event_conflict_1"],
        dry_run: false,
        duplicate_replayed: false,
      };
    },
    async buildAssociationGraph(principal, request) {
      calls.push(["buildAssociationGraph", principal.caller, request]);
      return {
        schema_version: "memory.association_graph.v1",
        graph_id: "graph_1",
        graph_revision: 1,
        nodes: [
          {
            type: "memory_point",
            id: request.seed_memory_point_ids[0],
            redaction_status: "not_required",
          },
        ],
        edges: [],
        paths: [
          {
            node_ids: [request.seed_memory_point_ids[0]],
            edge_ids: [],
            hop_count: 0,
            path_score: 1,
          },
        ],
        actual_budget: {
          max_hops: request.max_hops ?? 2,
          nodes_visited: 1,
          edges_visited: 0,
        },
        truncated: false,
        duplicate_replayed: false,
      };
    },
    async querySeries(principal, request) {
      calls.push(["querySeries", principal.caller, request]);
      return {
        schema_version: "memory.series.query.v1",
        series: {
          id: request.series_id,
          bot_id: request.bot_id,
          topic_key: "topic_1",
          topic_family_key: "family_1",
          status: "active",
          state_version: 1,
        },
        points: [],
        page: { points: { returned: 0 } },
        snapshot_token: "series_snapshot_1",
      };
    },
  });
}

function writeRequest() {
  return {
    schema_version: "memory.write_batch.v1",
    bot_id: scope.bot_id,
    trigger_process_id: "process_1",
    source_meta_job_id: "meta_job_1",
    idempotency_key: "batch_1",
    items: [
      {
        client_item_id: "item_1",
        content_summary: "remember alpha",
        subject_refs: [
          {
            subject_type: "user",
            canonical_id: "user_1",
            primary: true,
          },
        ],
        human_agent_relation: [],
        keyword_tags: ["alpha"],
        scene_tags: ["implementation"],
        emotion_tags: ["neutral"],
        source_info: {
          source_type: "trigger_snapshot",
          source_ref: "trigger_process:process_1",
          actor_type: "user",
        },
        confidence_score: 0.9,
        occurred_at: "2026-07-23T00:00:00.000Z",
      },
    ],
  };
}

test("write route binds meta-cognition, memory.write, bot scope, and owner schemas", async () => {
  const requirements = [];
  const app = buildMemoryApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify(_token, expected) {
            requirements.push(expected);
            return credential("meta_cognition", ["memory.write"]);
          },
        },
      },
    },
    { memory: application() },
  );
  const response = await app.inject({
    method: "POST",
    url: "/internal/memory/write-batch",
    headers: { authorization: `Bearer ${token}` },
    payload: writeRequest(),
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().item_results[0].decision, "new_series");
  assert.deepEqual(requirements, [
    {
      audience: "memory",
      allowedCallers: ["meta_cognition"],
      requiredCapabilities: ["memory.write"],
    },
  ]);
  await app.close();
});

test("write route enforces the raw two-MiB limit before application execution", async () => {
  const app = buildMemoryApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify() {
            return credential("meta_cognition", ["memory.write"]);
          },
        },
      },
    },
    { memory: application() },
  );
  const payload = writeRequest();
  payload.items[0].content_summary = "x".repeat(2_097_152);
  const response = await app.inject({
    method: "POST",
    url: "/internal/memory/write-batch",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  assert.equal(response.statusCode, 413, response.body);
  await app.close();
});

test("write route delegates item-level schema failures to the Memory owner", async () => {
  const app = buildMemoryApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify() {
            return credential("meta_cognition", ["memory.write"]);
          },
        },
      },
    },
    { memory: application() },
  );
  const payload = writeRequest();
  payload.items[0].occurred_at = "not-an-instant";
  const response = await app.inject({
    method: "POST",
    url: "/internal/memory/write-batch",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().batch_status, "partial_failed");
  assert.deepEqual(response.json().item_results, [
    {
      client_item_id: "item_1",
      status: "rejected",
      code: "schema_validation_failed",
      message: "memory write item was rejected",
      field_path: "/items/0",
    },
  ]);
  await app.close();
});

test("strict write envelope rejection never reaches the Memory owner handler", async () => {
  const memory = application();
  let handlerCalls = 0;
  memory.writeBatch = async () => {
    handlerCalls += 1;
    throw new Error("must not execute");
  };
  const app = buildMemoryApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify() {
            return credential("meta_cognition", ["memory.write"]);
          },
        },
      },
    },
    { memory },
  );
  const response = await app.inject({
    method: "POST",
    url: "/internal/memory/write-batch",
    headers: { authorization: `Bearer ${token}` },
    payload: { ...writeRequest(), unexpected: true },
  });
  assert.equal(response.statusCode, 422, response.body);
  assert.equal(response.json().code, "schema_validation_failed");
  assert.equal(handlerCalls, 0);
  await app.close();
});

test("integration route uses the owner wire schema and maps schema drift to 422", async () => {
  const app = buildMemoryApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify() {
            return credential("memory", ["memory.integration.run"]);
          },
        },
      },
    },
    { memory: application() },
  );
  const request = {
    schema_version: "memory.integration_run.v1",
    bot_id: scope.bot_id,
    scope: {},
    mode: "deduplicate",
    dry_run: false,
    idempotency_key: "integration_1",
    expected_policy_version: "memory.integration_policy.v1",
  };
  const accepted = await app.inject({
    method: "POST",
    url: "/internal/memory/integration/run",
    headers: { authorization: `Bearer ${token}` },
    payload: request,
  });
  assert.equal(accepted.statusCode, 202, accepted.body);
  assert.equal(accepted.json().schema_version, "memory.integration_run.v1");

  const rejected = await app.inject({
    method: "POST",
    url: "/internal/memory/integration/run",
    headers: { authorization: `Bearer ${token}` },
    payload: { ...request, unexpected: true },
  });
  assert.equal(rejected.statusCode, 422, rejected.body);
  assert.equal(rejected.json().code, "schema_validation_failed");
  await app.close();
});

test("production readiness fails closed without the Memory application", async () => {
  const app = buildMemoryApp(
    { logger: false },
    {},
    { require_complete_pipeline: true },
  );
  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(
    response.json().checks.map((check) => [check.name, check.status]),
    [["memory_application", "down"]],
  );
  await app.close();
});

test("complete-pipeline readiness rejects partial composition while an empty series policy is deny-all", async () => {
  const partial = buildMemoryApp(
    { logger: false },
    { memory: application() },
    { require_complete_pipeline: true },
  );
  const partialResponse = await partial.inject({
    method: "GET",
    url: "/ready",
  });
  assert.equal(partialResponse.statusCode, 503);
  await partial.close();

  const denyAll = buildMemoryApp(
    { logger: false },
    { memory: ownerApplication() },
    { require_complete_pipeline: true },
  );
  const denyAllResponse = await denyAll.inject({
    method: "GET",
    url: "/ready",
  });
  assert.equal(denyAllResponse.statusCode, 200, denyAllResponse.body);
  await denyAll.close();

  const complete = buildMemoryApp(
    { logger: false },
    { memory: ownerApplication() },
    {
      require_complete_pipeline: true,
      series_query_allowed_callers: ["trigger_processor"],
    },
  );
  const completeResponse = await complete.inject({
    method: "GET",
    url: "/ready",
  });
  assert.equal(completeResponse.statusCode, 200, completeResponse.body);
  await complete.close();
});

test("every rev309 owner route binds caller capability, owner schema, path, and bot scope", async () => {
  const calls = [];
  const requirements = [];
  const app = buildMemoryApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify(_token, expected) {
            requirements.push(expected);
            return credential(
              expected.allowedCallers[0],
              expected.requiredCapabilities,
            );
          },
        },
      },
    },
    { memory: ownerApplication(calls) },
    { series_query_allowed_callers: ["trigger_processor"] },
  );
  const headers = { authorization: `Bearer ${token}` };
  const requests = [
    {
      method: "POST",
      url: "/internal/memory/deep-recall",
      payload: {
        schema_version: "memory.deep_recall.v1",
        bot_id: scope.bot_id,
        owner_agent_id: scope.owner_agent_id,
        runtime_run_id: "run_1",
        trigger_process_id: "process_1",
        query: "why",
        scope: { channels: ["semantic"] },
        idempotency_key: "deep_1",
        policy_snapshot_id: "policy_1",
        policy_snapshot_hash: sha256,
        capability_token: "deep_token_1",
        capability_token_id: "deep_token_id_1",
        graph_profile_version: "memory.deep_recall_graph.v1",
      },
    },
    {
      method: "POST",
      url: "/internal/memory/pre-promotion-check",
      payload: {
        schema_version: "memory.pre_promotion_check.v1",
        bot_id: scope.bot_id,
        candidate_fact_id: "candidate_1",
        memory_point_ids: ["point_1"],
        idempotency_key: "check_1",
        trace_id: "trace_check_1",
      },
    },
    {
      method: "POST",
      url: "/internal/memory/pre-promotion-check/validate",
      payload: {
        schema_version: "memory.pre_promotion_validate.v1",
        bot_id: scope.bot_id,
        check_token: "check_token_1",
        check_id: "check_1",
        check_generation: 1,
        candidate_fact_id: "candidate_1",
        expected_point_versions: [
          {
            memory_point_id: "point_1",
            state_version: 1,
            state_hash: sha256,
          },
        ],
        expected_conflict_versions: [],
        idempotency_key: "validate_1",
      },
    },
    {
      method: "POST",
      url: "/internal/memory/promotion-reservations/reservation_1/ack",
      payload: {
        schema_version: "memory.promotion_reservation_ack.v1",
        bot_id: scope.bot_id,
        reservation_id: "reservation_1",
        candidate_fact_id: "candidate_1",
        fencing_generation: 1,
        reservation_token_hash: sha256,
        promotion_revision_id: "revision_1",
        committed_at: "2026-07-24T00:00:32.000Z",
        idempotency_key: "ack_1",
        trace_id: "trace_ack_1",
      },
    },
    {
      method: "POST",
      url:
        "/internal/memory/promotion-reservations/reservation_2/release",
      payload: {
        schema_version: "memory.promotion_reservation_release.v1",
        bot_id: scope.bot_id,
        reservation_id: "reservation_2",
        candidate_fact_id: "candidate_2",
        fencing_generation: 2,
        reservation_token_hash: sha256,
        release_reason: "promotion_commit_failed",
        released_at: "2026-07-24T00:00:32.000Z",
        idempotency_key: "release_1",
        trace_id: "trace_release_1",
      },
    },
    {
      method: "POST",
      url: "/v1/memory/feedback",
      payload: {
        schema_version: "memory.direct_feedback.v1",
        bot_id: scope.bot_id,
        target_type: "memory_point",
        target_id: "point_1",
        action: "confirm",
        expected_state_version: 1,
        idempotency_key: "feedback_1",
        reason: "confirmed",
        evidence_ref: "user_feedback:message_1",
      },
    },
    {
      method: "POST",
      url: "/internal/memory/conflicts/conflict_1/resolve",
      payload: {
        schema_version: "memory.conflict_resolve.v1",
        bot_id: scope.bot_id,
        decision: "prefer_old",
        reason: "old evidence wins",
        evidence_refs: ["memory_point:point_1"],
        expected_conflict_version: 1,
        expected_versions: {
          old_series_state_version: 1,
          old_point_state_version: 1,
          new_series_state_version: 1,
          new_point_state_version: 1,
        },
        idempotency_key: "resolve_1",
        trace_id: "trace_resolve_1",
      },
    },
    {
      method: "POST",
      url: "/internal/memory/association-graph/build",
      payload: {
        schema_version: "memory.association_graph.v1",
        bot_id: scope.bot_id,
        seed_memory_point_ids: ["point_1"],
        idempotency_key: "graph_1",
        policy_snapshot_id: "policy_1",
        capability_token: "graph_token_1",
      },
    },
    {
      method: "GET",
      url:
        "/v1/memory/series/series_1" +
        "?schema_version=memory.series.query.v1&bot_id=bot_1",
    },
  ];
  for (const request of requests) {
    const response = await app.inject({ ...request, headers });
    assert.equal(
      response.statusCode,
      200,
      `${request.method} ${request.url}: ${response.body}`,
    );
  }
  assert.deepEqual(
    calls.map((entry) => entry[0]),
    [
      "deepRecall",
      "checkPrePromotion",
      "validatePrePromotion",
      "ackPromotionReservation",
      "releasePromotionReservation",
      "submitDirectFeedback",
      "resolveConflict",
      "buildAssociationGraph",
      "querySeries",
    ],
  );
  assert.equal(calls[6][2], "conflict_1");
  assert.equal(calls[8][2].series_id, "series_1");
  assert.deepEqual(
    requirements.map((entry) => [
      entry.allowedCallers,
      entry.requiredCapabilities,
    ]),
    [
      [["action_runtime"], ["memory.deep_recall"]],
      [["knowthat"], ["memory.pre_promotion_check"]],
      [["knowthat"], ["memory.pre_promotion_check"]],
      [["knowthat"], ["memory.promotion_reservation.ack"]],
      [["knowthat"], ["memory.promotion_reservation.release"]],
      [
        ["meta_cognition", "action_runtime"],
        ["memory.feedback.write"],
      ],
      [["memory"], ["memory.conflict.resolve"]],
      [["memory"], ["memory.association_graph.build"]],
      [["trigger_processor"], ["memory.series.read"]],
    ],
  );
  await app.close();
});

test("advanced owner routes fail closed when durable operations or reviewed series callers are absent", async () => {
  const app = buildMemoryApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify(_token, expected) {
            return credential(
              expected.allowedCallers[0],
              expected.requiredCapabilities,
            );
          },
        },
      },
    },
    { memory: application() },
  );
  const headers = { authorization: `Bearer ${token}` };
  const deep = await app.inject({
    method: "POST",
    url: "/internal/memory/deep-recall",
    headers,
    payload: {
      schema_version: "memory.deep_recall.v1",
      bot_id: scope.bot_id,
      owner_agent_id: scope.owner_agent_id,
      runtime_run_id: "run_1",
      trigger_process_id: "process_1",
      query: "why",
      scope: { channels: ["semantic"] },
      idempotency_key: "deep_1",
      policy_snapshot_id: "policy_1",
      policy_snapshot_hash: sha256,
      capability_token: "deep_token_1",
      capability_token_id: "deep_token_id_1",
      graph_profile_version: "memory.deep_recall_graph.v1",
    },
  });
  assert.equal(deep.statusCode, 503, deep.body);
  assert.equal(deep.json().code, "dependency_unavailable");

  const series = await app.inject({
    method: "GET",
    url:
      "/v1/memory/series/series_1" +
      "?schema_version=memory.series.query.v1&bot_id=bot_1",
    headers,
  });
  assert.equal(series.statusCode, 503, series.body);
  assert.equal(series.json().code, "dependency_unavailable");
  await app.close();
});

test("advanced routes reject semantic drift, cross-scope access, and audit reads before application execution", async () => {
  const calls = [];
  const app = buildMemoryApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify(_token, expected) {
            return credential(
              expected.allowedCallers[0],
              expected.requiredCapabilities,
            );
          },
        },
      },
    },
    { memory: ownerApplication(calls) },
    { series_query_allowed_callers: ["trigger_processor"] },
  );
  const headers = { authorization: `Bearer ${token}` };
  const wrongOwner = await app.inject({
    method: "POST",
    url: "/internal/memory/deep-recall",
    headers,
    payload: {
      schema_version: "memory.deep_recall.v1",
      bot_id: scope.bot_id,
      owner_agent_id: "agent_other",
      runtime_run_id: "run_1",
      trigger_process_id: "process_1",
      query: "why",
      scope: { channels: ["semantic"] },
      idempotency_key: "deep_1",
      policy_snapshot_id: "policy_1",
      policy_snapshot_hash: sha256,
      capability_token: "deep_token_1",
      capability_token_id: "deep_token_id_1",
      graph_profile_version: "memory.deep_recall_graph.v1",
    },
  });
  assert.equal(wrongOwner.statusCode, 403, wrongOwner.body);

  const semanticDrift = await app.inject({
    method: "POST",
    url: "/v1/memory/feedback",
    headers,
    payload: {
      schema_version: "memory.direct_feedback.v1",
      bot_id: scope.bot_id,
      target_type: "memory_point",
      target_id: "point_1",
      action: "confirm",
      expected_state_version: 1,
      idempotency_key: "feedback_1",
      reason: "invalid correction binding",
      correction: { content_summary: "not allowed for confirm" },
      evidence_ref: "user_feedback:message_1",
    },
  });
  assert.equal(semanticDrift.statusCode, 422, semanticDrift.body);

  const utf8Overflow = await app.inject({
    method: "POST",
    url: "/v1/memory/feedback",
    headers,
    payload: {
      schema_version: "memory.direct_feedback.v1",
      bot_id: scope.bot_id,
      target_type: "memory_point",
      target_id: "point_1",
      action: "confirm",
      expected_state_version: 1,
      idempotency_key: "feedback_utf8_1",
      reason: "😀".repeat(1_025),
      evidence_ref: "user_feedback:message_1",
    },
  });
  assert.equal(utf8Overflow.statusCode, 422, utf8Overflow.body);

  const crossBot = await app.inject({
    method: "POST",
    url: "/internal/memory/association-graph/build",
    headers,
    payload: {
      schema_version: "memory.association_graph.v1",
      bot_id: "bot_other",
      seed_memory_point_ids: ["point_1"],
      idempotency_key: "graph_1",
      policy_snapshot_id: "policy_1",
      capability_token: "graph_token_1",
    },
  });
  assert.equal(crossBot.statusCode, 403, crossBot.body);

  const auditWithoutCapability = await app.inject({
    method: "GET",
    url:
      "/v1/memory/series/series_1" +
      "?schema_version=memory.series.query.v1&bot_id=bot_1" +
      "&include=conflicts&include=edges",
    headers,
  });
  assert.equal(
    auditWithoutCapability.statusCode,
    403,
    auditWithoutCapability.body,
  );
  assert.deepEqual(calls, []);
  await app.close();
});
