import { randomUUID } from "node:crypto";

import {
  canonicalPayloadHashV1,
  createRedisNamespaceV1,
  openVerifiedRedisStreamCompositionV1,
} from "@pai/eventing";
import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { describe, expect, it } from "vitest";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "../src/db/permission-manifest.v1.js";
import { openActionRuntimeSkillProjectionRuntimeV1 } from "../src/skill-security-projection-runtime.v1.js";
import { createPostgresRuntimeSkillSecurityProjectionV1 } from "../src/skill-security-projection.v1.js";

const databaseUrl =
  process.env.PAI_ACTION_RUNTIME_PROJECTION_INTEGRATION_DATABASE_URL;
const redisUrl = process.env.PAI_TEST_REDIS_URL;
const describeIntegration =
  databaseUrl === undefined || redisUrl === undefined ? describe.skip : describe;

describeIntegration("Action Runtime Redis + PostgreSQL skill projection", () => {
  it("consumes the global Skill epoch event and exposes a fresh durable checkpoint", async () => {
    if (databaseUrl === undefined || redisUrl === undefined) {
      throw new Error("projection integration dependencies are required");
    }
    const composition = await openVerifiedOwnerPostgresCompositionV1(
      ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
      databaseUrl,
    );
    const suffix = randomUUID().replaceAll("-", "");
    const current = await composition.postgres.query<{
      security_revocation_epoch: string | number;
      stream_epoch: string | null;
      stream_generation: string | number | null;
    }>(`SELECT security_revocation_epoch::text AS security_revocation_epoch,
              stream_epoch,
              stream_generation::text AS stream_generation
          FROM action_runtime.runtime_skill_security_projection
         WHERE singleton_key = 'global'`);
    const currentRow = current.rows[0];
    const streamEpoch = currentRow?.stream_epoch ?? `projection_${suffix}`;
    const streamGeneration =
      currentRow?.stream_generation === null ||
      currentRow?.stream_generation === undefined
        ? 1
        : Number(currentRow.stream_generation);
    const projection = createPostgresRuntimeSkillSecurityProjectionV1({
      postgres: composition.postgres,
      stream_epoch: streamEpoch,
      stream_generation: streamGeneration,
      maximum_staleness_seconds: 30,
    });
    const runtime = await openActionRuntimeSkillProjectionRuntimeV1({
      redis_url: redisUrl,
      deployment_environment: "local",
      release_channel: "stable",
      stream_epoch: streamEpoch,
      stream_generation: streamGeneration,
      projection,
      consumer_name: `projection_${suffix}`,
      poll_interval_ms: 10_000,
    });
    const producer = await openVerifiedRedisStreamCompositionV1({
      url: redisUrl,
      namespace: createRedisNamespaceV1({
        deployment_environment: "local",
        release_channel: "stable",
        owner_service: "skill_registry",
        stream_epoch: streamEpoch,
        stream_generation: streamGeneration,
      }),
      routes: {
        "action_runtime.skill_projection": "consumer:action_runtime",
      },
    });
    try {
      const previousEpoch = Number(
        currentRow?.security_revocation_epoch,
      );
      expect(Number.isSafeInteger(previousEpoch)).toBe(true);
      const nextEpoch = previousEpoch + 1;
      const event = Object.freeze({
        event_id: `skill-security-event:${suffix}`,
        event_type: "skill.security_revocation_epoch.changed" as const,
        schema_version: "skill_registry_event.v1" as const,
        producer: "skill_registry" as const,
        occurred_at: new Date().toISOString(),
        idempotency_key: `skill-security-epoch:${nextEpoch}:${suffix}`,
        trace_id: `trace:${suffix}`,
        payload: Object.freeze({
          scope_kind: "global" as const,
          actor_principal_id: "operator-1",
          reason_code: "emergency_revocation",
          previous_security_revocation_epoch: previousEpoch,
          security_revocation_epoch: nextEpoch,
          affected_skill_ids: Object.freeze([]),
          affected_version_ids: Object.freeze([]),
          emergency: true,
        }),
      });
      await producer.transport.publish({
        target: "action_runtime.skill_projection",
        envelope: event,
        payload_hash: canonicalPayloadHashV1(event.payload),
        current_transport_epoch: streamEpoch,
        current_transport_generation: streamGeneration,
      });
      await runtime.runOnce();
      runtime.start();
      await runtime.checkReadiness(new AbortController().signal);
      await expect(
        projection.policy_checkpoints.check({
          schema_version: "runtime_policy_checkpoint.v1",
          checkpoint: "skill_load",
          runtime_run_id: `run:${suffix}`,
          policy_snapshot_id: `policy:${suffix}`,
          workspace_id: "workspace-1",
          bot_id: "bot-1",
          owner_agent_id: "agent-1",
          deployment_environment: "local",
          release_channel: "stable",
          expected_security_revocation_epoch: nextEpoch,
          policy_expires_at: new Date(Date.now() + 60_000).toISOString(),
          checked_at: new Date().toISOString(),
        }),
      ).resolves.toMatchObject({
        status: "valid",
        current_security_revocation_epoch: nextEpoch,
      });
    } finally {
      await runtime.close();
      await producer.close();
      await composition.close();
    }
  });
});
