import assert from "node:assert/strict";
import test from "node:test";

import { MemoryEventEnvelopeV1Schema } from "@pai/contracts/memory/memory-event.v1";
import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { Value } from "@sinclair/typebox/value";

import { MEMORY_REPOSITORY_CONTRACT_V1 } from "../dist/db/permission-manifest.v1.js";
import { createPostgresMemoryStateRepositoryV1 } from "../dist/db/postgres-memory-state-repository.v1.js";
import { MemoryApplicationV1 } from "../dist/memory-application.v1.js";
import { PostgresMemoryHttpApplicationV1 } from "../dist/postgres-memory-http-application.v1.js";
import {
  createMemoryIntegrationWorkerV1,
  createPostgresMemoryIntegrationQueueV1,
} from "../dist/integration-worker.v1.js";
import { acquireMemoryRuntimeDatabaseV1 } from "./postgres-test-runtime.mjs";

const databaseUrl =
  process.env.PAI_MEMORY_TEST_DATABASE_URL ?? process.env.PAI_TEST_DATABASE_URL;

function vector() {
  const value = Array.from({ length: 2_048 }, () => 0);
  value[0] = 1;
  return value;
}

const embedding = Object.freeze({
  async checkReadiness() {},
  async embed(inputs) {
    return inputs.map(() => vector());
  },
});

function item(suffix, content) {
  return {
    client_item_id: `item_${suffix}`,
    source_item_id: `source_${suffix}`,
    content_summary: content,
    subject_refs: [
      {
        subject_type: "user",
        canonical_id: `user_${suffix}`,
        primary: true,
      },
    ],
    aspect_hint: "conflict",
    scope_hint: "global",
    human_agent_relation: [],
    keyword_tags: ["postgres"],
    scene_tags: ["decision_making"],
    emotion_tags: ["neutral"],
    source_info: {
      source_type: "trigger_snapshot",
      source_ref: `trigger_process:process_${suffix}`,
      actor_type: "user",
      actor_id: `user_${suffix}`,
    },
    confidence_score: 0.9,
    occurred_at: "2026-07-28T00:00:00.000Z",
  };
}

async function seedConflict(application, principal, suffix) {
  const base = {
    schema_version: "memory.write_batch.v1",
    bot_id: principal.scope.bot_id,
    trigger_process_id: `process_${suffix}`,
    source_meta_job_id: `meta_${suffix}`,
  };
  const first = {
    ...base,
    idempotency_key: `batch_old_${suffix}`,
    items: [item(suffix, `old fact ${suffix}`)],
  };
  await application.writeBatch(principal, first, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(first)),
    now: new Date("2026-07-28T00:00:01.000Z"),
  });
  const second = {
    ...base,
    idempotency_key: `batch_new_${suffix}`,
    items: [
      {
        ...item(suffix, `new contradictory fact ${suffix}`),
        client_item_id: `item_new_${suffix}`,
        source_item_id: `source_new_${suffix}`,
      },
    ],
  };
  const created = await application.writeBatch(principal, second, {
    raw_body_bytes: Buffer.byteLength(JSON.stringify(second)),
    now: new Date("2026-07-28T00:00:02.000Z"),
  });
  assert.equal(created.conflict_ids.length, 1);
  return created.conflict_ids[0];
}

async function conflictSnapshot(composition, botId, conflictId) {
  return composition.read_committed_postgres.withReadCommittedTransaction(
    async (transaction) => {
      const result = await transaction.query(
        `SELECT conflict.id,conflict.status,conflict.state_version AS conflict_version,
                old_series.id AS old_series_id,old_series.state_version AS old_series_version,
                old_series.topic_key AS old_topic_key,
                old_point.id AS old_point_id,old_point.state_version AS old_point_version,
                new_series.id AS new_series_id,new_series.state_version AS new_series_version,
                new_series.topic_key AS new_topic_key,
                new_point.id AS new_point_id,new_point.state_version AS new_point_version
           FROM memory.memory_conflicts AS conflict
           JOIN memory.memory_points AS old_point ON old_point.id=conflict.left_memory_point_id
           JOIN memory.memory_points AS new_point ON new_point.id=conflict.right_memory_point_id
           JOIN memory.memory_series AS old_series ON old_series.id=old_point.series_id
           JOIN memory.memory_series AS new_series ON new_series.id=new_point.series_id
          WHERE conflict.bot_id=$1 AND conflict.id=$2`,
        [botId, conflictId],
      );
      assert.equal(result.rows.length, 1);
      return result.rows[0];
    },
  );
}

function resolveRequest(scope, snapshot, suffix, decision, extra = {}) {
  return {
    schema_version: "memory.conflict_resolve.v1",
    bot_id: scope.bot_id,
    decision,
    reason: `verified resolution ${suffix}`,
    evidence_refs: [
      `memory_point:${snapshot.old_point_id}`,
      `memory_point:${snapshot.new_point_id}`,
    ],
    expected_conflict_version: Number(snapshot.conflict_version),
    expected_versions: {
      old_series_state_version: Number(snapshot.old_series_version),
      old_point_state_version: Number(snapshot.old_point_version),
      new_series_state_version: Number(snapshot.new_series_version),
      new_point_state_version: Number(snapshot.new_point_version),
    },
    idempotency_key: `resolve_${suffix}`,
    trace_id: `trace_${suffix}`,
    ...extra,
  };
}

test(
  "PostgreSQL Memory conflict, feedback, alias, and outbox effects are durable and replayable",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    const runtime = await acquireMemoryRuntimeDatabaseV1(databaseUrl);
    let composition;
    try {
      composition = await openVerifiedOwnerPostgresCompositionV1(
        MEMORY_REPOSITORY_CONTRACT_V1,
        runtime.database_url,
      );
      const run = `${Date.now().toString(36)}_${process.pid}`;
      const scope = Object.freeze({
        workspace_id: `workspace_${run}`,
        bot_id: `bot_${run}`,
        owner_agent_id: `agent_${run}`,
        deployment_environment: "local",
        release_channel: "stable",
      });
      const principal = Object.freeze({
        caller: "meta_cognition",
        capabilities: Object.freeze([
          "memory.write",
          "memory.conflict.resolve",
          "memory.feedback.write",
        ]),
        scope,
      });
      const core = new MemoryApplicationV1(
        createPostgresMemoryStateRepositoryV1(composition),
        embedding,
      );
      const application = new PostgresMemoryHttpApplicationV1(
        core,
        composition,
        embedding,
        "memory-test-promotion-secret-at-least-32-bytes",
      );

      const preferNewId = await seedConflict(core, principal, `${run}_prefer_new`);
      const preferNewSnapshot = await conflictSnapshot(
        composition,
        scope.bot_id,
        preferNewId,
      );
      const preferNewRequest = resolveRequest(
        scope,
        preferNewSnapshot,
        `${run}_prefer_new`,
        "prefer_new",
      );
      const resolved = await application.resolveConflict(
        principal,
        preferNewId,
        preferNewRequest,
      );
      assert.equal(resolved.status, "resolved");
      assert.equal(resolved.event_ids.length, 5);
      const replay = await application.resolveConflict(
        principal,
        preferNewId,
        preferNewRequest,
      );
      assert.equal(replay.duplicate_replayed, true);
      assert.deepEqual(replay.event_ids, resolved.event_ids);
      const terminal = await conflictSnapshot(composition, scope.bot_id, preferNewId);
      assert.equal(terminal.status, "resolved");
      assert.equal(Number(terminal.conflict_version), 2);

      const correction = await application.submitDirectFeedback(principal, {
        schema_version: "memory.direct_feedback.v1",
        bot_id: scope.bot_id,
        target_type: "memory_point",
        target_id: terminal.new_point_id,
        action: "correct",
        expected_state_version: Number(terminal.new_point_version),
        idempotency_key: `feedback_${run}`,
        reason: "correct the winning point",
        correction: { content_summary: "corrected durable memory" },
        evidence_ref: `memory_point:${terminal.new_point_id}`,
      });
      assert.equal(correction.state_version, Number(terminal.new_point_version) + 1);
      const correctionReplay = await application.submitDirectFeedback(principal, {
        schema_version: "memory.direct_feedback.v1",
        bot_id: scope.bot_id,
        target_type: "memory_point",
        target_id: terminal.new_point_id,
        action: "correct",
        expected_state_version: Number(terminal.new_point_version),
        idempotency_key: `feedback_${run}`,
        reason: "correct the winning point",
        correction: { content_summary: "corrected durable memory" },
        evidence_ref: `memory_point:${terminal.new_point_id}`,
      });
      assert.equal(correctionReplay.duplicate_replayed, true);

      const feedbackId = await seedConflict(core, principal, `${run}_feedback`);
      const feedbackSnapshot = await conflictSnapshot(composition, scope.bot_id, feedbackId);
      const feedbackRequest = resolveRequest(
        scope,
        feedbackSnapshot,
        `${run}_feedback`,
        "request_feedback",
      );
      const feedback = await application.resolveConflict(
        principal,
        feedbackId,
        feedbackRequest,
      );
      assert.equal(feedback.status, "feedback_requested");
      assert.ok(feedback.feedback_suggestion_outbox_id);
      const feedbackReplay = await application.resolveConflict(
        principal,
        feedbackId,
        feedbackRequest,
      );
      assert.equal(feedbackReplay.duplicate_replayed, true);

      const splitId = await seedConflict(core, principal, `${run}_split`);
      const splitSnapshot = await conflictSnapshot(composition, scope.bot_id, splitId);
      const split = await application.resolveConflict(
        principal,
        splitId,
        resolveRequest(scope, splitSnapshot, `${run}_split`, "keep_both", {
          keep_both_plan: {
            mode: "split_scope_dual_active",
            old_scope_key: "global",
            new_scope_key: "staging",
          },
        }),
      );
      assert.equal(split.resolution_code, "keep_both_split_scope");
      assert.notEqual(
        split.series_transitions[0].topic_key,
        split.series_transitions[1].topic_key,
      );

      const durable = await composition.read_committed_postgres.withReadCommittedTransaction(
        async (transaction) => {
          const command = await transaction.query(
            `SELECT request_payload,status FROM memory.memory_command_outbox WHERE id=$1`,
            [feedback.feedback_suggestion_outbox_id],
          );
          const aliases = await transaction.query(
            `SELECT old_topic_key,new_topic_key FROM memory.topic_key_aliases WHERE bot_id=$1`,
            [scope.bot_id],
          );
          const events = await transaction.query(
            `SELECT id,event_type,schema_version,producer,occurred_at,idempotency_key,trace_id,payload
               FROM memory.memory_event_outbox
              WHERE bot_id=$1 AND id=ANY($2::text[])`,
            [scope.bot_id, [...resolved.event_ids, correction.event_ids[0]]],
          );
          return { command: command.rows[0], aliases: aliases.rows, events: events.rows };
        },
      );
      assert.equal(durable.command.status, "pending");
      assert.equal(durable.command.request_payload.source_service, "memory_service");
      assert.equal(durable.aliases.length, 1);
      assert.equal(durable.events.length, 6);
      for (const event of durable.events) {
        assert.equal(
          Value.Check(MemoryEventEnvelopeV1Schema, {
            event_id: event.id,
            event_type: event.event_type,
            schema_version: event.schema_version,
            producer: event.producer,
            occurred_at: new Date(event.occurred_at).toISOString(),
            idempotency_key: event.idempotency_key,
            trace_id: event.trace_id,
            payload: event.payload,
          }),
          true,
          `invalid durable Memory event ${event.id}`,
        );
      }
    } finally {
      try {
        await composition?.close();
      } finally {
        await runtime.release();
      }
    }
  },
);

test(
  "PostgreSQL Memory integration worker claims atomically and applies a durable decay change",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    const runtime = await acquireMemoryRuntimeDatabaseV1(databaseUrl);
    let composition;
    try {
      composition = await openVerifiedOwnerPostgresCompositionV1(
        MEMORY_REPOSITORY_CONTRACT_V1,
        runtime.database_url,
      );
      const run = `${Date.now().toString(36)}_${process.pid}`;
      const scope = Object.freeze({
        workspace_id: `workspace_integration_${run}`,
        bot_id: `bot_integration_${run}`,
        owner_agent_id: `agent_integration_${run}`,
        deployment_environment: "local",
        release_channel: "stable",
      });
      const writerPrincipal = Object.freeze({
        caller: "meta_cognition",
        capabilities: Object.freeze(["memory.write"]),
        scope,
      });
      const integrationPrincipal = Object.freeze({
        caller: "memory",
        capabilities: Object.freeze([
          "memory.integration.run",
          "memory.integration.operator",
        ]),
        scope,
      });
      const core = new MemoryApplicationV1(
        createPostgresMemoryStateRepositoryV1(composition),
        embedding,
      );
      const application = new PostgresMemoryHttpApplicationV1(
        core,
        composition,
        embedding,
        "memory-integration-test-secret-at-least-32-bytes",
      );
      const request = {
        schema_version: "memory.write_batch.v1",
        bot_id: scope.bot_id,
        trigger_process_id: `process_integration_${run}`,
        source_meta_job_id: `meta_integration_${run}`,
        idempotency_key: `batch_integration_${run}`,
        items: [
          {
            ...item(`integration_${run}`, "old low importance memory"),
            confidence_score: 0.1,
            occurred_at: "2025-01-01T00:00:00.000Z",
          },
        ],
      };
      const written = await core.writeBatch(writerPrincipal, request, {
        raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
        now: new Date("2026-07-28T00:00:00.000Z"),
      });
      assert.equal(written.item_results.length, 1);
      assert.equal(written.item_results[0].status, "succeeded");
      const pointId = written.item_results[0].memory_point_id;
      const seriesId = written.item_results[0].series_id;
      const created = await application.createIntegrationJob(
        integrationPrincipal,
        {
          schema_version: "memory.integration_run.v1",
          bot_id: scope.bot_id,
          scope: { series_ids: [seriesId] },
          mode: "decay",
          dry_run: false,
          idempotency_key: `integration_decay_${run}`,
          expected_policy_version: "memory.integration_policy.v1",
        },
      );
      const worker = createMemoryIntegrationWorkerV1({
        application,
        composition,
        embedding,
        queue: createPostgresMemoryIntegrationQueueV1(
          composition.postgres,
        ),
        worker_id: `memory-integration-test-${process.pid}`,
        queued_batch_size: 10,
        change_batch_size: 2,
      });
      await worker.runOnce();
      const completed = await application.getIntegrationJob(
        integrationPrincipal,
        scope.bot_id,
        created.integration_job_id,
      );
      assert.equal(completed.status, "completed");
      assert.equal(completed.applied_counts.decay_point, 1);
      const proof = await composition.postgres.query(
        `SELECT point.status,point.state_version,
                (SELECT count(*)::int
                   FROM memory.memory_integration_change_receipts
                  WHERE integration_job_id=$2) AS receipt_count
           FROM memory.memory_points AS point
          WHERE point.id=$1`,
        [pointId, created.integration_job_id],
      );
      assert.deepEqual(proof.rows[0], {
        status: "downgraded",
        state_version: "2",
        receipt_count: 1,
      });
      await worker.close();
    } finally {
      try {
        await composition?.close();
      } finally {
        await runtime.release();
      }
    }
  },
);
