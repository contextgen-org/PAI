import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_KNOWTHAT_CONFIG_V1,
  KnowThatErrorV1,
  KNOWTHAT_REPOSITORY_CONTRACT_V1,
  buildKnowThatApp,
  canonicalHashV1,
  createLocalKnowThatCompositionV1,
  createProductionKnowThatCompositionV1,
  createInMemoryKnowThatStoreV1,
  createKnowThatApplicationV1,
  evaluateKnowThatCanonicalConflictV1,
  knowThatConfigFromEnvironmentV1,
  knowThatScopeFingerprintV1,
  signOpaqueV1,
  verifyOpaqueV1,
} from "../dist/index.js";

const workloadToken = "aaa.bbb.ccc";
const scope = Object.freeze({
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev",
  release_channel: "stable",
});

function queryCredential(jti = "credential-1") {
  return {
    claims: {
      iss: "pai-workload",
      sub: "trigger_processor",
      aud: "knowthat",
      jti,
      iat: 100,
      nbf: 100,
      exp: 200,
      capability: ["knowthat.fact.query"],
      scope_kind: "bot",
      ...scope,
    },
    protectedHeader: { alg: "EdDSA", kid: "key-1", typ: "JWT" },
  };
}

function item(overrides = {}) {
  return {
    client_item_id: "item-1",
    text: "The deployment region is Shanghai",
    subject: "deployment",
    predicate: "region",
    object: "Shanghai",
    category: "project_fact",
    proposed_status: "active",
    direct_active_hint: true,
    direct_active_reason: "user_explicit",
    risk_level: "low",
    explicitness: "explicit_statement",
    confidence: 0.95,
    source: "approved_artifact",
    source_ref: "artifact:release-1",
    evidence_refs: ["artifact:release-1"],
    evidence_pending: false,
    ...overrides,
  };
}

function batch(idempotencyKey, items) {
  return {
    schema_version: "knowthat.write_batch.v1",
    ...scope,
    trigger_process_id: "process-1",
    source_meta_job_id: "meta-1",
    idempotency_key: idempotencyKey,
    trace_id: `trace-${idempotencyKey}`,
    items,
  };
}

function allowedMemory(options = {}) {
  return {
    async check(request) {
      const checkedAt = new Date();
      const points = request.memory_point_ids.map((id, index) => ({
        memory_point_id: id,
        exists: true,
        state_version: 1,
        state_hash: `sha256:${String(index).padStart(64, "0")}`,
        status: "active",
        evidence_valid_until: null,
        unresolved_conflicts: [],
        expired: false,
        provenance_valid: true,
        source_trigger_process_id:
          options.source_trigger_process_id?.(id, index) ??
          `process-${index}`,
        confidence_score: 0.9,
        user_explicit_confirmation:
          options.user_explicit_confirmation?.(id, index) ?? false,
        blocking_reasons: [],
      }));
      return {
        schema_version: "memory.pre_promotion_check.v1",
        check_id: `check:${request.idempotency_key}`,
        check_generation: 1,
        candidate_fact_id: request.candidate_fact_id,
        overall_result: "passed",
        checked_at: checkedAt.toISOString(),
        expires_at: new Date(checkedAt.getTime() + 30_000).toISOString(),
        check_token: `check-token:${request.idempotency_key}`,
        check_policy_version: "memory.pre_promotion_policy.rev309",
        required_checks: request.required_checks,
        points,
        summary: {
          active_count: request.memory_point_ids.length,
          independent_trigger_process_count:
            new Set(
              points.map((point) => point.source_trigger_process_id),
            ).size,
          has_user_explicit_confirmation: points.some(
            (point) => point.user_explicit_confirmation,
          ),
          blocking_reasons: [],
        },
        duplicate_replayed: false,
      };
    },
    async validate(request) {
      options.on_validate?.(request);
      const reservedAt = new Date();
      return {
        schema_version: "memory.promotion_reservation.v1",
        reservation_id: `reservation:${request.idempotency_key}`,
        check_id: request.check_id,
        check_generation: request.check_generation,
        candidate_fact_id: request.candidate_fact_id,
        fencing_generation: 1,
        reserved_points: request.expected_point_versions,
        reserved_conflicts: request.expected_conflict_versions,
        reservation_token: `reservation-token:${request.idempotency_key}`,
        reserved_at: reservedAt.toISOString(),
        expires_at: new Date(reservedAt.getTime() + 5_000).toISOString(),
        status: "active",
      };
    },
    async ack(request) {
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
    async release(request) {
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
  };
}

test("startup compositions cannot confuse local memory with a durable owner", async () => {
  for (const deployment_environment of ["staging", "prod"]) {
    assert.throws(
      () =>
        knowThatConfigFromEnvironmentV1({
          PAI_DEPLOYMENT_ENVIRONMENT: deployment_environment,
        }),
      /PAI_KNOWTHAT_SNAPSHOT_HMAC_SECRET is required in production/u,
    );
  }

  await assert.rejects(
    () =>
      createProductionKnowThatCompositionV1({
        deployment_environment: "local",
        release_channel: "stable",
        production_dependencies_required: false,
        env: {},
      }),
    /PAI_DATABASE_URL is required/u,
  );

  const unavailableMemory = {
    async check() {
      throw new Error("not composed");
    },
    async validate() {
      throw new Error("not composed");
    },
    async ack() {
      throw new Error("not composed");
    },
    async release() {
      throw new Error("not composed");
    },
    async checkReadiness() {
      throw new Error("not composed");
    },
  };
  const local = createLocalKnowThatCompositionV1(unavailableMemory);
  const app = local.buildApp({ logger: false });
  const readiness = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(readiness.statusCode, 503);
  assert.deepEqual(
    readiness.json().checks.map((check) => [check.name, check.status]),
    [["knowthat_pipeline", "down"]],
  );
  await app.close();
});

test("pipeline readiness fails closed when an owner dependency omits its probe", async () => {
  const incomplete = createKnowThatApplicationV1(
    createInMemoryKnowThatStoreV1(),
    allowedMemory(),
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  await assert.rejects(
    incomplete.checkReadiness(new AbortController().signal),
    /readiness probes are required/u,
  );

  const complete = createKnowThatApplicationV1(
    createInMemoryKnowThatStoreV1(),
    {
      ...allowedMemory(),
      async checkReadiness() {},
    },
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  await assert.doesNotReject(
    complete.checkReadiness(new AbortController().signal),
  );
});

test("HTTP error envelopes never expose dependency messages", async () => {
  const secret =
    "Bearer knowthat-http-super-secret https://memory.invalid/?token=secret";
  const application = {
    async query() {
      throw new KnowThatErrorV1(
        "promotion_reservation_unavailable",
        secret,
        true,
      );
    },
  };
  const app = buildKnowThatApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify() {
            return queryCredential();
          },
        },
      },
    },
    application,
  );
  const response = await app.inject({
    method: "POST",
    url: "/v1/knowthat/query",
    headers: { authorization: `Bearer ${workloadToken}` },
    payload: {
      schema_version: "knowthat_query.v1",
      ...scope,
      limit: 1,
    },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(
    response.json().message,
    "Memory promotion reservation is unavailable",
  );
  assert.equal(response.body.includes(secret), false);
  assert.equal(response.body.includes("knowthat-http-super-secret"), false);
});

test("Fastify schema rejection never reaches the KnowThat owner handler", async () => {
  let handlerCalls = 0;
  const application = {
    async query() {
      handlerCalls += 1;
      throw new Error("must not execute");
    },
  };
  const app = buildKnowThatApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify() {
            return queryCredential();
          },
        },
      },
    },
    application,
  );
  const response = await app.inject({
    method: "POST",
    url: "/v1/knowthat/query",
    headers: { authorization: `Bearer ${workloadToken}` },
    payload: {
      schema_version: "knowthat_query.v1",
      ...scope,
      limit: 1,
      unexpected: true,
    },
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, "invalid_request");
  assert.equal(handlerCalls, 0);
  await app.close();
});

test("HTTP snapshot pagination survives workload JWT renewal", async () => {
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const application = createKnowThatApplicationV1(
    store,
    allowedMemory(),
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  await application.writeBatch(
    batch("http-page-seed", [
      item({ client_item_id: "http-a", subject: "a", object: "one" }),
      item({
        client_item_id: "http-b",
        subject: "b",
        object: "two",
        source_ref: "artifact:http-page-2",
        evidence_refs: ["artifact:http-page-2"],
      }),
    ]),
  );
  let jti = "query-token-1";
  const app = buildKnowThatApp(
    {
      logger: false,
      auth: {
        verifier: {
          async verify() {
            return queryCredential(jti);
          },
        },
      },
    },
    application,
  );
  const first = await app.inject({
    method: "POST",
    url: "/v1/knowthat/query",
    headers: { authorization: `Bearer ${workloadToken}` },
    payload: {
      schema_version: "knowthat_query.v1",
      ...scope,
      limit: 1,
    },
  });
  assert.equal(first.statusCode, 200, first.body);
  assert.ok(first.json().next_cursor);

  jti = "query-token-2";
  const second = await app.inject({
    method: "POST",
    url: "/v1/knowthat/query",
    headers: { authorization: `Bearer ${workloadToken}` },
    payload: {
      schema_version: "knowthat_query.v1",
      ...scope,
      snapshot_token: first.json().snapshot_token,
      cursor: first.json().next_cursor,
      limit: 1,
    },
  });
  assert.equal(second.statusCode, 200, second.body);
  assert.equal(second.json().facts.length, 1);
  await app.close();
});

test("canonical hashing is bounded, side-effect free, and permits non-cyclic aliases", () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "secret";
    },
  });
  assert.throws(() => canonicalHashV1(accessor), /accessor_property/u);
  assert.equal(getterCalls, 0);

  const hidden = {};
  Object.defineProperty(hidden, "value", {
    enumerable: false,
    value: "hidden",
  });
  assert.throws(() => canonicalHashV1(hidden), /hidden_property/u);

  const sparse = new Array(2);
  sparse[1] = "present";
  assert.throws(() => canonicalHashV1(sparse), /sparse/u);
  assert.throws(
    () => canonicalHashV1(new Proxy({ value: "proxied" }, {})),
    /proxy_object/u,
  );

  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalHashV1(cyclic), /cycle/u);

  const deep = {};
  let cursor = deep;
  for (let depth = 0; depth < 66; depth += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.throws(() => canonicalHashV1(deep), /max_depth_exceeded/u);

  const shared = { value: "same" };
  assert.equal(
    canonicalHashV1({ left: shared, right: shared }),
    canonicalHashV1({
      left: { value: "same" },
      right: { value: "same" },
    }),
  );

  const token = signOpaqueV1(
    "knowthat_snapshot",
    {
      kind: "caller_overridden_kind",
      version: 999,
      value: "bounded",
    },
    "opaque-test-secret",
  );
  assert.deepEqual(
    verifyOpaqueV1(
      token,
      "knowthat_snapshot",
      "opaque-test-secret",
    ),
    {
      kind: "knowthat_snapshot",
      value: "bounded",
      version: 1,
    },
  );
});

function sourceEvent(candidateId, suggestionId, sourceMetaJobId) {
  const payload = {
    candidate_id: candidateId,
    suggestion_id: suggestionId,
    source_meta_job_id: sourceMetaJobId,
  };
  const idempotencyKey = `meta-review:${sourceMetaJobId}:${suggestionId}`;
  return {
    ...scope,
    source: "meta_cognition",
    event_id: `event-${suggestionId}`,
    idempotency_key: idempotencyKey,
    payload_hash: canonicalHashV1(payload),
    semantic_hash: canonicalHashV1({
      source: "meta_cognition",
      idempotency_key: idempotencyKey,
      payload,
    }),
    scope_fingerprint: knowThatScopeFingerprintV1(scope),
    payload,
  };
}

function review(candidateId, version, overrides = {}) {
  const suggestionId = overrides.suggestion_id ?? "suggestion-1";
  const sourceMetaJobId = overrides.source_meta_job_id ?? "meta-review-1";
  return {
    schema_version: "knowthat.candidate_review.v1",
    ...scope,
    candidate_id: candidateId,
    suggestion_id: suggestionId,
    source_meta_job_id: sourceMetaJobId,
    target_candidate_version: version,
    suggested_action: "promote",
    reason: "new independent Memory evidence",
    new_evidence_refs: ["memory_point:point-2"],
    risk_level: "low",
    confidence_delta: 0,
    validation_profile: "standard",
    idempotency_key: `candidate_review:${sourceMetaJobId}:${suggestionId}`,
    trace_id: `trace-${suggestionId}`,
    source_event: sourceEvent(candidateId, suggestionId, sourceMetaJobId),
    ...overrides,
  };
}

test("direct-active accepts only the complete gate and weak implication remains candidate", async () => {
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    allowedMemory(),
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const direct = await app.writeBatch(
    batch("direct", [item()]),
    new Date("2026-07-24T00:00:00.000Z"),
  );
  assert.equal(direct.item_results[0].final_status, "active");

  const weak = await app.writeBatch(
    batch("weak", [
      item({
        client_item_id: "weak",
        subject: "answer",
        predicate: "tone",
        object: "concise",
        explicitness: "weak_implication",
      }),
    ]),
    new Date("2026-07-24T00:00:01.000Z"),
  );
  assert.equal(weak.item_results[0].final_status, "candidate");
  assert.equal(weak.item_results[0].decision_reason, "not_explicit_statement");
});

test("canonical conflict ranks come from shared domain/source matrix and rules never auto-resolve", async () => {
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    allowedMemory(),
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const existing = await app.writeBatch(
    batch("runtime-existing", [
      item({
        client_item_id: "runtime-existing",
        category: "world_state",
        subject: "service",
        predicate: "status",
        object: "healthy",
        source: "system_event_tool_result",
        source_ref: "system_event:health-1",
        evidence_refs: ["system_event:health-1"],
        valid_until: "2026-07-25T00:00:00.000Z",
      }),
    ]),
    new Date("2026-07-24T00:00:00.000Z"),
  );
  const conflicting = await app.writeBatch(
    batch("runtime-conflict", [
      item({
        client_item_id: "runtime-conflict",
        category: "world_state",
        subject: "service",
        predicate: "status",
        object: "down",
        source: "explicit_feedback",
        source_ref: "user_feedback:health-2",
        evidence_refs: ["user_feedback:health-2"],
        valid_until: "2026-07-25T00:00:00.000Z",
      }),
    ]),
    new Date("2026-07-24T00:00:01.000Z"),
  );
  assert.equal(conflicting.item_results[0].final_status, "candidate");
  const runtimeConflict = store.inspect().conflicts[0];
  assert.equal(runtimeConflict.status, "auto_resolved");
  assert.equal(runtimeConflict.source_priority_snapshot.rank_source, "shared.conflict_policy.v1");
  assert.equal(runtimeConflict.source_priority_snapshot.left.rank, 9);
  assert.equal(runtimeConflict.source_priority_snapshot.right.rank, 7);
  assert.equal(
    store.inspect().facts.find((fact) => fact.id === existing.item_results[0].fact_id)
      .status,
    "active",
  );

  const ruleLeft = {
    ...store.inspect().facts[0],
    category: "rule",
    source: "explicit_feedback",
    source_ref: "user_feedback:rule-left",
  };
  const ruleRight = {
    ...ruleLeft,
    id: "rule-right",
    source: "meta_inference",
    source_ref: "memory_point:rule-right",
  };
  const decision = evaluateKnowThatCanonicalConflictV1(ruleLeft, ruleRight);
  assert.equal(decision.policy.auto_resolution_eligible, false);
  assert.equal(decision.policy.domain, "rule");
});

test("higher canonical source atomically supersedes existing active only when direct-active passes", async () => {
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    allowedMemory(),
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const oldResult = await app.writeBatch(
    batch("old-runtime", [
      item({
        client_item_id: "old",
        category: "world_state",
        subject: "service",
        predicate: "status",
        object: "down",
        source: "explicit_feedback",
        source_ref: "user_feedback:old",
        evidence_refs: ["user_feedback:old"],
        valid_until: "2026-07-25T00:00:00.000Z",
      }),
    ]),
    new Date("2026-07-24T00:00:00.000Z"),
  );
  const replacement = await app.writeBatch(
    batch("new-runtime", [
      item({
        client_item_id: "new",
        category: "world_state",
        subject: "service",
        predicate: "status",
        object: "healthy",
        source: "system_event_tool_result",
        source_ref: "system_event:new",
        evidence_refs: ["system_event:new"],
        valid_until: "2026-07-25T00:00:00.000Z",
      }),
    ]),
    new Date("2026-07-24T00:00:01.000Z"),
  );
  assert.equal(replacement.item_results[0].final_status, "active");
  assert.equal(
    replacement.item_results[0].decision_reason,
    "canonical_conflict_supersession",
  );
  assert.equal(
    (await store.readFact(scope, oldResult.item_results[0].fact_id)).status,
    "expired",
  );
  assert.equal(store.inspect().conflicts[0].status, "auto_resolved");
  assert.equal(
    store.inspect().facts.filter((fact) => fact.status === "active").length,
    1,
  );
});

test("batch and item idempotency reject request and source/object drift", async () => {
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    allowedMemory(),
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const request = batch("idem", [item()]);
  const first = await app.writeBatch(request);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.item_results), true);
  assert.equal(Object.isFrozen(first.item_results[0]), true);
  assert.throws(() => {
    first.item_results[0].decision_reason = "mutated_after_commit";
  }, TypeError);
  const replay = await app.writeBatch({ ...request, trace_id: "trace-retry" });
  assert.equal(replay.write_batch_id, first.write_batch_id);
  assert.equal(replay.duplicate_replayed, true);
  assert.notEqual(
    replay.item_results[0].decision_reason,
    "mutated_after_commit",
  );

  await assert.rejects(
    app.writeBatch({
      ...request,
      items: [item({ confidence: 0.91 })],
    }),
    (error) =>
      error instanceof KnowThatErrorV1 &&
      error.code === "idempotency_conflict",
  );

  const drift = await app.writeBatch(
    batch("source-drift", [
      item({
        client_item_id: "drift",
        object: "Beijing",
        source_ref: "artifact:release-1",
        evidence_refs: ["artifact:release-1"],
      }),
    ]),
  );
  assert.equal(drift.batch_status, "partial_failed");
  assert.equal(drift.rejected_items[0].code, "source_ref_object_drift");
});

test("same-batch contradictory values use shared source rank for a deterministic conflict plan", async () => {
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    allowedMemory(),
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const result = await app.writeBatch(
    batch("same-batch-conflict", [
      item({
        client_item_id: "lower",
        object: "Beijing",
        source: "meta_inference",
        source_ref: "memory_point:lower",
        evidence_refs: ["memory_point:lower"],
      }),
      item({
        client_item_id: "higher",
        object: "Shanghai",
        source: "explicit_feedback",
        source_ref: "user_feedback:higher",
        evidence_refs: ["user_feedback:higher"],
      }),
    ]),
  );
  assert.equal(result.candidate_fact_ids.length, 2);
  assert.equal(result.conflict_ids.length, 1);
  const representative = result.item_results.find(
    (entry) => entry.representative_client_item_id === "higher",
  );
  assert.ok(representative);
  const conflict = store.inspect().conflicts[0];
  assert.equal(conflict.status, "open");
  assert.equal(conflict.source_priority_snapshot.rank_source, "shared.conflict_policy.v1");

  await assert.rejects(
    app.writeBatch(
      batch("caller-rank", [
        { ...item(), source_rank: 999, authority_gate_passed: true },
      ]),
    ),
    (error) =>
      error instanceof KnowThatErrorV1 &&
      error.code === "schema_validation_failed",
  );
});

test("snapshot pagination binds principal/scope/as_of/revision and excludes later mutations", async () => {
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    allowedMemory(),
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  await app.writeBatch(
    batch("page-seed", [
      item({ client_item_id: "a", subject: "a", object: "one" }),
      item({
        client_item_id: "b",
        subject: "b",
        object: "two",
        source_ref: "artifact:release-2",
        evidence_refs: ["artifact:release-2"],
      }),
    ]),
    new Date("2026-07-24T00:00:00.000Z"),
  );
  const first = await app.query(
    {
      schema_version: "knowthat_query.v1",
      ...scope,
      limit: 1,
    },
    "trigger:jti-1",
    new Date("2026-07-24T00:00:01.000Z"),
  );
  assert.equal(first.facts.length, 1);
  assert.ok(first.next_cursor);

  await app.writeBatch(
    batch("later", [
      item({
        client_item_id: "c",
        subject: "c",
        object: "three",
        source_ref: "artifact:release-3",
        evidence_refs: ["artifact:release-3"],
      }),
    ]),
    new Date("2026-07-24T00:00:02.000Z"),
  );
  const second = await app.query(
    {
      schema_version: "knowthat_query.v1",
      ...scope,
      snapshot_token: first.snapshot_token,
      cursor: first.next_cursor,
      limit: 1,
    },
    "trigger:jti-1",
    new Date("2026-07-24T00:00:03.000Z"),
  );
  assert.equal(second.query_revision, first.query_revision);
  assert.equal(second.facts.length, 1);
  assert.notEqual(second.facts[0].subject, "c");

  await assert.rejects(
    app.query(
      {
        schema_version: "knowthat_query.v1",
        ...scope,
        snapshot_token: first.snapshot_token,
        cursor: first.next_cursor,
      },
      "trigger:jti-other",
      new Date("2026-07-24T00:00:03.000Z"),
    ),
    (error) =>
      error instanceof KnowThatErrorV1 && error.code === "scope_mismatch",
  );
});

test("evidence_pending converges on the same candidate with CAS and durable linkage", async () => {
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    allowedMemory(),
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("pending", [
      item({
        client_item_id: "pending",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-1",
        evidence_refs: ["memory_point:point-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting independent Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  const result = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1),
    new AbortController().signal,
  );
  assert.equal(result.decision, "promote");
  assert.equal(result.reason_code, "promoted");
  assert.equal(result.linkage_check_ids.length, 1);
  const promoted = await store.readFact(scope, candidateId);
  assert.equal(promoted.status, "active");
  assert.equal(promoted.evidence_pending, false);
  assert.equal(promoted.candidate_version, 2);
  const promotionState = store.inspect();
  const promotionAck = promotionState.memory_commands.find(
    (command) => command.command_type === "promotion_reservation_ack",
  );
  assert.equal(promotionAck.status, "sent");
  assert.equal(promotionAck.candidate_fact_id, candidateId);
  assert.ok(
    promotionState.revisions.some(
      (revision) => revision.id === promotionAck.promotion_revision_id,
    ),
  );
  assert.ok(
    promotionState.events.some(
      (event) =>
        event.event_type === "knowthat.candidate.promoted" &&
        event.payload.candidate_id === candidateId,
    ),
  );
  assert.ok(
    promotionState.audits.some(
      (audit) =>
        audit.aggregate_id === candidateId &&
        audit.action === "candidate_reviewed",
    ),
  );

  const replay = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1),
    new AbortController().signal,
  );
  assert.equal(replay.duplicate_replayed, true);
  assert.equal(store.inspect().facts.filter((fact) => fact.id === candidateId).length, 1);
});

test("promotion rejects multiple Memory refs from one source before reserving", async () => {
  let validateCalls = 0;
  const memory = allowedMemory({
    source_trigger_process_id: () => "same-trigger-process",
    on_validate: () => {
      validateCalls += 1;
    },
  });
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("same-source-candidate", [
      item({
        client_item_id: "same-source-candidate",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-1",
        evidence_refs: ["memory_point:point-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting independent Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;

  const result = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1),
    new AbortController().signal,
  );

  assert.equal(result.decision, "keep_candidate");
  assert.equal(result.reason_code, "insufficient_independent_evidence");
  assert.equal(validateCalls, 0);
  assert.equal((await store.readFact(scope, candidateId)).status, "candidate");
});

test("ordinary promotion accepts two independently sourced Memory points", async () => {
  let validateCalls = 0;
  const memory = allowedMemory({
    on_validate: () => {
      validateCalls += 1;
    },
  });
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("independent-source-candidate", [
      item({
        client_item_id: "independent-source-candidate",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-1",
        evidence_refs: ["memory_point:point-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting independent Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;

  const result = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1),
    new AbortController().signal,
  );

  assert.equal(result.decision, "promote");
  assert.equal(result.reason_code, "promoted");
  assert.equal(validateCalls, 1);
});

test("high-risk promotion requires Memory-confirmed explicit evidence before reserving", async () => {
  let validateCalls = 0;
  const memory = allowedMemory({
    on_validate: () => {
      validateCalls += 1;
    },
  });
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("high-risk-candidate", [
      item({
        client_item_id: "high-risk-candidate",
        proposed_status: "candidate",
        direct_active_hint: false,
        risk_level: "high",
        source: "meta_inference",
        source_ref: "memory_point:point-1",
        evidence_refs: ["memory_point:point-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting confirmed Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;

  const result = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1, { risk_level: "high" }),
    new AbortController().signal,
  );

  assert.equal(result.decision, "keep_candidate");
  assert.equal(result.reason_code, "insufficient_independent_evidence");
  assert.equal(validateCalls, 0);
  assert.equal((await store.readFact(scope, candidateId)).status, "candidate");
});

test("high-risk promotion accepts Memory-confirmed explicit evidence", async () => {
  let validateCalls = 0;
  const memory = allowedMemory({
    user_explicit_confirmation: (_id, index) => index === 0,
    on_validate: () => {
      validateCalls += 1;
    },
  });
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("high-risk-confirmed-candidate", [
      item({
        client_item_id: "high-risk-confirmed-candidate",
        proposed_status: "candidate",
        direct_active_hint: false,
        risk_level: "high",
        source: "meta_inference",
        source_ref: "memory_point:point-1",
        evidence_refs: ["memory_point:point-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting confirmed Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;

  const result = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1, { risk_level: "high" }),
    new AbortController().signal,
  );

  assert.equal(result.decision, "promote");
  assert.equal(result.reason_code, "promoted");
  assert.equal(validateCalls, 1);
});

test("an explicitly injected review clock is authoritative across Memory awaits", async () => {
  const fixedNow = new Date("2026-07-24T09:00:00.000Z");
  const memory = allowedMemory();
  const validCheck = memory.check.bind(memory);
  const validValidate = memory.validate.bind(memory);
  memory.check = async (request) => ({
    ...(await validCheck(request)),
    checked_at: new Date(fixedNow.getTime() + 1_000).toISOString(),
    expires_at: new Date(fixedNow.getTime() + 31_000).toISOString(),
  });
  memory.validate = async (request) => ({
    ...(await validValidate(request)),
    reserved_at: new Date(fixedNow.getTime() + 2_000).toISOString(),
    expires_at: new Date(fixedNow.getTime() + 7_000).toISOString(),
  });
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("injected-review-clock", [
      item({
        client_item_id: "injected-review-clock",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:injected-clock-1",
        evidence_refs: ["memory_point:injected-clock-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
    fixedNow,
  );
  const candidateId = created.item_results[0].fact_id;
  const result = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1, {
      suggestion_id: "injected-review-clock",
      source_meta_job_id: "meta-injected-review-clock",
      new_evidence_refs: ["memory_point:injected-clock-2"],
    }),
    new AbortController().signal,
    new Date(fixedNow.getTime() + 3_000),
  );
  assert.equal(result.reason_code, "promoted");
});

test("an expired Memory check is retryable and cannot commit a business review", async () => {
  let validateCalls = 0;
  const memory = allowedMemory({
    on_validate: () => {
      validateCalls += 1;
    },
  });
  const validCheck = memory.check.bind(memory);
  memory.check = async (request) => {
    const response = await validCheck(request);
    const expiresAt = new Date(Date.now() - 1_000);
    return {
      ...response,
      checked_at: new Date(expiresAt.getTime() - 30_000).toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  };
  const store = createInMemoryKnowThatStoreV1(DEFAULT_KNOWTHAT_CONFIG_V1);
  const app = createKnowThatApplicationV1(
    store,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("expired-check-candidate", [
      item({
        client_item_id: "expired-check-candidate",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-1",
        evidence_refs: ["memory_point:point-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting independent Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;

  await assert.rejects(
    app.reviewCandidate(
      candidateId,
      review(candidateId, 1),
      new AbortController().signal,
    ),
    (error) =>
      error instanceof KnowThatErrorV1 &&
      error.code === "promotion_reservation_unavailable" &&
      error.retryable,
  );

  assert.equal(validateCalls, 0);
  const candidate = await store.readFact(scope, candidateId);
  assert.equal(candidate.status, "candidate");
  assert.equal(candidate.candidate_version, 1);
  assert.equal(candidate.evidence_pending, true);
});

test("promotion ack remains durable across Memory outage and reconciles idempotently", async () => {
  const downstreamSecret =
    "Bearer knowthat-super-secret https://memory.invalid/?token=secret";
  const durableStore = createInMemoryKnowThatStoreV1({
    ...DEFAULT_KNOWTHAT_CONFIG_V1,
    retry_base_ms: 10,
  });
  let disconnectAfterSentCommit = false;
  const store = {
    ...durableStore,
    async settlePromotionAck(input) {
      const settled = await durableStore.settlePromotionAck(input);
      if (disconnectAfterSentCommit && input.outcome === "sent") {
        disconnectAfterSentCommit = false;
        throw new Error("database disconnected after commit");
      }
      return settled;
    },
  };
  const memory = allowedMemory();
  const successfulValidate = memory.validate.bind(memory);
  const successfulAck = memory.ack.bind(memory);
  let plaintextReservationToken;
  memory.validate = async (request) => {
    const reservation = await successfulValidate(request);
    plaintextReservationToken = reservation.reservation_token;
    return reservation;
  };
  let ackAttempts = 0;
  memory.ack = async (request) => {
    ackAttempts += 1;
    if (ackAttempts === 1) throw new Error(downstreamSecret);
    return successfulAck(request);
  };
  const app = createKnowThatApplicationV1(
    store,
    memory,
    {
      ...DEFAULT_KNOWTHAT_CONFIG_V1,
      retry_base_ms: 10,
    },
  );
  const created = await app.writeBatch(
    batch("ack-recovery", [
      item({
        client_item_id: "ack-recovery",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-ack-1",
        evidence_refs: ["memory_point:point-ack-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  const reviewed = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1, {
      suggestion_id: "ack-recovery",
      source_meta_job_id: "meta-ack-recovery",
      new_evidence_refs: ["memory_point:point-ack-2"],
    }),
    new AbortController().signal,
  );
  assert.equal(reviewed.reason_code, "promoted");
  assert.equal(
    store.inspect().memory_commands.find(
      (command) => command.command_type === "promotion_reservation_ack",
    ).status,
    "retry_wait",
  );
  const pending = store.inspect().memory_commands.find(
    (command) => command.command_type === "promotion_reservation_ack",
  );
  assert.deepEqual(pending.last_error, {
    failure_code: "promotion_ack_unavailable",
    safe_summary: "Memory promotion acknowledgement is unavailable",
  });
  assert.equal("reservation_token" in pending.request, false);
  assert.match(pending.reservation_token_hash, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(typeof plaintextReservationToken, "string");
  const inspected = JSON.stringify(store.inspect());
  assert.equal(inspected.includes(downstreamSecret), false);
  assert.equal(inspected.includes("knowthat-super-secret"), false);
  assert.equal(inspected.includes(plaintextReservationToken), false);

  const restartedApp = createKnowThatApplicationV1(
    store,
    memory,
    {
      ...DEFAULT_KNOWTHAT_CONFIG_V1,
      retry_base_ms: 10,
    },
  );
  disconnectAfterSentCommit = true;
  const reconciled = await restartedApp.reconcilePromotionAcks(
    new AbortController().signal,
    new Date(Date.now() + 60_000),
  );
  assert.deepEqual(reconciled, {
    attempted: 1,
    sent: 1,
    retry_wait: 0,
    failed: 0,
  });
  assert.equal(
    store.inspect().memory_commands.find(
      (command) => command.command_type === "promotion_reservation_ack",
    ).status,
    "sent",
  );
});

test("promotion ack rejects false-positive owner responses and retries beyond the ordinary outbox budget", async () => {
  const config = {
    ...DEFAULT_KNOWTHAT_CONFIG_V1,
    max_outbox_attempts: 1,
    retry_base_ms: 1,
  };
  const store = createInMemoryKnowThatStoreV1(config);
  const memory = allowedMemory();
  const validAck = memory.ack.bind(memory);
  let returnDriftedIdentity = true;
  memory.ack = async (request) => {
    const response = await validAck(request);
    return returnDriftedIdentity
      ? { ...response, reservation_id: "reservation:wrong" }
      : response;
  };
  const app = createKnowThatApplicationV1(store, memory, config);
  const created = await app.writeBatch(
    batch("ack-contract-drift", [
      item({
        client_item_id: "ack-contract-drift",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-ack-drift-1",
        evidence_refs: ["memory_point:point-ack-drift-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  const reviewed = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1, {
      suggestion_id: "ack-contract-drift",
      source_meta_job_id: "meta-ack-contract-drift",
      new_evidence_refs: ["memory_point:point-ack-drift-2"],
    }),
    new AbortController().signal,
  );
  assert.equal(reviewed.reason_code, "promoted");
  const pending = store.inspect().memory_commands.find(
    (command) => command.command_type === "promotion_reservation_ack",
  );
  assert.equal(pending.status, "retry_wait");
  assert.equal(pending.attempt_count, 1);

  returnDriftedIdentity = false;
  const reconciled = await app.reconcilePromotionAcks(
    new AbortController().signal,
    new Date(Date.now() + 60_000),
  );
  assert.deepEqual(reconciled, {
    attempted: 1,
    sent: 1,
    retry_wait: 0,
    failed: 0,
  });
  assert.equal(
    store.inspect().memory_commands.find(
      (command) => command.command_type === "promotion_reservation_ack",
    ).status,
    "sent",
  );
});

test("promotion ack pins a queued command across the Memory await and settles only that identity", async () => {
  const config = {
    ...DEFAULT_KNOWTHAT_CONFIG_V1,
    retry_base_ms: 1,
  };
  const durableStore = createInMemoryKnowThatStoreV1(config);
  let queuedCommands;
  const settlementIds = [];
  const store = {
    ...durableStore,
    async pendingPromotionAcks(input) {
      queuedCommands = structuredClone(
        await durableStore.pendingPromotionAcks(input),
      );
      return queuedCommands;
    },
    async settlePromotionAck(input) {
      settlementIds.push(input.command_id);
      return durableStore.settlePromotionAck(input);
    },
  };
  const memory = allowedMemory();
  let ackCalls = 0;
  memory.ack = async (request) => {
    ackCalls += 1;
    if (ackCalls === 1) {
      throw new Error("force durable retry handoff");
    }
    const delivered = structuredClone(request);
    queuedCommands[0].id = "knowthat_memory_promotion_reservation_ack_B";
    queuedCommands[0].reservation_id = "reservation:B";
    queuedCommands[0].request.reservation_id = "reservation:B";
    return {
      schema_version: "memory.promotion_reservation_ack.v1",
      reservation_id: delivered.reservation_id,
      candidate_fact_id: delivered.candidate_fact_id,
      fencing_generation: delivered.fencing_generation,
      status: "committed",
      promotion_revision_id: delivered.promotion_revision_id,
      committed_at: delivered.committed_at,
      duplicate_replayed: false,
    };
  };
  const app = createKnowThatApplicationV1(store, memory, config);
  const created = await app.writeBatch(
    batch("ack-command-snapshot", [
      item({
        client_item_id: "ack-command-snapshot",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:ack-command-snapshot-1",
        evidence_refs: ["memory_point:ack-command-snapshot-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  await app.reviewCandidate(
    candidateId,
    review(candidateId, 1, {
      suggestion_id: "ack-command-snapshot",
      source_meta_job_id: "meta-ack-command-snapshot",
      new_evidence_refs: ["memory_point:ack-command-snapshot-2"],
    }),
    new AbortController().signal,
  );
  const original = durableStore
    .inspect()
    .memory_commands.find(
      (command) => command.command_type === "promotion_reservation_ack",
    );
  assert.equal(original.status, "retry_wait");

  const reconciled = await app.reconcilePromotionAcks(
    new AbortController().signal,
    new Date(Date.now() + 60_000),
  );
  assert.deepEqual(reconciled, {
    attempted: 1,
    sent: 1,
    retry_wait: 0,
    failed: 0,
  });
  assert.equal(settlementIds.at(-1), original.id);
  assert.equal(
    durableStore
      .inspect()
      .memory_commands.find((command) => command.id === original.id).status,
    "sent",
  );
});

test("promotion ack rejects a settled owner row whose durable identity drifted", async () => {
  const config = {
    ...DEFAULT_KNOWTHAT_CONFIG_V1,
    retry_base_ms: 1,
  };
  const durableStore = createInMemoryKnowThatStoreV1(config);
  let driftSettledRows = false;
  const store = {
    ...durableStore,
    async settlePromotionAck(input) {
      const settled = await durableStore.settlePromotionAck(input);
      return driftSettledRows
        ? { ...settled, promotion_revision_id: "revision:wrong" }
        : settled;
    },
  };
  const memory = allowedMemory();
  let ackCalls = 0;
  const successfulAck = memory.ack.bind(memory);
  memory.ack = async (request) => {
    ackCalls += 1;
    if (ackCalls === 1) throw new Error("force durable retry handoff");
    return successfulAck(request);
  };
  const app = createKnowThatApplicationV1(store, memory, config);
  const created = await app.writeBatch(
    batch("ack-settled-identity", [
      item({
        client_item_id: "ack-settled-identity",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:ack-settled-identity-1",
        evidence_refs: ["memory_point:ack-settled-identity-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  await app.reviewCandidate(
    candidateId,
    review(candidateId, 1, {
      suggestion_id: "ack-settled-identity",
      source_meta_job_id: "meta-ack-settled-identity",
      new_evidence_refs: ["memory_point:ack-settled-identity-2"],
    }),
    new AbortController().signal,
  );
  driftSettledRows = true;
  await assert.rejects(
    app.reconcilePromotionAcks(
      new AbortController().signal,
      new Date(Date.now() + 60_000),
    ),
    /promotion ack command identity binding drifted|no longer identifies/u,
  );
});

test("promotion release rejects a settled owner row whose delivered identity drifted", async () => {
  const config = {
    ...DEFAULT_KNOWTHAT_CONFIG_V1,
    retry_base_ms: 1,
  };
  const durableStore = createInMemoryKnowThatStoreV1(config);
  const candidateId = "candidate-release-settled-identity";
  const request = review(candidateId, 1, {
    suggestion_id: "release-settled-identity",
    source_meta_job_id: "meta-release-settled-identity",
  });
  await durableStore.ensurePromotionRelease({
    request,
    promotion_reservation: {
      schema_version: "memory.promotion_reservation.v1",
      reservation_id: "reservation:release-settled-identity",
      check_id: "check:release-settled-identity",
      check_generation: 1,
      candidate_fact_id: candidateId,
      fencing_generation: 1,
      reserved_points: [
        {
          memory_point_id: "release-settled-identity-point",
          state_version: 1,
          state_hash: `sha256:${"1".repeat(64)}`,
        },
      ],
      reserved_conflicts: [],
      reservation_token_hash: `sha256:${"2".repeat(64)}`,
      reserved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5_000).toISOString(),
      status: "active",
    },
    release_reason: "promotion_not_applied",
    now: new Date(),
  });
  let driftSettledRows = false;
  const store = {
    ...durableStore,
    async settlePromotionRelease(input) {
      const settled = await durableStore.settlePromotionRelease(input);
      return driftSettledRows
        ? { ...settled, release_reason: "stale_fence" }
        : settled;
    },
  };
  const memory = allowedMemory();
  let releaseCalls = 0;
  const successfulRelease = memory.release.bind(memory);
  memory.release = async (releaseRequest) => {
    releaseCalls += 1;
    if (releaseCalls === 1) {
      const response = await successfulRelease(releaseRequest);
      return {
        ...response,
        release_reason: "reservation_expired",
        released_at: releaseRequest.released_at,
      };
    }
    return successfulRelease(releaseRequest);
  };
  const app = createKnowThatApplicationV1(store, memory, config);
  const first = await app.reconcilePromotionReleases(
    new AbortController().signal,
    new Date(),
  );
  assert.deepEqual(first, {
    attempted: 1,
    sent: 0,
    retry_wait: 1,
    failed: 0,
  });

  driftSettledRows = true;
  await assert.rejects(
    app.reconcilePromotionReleases(
      new AbortController().signal,
      new Date(Date.now() + 60_000),
    ),
    /promotion release command identity binding drifted|no longer identifies/u,
  );
  assert.equal(
    durableStore
      .inspect()
      .memory_commands.find(
        (command) =>
          command.command_type === "promotion_reservation_release",
      ).status,
    "sent",
  );
});

test("definite KnowThat commit failure releases the Memory reservation", async () => {
  const durableStore = createInMemoryKnowThatStoreV1(
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const failingStore = {
    ...durableStore,
    async reviewCandidate() {
      throw new Error("definite transaction rollback");
    },
  };
  const memory = allowedMemory();
  const released = [];
  const successfulRelease = memory.release.bind(memory);
  memory.release = async (request) => {
    released.push(request);
    return successfulRelease(request);
  };
  const app = createKnowThatApplicationV1(
    failingStore,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("commit-failure", [
      item({
        client_item_id: "commit-failure",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-failure-1",
        evidence_refs: ["memory_point:point-failure-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  await assert.rejects(
    app.reviewCandidate(
      candidateId,
      review(candidateId, 1, {
        suggestion_id: "commit-failure",
        source_meta_job_id: "meta-commit-failure",
        new_evidence_refs: ["memory_point:point-failure-2"],
      }),
      new AbortController().signal,
    ),
    /definite transaction rollback/u,
  );
  assert.equal(released.length, 1);
  assert.equal(released[0].release_reason, "promotion_commit_failed");
  assert.equal((await durableStore.readFact(scope, candidateId)).status, "candidate");
});

test("a durable release handoff fences retry promotion on the same reservation", async () => {
  const durableStore = createInMemoryKnowThatStoreV1({
    ...DEFAULT_KNOWTHAT_CONFIG_V1,
    retry_base_ms: 1,
  });
  let failFirstReview = true;
  const store = {
    ...durableStore,
    async reviewCandidate(input) {
      if (failFirstReview) {
        failFirstReview = false;
        throw new Error("definite transaction rollback");
      }
      return durableStore.reviewCandidate(input);
    },
  };
  const memory = allowedMemory();
  const successfulCheck = memory.check.bind(memory);
  let stableCheck;
  memory.check = async (request) => {
    stableCheck ??= await successfulCheck(request);
    return structuredClone(stableCheck);
  };
  const successfulValidate = memory.validate.bind(memory);
  let stableReservation;
  memory.validate = async (request) => {
    stableReservation ??= await successfulValidate(request);
    return structuredClone(stableReservation);
  };
  const successfulRelease = memory.release.bind(memory);
  let releaseCalls = 0;
  memory.release = async (request) => {
    releaseCalls += 1;
    if (releaseCalls === 1) throw new Error("Memory release unavailable");
    return successfulRelease(request);
  };
  const app = createKnowThatApplicationV1(
    store,
    memory,
    {
      ...DEFAULT_KNOWTHAT_CONFIG_V1,
      retry_base_ms: 1,
    },
  );
  const created = await app.writeBatch(
    batch("release-fences-promotion-retry", [
      item({
        client_item_id: "release-fences-promotion-retry",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:release-fence-1",
        evidence_refs: ["memory_point:release-fence-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  const request = review(candidateId, 1, {
    suggestion_id: "release-fences-promotion-retry",
    source_meta_job_id: "meta-release-fences-promotion-retry",
    new_evidence_refs: ["memory_point:release-fence-2"],
  });
  const protocolNow = new Date();
  await assert.rejects(
    app.reviewCandidate(
      candidateId,
      request,
      new AbortController().signal,
      protocolNow,
    ),
    /definite transaction rollback/u,
  );
  assert.equal(
    durableStore.inspect().memory_commands.find(
      (command) =>
        command.command_type === "promotion_reservation_release",
    ).status,
    "retry_wait",
  );

  await assert.rejects(
    app.reviewCandidate(
      candidateId,
      { ...request, trace_id: "trace-release-fence-retry" },
      new AbortController().signal,
      protocolNow,
    ),
    (error) =>
      error instanceof KnowThatErrorV1 &&
      error.code === "promotion_retry_required" &&
      error.retryable,
  );
  assert.equal((await durableStore.readFact(scope, candidateId)).status, "candidate");
  assert.equal(
    durableStore.inspect().memory_commands.some(
      (command) => command.command_type === "promotion_reservation_ack",
    ),
    false,
  );
  assert.equal(
    durableStore.inspect().memory_commands.find(
      (command) =>
        command.command_type === "promotion_reservation_release",
    ).status,
    "sent",
  );
});

test("release enqueue rechecks commit outcome and cannot race a retry promotion", async () => {
  const durableStore = createInMemoryKnowThatStoreV1(
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  let failedInput;
  let failFirstReview = true;
  let injectRetryCommit = true;
  const racingStore = {
    ...durableStore,
    async reviewCandidate(input) {
      if (failFirstReview) {
        failFirstReview = false;
        failedInput = input;
        throw new Error("definite transaction rollback");
      }
      return durableStore.reviewCandidate(input);
    },
    async ensurePromotionRelease(input) {
      if (injectRetryCommit) {
        injectRetryCommit = false;
        await durableStore.reviewCandidate(failedInput);
      }
      return durableStore.ensurePromotionRelease(input);
    },
  };
  const memory = allowedMemory();
  let releaseCalls = 0;
  const successfulRelease = memory.release.bind(memory);
  memory.release = async (request) => {
    releaseCalls += 1;
    return successfulRelease(request);
  };
  const app = createKnowThatApplicationV1(
    racingStore,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("release-enqueue-race", [
      item({
        client_item_id: "release-enqueue-race",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:release-race-1",
        evidence_refs: ["memory_point:release-race-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  const request = review(candidateId, 1, {
    suggestion_id: "release-enqueue-race",
    source_meta_job_id: "meta-release-enqueue-race",
    new_evidence_refs: ["memory_point:release-race-2"],
  });
  await assert.rejects(
    app.reviewCandidate(
      candidateId,
      request,
      new AbortController().signal,
    ),
    (error) =>
      error instanceof KnowThatErrorV1 &&
      error.code === "promotion_retry_required" &&
      error.retryable,
  );
  assert.equal((await durableStore.readFact(scope, candidateId)).status, "active");
  assert.equal(releaseCalls, 0);
  assert.equal(
    durableStore.inspect().memory_commands.some(
      (command) =>
        command.command_type === "promotion_reservation_release",
    ),
    false,
  );
  assert.equal(
    durableStore.inspect().memory_commands.find(
      (command) => command.command_type === "promotion_reservation_ack",
    ).status,
    "pending",
  );

  const restarted = createKnowThatApplicationV1(
    durableStore,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const recovered = await restarted.reviewCandidate(
    candidateId,
    { ...request, trace_id: "trace-release-enqueue-race-retry" },
    new AbortController().signal,
  );
  assert.equal(recovered.reason_code, "promoted");
  assert.equal(recovered.duplicate_replayed, true);
  assert.equal(
    durableStore.inspect().memory_commands.find(
      (command) => command.command_type === "promotion_reservation_ack",
    ).status,
    "sent",
  );
});

test("mismatched or overlong Memory reservations fail closed before KnowThat mutation", async () => {
  const store = createInMemoryKnowThatStoreV1(
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const memory = allowedMemory();
  const validValidate = memory.validate.bind(memory);
  memory.validate = async (request) => {
    const reservation = await validValidate(request);
    return {
      ...reservation,
      reserved_points: [],
      expires_at: new Date(
        Date.parse(reservation.reserved_at) + 20_000,
      ).toISOString(),
    };
  };
  const app = createKnowThatApplicationV1(
    store,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("invalid-reservation", [
      item({
        client_item_id: "invalid-reservation",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-invalid-1",
        evidence_refs: ["memory_point:point-invalid-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  await assert.rejects(
    app.reviewCandidate(
      candidateId,
      review(candidateId, 1, {
        suggestion_id: "invalid-reservation",
        source_meta_job_id: "meta-invalid-reservation",
        new_evidence_refs: ["memory_point:point-invalid-2"],
      }),
      new AbortController().signal,
    ),
    (error) =>
      error instanceof KnowThatErrorV1 &&
      error.code === "promotion_reservation_unavailable",
  );
  assert.equal((await store.readFact(scope, candidateId)).status, "candidate");
  assert.equal(
    store.inspect().memory_commands.some(
      (command) => command.command_type === "promotion_reservation_ack",
    ),
    false,
  );
});

test("commit-then-disconnect is recovered before release and preserves the atomic ack outbox", async () => {
  const durableStore = createInMemoryKnowThatStoreV1(
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  let disconnect = true;
  const uncertainStore = {
    ...durableStore,
    async reviewCandidate(input) {
      const committed = await durableStore.reviewCandidate(input);
      if (disconnect) {
        disconnect = false;
        throw new Error("commit then disconnect");
      }
      return committed;
    },
  };
  const memory = allowedMemory();
  let releaseCalls = 0;
  const successfulRelease = memory.release.bind(memory);
  memory.release = async (request) => {
    releaseCalls += 1;
    return successfulRelease(request);
  };
  const app = createKnowThatApplicationV1(
    uncertainStore,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("commit-disconnect", [
      item({
        client_item_id: "commit-disconnect",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-disconnect-1",
        evidence_refs: ["memory_point:point-disconnect-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  const result = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1, {
      suggestion_id: "commit-disconnect",
      source_meta_job_id: "meta-commit-disconnect",
      new_evidence_refs: ["memory_point:point-disconnect-2"],
    }),
    new AbortController().signal,
  );
  assert.equal(result.reason_code, "promoted");
  assert.equal(releaseCalls, 0);
  assert.equal((await durableStore.readFact(scope, candidateId)).status, "active");
  assert.equal(
    durableStore.inspect().memory_commands.find(
      (command) => command.command_type === "promotion_reservation_ack",
    ).status,
    "sent",
  );
});

test("ambiguous promotion fails closed when commit recovery omits its atomic ack handoff", async () => {
  const durableStore = createInMemoryKnowThatStoreV1(
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  let committed = false;
  const malformedRecoveryStore = {
    ...durableStore,
    async reviewCandidate(input) {
      await durableStore.reviewCandidate(input);
      committed = true;
      throw new Error("commit then disconnect");
    },
    async readCandidateReview(input) {
      const recovered = await durableStore.readCandidateReview(input);
      return committed && recovered !== undefined
        ? { ...recovered, promotion_ack_command: null }
        : recovered;
    },
  };
  const memory = allowedMemory();
  let releaseCalls = 0;
  const successfulRelease = memory.release.bind(memory);
  memory.release = async (request) => {
    releaseCalls += 1;
    return successfulRelease(request);
  };
  const app = createKnowThatApplicationV1(
    malformedRecoveryStore,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const created = await app.writeBatch(
    batch("malformed-commit-recovery", [
      item({
        client_item_id: "malformed-commit-recovery",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:malformed-recovery-1",
        evidence_refs: ["memory_point:malformed-recovery-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  await assert.rejects(
    app.reviewCandidate(
      candidateId,
      review(candidateId, 1, {
        suggestion_id: "malformed-commit-recovery",
        source_meta_job_id: "meta-malformed-commit-recovery",
        new_evidence_refs: ["memory_point:malformed-recovery-2"],
      }),
      new AbortController().signal,
    ),
    (error) =>
      error instanceof KnowThatErrorV1 &&
      error.code === "promotion_retry_required" &&
      error.retryable,
  );
  assert.equal(releaseCalls, 0);
  assert.equal((await durableStore.readFact(scope, candidateId)).status, "active");
  assert.equal(
    durableStore.inspect().memory_commands.find(
      (command) => command.command_type === "promotion_reservation_ack",
    ).status,
    "pending",
  );

  const restarted = createKnowThatApplicationV1(
    durableStore,
    memory,
    DEFAULT_KNOWTHAT_CONFIG_V1,
  );
  const replay = await restarted.reviewCandidate(
    candidateId,
    review(candidateId, 1, {
      suggestion_id: "malformed-commit-recovery",
      source_meta_job_id: "meta-malformed-commit-recovery",
      new_evidence_refs: ["memory_point:malformed-recovery-2"],
      trace_id: "trace-malformed-commit-recovery-replay",
    }),
    new AbortController().signal,
  );
  assert.equal(replay.reason_code, "promoted");
  assert.equal(replay.duplicate_replayed, true);
  assert.equal(
    durableStore.inspect().memory_commands.find(
      (command) => command.command_type === "promotion_reservation_ack",
    ).status,
    "sent",
  );
});

test("non-promoted reservations survive review and Memory commit disconnects and reconcile after restart", async () => {
  const config = {
    ...DEFAULT_KNOWTHAT_CONFIG_V1,
    retry_base_ms: 1,
  };
  const durableStore = createInMemoryKnowThatStoreV1(config);
  let injectCandidateRace = true;
  let disconnectAfterReviewCommit = true;
  const uncertainStore = {
    ...durableStore,
    async reviewCandidate(input) {
      if (injectCandidateRace) {
        injectCandidateRace = false;
        const raceRequest = {
          ...input.request,
          suggestion_id: "release-race",
          source_meta_job_id: "meta-release-race",
          target_candidate_version: input.request.target_candidate_version,
          suggested_action: "keep_candidate",
          reason: "concurrent evidence update",
          new_evidence_refs: ["artifact:release-race"],
          idempotency_key: `candidate_review:release-race:${input.candidate_id}`,
          trace_id: "trace-release-race",
          source_event: {
            ...input.request.source_event,
            event_id: `event-release-race:${input.candidate_id}`,
            idempotency_key: `event-release-race:${input.candidate_id}`,
          },
        };
        await durableStore.reviewCandidate({
          candidate_id: input.candidate_id,
          request: raceRequest,
          request_hash: canonicalHashV1(raceRequest),
          promotion_evidence: null,
          promotion_reservation: null,
          now: input.now,
        });
      }
      const committed = await durableStore.reviewCandidate(input);
      if (disconnectAfterReviewCommit) {
        disconnectAfterReviewCommit = false;
        throw new Error("review commit then disconnect");
      }
      return committed;
    },
  };
  const memory = allowedMemory();
  const successfulRelease = memory.release.bind(memory);
  const releasedByIdempotency = new Map();
  const releaseRequests = [];
  let queuedReleaseCommands;
  let disconnectAfterReleaseCommit = true;
  let releaseCalls = 0;
  let releaseEffects = 0;
  memory.release = async (request) => {
    releaseCalls += 1;
    if (releaseCalls === 2 && queuedReleaseCommands !== undefined) {
      queuedReleaseCommands[0].reservation_id =
        "reservation:mutated-after-queue";
      queuedReleaseCommands[0].request.reservation_id =
        "reservation:mutated-after-queue";
      queuedReleaseCommands[0].request.idempotency_key =
        "memory-release:mutated-after-queue";
    }
    releaseRequests.push(structuredClone(request));
    let response = releasedByIdempotency.get(request.idempotency_key);
    if (response === undefined) {
      response = await successfulRelease(request);
      releasedByIdempotency.set(request.idempotency_key, response);
      releaseEffects += 1;
    } else {
      response = { ...response, duplicate_replayed: true };
    }
    if (disconnectAfterReleaseCommit) {
      disconnectAfterReleaseCommit = false;
      throw new Error("Memory release commit then disconnect");
    }
    return response;
  };
  const app = createKnowThatApplicationV1(
    uncertainStore,
    memory,
    config,
  );
  const created = await app.writeBatch(
    batch("release-handoff", [
      item({
        client_item_id: "release-handoff",
        proposed_status: "candidate",
        direct_active_hint: false,
        source: "meta_inference",
        source_ref: "memory_point:point-release-1",
        evidence_refs: ["memory_point:point-release-1"],
        evidence_pending: true,
        evidence_pending_reason: "awaiting Memory evidence",
      }),
    ]),
  );
  const candidateId = created.item_results[0].fact_id;
  const result = await app.reviewCandidate(
    candidateId,
    review(candidateId, 1, {
      suggestion_id: "release-handoff",
      source_meta_job_id: "meta-release-handoff",
      new_evidence_refs: ["memory_point:point-release-2"],
    }),
    new AbortController().signal,
  );
  assert.equal(result.status, "stale_candidate_version");
  assert.equal(result.reason_code, "stale_candidate_version");
  const pending = durableStore.inspect().memory_commands.find(
    (command) =>
      command.command_type === "promotion_reservation_release",
  );
  assert.notEqual(pending, undefined);
  assert.equal(pending.status, "retry_wait");
  assert.deepEqual(pending.last_error, {
    failure_code: "promotion_release_unavailable",
    safe_summary: "Memory promotion reservation release is unavailable",
  });
  assert.equal("reservation_token" in pending, false);
  assert.equal("reservation_token" in pending.request, false);
  assert.match(
    pending.reservation_token_hash,
    /^sha256:[0-9a-f]{64}$/u,
  );
  assert.equal(releaseCalls, 1);
  assert.equal(releaseEffects, 1);

  const adversarialRestartStore = {
    ...durableStore,
    async pendingPromotionReleases(input) {
      queuedReleaseCommands = structuredClone(
        await durableStore.pendingPromotionReleases(input),
      );
      return queuedReleaseCommands;
    },
  };
  const restarted = createKnowThatApplicationV1(
    adversarialRestartStore,
    memory,
    config,
  );
  const reconciled = await restarted.reconcilePromotionReleases(
    new AbortController().signal,
    new Date(Date.now() + 60_000),
  );
  assert.deepEqual(reconciled, {
    attempted: 1,
    sent: 1,
    retry_wait: 0,
    failed: 0,
  });
  assert.equal(releaseCalls, 2);
  assert.equal(releaseEffects, 1);
  assert.equal(
    releaseRequests[1].reservation_id,
    releaseRequests[0].reservation_id,
  );
  assert.equal(
    releaseRequests[1].idempotency_key,
    releaseRequests[0].idempotency_key,
  );
  assert.equal(
    durableStore.inspect().memory_commands.find(
      (command) =>
        command.command_type === "promotion_reservation_release",
    ).status,
    "sent",
  );
  assert.equal(
    (await durableStore.readFact(scope, candidateId)).status,
    "candidate",
  );
});

test("candidate review writers declare atomic Memory ack and release handoffs", () => {
  const signature =
    KNOWTHAT_REPOSITORY_CONTRACT_V1.function_signatures.find(
      ({ function_name }) =>
        function_name === "record_knowthat_candidate_review_v1",
    );
  assert.notEqual(signature, undefined);
  assert.deepEqual(
    new Set(signature.writes_tables),
    new Set([
      "knowthat_facts",
      "knowthat_fact_revisions",
      "knowthat_candidate_reviews",
      "knowthat_linkage_checks",
      "knowthat_event_inbox",
      "knowthat_event_dlq",
      "knowthat_audit_logs",
      "knowthat_query_revisions",
      "knowthat_fact_query_versions",
      "knowthat_memory_command_outbox",
      "knowthat_event_outbox",
    ]),
  );
  assert.equal(
    signature.reads_tables.includes("knowthat_memory_command_outbox"),
    true,
  );
  assert.equal(
    signature.arguments.some(
      ({ argument_name }) =>
        argument_name === "p_promotion_reservation",
    ),
    true,
  );
  assert.equal(
    signature.arguments.some(
      ({ argument_name, nullable }) =>
        argument_name === "p_promotion_evidence" &&
        nullable === true,
    ),
    true,
  );
  assert.equal(
    signature.arguments.some(
      ({ argument_name, nullable }) =>
        argument_name === "p_memory_ack_command" &&
        nullable === true,
    ),
    true,
  );
  assert.equal(
    signature.arguments.some(
      ({ argument_name, nullable }) =>
        argument_name === "p_memory_release_command" &&
        nullable === true,
    ),
    true,
  );
  assert.equal(
    signature.arguments.some(
      ({ argument_name, nullable }) =>
        argument_name === "p_promotion_reservation" &&
        nullable === true,
    ),
    true,
  );
  const commandPermission =
    KNOWTHAT_REPOSITORY_CONTRACT_V1.table_permissions.find(
      ({ table_name }) =>
        table_name === "knowthat_memory_command_outbox",
    );
  assert.notEqual(commandPermission, undefined);
  for (const column of [
    "attempt_count",
    "claim_token",
    "locked_by",
    "locked_until",
    "reservation_expires_at",
    "release_reason",
    "released_at",
  ]) {
    assert.equal(
      commandPermission.select_columns.includes(column),
      true,
      `promotion command outbox is missing ${column}`,
    );
  }
  assert.equal(commandPermission.writer_kind, "outbox_claim_ack");
  const releaseWriter =
    KNOWTHAT_REPOSITORY_CONTRACT_V1.function_signatures.find(
      ({ function_name }) =>
        function_name === "enqueue_knowthat_promotion_release_v1",
    );
  assert.notEqual(releaseWriter, undefined);
  assert.deepEqual(releaseWriter.writes_tables, [
    "knowthat_memory_command_outbox",
  ]);
  assert.equal(
    releaseWriter.reads_tables.includes("knowthat_candidate_reviews"),
    true,
  );
  assert.equal(
    KNOWTHAT_REPOSITORY_CONTRACT_V1.foreign_keys.some(
      ({ constraint_name }) =>
        constraint_name ===
        "knowthat_memory_command_outbox_promotion_revision_id_fkey",
    ),
    true,
  );
  const reviewPermission =
    KNOWTHAT_REPOSITORY_CONTRACT_V1.table_permissions.find(
      ({ table_name }) => table_name === "knowthat_candidate_reviews",
    );
  const revisionPermission =
    KNOWTHAT_REPOSITORY_CONTRACT_V1.table_permissions.find(
      ({ table_name }) => table_name === "knowthat_fact_revisions",
    );
  for (const column of [
    "promotion_reservation_id",
    "promotion_fence_generation",
    "promotion_reservation_token_hash",
    "promotion_reservation_expires_at",
    "promotion_committed_at",
  ]) {
    assert.equal(
      reviewPermission.select_columns.includes(column),
      true,
      `candidate review is missing ${column}`,
    );
  }
  for (const column of [
    "promotion_reservation_id",
    "promotion_fence_generation",
    "promotion_reservation_token_hash",
    "promotion_committed_at",
  ]) {
    assert.equal(
      revisionPermission.select_columns.includes(column),
      true,
      `fact revision is missing ${column}`,
    );
  }
});

test("linkage and event workers enforce lease fencing, retry and recovery", async () => {
  const linkageSecret =
    "Bearer linkage-super-secret https://memory.invalid/?token=secret";
  const store = createInMemoryKnowThatStoreV1({
    ...DEFAULT_KNOWTHAT_CONFIG_V1,
    linkage_lease_ms: 1_000,
    outbox_lease_ms: 1_000,
    max_outbox_attempts: 2,
    retry_base_ms: 100,
  });
  const app = createKnowThatApplicationV1(
    store,
    allowedMemory(),
    {
      ...DEFAULT_KNOWTHAT_CONFIG_V1,
      linkage_lease_ms: 1_000,
      outbox_lease_ms: 1_000,
      max_outbox_attempts: 2,
      retry_base_ms: 100,
    },
  );
  await app.writeBatch(
    batch("workers", [item()]),
    new Date("2026-07-24T00:00:00.000Z"),
  );
  const [claim] = await store.claimLinkage({
    worker_id: "worker-1",
    limit: 1,
    now: new Date("2026-07-24T00:00:01.000Z"),
  });
  const retried = await store.settleLinkage({
    fence: claim.fence,
    outcome: "retry_wait",
    result: {},
    error: { code: "memory_unavailable", raw_message: linkageSecret },
    now: new Date("2026-07-24T00:00:01.100Z"),
  });
  assert.equal(retried.status, "retry_wait");
  assert.deepEqual(retried.last_error, {
    failure_code: "linkage_retry_required",
    safe_summary: "Memory linkage update requires retry",
  });
  assert.equal(JSON.stringify(store.inspect()).includes(linkageSecret), false);
  const recoverySemantic = {
    schema_version: "knowthat.linkage_recovery.v1",
    ...scope,
    linkage_job_id: retried.id,
    expected_job_version: retried.job_version,
    recovery_action: "replay",
    reason: "operator verified transient Memory outage",
    idempotency_key: `linkage-recovery:${retried.id}:1`,
  };
  const recovered = await app.recoverLinkage(retried.id, {
    ...recoverySemantic,
    request_hash: canonicalHashV1(recoverySemantic),
    trace_id: "trace-recovery",
  });
  assert.equal(recovered.linkage_job.status, "pending");
  await assert.rejects(
    store.settleLinkage({
      fence: claim.fence,
      outcome: "completed",
      result: {},
      error: null,
      now: new Date("2026-07-24T00:00:01.200Z"),
    }),
    (error) =>
      error instanceof KnowThatErrorV1 && error.code === "stale_lease",
  );

  const [eventClaim] = await store.claimEvents({
    worker_id: "dispatcher-1",
    limit: 1,
    now: new Date("2026-07-24T00:00:01.000Z"),
  });
  const event = eventClaim.event;
  assert.deepEqual(Object.keys(event).sort(), [
    "event_id",
    "event_type",
    "idempotency_key",
    "occurred_at",
    "payload",
    "producer",
    "schema_version",
    "trace_id",
  ]);
  const retryEvent = await store.ackEvent({
    event_id: event.event_id,
    claim_token: eventClaim.fence.claim_token,
    outcome: "retry_wait",
    now: new Date("2026-07-24T00:00:01.100Z"),
  });
  assert.equal(retryEvent.status, "retry_wait");
  const reclaimed = await store.claimEvents({
    worker_id: "dispatcher-2",
    limit: 1,
    now: new Date("2026-07-24T00:00:02.000Z"),
  });
  assert.equal(
    reclaimed.some((entry) => entry.event.event_id === event.event_id),
    true,
  );
  const reclaimedEvent = reclaimed.find(
    (entry) => entry.event.event_id === event.event_id,
  );
  const terminal = await store.ackEvent({
    event_id: reclaimedEvent.event.event_id,
    claim_token: reclaimedEvent.fence.claim_token,
    outcome: "retry_wait",
    now: new Date("2026-07-24T00:00:02.100Z"),
  });
  assert.equal(terminal.status, "failed");
  assert.equal(
    store.inspect().event_dead_letters.some(
      (entry) => entry.event_id === event.event_id,
    ),
    true,
  );
});
