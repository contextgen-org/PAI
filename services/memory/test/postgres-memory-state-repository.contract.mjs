import assert from "node:assert/strict";
import test from "node:test";

import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import { MEMORY_REPOSITORY_CONTRACT_V1 } from "../dist/db/permission-manifest.v1.js";
import { createPostgresMemoryStateRepositoryV1 } from "../dist/db/postgres-memory-state-repository.v1.js";
import {
  MemoryApplicationErrorV1,
  MemoryApplicationV1,
} from "../dist/memory-application.v1.js";
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

test(
  "PostgreSQL Memory write and search projection survive restart",
  { skip: databaseUrl === undefined },
  async () => {
    const runtime = await acquireMemoryRuntimeDatabaseV1(databaseUrl);
    let composition;
    try {
      composition = await openVerifiedOwnerPostgresCompositionV1(
        MEMORY_REPOSITORY_CONTRACT_V1,
        runtime.database_url,
      );
      const suffix = Date.now().toString(36);
      const scope = Object.freeze({
        workspace_id: `workspace_${suffix}`,
        bot_id: `bot_${suffix}`,
        owner_agent_id: `agent_${suffix}`,
        deployment_environment: "local",
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
      const request = Object.freeze({
        schema_version: "memory.write_batch.v1",
        bot_id: scope.bot_id,
        trigger_process_id: `process_${suffix}`,
        source_meta_job_id: `meta_${suffix}`,
        idempotency_key: `batch_${suffix}`,
        items: [
          {
            client_item_id: `item_${suffix}`,
            source_item_id: `source_${suffix}`,
            content_summary: "durable postgres memory",
            subject_refs: [
              {
                subject_type: "user",
                canonical_id: `user_${suffix}`,
                primary: true,
              },
            ],
            aspect_hint: "persistence",
            human_agent_relation: [],
            keyword_tags: ["postgres"],
            scene_tags: ["implementation"],
            emotion_tags: ["neutral"],
            source_info: {
              source_type: "trigger_snapshot",
              source_ref: `trigger_process:process_${suffix}`,
              actor_type: "user",
              actor_id: `user_${suffix}`,
            },
            confidence_score: 0.9,
            occurred_at: "2026-07-28T00:00:00.000Z",
          },
        ],
      });
      const firstApplication = new MemoryApplicationV1(
        createPostgresMemoryStateRepositoryV1(composition),
        embedding,
      );
      const created = await firstApplication.writeBatch(writer, request, {
        raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
        now: new Date("2026-07-28T00:00:01.000Z"),
      });
      assert.equal(created.batch_status, "completed");
      assert.equal(created.accepted_point_ids.length, 1);

      const restarted = new MemoryApplicationV1(
        createPostgresMemoryStateRepositoryV1(composition),
        embedding,
      );
      const replay = await restarted.writeBatch(writer, request, {
        raw_body_bytes: Buffer.byteLength(JSON.stringify(request)),
        now: new Date("2026-07-28T00:00:02.000Z"),
      });
      assert.equal(replay.duplicate_replayed, true);
      assert.deepEqual(replay.accepted_point_ids, created.accepted_point_ids);

      const recall = await restarted.fastRecall(
        reader,
        {
          schema_version: "memory.fast_recall.v1",
          bot_id: scope.bot_id,
          query: "durable postgres",
          query_purpose: "context_injection",
        },
        new Date("2026-07-28T00:00:03.000Z"),
      );
      assert.equal(recall.items.length, 1);
      assert.equal(recall.items[0].memory_point_id, created.accepted_point_ids[0]);

      const mismatchedScope = Object.freeze({
        ...scope,
        workspace_id: `other_workspace_${suffix}`,
        owner_agent_id: `other_agent_${suffix}`,
      });
      const mismatchedReader = Object.freeze({
        caller: "trigger_processor",
        capabilities: Object.freeze(["memory.read"]),
        scope: mismatchedScope,
      });
      await assert.rejects(
        () =>
          restarted.fastRecall(
            mismatchedReader,
            {
              schema_version: "memory.fast_recall.v1",
              bot_id: scope.bot_id,
              query: "durable postgres",
              query_purpose: "context_injection",
            },
            new Date("2026-07-28T00:00:04.000Z"),
          ),
        (error) =>
          error instanceof MemoryApplicationErrorV1 &&
          error.code === "forbidden" &&
          error.retryable === false,
      );
    } finally {
      try {
        await composition?.close();
      } finally {
        await runtime.release();
      }
    }
  },
);
