import { randomUUID } from "node:crypto";

import { createDurableInboxConsumerV1 } from "@pai/eventing";
import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "../src/db/permission-manifest.v1.js";
import { createPostgresRuntimeSkillSecurityProjectionV1 } from "../src/skill-security-projection.v1.js";

const databaseUrl = process.env.PAI_ACTION_RUNTIME_TEST_DATABASE_URL;

describe.skipIf(databaseUrl === undefined)(
  "Action Runtime durable Skill security projection (PostgreSQL)",
  () => {
    let composition: Awaited<
      ReturnType<typeof openVerifiedOwnerPostgresCompositionV1>
    >;

    beforeAll(async () => {
      composition = await openVerifiedOwnerPostgresCompositionV1(
        ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
        databaseUrl!,
      );
    });

    afterAll(async () => {
      await composition?.close();
    });

    it("atomically advances the epoch, fails closed before stream sync, and replays", async () => {
      const current = await composition.postgres.query<{
        security_revocation_epoch: string;
      }>(
        `SELECT security_revocation_epoch::text AS security_revocation_epoch
           FROM action_runtime.runtime_skill_security_projection
          WHERE singleton_key = 'global'`,
      );
      const previousEpoch = Number(current.rows[0]!.security_revocation_epoch);
      const nextEpoch = previousEpoch + 1;
      const projection = createPostgresRuntimeSkillSecurityProjectionV1({
        postgres: composition.postgres,
        stream_epoch: "delivery_test",
        stream_generation: 1,
        maximum_staleness_seconds: 30,
      });
      const consumer = createDurableInboxConsumerV1(projection.inbox, {
        consumer_service: "action_runtime",
      });
      const suffix = randomUUID();
      const occurredAt = new Date().toISOString();
      const envelope = Object.freeze({
        event_id: `skill-security-event:${suffix}`,
        event_type: "skill.security_revocation_epoch.changed",
        schema_version: "skill_registry_event.v1",
        producer: "skill_registry",
        occurred_at: occurredAt,
        idempotency_key: `skill-security-epoch:${nextEpoch}:${suffix}`,
        trace_id: `trace:${suffix}`,
        payload: Object.freeze({
          scope_kind: "global",
          actor_principal_id: "operator-1",
          reason_code: "emergency_revocation",
          previous_security_revocation_epoch: previousEpoch,
          security_revocation_epoch: nextEpoch,
          affected_skill_ids: Object.freeze([]),
          affected_version_ids: Object.freeze([]),
          emergency: true,
        }),
      });

      await expect(consumer.consume(envelope)).resolves.toEqual({
        status: "processed",
      });
      await expect(
        projection.policy_checkpoints.check({
          schema_version: "runtime_policy_checkpoint.v1",
          checkpoint: "worker_claim",
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
      ).rejects.toThrow(/not synchronized/u);

      await projection.markSynchronized(`sync:${suffix}`);
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
      await expect(consumer.consume(envelope)).resolves.toEqual({
        status: "replayed",
      });

      const gapEnvelope = {
        ...envelope,
        event_id: `skill-security-gap:${suffix}`,
        idempotency_key: `skill-security-gap:${suffix}`,
        payload: {
          ...envelope.payload,
          previous_security_revocation_epoch: nextEpoch + 1,
          security_revocation_epoch: nextEpoch + 2,
        },
      };
      await expect(consumer.consume(gapEnvelope)).rejects.toThrow(
        /projection gap or regression/u,
      );
    });
  },
);
