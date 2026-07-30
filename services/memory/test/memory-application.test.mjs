import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  InMemoryMemoryStateRepositoryV1,
  MemoryApplicationErrorV1,
  MemoryApplicationV1,
  memoryCanonicalJsonV1,
  memoryTopicIdentityV1,
} from "../dist/memory-application.v1.js";

const scope = Object.freeze({
  workspace_id: "workspace_1",
  bot_id: "bot_1",
  owner_agent_id: "agent_1",
  deployment_environment: "dev",
  release_channel: "stable",
});

const writer = Object.freeze({
  caller: "meta_cognition",
  capabilities: Object.freeze(["memory.write"]),
  scope,
});

const reader = Object.freeze({
  caller: "trigger_processor",
  capabilities: Object.freeze(["memory.read"]),
  scope,
});

const promoter = Object.freeze({
  caller: "knowthat",
  capabilities: Object.freeze([
    "memory.pre_promotion_check",
    "memory.promotion_reservation.ack",
    "memory.promotion_reservation.release",
  ]),
  scope,
});

test("canonical JSON is bounded, side-effect free, and permits non-cyclic aliases", () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "secret";
    },
  });
  assert.throws(() => memoryCanonicalJsonV1(accessor), /accessor_property/u);
  assert.equal(getterCalls, 0);

  const hidden = {};
  Object.defineProperty(hidden, "value", {
    enumerable: false,
    value: "hidden",
  });
  assert.throws(() => memoryCanonicalJsonV1(hidden), /hidden_property/u);

  const sparse = new Array(2);
  sparse[1] = "present";
  assert.throws(() => memoryCanonicalJsonV1(sparse), /sparse_array/u);
  assert.throws(
    () => memoryCanonicalJsonV1(new Proxy({ value: "proxied" }, {})),
    /proxy_object/u,
  );

  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => memoryCanonicalJsonV1(cyclic), /cycle/u);

  const deep = {};
  let cursor = deep;
  for (let depth = 0; depth < 66; depth += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.throws(() => memoryCanonicalJsonV1(deep), /max_depth_exceeded/u);

  const shared = { value: "same" };
  assert.equal(
    memoryCanonicalJsonV1({ left: shared, right: shared }),
    '{"left":{"value":"same"},"right":{"value":"same"}}',
  );
});

const worker = Object.freeze({
  caller: "memory",
  capabilities: Object.freeze([
    "memory.integration.run",
    "memory.integration.operator",
  ]),
  scope,
});

function vector(seed = 0) {
  const result = Array.from({ length: 2_048 }, () => 0);
  result[Math.abs(seed) % result.length] = 1;
  return result;
}

function promotionTokenHash(token) {
  return `sha256:${createHash("sha256")
    .update(token, "utf8")
    .digest("hex")}`;
}

class EmbeddingStub {
  constructor(output) {
    this.output = output;
    this.calls = [];
  }

  async checkReadiness() {}

  async embed(inputs) {
    this.calls.push([...inputs]);
    if (this.output !== undefined) {
      return this.output(inputs);
    }
    return inputs.map(() => vector(0));
  }
}

class CommitDisconnectMemoryRepository
  extends InMemoryMemoryStateRepositoryV1 {
  disconnectNextBatchCommit = true;

  async transact(operation) {
    let committedBatch = false;
    const result = await super.transact(async (state) => {
      const before = state.batches.size;
      const value = await operation(state);
      committedBatch = state.batches.size > before;
      return value;
    });
    if (this.disconnectNextBatchCommit && committedBatch) {
      this.disconnectNextBatchCommit = false;
      throw new Error("simulated batch commit-then-disconnect");
    }
    return result;
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class BlockingMemoryRepository extends InMemoryMemoryStateRepositoryV1 {
  nextGate;

  blockNextTransaction() {
    assert.equal(this.nextGate, undefined);
    const entered = deferred();
    const release = deferred();
    this.nextGate = { entered, release };
    return this.nextGate;
  }

  async transact(operation) {
    const gate = this.nextGate;
    if (gate !== undefined) {
      this.nextGate = undefined;
      gate.entered.resolve();
      await gate.release.promise;
    }
    return super.transact(operation);
  }
}

function harness(embedding = new EmbeddingStub()) {
  const repository = new InMemoryMemoryStateRepositoryV1();
  return {
    application: new MemoryApplicationV1(repository, embedding, {
      integration_lease_seconds: 30,
    }),
    embedding,
    repository,
  };
}

function mutableWorker() {
  return {
    caller: "memory",
    capabilities: [
      "memory.integration.run",
      "memory.integration.operator",
    ],
    scope: { ...scope },
  };
}

function item(id, overrides = {}) {
  return {
    client_item_id: id,
    source_item_id: `source_${id}`,
    content_summary: `memory ${id}`,
    subject_refs: [
      {
        subject_type: "user",
        canonical_id: `user_${id}`,
        primary: true,
      },
    ],
    aspect_hint: `aspect_${id}`,
    human_agent_relation: [],
    keyword_tags: ["alpha"],
    scene_tags: ["implementation"],
    emotion_tags: ["neutral"],
    source_info: {
      source_type: "trigger_snapshot",
      source_ref: `trigger_process:process_${id}`,
      actor_type: "user",
      actor_id: `user_${id}`,
    },
    confidence_score: 0.8,
    occurred_at: "2026-07-23T00:00:00.000Z",
    ...overrides,
  };
}

function batch(key, items, overrides = {}) {
  return {
    schema_version: "memory.write_batch.v1",
    bot_id: scope.bot_id,
    trigger_process_id: "process_1",
    source_meta_job_id: "meta_job_1",
    idempotency_key: key,
    items,
    ...overrides,
  };
}

function recall(overrides = {}) {
  return {
    schema_version: "memory.fast_recall.v1",
    bot_id: scope.bot_id,
    query: "alpha beta",
    query_purpose: "context_injection",
    ...overrides,
  };
}

test("write batch is idempotent and the item decision ledger prevents repeated effects", async () => {
  const { application, embedding, repository } = harness();
  const request = batch("batch_1", [item("1")]);
  const first = await application.writeBatch(writer, request, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
    now: new Date("2026-07-23T01:00:00.000Z"),
  });
  const replay = await application.writeBatch(writer, request, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
    now: new Date("2026-07-23T02:00:00.000Z"),
  });
  assert.equal(first.item_results[0].decision, "new_series");
  assert.equal(replay.duplicate_replayed, true);
  assert.equal(replay.write_batch_id, first.write_batch_id);
  assert.equal(embedding.calls.length, 1);
  const state = await repository.transact((current) => ({
    decisions: current.decisions.size,
    points: current.points.size,
    projections: current.projections.size,
    outbox: current.outbox.map((event) => event.event_type),
  }));
  assert.deepEqual(state, {
    decisions: 1,
    points: 1,
    projections: 1,
    outbox: ["memory.series.created", "memory.point.created"],
  });

  await assert.rejects(
    application.writeBatch(
      writer,
      batch("batch_1", [item("1", { content_summary: "drift" })]),
      { raw_body_bytes: 1_000 },
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "idempotency_conflict",
  );
});

test("mixed item validation commits succeeded and deterministic rejected decisions atomically", async () => {
  const { application, embedding, repository } = harness();
  const request = batch("mixed_partial", [
    item("valid"),
    item("invalid", { occurred_at: "2026-02-30T00:00:00.000Z" }),
  ]);
  const first = await application.writeBatch(writer, request, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
    now: new Date("2026-07-23T01:00:00.000Z"),
  });
  assert.equal(first.batch_status, "partial_failed");
  assert.equal(first.item_results[0].status, "succeeded");
  assert.deepEqual(first.item_results[1], {
    client_item_id: "invalid",
    status: "rejected",
    code: "schema_validation_failed",
    message: "memory write item was rejected",
    field_path: "/items/1/occurred_at",
  });
  assert.deepEqual(first.rejected_items, [first.item_results[1]]);
  assert.deepEqual(embedding.calls, [["memory valid"]]);
  assert.deepEqual(
    await repository.transact((state) => ({
      batches: state.batches.size,
      decisions: [...state.decisions.values()].map(
        (decision) => decision.decision,
      ),
      points: state.points.size,
      outbox: state.outbox.length,
    })),
    {
      batches: 1,
      decisions: ["rejected", "new_series"],
      points: 1,
      outbox: 2,
    },
  );

  const reordered = await application.writeBatch(
    writer,
    batch("mixed_partial", [request.items[1], request.items[0]]),
    {
      raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
      now: new Date("2026-07-23T01:00:01.000Z"),
    },
  );
  assert.equal(reordered.duplicate_replayed, true);
  assert.deepEqual(
    reordered.item_results,
    first.item_results,
  );
  assert.equal(embedding.calls.length, 1);

  await assert.rejects(
    application.writeBatch(
      writer,
      batch("mixed_partial", [
        item("valid"),
        item("invalid", { occurred_at: "not-a-date" }),
      ]),
      { raw_body_bytes: 2_000 },
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "idempotency_conflict",
  );
});

test("synthetic rejected identities cannot collide with caller item identities", async () => {
  const { application, embedding, repository } = harness();
  const invalid = item("missing_identity", {
    occurred_at: "not-a-date",
  });
  delete invalid.client_item_id;
  const invalidHash = createHash("sha256")
    .update(memoryCanonicalJsonV1(invalid), "utf8")
    .digest("hex");
  const callerIdentity = `invalid_item_1_${invalidHash.slice(0, 16)}`;
  const request = batch("synthetic_identity_collision", [
    invalid,
    item(callerIdentity),
  ]);
  const response = await application.writeBatch(writer, request, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
    now: new Date("2026-07-23T01:00:00.000Z"),
  });
  assert.equal(response.batch_status, "partial_failed");
  assert.equal(
    response.item_results[0].client_item_id,
    `${callerIdentity}_1`,
  );
  assert.equal(response.item_results[0].status, "rejected");
  assert.equal(response.item_results[1].client_item_id, callerIdentity);
  assert.equal(response.item_results[1].status, "succeeded");
  assert.deepEqual(embedding.calls, [[`memory ${callerIdentity}`]]);
  assert.equal(
    await repository.transact((state) => state.decisions.size),
    2,
  );
});

test("all-invalid batches skip embedding and persist only rejected decisions", async () => {
  const { application, embedding, repository } = harness();
  const request = batch("all_rejected", [
    item("bad_date", { occurred_at: "not-a-date" }),
    item("bad_confidence", { confidence_score: 2 }),
  ]);
  const response = await application.writeBatch(writer, request, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
    now: new Date("2026-07-23T01:00:00.000Z"),
  });
  assert.equal(response.batch_status, "partial_failed");
  assert.equal(response.item_results.length, 2);
  assert.ok(
    response.item_results.every((result) => result.status === "rejected"),
  );
  assert.equal(response.rejected_items.length, 2);
  assert.deepEqual(response.accepted_point_ids, []);
  assert.equal(embedding.calls.length, 0);
  assert.deepEqual(
    await repository.transact((state) => ({
      batches: state.batches.size,
      decisions: [...state.decisions.values()].map(
        (decision) => decision.decision,
      ),
      series: state.series.size,
      points: state.points.size,
      outbox: state.outbox.length,
    })),
    {
      batches: 1,
      decisions: ["rejected", "rejected"],
      series: 0,
      points: 0,
      outbox: 0,
    },
  );
});

test("batch commit-then-disconnect replays mixed results without duplicate effects", async () => {
  const repository = new CommitDisconnectMemoryRepository();
  const embedding = new EmbeddingStub();
  const application = new MemoryApplicationV1(repository, embedding);
  const request = batch("mixed_disconnect", [
    item("valid_disconnect"),
    item("invalid_disconnect", { confidence_score: -1 }),
  ]);
  await assert.rejects(
    application.writeBatch(writer, request, {
      raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
      now: new Date("2026-07-23T01:00:00.000Z"),
    }),
    /commit-then-disconnect/u,
  );
  const replay = await application.writeBatch(writer, request, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
    now: new Date("2026-07-23T01:00:01.000Z"),
  });
  assert.equal(replay.duplicate_replayed, true);
  assert.equal(replay.batch_status, "partial_failed");
  assert.equal(embedding.calls.length, 1);
  assert.deepEqual(
    await repository.transact((state) => ({
      batches: state.batches.size,
      decisions: state.decisions.size,
      points: state.points.size,
      outbox: state.outbox.length,
      reservations: state.batchReservations.size,
    })),
    {
      batches: 1,
      decisions: 2,
      points: 1,
      outbox: 2,
      reservations: 0,
    },
  );
});

test("deferred write embedding shares one in-flight identity without blocking integration lease progress", async () => {
  const entered = deferred();
  const release = deferred();
  const embedding = new EmbeddingStub(async (inputs) => {
    entered.resolve();
    await release.promise;
    return inputs.map(() => vector(0));
  });
  const { application, repository } = harness(embedding);
  const integrationRequest = {
    schema_version: "memory.integration_run.v1",
    bot_id: scope.bot_id,
    scope: {},
    mode: "full",
    dry_run: true,
    idempotency_key: "integration during embedding",
    expected_policy_version: "memory.integration_policy.v1",
  };
  const integration = await application.createIntegrationJob(
    worker,
    integrationRequest,
    new Date("2026-07-23T00:00:00.000Z"),
  );
  const lease = await application.claimIntegrationJob(worker, {
    bot_id: scope.bot_id,
    integration_job_id: integration.integration_job_id,
    owner_id: "integration-worker",
    now: "2026-07-23T00:00:00.000Z",
  });
  const request = batch("shared_inflight", [item("shared")]);
  const options = {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
    now: new Date("2026-07-23T00:00:01.000Z"),
  };
  const first = application.writeBatch(writer, request, options);
  await entered.promise;
  const replay = application.writeBatch(writer, request, options);
  assert.equal(embedding.calls.length, 1);

  const checkpoint = await Promise.race([
    application.checkpointIntegrationJob(worker, {
      bot_id: scope.bot_id,
      integration_job_id: integration.integration_job_id,
      lease_id: lease.lease_id,
      lease_generation: lease.lease_generation,
      checkpoint_ref: "embedding-independent-checkpoint",
      applied_counts: { scanned: 1 },
      now: "2026-07-23T00:00:02.000Z",
    }),
    new Promise((_, rejectPromise) => {
      setTimeout(
        () => rejectPromise(new Error("integration checkpoint was lock-starved")),
        250,
      );
    }),
  ]);
  assert.equal(checkpoint.checkpoint_ref, "embedding-independent-checkpoint");

  release.resolve();
  const [created, duplicate] = await Promise.all([first, replay]);
  assert.equal(created.duplicate_replayed, false);
  assert.equal(duplicate.duplicate_replayed, true);
  assert.equal(duplicate.write_batch_id, created.write_batch_id);
  assert.equal(embedding.calls.length, 1);
  assert.deepEqual(
    await repository.transact((state) => ({
      batches: state.batches.size,
      reservations: state.batchReservations.size,
      decisions: state.decisions.size,
      outbox: state.outbox.length,
    })),
    { batches: 1, reservations: 0, decisions: 1, outbox: 2 },
  );
});

test("write reservation CAS rejects revision drift without partial canonical effects", async () => {
  const entered = deferred();
  const release = deferred();
  const embedding = new EmbeddingStub(async (inputs) => {
    if (inputs.some((input) => input.includes("slow"))) {
      entered.resolve();
      await release.promise;
    }
    return inputs.map(() => vector(0));
  });
  const { application, repository } = harness(embedding);
  const slowRequest = batch("slow_cas", [
    item("slow", { content_summary: "slow embedding" }),
  ]);
  const slowOutcome = application
    .writeBatch(writer, slowRequest, {
      raw_body_bytes: Buffer.byteLength(JSON.stringify(slowRequest)),
      now: new Date("2026-07-23T01:00:00.000Z"),
    })
    .then(
      (response) => response,
      (error) => error,
    );
  await entered.promise;

  const fastRequest = batch("fast_cas", [
    item("fast", { content_summary: "fast embedding" }),
  ]);
  await application.writeBatch(writer, fastRequest, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(fastRequest)),
    now: new Date("2026-07-23T01:00:01.000Z"),
  });
  release.resolve();
  const rejected = await slowOutcome;
  assert.ok(rejected instanceof MemoryApplicationErrorV1);
  assert.equal(rejected.code, "lease_conflict");
  assert.equal(rejected.retryable, true);

  assert.deepEqual(
    await repository.transact((state) => ({
      batches: state.batches.size,
      reservations: state.batchReservations.size,
      contents: [...state.points.values()].map(
        (point) => point.content_summary,
      ),
      outbox: state.outbox.length,
    })),
    {
      batches: 1,
      reservations: 0,
      contents: ["fast embedding"],
      outbox: 2,
    },
  );
});

test("counter exhaustion rolls back the complete Memory owner transaction", async () => {
  const { application, repository } = harness();
  await repository.transact((state) => {
    state.queryRevision = Number.MAX_SAFE_INTEGER;
  });
  const request = batch("counter_exhaustion", [
    item("counter"),
    item("counter_rejected", { confidence_score: 2 }),
  ]);

  await assert.rejects(
    application.writeBatch(writer, request, {
      raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
      now: new Date("2026-07-23T01:00:00.000Z"),
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "dependency_unavailable" &&
      error.retryable === false,
  );

  const state = await repository.transact((current) => ({
    queryRevision: current.queryRevision,
    batches: current.batches.size,
    reservations: current.batchReservations.size,
    decisions: current.decisions.size,
    series: current.series.size,
    points: current.points.size,
    outbox: current.outbox.length,
  }));
  assert.deepEqual(state, {
    queryRevision: Number.MAX_SAFE_INTEGER,
    batches: 0,
    reservations: 0,
    decisions: 0,
    series: 0,
    points: 0,
    outbox: 0,
  });
});

test("source_item_id replays exact content, rejects drift, and same-instant contradictions become conflict_review", async () => {
  const { application, repository } = harness();
  const original = item("stable");
  const first = await application.writeBatch(
    writer,
    batch("source_batch_1", [original]),
    { raw_body_bytes: 1_000 },
  );
  const duplicate = await application.writeBatch(
    writer,
    batch("source_batch_2", [
      {
        ...original,
        client_item_id: "stable_retry",
      },
    ]),
    { raw_body_bytes: 1_000 },
  );
  assert.equal(duplicate.item_results[0].decision, "merge_existing");
  assert.equal(
    duplicate.item_results[0].memory_point_id,
    first.item_results[0].memory_point_id,
  );

  await assert.rejects(
    application.writeBatch(
      writer,
      batch("source_batch_3", [
        {
          ...original,
          client_item_id: "stable_drift",
          content_summary: "different payload for the same source item",
        },
      ]),
      { raw_body_bytes: 1_000 },
    ),
    (error) => error.code === "idempotency_conflict",
  );

  const conflict = await application.writeBatch(
    writer,
    batch("source_batch_4", [
      {
        ...original,
        source_item_id: "stable_distinct_contradictory_source",
        client_item_id: "stable_conflict",
        content_summary: "different payload from a distinct source at the same instant",
      },
    ]),
    { raw_body_bytes: 1_000 },
  );
  assert.equal(conflict.item_results[0].decision, "conflict_review");
  assert.equal(conflict.item_results[0].memory_point_id, undefined);
  assert.equal(conflict.conflict_ids.length, 1);
  assert.deepEqual(conflict.conflict_ids, conflict.item_results[0].conflict_ids);
  const facts = await repository.transact((state) => ({
    points: state.points.size,
    series: [...state.series.values()].map(({ id, status }) => ({
      id,
      status,
    })),
    conflicts: state.conflicts.size,
    conflict: [...state.conflicts.values()][0],
    decision: [...state.decisions.values()].find(
      (decision) => decision.client_item_id === "stable_conflict",
    ),
    events: state.outbox.map((event) => ({
      type: event.event_type,
      fields: Object.keys(event).length,
    })),
  }));
  assert.equal(facts.points, 2);
  assert.equal(facts.series.length, 2);
  assert.deepEqual(
    facts.series.map((series) => series.status).sort(),
    ["active", "pending_conflict"],
  );
  assert.equal(facts.conflicts, 1);
  assert.equal(facts.decision.conflict_id, facts.conflict.id);
  assert.notEqual(
    facts.conflict.old_series_id,
    facts.conflict.new_series_id,
  );
  assert.notEqual(
    facts.conflict.left_memory_point_id,
    facts.conflict.right_memory_point_id,
  );
  assert.equal(
    facts.events.some((event) => event.type === "memory.conflict.detected"),
    true,
  );
  assert.equal(facts.events.every((event) => event.fields === 8), true);
});

test("promotion reservation fences point and series mutations until ack, release, or expiry", async () => {
  const { application, repository } = harness();
  const baseTime = new Date("2026-07-24T10:00:00.000Z");
  const created = await application.writeBatch(
    writer,
    batch("promotion_source", [item("promotion")]),
    { raw_body_bytes: 1_000, now: baseTime },
  );
  const pointId = created.item_results[0].memory_point_id;
  const check = await application.checkPrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_check.v1",
      bot_id: scope.bot_id,
      candidate_fact_id: "candidate_promotion",
      memory_point_ids: [pointId],
      required_checks: [
        "point_exists",
        "state_allowed",
        "no_unresolved_conflict",
        "not_expired",
        "provenance_integrity",
      ],
      idempotency_key: "promotion_check",
      trace_id: "trace_promotion",
    },
    new Date(baseTime.getTime() + 1_000),
  );
  assert.equal(check.overall_result, "passed");
  const storedCheckMaterial = await repository.transact((state) =>
    JSON.stringify([...state.promotionChecksByIdempotency.values()]),
  );
  assert.equal(storedCheckMaterial.includes(check.check_token), false);
  assert.equal(
    storedCheckMaterial.includes(promotionTokenHash(check.check_token)),
    true,
  );
  const point = check.points[0];
  assert.equal(point.exists, true);
  const validationRequest = {
    schema_version: "memory.pre_promotion_validate.v1",
    bot_id: scope.bot_id,
    check_token: check.check_token,
    check_id: check.check_id,
    check_generation: check.check_generation,
    candidate_fact_id: check.candidate_fact_id,
    expected_point_versions: [
      {
        memory_point_id: point.memory_point_id,
        state_version: point.state_version,
        state_hash: point.state_hash,
      },
    ],
    expected_conflict_versions: [],
    idempotency_key: "promotion_reserve",
  };
  const reservation = await application.validatePrePromotion(
    promoter,
    validationRequest,
    new Date(baseTime.getTime() + 2_000),
  );
  assert.throws(() => {
    reservation.reserved_points[0].state_version = 999;
  }, TypeError);
  assert.throws(() => {
    reservation.reserved_points.push({
      memory_point_id: "mutated_after_return",
      state_version: 999,
      state_hash: `sha256:${"9".repeat(64)}`,
    });
  }, TypeError);
  assert.equal(
    Date.parse(reservation.expires_at) -
      Date.parse(reservation.reserved_at),
    5_000,
  );
  const reservationReplay = await application.validatePrePromotion(
    promoter,
    structuredClone(validationRequest),
    new Date(baseTime.getTime() + 2_500),
  );
  assert.deepEqual(reservationReplay, reservation);
  const replayState = await repository.transact((current) => ({
    reservation_count: current.promotionReservations.size,
    candidate_generation: [
      ...current.promotionGenerationByCandidate.values(),
    ],
  }));
  assert.deepEqual(replayState, {
    reservation_count: 1,
    candidate_generation: [1],
  });

  const mutation = batch("promotion_mutation", [
    item("promotion", {
      client_item_id: "promotion_mutation",
      source_item_id: "source_promotion_mutation",
      content_summary: "memory promotion changed",
      occurred_at: "2026-07-23T00:00:01.000Z",
    }),
  ]);
  await assert.rejects(
    application.writeBatch(writer, mutation, {
      raw_body_bytes: 1_000,
      now: new Date(baseTime.getTime() + 3_000),
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "promotion_reserved" &&
      error.retryable &&
      error.details?.retry_after === reservation.expires_at,
  );

  const ackRequest = {
    schema_version: "memory.promotion_reservation_ack.v1",
    bot_id: scope.bot_id,
    reservation_id: reservation.reservation_id,
    candidate_fact_id: reservation.candidate_fact_id,
    fencing_generation: reservation.fencing_generation,
    reservation_token_hash: promotionTokenHash(
      reservation.reservation_token,
    ),
    promotion_revision_id: "knowthat_revision_1",
    committed_at: new Date(baseTime.getTime() + 3_000).toISOString(),
    idempotency_key: "promotion_ack",
    trace_id: "trace_promotion",
  };
  await assert.rejects(
    application.ackPromotionReservation(promoter, {
      ...ackRequest,
      reservation_token_hash: `sha256:${"0".repeat(64)}`,
      idempotency_key: "promotion_ack_wrong_hash",
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "promotion_stale_fence",
  );
  const ack = await application.ackPromotionReservation(
    promoter,
    ackRequest,
  );
  assert.equal(ack.status, "committed");
  assert.equal(
    (
      await application.ackPromotionReservation(promoter, ackRequest)
    ).duplicate_replayed,
    true,
  );
  await assert.rejects(
    application.ackPromotionReservation(promoter, {
      ...ackRequest,
      fencing_generation: reservation.fencing_generation + 1,
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "promotion_stale_fence",
  );
  const mutated = await application.writeBatch(writer, mutation, {
    raw_body_bytes: 1_000,
    now: new Date(baseTime.getTime() + 4_000),
  });
  assert.equal(mutated.item_results[0].decision, "append_version");

  const state = await repository.transact((current) => ({
    reservation_status:
      current.promotionReservations.get(reservation.reservation_id)
        ?.status,
    active_targets: current.activePromotionReservationByTarget.size,
  }));
  assert.deepEqual(state, {
    reservation_status: "acked",
    active_targets: 0,
  });
});

test("promotion idempotency ignores trace-only drift but rejects semantic drift", async () => {
  const { application } = harness();
  const baseTime = new Date("2026-07-24T10:05:00.000Z");
  const created = await application.writeBatch(
    writer,
    batch("promotion_trace_source", [item("promotion_trace")]),
    { raw_body_bytes: 1_000, now: baseTime },
  );
  const pointId = created.item_results[0].memory_point_id;
  const checkRequest = {
    schema_version: "memory.pre_promotion_check.v1",
    bot_id: scope.bot_id,
    candidate_fact_id: "candidate_promotion_trace",
    memory_point_ids: [pointId],
    required_checks: [
      "point_exists",
      "state_allowed",
      "no_unresolved_conflict",
      "not_expired",
      "provenance_integrity",
    ],
    idempotency_key: "promotion_trace_check",
    trace_id: "trace-promotion-a",
  };
  const check = await application.checkPrePromotion(
    promoter,
    checkRequest,
    new Date(baseTime.getTime() + 1_000),
  );
  const replay = await application.checkPrePromotion(
    promoter,
    { ...checkRequest, trace_id: "trace-promotion-b" },
    new Date(baseTime.getTime() + 1_500),
  );
  assert.equal(replay.duplicate_replayed, true);
  assert.equal(replay.check_id, check.check_id);
  assert.equal(replay.check_token, check.check_token);

  const point = check.points[0];
  assert.equal(point.exists, true);
  const validation = await application.validatePrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_validate.v1",
      bot_id: scope.bot_id,
      check_token: check.check_token,
      check_id: check.check_id,
      check_generation: check.check_generation,
      candidate_fact_id: check.candidate_fact_id,
      expected_point_versions: [
        {
          memory_point_id: point.memory_point_id,
          state_version: point.state_version,
          state_hash: point.state_hash,
        },
      ],
      expected_conflict_versions: [],
      idempotency_key: "promotion_trace_reserve",
    },
    new Date(baseTime.getTime() + 2_000),
  );
  const ackRequest = {
    schema_version: "memory.promotion_reservation_ack.v1",
    bot_id: scope.bot_id,
    reservation_id: validation.reservation_id,
    candidate_fact_id: validation.candidate_fact_id,
    fencing_generation: validation.fencing_generation,
    reservation_token_hash: promotionTokenHash(
      validation.reservation_token,
    ),
    promotion_revision_id: "knowthat_revision_trace",
    committed_at: new Date(baseTime.getTime() + 2_500).toISOString(),
    idempotency_key: "promotion_trace_ack",
    trace_id: "trace-promotion-a",
  };
  const ack = await application.ackPromotionReservation(
    promoter,
    ackRequest,
  );
  const ackReplay = await application.ackPromotionReservation(promoter, {
    ...ackRequest,
    trace_id: "trace-promotion-b",
  });
  assert.equal(ack.status, "committed");
  assert.equal(ackReplay.duplicate_replayed, true);
  await assert.rejects(
    application.ackPromotionReservation(promoter, {
      ...ackRequest,
      promotion_revision_id: "knowthat_revision_drift",
      trace_id: "trace-promotion-c",
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "idempotency_conflict",
  );
});

test("promotion and integration clocks are intrinsic snapshots before queued transactions", async () => {
  const repository = new BlockingMemoryRepository();
  const application = new MemoryApplicationV1(
    repository,
    new EmbeddingStub(),
    { integration_lease_seconds: 30 },
  );
  const baseTime = new Date("2026-07-24T10:00:00.000Z");
  const created = await application.writeBatch(
    writer,
    batch("clock_snapshot_source", [item("clock_snapshot")]),
    { raw_body_bytes: 1_000, now: baseTime },
  );
  const pointId = created.item_results[0].memory_point_id;
  const checkRequest = {
    schema_version: "memory.pre_promotion_check.v1",
    bot_id: scope.bot_id,
    candidate_fact_id: "candidate_clock_snapshot",
    memory_point_ids: [pointId],
    required_checks: [
      "point_exists",
      "state_allowed",
      "no_unresolved_conflict",
      "not_expired",
      "provenance_integrity",
    ],
    idempotency_key: "clock_snapshot_check",
    trace_id: "trace_clock_snapshot",
  };
  const checkNow = new Date(baseTime.getTime() + 1_000);
  const checkGate = repository.blockNextTransaction();
  const checkPromise = application.checkPrePromotion(
    promoter,
    checkRequest,
    checkNow,
  );
  await checkGate.entered.promise;
  checkNow.setUTCFullYear(2099);
  checkGate.release.resolve();
  const check = await checkPromise;
  assert.equal(
    check.checked_at,
    "2026-07-24T10:00:01.000Z",
  );

  const checkedPoint = check.points[0];
  const validateNow = new Date(baseTime.getTime() + 2_000);
  const validateGate = repository.blockNextTransaction();
  const reservationPromise = application.validatePrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_validate.v1",
      bot_id: scope.bot_id,
      check_token: check.check_token,
      check_id: check.check_id,
      check_generation: check.check_generation,
      candidate_fact_id: check.candidate_fact_id,
      expected_point_versions: [
        {
          memory_point_id: checkedPoint.memory_point_id,
          state_version: checkedPoint.state_version,
          state_hash: checkedPoint.state_hash,
        },
      ],
      expected_conflict_versions: [],
      idempotency_key: "clock_snapshot_reservation",
    },
    validateNow,
  );
  await validateGate.entered.promise;
  validateNow.setUTCFullYear(2099);
  validateGate.release.resolve();
  const reservation = await reservationPromise;
  assert.equal(
    reservation.reserved_at,
    "2026-07-24T10:00:02.000Z",
  );

  const integrationNow = new Date("2026-07-24T11:00:00.000Z");
  const integrationGate = repository.blockNextTransaction();
  const integrationPromise = application.createIntegrationJob(
    worker,
    {
      schema_version: "memory.integration_run.v1",
      bot_id: scope.bot_id,
      scope: {},
      mode: "full",
      dry_run: true,
      idempotency_key: "integration clock snapshot",
      expected_policy_version: "memory.integration_policy.v1",
    },
    integrationNow,
  );
  await integrationGate.entered.promise;
  integrationNow.setUTCFullYear(2099);
  integrationGate.release.resolve();
  const integration = await integrationPromise;
  const integrationJob = await application.getIntegrationJob(
    worker,
    scope.bot_id,
    integration.integration_job_id,
  );
  assert.equal(
    integrationJob.created_at,
    "2026-07-24T11:00:00.000Z",
  );

  await assert.rejects(
    application.createIntegrationJob(
      worker,
      {
        schema_version: "memory.integration_run.v1",
        bot_id: scope.bot_id,
        scope: {},
        mode: "full",
        dry_run: true,
        idempotency_key: "integration proxy clock",
        expected_policy_version: "memory.integration_policy.v1",
      },
      new Proxy(new Date(), {}),
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "invalid_request",
  );
  let getterCalls = 0;
  const accessorClock = {};
  Object.defineProperty(accessorClock, "getTime", {
    get() {
      getterCalls += 1;
      return () => baseTime.getTime();
    },
  });
  await assert.rejects(
    application.checkPrePromotion(
      promoter,
      {
        ...checkRequest,
        idempotency_key: "accessor clock check",
      },
      accessorClock,
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "invalid_request",
  );
  assert.equal(getterCalls, 0);
});

test("expired pre-promotion checks rotate under the same idempotency identity", async () => {
  const { application } = harness();
  const baseTime = new Date("2026-07-24T10:30:00.000Z");
  const created = await application.writeBatch(
    writer,
    batch("promotion_recheck_source", [item("promotion_recheck")]),
    { raw_body_bytes: 1_000, now: baseTime },
  );
  const request = {
    schema_version: "memory.pre_promotion_check.v1",
    bot_id: scope.bot_id,
    candidate_fact_id: "candidate_promotion_recheck",
    memory_point_ids: [created.item_results[0].memory_point_id],
    idempotency_key: "promotion_recheck",
    trace_id: "trace_promotion_recheck",
  };

  const first = await application.checkPrePromotion(
    promoter,
    request,
    new Date(baseTime.getTime() + 1_000),
  );
  const replay = await application.checkPrePromotion(
    promoter,
    request,
    new Date(baseTime.getTime() + 2_000),
  );
  assert.equal(replay.duplicate_replayed, true);
  assert.equal(replay.check_id, first.check_id);
  assert.equal(replay.check_generation, first.check_generation);
  assert.equal(replay.check_token, first.check_token);

  const [rotated, convergedReplay] = await Promise.all([
    application.checkPrePromotion(
      promoter,
      request,
      new Date(baseTime.getTime() + 31_001),
    ),
    application.checkPrePromotion(
      promoter,
      request,
      new Date(baseTime.getTime() + 31_001),
    ),
  ]);
  assert.equal(rotated.duplicate_replayed, false);
  assert.notEqual(rotated.check_id, first.check_id);
  assert.equal(rotated.check_generation, first.check_generation + 1);
  assert.notEqual(rotated.check_token, first.check_token);
  assert.equal(convergedReplay.duplicate_replayed, true);
  assert.equal(convergedReplay.check_id, rotated.check_id);
  assert.equal(
    convergedReplay.check_generation,
    rotated.check_generation,
  );
  assert.equal(
    Date.parse(rotated.expires_at) - Date.parse(rotated.checked_at),
    30_000,
  );
  const firstPoint = first.points[0];
  await assert.rejects(
    application.validatePrePromotion(
      promoter,
      {
        schema_version: "memory.pre_promotion_validate.v1",
        bot_id: scope.bot_id,
        check_token: first.check_token,
        check_id: first.check_id,
        check_generation: first.check_generation,
        candidate_fact_id: first.candidate_fact_id,
        expected_point_versions: [
          {
            memory_point_id: firstPoint.memory_point_id,
            state_version: firstPoint.state_version,
            state_hash: firstPoint.state_hash,
          },
        ],
        expected_conflict_versions: [],
        idempotency_key: "promotion_recheck_old_generation",
      },
      new Date(baseTime.getTime() + 31_002),
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "stale_memory_check",
  );

  await assert.rejects(
    application.checkPrePromotion(
      promoter,
      {
        ...request,
        candidate_fact_id: "candidate_promotion_recheck_drift",
      },
      new Date(baseTime.getTime() + 32_000),
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "idempotency_conflict",
  );
});

test("evidence expiry is projected, blocks at the boundary, and is rechecked before reservation", async () => {
  const { application, repository } = harness();
  const baseTime = new Date("2026-07-24T10:45:00.000Z");
  const evidenceValidUntil = new Date(
    baseTime.getTime() + 2_500,
  ).toISOString();
  const created = await application.writeBatch(
    writer,
    batch("evidence_expiry_source", [
      item("evidence_expiry", {
        evidence_valid_until: evidenceValidUntil,
      }),
    ]),
    { raw_body_bytes: 1_000, now: baseTime },
  );
  const pointId = created.item_results[0].memory_point_id;
  const checkRequest = {
    schema_version: "memory.pre_promotion_check.v1",
    bot_id: scope.bot_id,
    candidate_fact_id: "candidate_evidence_expiry",
    memory_point_ids: [pointId],
    idempotency_key: "evidence_expiry_check",
    trace_id: "trace_evidence_expiry",
  };
  const beforeExpiry = await application.checkPrePromotion(
    promoter,
    checkRequest,
    new Date(baseTime.getTime() + 1_000),
  );
  assert.equal(beforeExpiry.overall_result, "passed");
  assert.equal(
    beforeExpiry.points[0].evidence_valid_until,
    evidenceValidUntil,
  );
  assert.equal(beforeExpiry.points[0].expired, false);
  const projection = await repository.transact((state) => ({
    point: state.points.get(pointId).evidence_valid_until,
    projection: state.projections.get(pointId).evidence_valid_until,
  }));
  assert.deepEqual(projection, {
    point: evidenceValidUntil,
    projection: evidenceValidUntil,
  });
  const checkedPoint = beforeExpiry.points[0];
  await assert.rejects(
    application.validatePrePromotion(
      promoter,
      {
        schema_version: "memory.pre_promotion_validate.v1",
        bot_id: scope.bot_id,
        check_token: beforeExpiry.check_token,
        check_id: beforeExpiry.check_id,
        check_generation: beforeExpiry.check_generation,
        candidate_fact_id: beforeExpiry.candidate_fact_id,
        expected_point_versions: [
          {
            memory_point_id: checkedPoint.memory_point_id,
            state_version: checkedPoint.state_version,
            state_hash: checkedPoint.state_hash,
          },
        ],
        expected_conflict_versions: [],
        idempotency_key: "evidence_expiry_reservation",
      },
      new Date(evidenceValidUntil),
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "stale_memory_check",
  );
  const atExpiry = await application.checkPrePromotion(
    promoter,
    checkRequest,
    new Date(evidenceValidUntil),
  );
  assert.equal(atExpiry.check_generation, beforeExpiry.check_generation + 1);
  assert.equal(atExpiry.overall_result, "blocked");
  assert.equal(atExpiry.points[0].expired, true);
  assert.deepEqual(atExpiry.points[0].blocking_reasons, [
    "evidence_expired",
  ]);
  const recalled = await application.fastRecall(
    reader,
    recall({ query: "memory evidence_expiry" }),
    new Date(evidenceValidUntil),
  );
  assert.equal(recalled.items.length, 0);
});

test("promotion release is idempotent and expired fences do not strand Memory mutations", async () => {
  const { application } = harness();
  const baseTime = new Date("2026-07-24T11:00:00.000Z");
  const created = await application.writeBatch(
    writer,
    batch("release_source", [item("release")]),
    { raw_body_bytes: 1_000, now: baseTime },
  );
  const pointId = created.item_results[0].memory_point_id;
  const check = await application.checkPrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_check.v1",
      bot_id: scope.bot_id,
      candidate_fact_id: "candidate_release",
      memory_point_ids: [pointId],
      idempotency_key: "release_check",
      trace_id: "trace_release",
    },
    new Date(baseTime.getTime() + 1_000),
  );
  const point = check.points[0];
  const reservation = await application.validatePrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_validate.v1",
      bot_id: scope.bot_id,
      check_token: check.check_token,
      check_id: check.check_id,
      check_generation: check.check_generation,
      candidate_fact_id: check.candidate_fact_id,
      expected_point_versions: [
        {
          memory_point_id: point.memory_point_id,
          state_version: point.state_version,
          state_hash: point.state_hash,
        },
      ],
      expected_conflict_versions: [],
      idempotency_key: "release_reserve",
    },
    new Date(baseTime.getTime() + 2_000),
  );
  const releaseRequest = {
    schema_version: "memory.promotion_reservation_release.v1",
    bot_id: scope.bot_id,
    reservation_id: reservation.reservation_id,
    candidate_fact_id: reservation.candidate_fact_id,
    fencing_generation: reservation.fencing_generation,
    reservation_token_hash: promotionTokenHash(
      reservation.reservation_token,
    ),
    release_reason: "promotion_commit_failed",
    released_at: new Date(baseTime.getTime() + 3_000).toISOString(),
    idempotency_key: "release_command",
    trace_id: "trace_release",
  };
  assert.equal(
    (
      await application.releasePromotionReservation(
        promoter,
        { ...releaseRequest, trace_id: "trace_release_retry" },
      )
    ).status,
    "released",
  );
  assert.equal(
    (
      await application.releasePromotionReservation(
        promoter,
        releaseRequest,
      )
    ).duplicate_replayed,
    true,
  );
  await assert.rejects(
    application.ackPromotionReservation(promoter, {
      schema_version: "memory.promotion_reservation_ack.v1",
      bot_id: scope.bot_id,
      reservation_id: reservation.reservation_id,
      candidate_fact_id: reservation.candidate_fact_id,
      fencing_generation: reservation.fencing_generation,
      reservation_token_hash: promotionTokenHash(
        reservation.reservation_token,
      ),
      promotion_revision_id: "revision_after_explicit_release",
      committed_at: new Date(baseTime.getTime() + 2_500).toISOString(),
      idempotency_key: "release_then_ack",
      trace_id: "trace_release",
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "promotion_stale_fence",
  );

  const mutation = batch("release_mutation", [
    item("release", {
      client_item_id: "release_mutation",
      source_item_id: "source_release_mutation",
      content_summary: "released reservation permits mutation",
      occurred_at: "2026-07-23T00:00:01.000Z",
    }),
  ]);
  const result = await application.writeBatch(writer, mutation, {
    raw_body_bytes: 1_000,
    now: new Date(baseTime.getTime() + 4_000),
  });
  assert.equal(result.item_results[0].decision, "append_version");

  const latestPointId = result.item_results[0].memory_point_id;
  const expiringCheck = await application.checkPrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_check.v1",
      bot_id: scope.bot_id,
      candidate_fact_id: "candidate_expiring",
      memory_point_ids: [latestPointId],
      idempotency_key: "expiring_check",
      trace_id: "trace_expiring",
    },
    new Date(baseTime.getTime() + 5_000),
  );
  const latestPoint = expiringCheck.points[0];
  await application.validatePrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_validate.v1",
      bot_id: scope.bot_id,
      check_token: expiringCheck.check_token,
      check_id: expiringCheck.check_id,
      check_generation: expiringCheck.check_generation,
      candidate_fact_id: expiringCheck.candidate_fact_id,
      expected_point_versions: [
        {
          memory_point_id: latestPoint.memory_point_id,
          state_version: latestPoint.state_version,
          state_hash: latestPoint.state_hash,
        },
      ],
      expected_conflict_versions: [],
      idempotency_key: "expiring_reserve",
    },
    new Date(baseTime.getTime() + 6_000),
  );
  const afterExpiry = await application.writeBatch(
    writer,
    batch("after_expiry_mutation", [
      item("release", {
        client_item_id: "after_expiry_mutation",
        source_item_id: "source_after_expiry_mutation",
        content_summary: "expired reservation permits mutation",
      }),
    ]),
    {
      raw_body_bytes: 1_000,
      now: new Date(baseTime.getTime() + 12_000),
    },
  );
  assert.equal(afterExpiry.item_results[0].decision, "append_version");
});

test("promotion reservations serialize per candidate and superseded generations cannot ack", async () => {
  const { application } = harness();
  const baseTime = new Date("2026-07-24T11:30:00.000Z");
  const created = await application.writeBatch(
    writer,
    batch("candidate-fence-source", [
      item("candidate-fence-a"),
      item("candidate-fence-b"),
    ]),
    { raw_body_bytes: 2_000, now: baseTime },
  );
  const [firstPointId, secondPointId] = created.item_results.map(
    (result) => result.memory_point_id,
  );
  const candidateFactId = "candidate_generation_fence";
  const checks = await Promise.all(
    [
      ["candidate-fence-check-a", firstPointId],
      ["candidate-fence-check-b", secondPointId],
    ].map(([idempotencyKey, pointId]) =>
      application.checkPrePromotion(
        promoter,
        {
          schema_version: "memory.pre_promotion_check.v1",
          bot_id: scope.bot_id,
          candidate_fact_id: candidateFactId,
          memory_point_ids: [pointId],
          idempotency_key: idempotencyKey,
          trace_id: "trace_candidate_fence",
        },
        new Date(baseTime.getTime() + 1_000),
      ),
    ),
  );
  const reserve = (check, idempotencyKey, now) => {
    const point = check.points[0];
    return application.validatePrePromotion(
      promoter,
      {
        schema_version: "memory.pre_promotion_validate.v1",
        bot_id: scope.bot_id,
        check_token: check.check_token,
        check_id: check.check_id,
        check_generation: check.check_generation,
        candidate_fact_id: candidateFactId,
        expected_point_versions: [
          {
            memory_point_id: point.memory_point_id,
            state_version: point.state_version,
            state_hash: point.state_hash,
          },
        ],
        expected_conflict_versions: [],
        idempotency_key: idempotencyKey,
      },
      now,
    );
  };
  const first = await reserve(
    checks[0],
    "candidate-fence-reserve-a",
    new Date(baseTime.getTime() + 2_000),
  );
  await assert.rejects(
    reserve(
      checks[1],
      "candidate-fence-reserve-b",
      new Date(baseTime.getTime() + 3_000),
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "promotion_reserved",
  );

  const second = await reserve(
    checks[1],
    "candidate-fence-reserve-b",
    new Date(baseTime.getTime() + 8_000),
  );
  assert.equal(second.fencing_generation, first.fencing_generation + 1);
  await assert.rejects(
    application.ackPromotionReservation(promoter, {
      schema_version: "memory.promotion_reservation_ack.v1",
      bot_id: scope.bot_id,
      reservation_id: first.reservation_id,
      candidate_fact_id: candidateFactId,
      fencing_generation: first.fencing_generation,
      reservation_token_hash: promotionTokenHash(
        first.reservation_token,
      ),
      promotion_revision_id: "revision_superseded",
      committed_at: new Date(baseTime.getTime() + 4_000).toISOString(),
      idempotency_key: "candidate-fence-old-ack",
      trace_id: "trace_candidate_fence",
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "promotion_stale_fence",
  );
});

test("commit proof inside the lease can ack after expiry cleanup and later target drift", async () => {
  const { application } = harness();
  const baseTime = new Date("2026-07-24T11:45:00.000Z");
  const created = await application.writeBatch(
    writer,
    batch("late-ack-source", [item("late-ack")]),
    { raw_body_bytes: 1_000, now: baseTime },
  );
  const pointId = created.item_results[0].memory_point_id;
  const check = await application.checkPrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_check.v1",
      bot_id: scope.bot_id,
      candidate_fact_id: "candidate_late_ack",
      memory_point_ids: [pointId],
      idempotency_key: "late-ack-check",
      trace_id: "trace_late_ack",
    },
    new Date(baseTime.getTime() + 1_000),
  );
  const checkedPoint = check.points[0];
  const reservation = await application.validatePrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_validate.v1",
      bot_id: scope.bot_id,
      check_token: check.check_token,
      check_id: check.check_id,
      check_generation: check.check_generation,
      candidate_fact_id: check.candidate_fact_id,
      expected_point_versions: [
        {
          memory_point_id: checkedPoint.memory_point_id,
          state_version: checkedPoint.state_version,
          state_hash: checkedPoint.state_hash,
        },
      ],
      expected_conflict_versions: [],
      idempotency_key: "late-ack-reserve",
    },
    new Date(baseTime.getTime() + 2_000),
  );
  await application.writeBatch(
    writer,
    batch("late-ack-mutation", [
      item("late-ack", {
        client_item_id: "late-ack-mutation",
        source_item_id: "source_late-ack-mutation",
        content_summary: "mutation after the reservation lease",
      }),
    ]),
    {
      raw_body_bytes: 1_000,
      now: new Date(baseTime.getTime() + 8_000),
    },
  );
  const ackRequest = {
    schema_version: "memory.promotion_reservation_ack.v1",
    bot_id: scope.bot_id,
    reservation_id: reservation.reservation_id,
    candidate_fact_id: reservation.candidate_fact_id,
    fencing_generation: reservation.fencing_generation,
    reservation_token_hash: promotionTokenHash(
      reservation.reservation_token,
    ),
    promotion_revision_id: "revision_committed_in_window",
    committed_at: new Date(baseTime.getTime() + 4_000).toISOString(),
    idempotency_key: "late-ack-command",
    trace_id: "trace_late_ack",
  };
  assert.equal(
    (await application.ackPromotionReservation(promoter, ackRequest))
      .status,
    "committed",
  );
  await assert.rejects(
    application.releasePromotionReservation(promoter, {
      schema_version: "memory.promotion_reservation_release.v1",
      bot_id: scope.bot_id,
      reservation_id: reservation.reservation_id,
      candidate_fact_id: reservation.candidate_fact_id,
      fencing_generation: reservation.fencing_generation,
      reservation_token_hash: promotionTokenHash(
        reservation.reservation_token,
      ),
      release_reason: "reservation_expired",
      released_at: reservation.expires_at,
      idempotency_key: "late-ack-release-after-commit",
      trace_id: "trace_late_ack",
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "promotion_stale_fence",
  );
});

test("point or conflict drift invalidates validation and ack instead of committing a stale fence", async () => {
  const { application, repository } = harness();
  const baseTime = new Date("2026-07-24T12:00:00.000Z");
  const created = await application.writeBatch(
    writer,
    batch("drift_source", [item("drift")]),
    { raw_body_bytes: 1_000, now: baseTime },
  );
  const pointId = created.item_results[0].memory_point_id;
  const checkRequest = {
    schema_version: "memory.pre_promotion_check.v1",
    bot_id: scope.bot_id,
    candidate_fact_id: "candidate_drift",
    memory_point_ids: [pointId],
    idempotency_key: "drift_check_1",
    trace_id: "trace_drift",
  };
  const firstCheck = await application.checkPrePromotion(
    promoter,
    checkRequest,
    new Date(baseTime.getTime() + 1_000),
  );
  const firstPoint = firstCheck.points[0];
  await repository.transact((state) => {
    const point = state.points.get(pointId);
    point.state_version += 1;
  });
  await assert.rejects(
    application.validatePrePromotion(
      promoter,
      {
        schema_version: "memory.pre_promotion_validate.v1",
        bot_id: scope.bot_id,
        check_token: firstCheck.check_token,
        check_id: firstCheck.check_id,
        check_generation: firstCheck.check_generation,
        candidate_fact_id: firstCheck.candidate_fact_id,
        expected_point_versions: [
          {
            memory_point_id: firstPoint.memory_point_id,
            state_version: firstPoint.state_version,
            state_hash: firstPoint.state_hash,
          },
        ],
        expected_conflict_versions: [],
        idempotency_key: "drift_reserve_1",
      },
      new Date(baseTime.getTime() + 2_000),
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "stale_memory_check",
  );

  const secondCheck = await application.checkPrePromotion(
    promoter,
    {
      ...checkRequest,
      idempotency_key: "drift_check_2",
    },
    new Date(baseTime.getTime() + 3_000),
  );
  const secondPoint = secondCheck.points[0];
  const reservation = await application.validatePrePromotion(
    promoter,
    {
      schema_version: "memory.pre_promotion_validate.v1",
      bot_id: scope.bot_id,
      check_token: secondCheck.check_token,
      check_id: secondCheck.check_id,
      check_generation: secondCheck.check_generation,
      candidate_fact_id: secondCheck.candidate_fact_id,
      expected_point_versions: [
        {
          memory_point_id: secondPoint.memory_point_id,
          state_version: secondPoint.state_version,
          state_hash: secondPoint.state_hash,
        },
      ],
      expected_conflict_versions: [],
      idempotency_key: "drift_reserve_2",
    },
    new Date(baseTime.getTime() + 4_000),
  );
  await repository.transact((state) => {
    const point = state.points.get(pointId);
    state.conflicts.set("conflict_out_of_band", {
      id: "conflict_out_of_band",
      scope,
      old_series_id: point.series_id,
      new_series_id: point.series_id,
      conflict_type: "source_item_identity_drift",
      source_item_id: "source_out_of_band",
      left_memory_point_id: pointId,
      right_memory_point_id: pointId,
      evidence_refs: ["memory_point:out_of_band"],
      incoming_content_hash: `sha256:${"0".repeat(64)}`,
      status: "open",
      state_version: 1,
      created_at: new Date(baseTime.getTime() + 4_500).toISOString(),
    });
  });
  await assert.rejects(
    application.ackPromotionReservation(promoter, {
      schema_version: "memory.promotion_reservation_ack.v1",
      bot_id: scope.bot_id,
      reservation_id: reservation.reservation_id,
      candidate_fact_id: reservation.candidate_fact_id,
      fencing_generation: reservation.fencing_generation,
      reservation_token_hash: promotionTokenHash(
        reservation.reservation_token,
      ),
      promotion_revision_id: "revision_drift",
      committed_at: new Date(baseTime.getTime() + 4_500).toISOString(),
      idempotency_key: "drift_ack",
      trace_id: "trace_drift",
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "promotion_version_drift",
  );
});

test("append and merge mutations emit every durable aggregate transition", async () => {
  const { application, repository } = harness();
  const original = item("events", {
    source_item_id: "source_events_1",
    occurred_at: "2026-07-23T00:00:00.000Z",
  });
  await application.writeBatch(writer, batch("events_1", [original]), {
    raw_body_bytes: 1_000,
  });
  await application.writeBatch(
    writer,
    batch("events_2", [
      {
        ...original,
        client_item_id: "events_append",
        source_item_id: "source_events_2",
        content_summary: "changed memory",
        occurred_at: "2026-07-23T00:00:01.000Z",
      },
    ]),
    { raw_body_bytes: 1_000 },
  );
  await application.writeBatch(
    writer,
    batch("events_3", [
      {
        ...original,
        client_item_id: "events_merge",
        source_item_id: "source_events_3",
        content_summary: "changed memory",
        occurred_at: "2026-07-23T00:00:02.000Z",
      },
    ]),
    { raw_body_bytes: 1_000 },
  );
  const events = await repository.transact((state) =>
    state.outbox.map((event) => event.event_type),
  );
  assert.deepEqual(events, [
    "memory.series.created",
    "memory.point.created",
    "memory.series.updated",
    "memory.point.updated",
    "memory.point.created",
    "memory.series.updated",
  ]);
});

test("embedding validation rolls the whole batch back on wrong dimension and zero vectors", async () => {
  for (const output of [
    () => [[1, 0]],
    () => [Array.from({ length: 2_048 }, () => 0)],
  ]) {
    const { application, repository } = harness(new EmbeddingStub(output));
    await assert.rejects(
      application.writeBatch(writer, batch("invalid_embedding", [item("1")]), {
        raw_body_bytes: 1_000,
      }),
      (error) =>
        error instanceof MemoryApplicationErrorV1 &&
        error.code === "dependency_unavailable",
    );
    const sizes = await repository.transact((state) => [
      state.batches.size,
      state.decisions.size,
      state.series.size,
      state.points.size,
      state.projections.size,
      state.outbox.length,
    ]);
    assert.deepEqual(sizes, [0, 0, 0, 0, 0, 0]);
  }
});

test("embedding dependency projections reject a typed Proxy before property access", async () => {
  const embedding = new EmbeddingStub();
  let propertyReads = 0;
  embedding.output = () =>
    [
      new Proxy(vector(0.5), {
        get(target, property, receiver) {
          propertyReads += 1;
          return Reflect.get(target, property, receiver);
        },
      }),
    ];
  const { application, repository } = harness(embedding);
  await assert.rejects(
    application.writeBatch(
      writer,
      batch("malicious-embedding-projection", [
        item("malicious-embedding-projection"),
      ]),
      { raw_body_bytes: 1_000 },
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "dependency_unavailable",
  );
  assert.equal(propertyReads, 0);
  assert.equal(
    await repository.transact((state) => state.batches.size),
    0,
  );
});

test("owner envelope limits and capabilities fail closed while malformed items are rejected", async () => {
  const { application } = harness();
  await assert.rejects(
    application.writeBatch(writer, batch("oversize", [item("1")]), {
      raw_body_bytes: 2_097_153,
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "payload_too_large",
  );
  await assert.rejects(
    application.writeBatch(
      writer,
      batch(
        "too_many",
        Array.from({ length: 101 }, (_, index) => item(String(index))),
      ),
      { raw_body_bytes: 100_000 },
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "too_many_items",
  );
  const malformed = await application.writeBatch(
    writer,
    batch("bad_date", [
      item("1", { occurred_at: "2026-02-30T00:00:00.000Z" }),
    ]),
    { raw_body_bytes: 1_000 },
  );
  assert.equal(malformed.batch_status, "partial_failed");
  assert.deepEqual(malformed.item_results, [
    {
      client_item_id: "1",
      status: "rejected",
      code: "schema_validation_failed",
      message: "memory write item was rejected",
      field_path: "/items/0/occurred_at",
    },
  ]);
  await assert.rejects(
    application.writeBatch(
      { ...writer, capabilities: [] },
      batch("forbidden", [item("1")]),
      { raw_body_bytes: 1_000 },
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "forbidden",
  );
  await assert.rejects(
    application.writeBatch(
      writer,
      {
        ...batch("other_scope", [item("1")]),
        bot_id: "bot_other",
      },
      { raw_body_bytes: 1_000 },
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "bot_scope_mismatch",
  );

  await application.writeBatch(
    writer,
    batch("isolated", [item("isolated")]),
    { raw_body_bytes: 1_000 },
  );
  const isolated = await application.fastRecall(
    {
      ...reader,
      scope: { ...scope, owner_agent_id: "agent_other" },
    },
    recall({ query: "memory" }),
  );
  assert.deepEqual(isolated.items, []);
});

test("topic identity uses NFKC JCS semantics without collapsing opaque internal whitespace", () => {
  const opaque = memoryTopicIdentityV1(
    "bot_1",
    item("topic", {
      subject_refs: [
        {
          subject_type: "user",
          canonical_id: "  User  A  ",
          primary: true,
        },
      ],
      aspect_hint: "  Work   PLAN ",
      scope_hint: " ＧＬＯＢＡＬ ",
    }),
  ).identity;
  assert.equal(opaque.subject_key, "User  A");
  assert.equal(opaque.aspect_key, "work plan");
  assert.equal(opaque.scope_key, "global");

  const folded = memoryTopicIdentityV1(
    "bot_1",
    item("topic_label", {
      subject_refs: [
        {
          subject_type: "user",
          label: "  Straẞe   TEAM ",
          primary: true,
        },
      ],
    }),
  ).identity;
  assert.equal(folded.subject_key, "label:strasse team");
  assert.notEqual(
    folded.topic_key,
    `${folded.subject_key}:${folded.aspect_key}:${folded.scope_key}`,
  );
});

test("legacy subject order is default-deny and requires both capability and server allowlist", async () => {
  const request = batch(
    "legacy",
    [
      item("legacy", {
        subject_refs: [
          { subject_type: "user", canonical_id: "user_legacy" },
          { subject_type: "project", canonical_id: "project_legacy" },
        ],
      }),
    ],
    { compatibility_mode: "legacy_subject_order" },
  );
  const denied = harness().application;
  await assert.rejects(
    denied.writeBatch(
      {
        ...writer,
        capabilities: [
          "memory.write",
          "memory.compatibility.legacy_subject_order",
        ],
      },
      request,
      { raw_body_bytes: 1_000 },
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "forbidden",
  );

  const repository = new InMemoryMemoryStateRepositoryV1();
  const allowed = new MemoryApplicationV1(
    repository,
    new EmbeddingStub(),
    {
      legacy_subject_order_owner_agent_ids: [scope.owner_agent_id],
    },
  );
  const response = await allowed.writeBatch(
    {
      ...writer,
      capabilities: [
        "memory.write",
        "memory.compatibility.legacy_subject_order",
      ],
    },
    request,
    { raw_body_bytes: 1_000 },
  );
  assert.equal(response.warnings[0].code, "legacy_primary_fallback");
  const audits = await repository.transact((state) =>
    state.audit.filter((entry) => entry.type === "compatibility_mode_used"),
  );
  assert.equal(audits.length, 1);
});

test("fast recall reads the immediate projection and follows ranking v1 min-max and tag dimensions", async () => {
  const { application } = harness();
  await application.writeBatch(
    writer,
    batch("ranking", [
      item("low", {
        content_summary: "alpha",
        keyword_tags: ["alpha"],
        scene_tags: ["implementation", "debugging"],
        emotion_tags: ["neutral"],
      }),
      item("high", {
        content_summary: "alpha beta",
        keyword_tags: ["alpha", "beta"],
        scene_tags: ["implementation"],
        emotion_tags: ["neutral"],
      }),
    ]),
    {
      raw_body_bytes: 2_000,
      now: new Date("2026-07-23T00:00:00.000Z"),
    },
  );
  const response = await application.fastRecall(
    reader,
    recall({ query: "alpha beta implementation debugging" }),
    new Date("2026-07-23T00:00:00.000Z"),
  );
  assert.equal(response.items.length, 2);
  const low = response.items.find((entry) => entry.content_summary === "alpha");
  const high = response.items.find(
    (entry) => entry.content_summary === "alpha beta",
  );
  assert.equal(low.score_breakdown.keyword, 0);
  assert.equal(high.score_breakdown.keyword, 1);
  assert.equal(low.score_breakdown.tag_boost, 0.025);
  assert.equal(response.ranking_profile_version, "memory.fast_recall.ranking.v1");
});

test("deferred recall embedding releases the repository and fails its stale revision CAS", async () => {
  const entered = deferred();
  const release = deferred();
  let deferRecall = false;
  const embedding = new EmbeddingStub(async (inputs) => {
    if (deferRecall && inputs.length === 1 && inputs[0] === "slow recall") {
      entered.resolve();
      await release.promise;
    }
    return inputs.map(() => vector(0));
  });
  const { application, repository } = harness(embedding);
  const seed = batch("recall_cas_seed", [item("seed")]);
  await application.writeBatch(writer, seed, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(seed)),
    now: new Date("2026-07-23T00:00:00.000Z"),
  });

  deferRecall = true;
  const recallOutcome = application
    .fastRecall(
      reader,
      recall({ query: "slow recall" }),
      new Date("2026-07-23T00:00:01.000Z"),
    )
    .then(
      (response) => response,
      (error) => error,
    );
  await entered.promise;

  const concurrent = batch("recall_cas_concurrent", [
    item("concurrent", { content_summary: "concurrent write" }),
  ]);
  await application.writeBatch(writer, concurrent, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(concurrent)),
    now: new Date("2026-07-23T00:00:02.000Z"),
  });
  release.resolve();

  const rejected = await recallOutcome;
  assert.ok(rejected instanceof MemoryApplicationErrorV1);
  assert.equal(rejected.code, "lease_conflict");
  assert.equal(rejected.retryable, true);
  assert.equal(
    await repository.transact((state) => state.recallSnapshots.size),
    0,
  );
});

test("recall pages are frozen for 30 seconds and cursor is bound to the stored snapshot", async () => {
  const { application } = harness();
  await application.writeBatch(
    writer,
    batch("snapshot_seed", [
      item("older", {
        content_summary: "alpha old",
        occurred_at: "2026-07-22T00:00:00.000Z",
      }),
      item("newer", {
        content_summary: "alpha new",
        occurred_at: "2026-07-23T00:00:00.000Z",
      }),
    ]),
    { raw_body_bytes: 2_000 },
  );
  const first = await application.fastRecall(
    reader,
    recall({ query: "alpha", limit: 1 }),
    new Date("2026-07-23T00:00:00.000Z"),
  );
  assert.equal(first.items[0].content_summary, "alpha new");
  assert.ok(first.next_cursor);

  await application.writeBatch(
    writer,
    batch("snapshot_update", [
      {
        ...item("older", {
          client_item_id: "older_update",
          source_item_id: "source_older_update",
          content_summary: "alpha changed after snapshot",
          occurred_at: "2026-07-23T00:00:01.000Z",
        }),
      },
    ]),
    { raw_body_bytes: 1_000 },
  );
  const second = await application.fastRecall(
    reader,
    recall({
      query: "alpha",
      limit: 1,
      snapshot_token: first.snapshot_token,
      cursor: first.next_cursor,
    }),
    new Date("2026-07-23T00:00:10.000Z"),
  );
  assert.equal(second.items[0].content_summary, "alpha old");

  await assert.rejects(
    application.fastRecall(
      reader,
      recall({
        query: "alpha",
        limit: 1,
        snapshot_token: first.snapshot_token,
        cursor: "mc_forged",
      }),
      new Date("2026-07-23T00:00:10.000Z"),
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "invalid_request",
  );
  await assert.rejects(
    application.fastRecall(
      reader,
      recall({
        query: "alpha",
        limit: 1,
        snapshot_token: first.snapshot_token,
        cursor: first.next_cursor,
      }),
      new Date("2026-07-23T00:00:30.000Z"),
    ),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "snapshot_expired",
  );
});

test("recall snapshot cache enforces per-scope/global bounds and eagerly prunes TTL expiry", async () => {
  const { application, repository } = harness();
  const baseTime = new Date("2026-07-24T14:00:00.000Z");
  const first = await application.fastRecall(
    reader,
    recall({ query: "snapshot-0" }),
    baseTime,
  );
  for (let index = 1; index < 65; index += 1) {
    await application.fastRecall(
      reader,
      recall({ query: `snapshot-${index}` }),
      new Date(baseTime.getTime() + index),
    );
  }
  const scoped = await repository.transact((state) => ({
    size: state.recallSnapshots.size,
    contains_first: state.recallSnapshots.has(first.snapshot_token),
  }));
  assert.deepEqual(scoped, {
    size: 64,
    contains_first: false,
  });

  for (let index = 0; index < 449; index += 1) {
    const scopedReader = {
      ...reader,
      scope: {
        ...scope,
        owner_agent_id: `snapshot_owner_${index}`,
      },
    };
    await application.fastRecall(
      scopedReader,
      recall({ query: `global-snapshot-${index}` }),
      new Date(baseTime.getTime() + 100 + index),
    );
  }
  assert.equal(
    await repository.transact((state) => state.recallSnapshots.size),
    512,
  );

  await application.fastRecall(
    reader,
    recall({ query: "snapshot-after-ttl" }),
    new Date(baseTime.getTime() + 31_000),
  );
  assert.equal(
    await repository.transact((state) => state.recallSnapshots.size),
    1,
  );
});

test("integration owner boundaries snapshot caller data before a blocked transaction", async () => {
  const repository = new BlockingMemoryRepository();
  const application = new MemoryApplicationV1(
    repository,
    new EmbeddingStub(),
    { integration_lease_seconds: 30 },
  );
  const created = await application.createIntegrationJob(
    worker,
    {
      schema_version: "memory.integration_run.v1",
      bot_id: scope.bot_id,
      scope: {},
      mode: "full",
      dry_run: true,
      idempotency_key: "integration boundary snapshot",
      expected_policy_version: "memory.integration_policy.v1",
    },
    new Date("2026-07-23T00:00:00.000Z"),
  );

  const claimPrincipal = mutableWorker();
  const claimInput = {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    owner_id: "worker_original",
    now: "2026-07-23T00:00:01.000Z",
  };
  const claimGate = repository.blockNextTransaction();
  const claimPromise = application.claimIntegrationJob(
    claimPrincipal,
    claimInput,
  );
  await claimGate.entered.promise;
  claimPrincipal.caller = "knowthat";
  claimPrincipal.capabilities.length = 0;
  claimPrincipal.scope.bot_id = "bot_mutated";
  claimInput.integration_job_id = "job_mutated";
  claimInput.owner_id = "worker_mutated";
  claimGate.release.resolve();
  const claimed = await claimPromise;
  assert.equal(claimed.job.id, created.integration_job_id);
  assert.equal(
    await repository.transact(
      (state) =>
        state.integrationLeases.get(created.integration_job_id)?.owner_id,
    ),
    "worker_original",
  );

  const checkpointPrincipal = mutableWorker();
  const checkpointInput = {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    lease_id: claimed.lease_id,
    lease_generation: claimed.lease_generation,
    checkpoint_ref: "checkpoint_original",
    applied_counts: { scanned: 1 },
    proposed_changes: [{ operation: "original" }],
    now: "2026-07-23T00:00:02.000Z",
  };
  const checkpointGate = repository.blockNextTransaction();
  const checkpointPromise = application.checkpointIntegrationJob(
    checkpointPrincipal,
    checkpointInput,
  );
  await checkpointGate.entered.promise;
  checkpointPrincipal.caller = "knowthat";
  checkpointPrincipal.capabilities.length = 0;
  checkpointPrincipal.scope.bot_id = "bot_mutated";
  checkpointInput.integration_job_id = "job_mutated";
  checkpointInput.lease_id = "lease_mutated";
  checkpointInput.checkpoint_ref = "checkpoint_mutated";
  checkpointInput.applied_counts.scanned = 999;
  checkpointInput.proposed_changes[0].operation = "mutated";
  checkpointGate.release.resolve();
  const checkpointed = await checkpointPromise;
  assert.equal(checkpointed.checkpoint_ref, "checkpoint_original");
  assert.deepEqual(checkpointed.applied_counts, { scanned: 1 });
  assert.deepEqual(checkpointed.proposed_changes, [
    { operation: "original" },
  ]);

  const finishPrincipal = mutableWorker();
  const finishInput = {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    lease_id: claimed.lease_id,
    lease_generation: claimed.lease_generation,
    status: "completed",
    now: "2026-07-23T00:00:03.000Z",
  };
  const finishGate = repository.blockNextTransaction();
  const finishPromise = application.finishIntegrationJob(
    finishPrincipal,
    finishInput,
  );
  await finishGate.entered.promise;
  finishPrincipal.caller = "knowthat";
  finishPrincipal.capabilities.length = 0;
  finishPrincipal.scope.bot_id = "bot_mutated";
  finishInput.integration_job_id = "job_mutated";
  finishInput.lease_id = "lease_mutated";
  finishInput.status = "failed";
  finishInput.error = "mutated after validation";
  finishGate.release.resolve();
  const finished = await finishPromise;
  assert.equal(finished.status, "completed");
  assert.equal(finished.error, null);
});

test("integration jobs replay by hash and recover only through generation-fenced expired leases", async () => {
  const { application } = harness();
  const request = {
    schema_version: "memory.integration_run.v1",
    bot_id: scope.bot_id,
    scope: {},
    mode: "full",
    dry_run: false,
    idempotency_key: "integration key 1",
    expected_policy_version: "memory.integration_policy.v1",
  };
  const created = await application.createIntegrationJob(
    worker,
    request,
    new Date("2026-07-23T00:00:00.000Z"),
  );
  const replay = await application.createIntegrationJob(
    worker,
    request,
    new Date("2026-07-23T00:00:01.000Z"),
  );
  assert.equal(replay.duplicate_replayed, true);
  assert.equal(replay.integration_job_id, created.integration_job_id);

  const first = await application.claimIntegrationJob(worker, {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    owner_id: "worker_1",
    now: "2026-07-23T00:00:00.000Z",
  });
  const checkpoint = await application.checkpointIntegrationJob(worker, {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    lease_id: first.lease_id,
    lease_generation: first.lease_generation,
    checkpoint_ref: "checkpoint_1",
    applied_counts: { scanned: 10 },
    now: "2026-07-23T00:00:20.000Z",
  });
  assert.equal(checkpoint.status, "running");

  await assert.rejects(
    application.claimIntegrationJob(worker, {
      bot_id: scope.bot_id,
      integration_job_id: created.integration_job_id,
      owner_id: "worker_2",
      now: "2026-07-23T00:00:31.000Z",
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "lease_conflict",
  );
  const recovered = await application.claimIntegrationJob(worker, {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    owner_id: "worker_2",
    now: "2026-07-23T00:00:51.000Z",
  });
  assert.equal(recovered.lease_generation, 2);
  assert.equal(recovered.job.checkpoint_ref, "checkpoint_1");

  await assert.rejects(
    application.finishIntegrationJob(worker, {
      bot_id: scope.bot_id,
      integration_job_id: created.integration_job_id,
      lease_id: first.lease_id,
      lease_generation: first.lease_generation,
      status: "completed",
      now: "2026-07-23T00:00:52.000Z",
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "lease_conflict",
  );
  const finished = await application.finishIntegrationJob(worker, {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    lease_id: recovered.lease_id,
    lease_generation: recovered.lease_generation,
    status: "completed",
    now: "2026-07-23T00:00:52.000Z",
  });
  assert.equal(finished.status, "completed");
  assert.equal(finished.checkpoint_ref, "checkpoint_1");
  const finishReplay = await application.finishIntegrationJob(worker, {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    lease_id: recovered.lease_id,
    lease_generation: recovered.lease_generation,
    status: "completed",
    now: "2026-07-23T00:00:53.000Z",
  });
  assert.equal(finishReplay.state_version, finished.state_version);
  await assert.rejects(
    application.finishIntegrationJob(worker, {
      bot_id: scope.bot_id,
      integration_job_id: created.integration_job_id,
      lease_id: recovered.lease_id,
      lease_generation: recovered.lease_generation,
      status: "failed",
      error: "body drift",
      now: "2026-07-23T00:00:54.000Z",
    }),
    (error) =>
      error instanceof MemoryApplicationErrorV1 &&
      error.code === "idempotency_conflict",
  );
});

test("integration failure details are request-bound but never persisted or reflected", async () => {
  const { application } = harness();
  const created = await application.createIntegrationJob(
    worker,
    {
      schema_version: "memory.integration_run.v1",
      bot_id: scope.bot_id,
      scope: {},
      mode: "full",
      dry_run: false,
      idempotency_key: "integration failure redaction",
      expected_policy_version: "memory.integration_policy.v1",
    },
    new Date("2026-07-23T01:00:00.000Z"),
  );
  const claimed = await application.claimIntegrationJob(worker, {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    owner_id: "worker_redaction",
    now: "2026-07-23T01:00:01.000Z",
  });
  const secret =
    "Bearer memory-integration-secret https://provider.invalid/?token=secret";
  const failed = await application.finishIntegrationJob(worker, {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    lease_id: claimed.lease_id,
    lease_generation: claimed.lease_generation,
    status: "failed",
    error: secret,
    now: "2026-07-23T01:00:02.000Z",
  });
  assert.equal(failed.error, "memory_integration_failed");
  assert.equal(JSON.stringify(failed).includes(secret), false);

  const replay = await application.finishIntegrationJob(worker, {
    bot_id: scope.bot_id,
    integration_job_id: created.integration_job_id,
    lease_id: claimed.lease_id,
    lease_generation: claimed.lease_generation,
    status: "failed",
    error: secret,
    now: "2026-07-23T01:00:03.000Z",
  });
  assert.equal(replay.error, "memory_integration_failed");
  const queried = await application.getIntegrationJob(
    worker,
    scope.bot_id,
    created.integration_job_id,
  );
  assert.equal(queried.error, "memory_integration_failed");
  assert.equal(JSON.stringify(queried).includes(secret), false);
});
