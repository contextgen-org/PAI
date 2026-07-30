import { describe, expect, it, vi } from "vitest";

import { createTriggerObjectAccessPolicyV1 } from "../src/production-object-access-policy.v1.js";

const retentionUntil = "2026-08-30T00:00:00.000Z";
const contextRequest = {
  trigger_process_id: "process-1",
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
  context_snapshot_ref: "objv1_context" as never,
  context_snapshot_version: 3,
  context_snapshot_hash: `sha256:${"a".repeat(64)}`,
  purpose: "intent_synthesis" as const,
};

function policy() {
  const postgres = {
    query: vi.fn().mockResolvedValue({ rows: [{ retention_until: retentionUntil }] }),
  };
  return {
    postgres,
    access: createTriggerObjectAccessPolicyV1({
      postgres: postgres as never,
      hmac_secret: "h".repeat(32),
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    }),
  };
}

describe("Trigger ObjectStore access policy", () => {
  it("issues a Context decision that verifies against the canonical bot scope", async () => {
    const { access } = policy();
    const decision = await access.context_snapshots.resolve(contextRequest);

    await expect(
      access.verifier.verify({
        access_decision_ref: decision.access_decision_ref,
        operation: "get",
        object_ref: contextRequest.context_snapshot_ref,
        owner_service: "trigger_processor",
        owner_object_id: contextRequest.trigger_process_id,
        owner_state_version: contextRequest.context_snapshot_version,
        scope: {
          scope_kind: "bot",
          workspace_id: contextRequest.workspace_id,
          bot_id: contextRequest.bot_id,
          owner_agent_id: contextRequest.owner_agent_id,
          deployment_environment: contextRequest.deployment_environment,
          release_channel: contextRequest.release_channel,
        },
        scope_fingerprint: "unused-by-owner-policy",
        capability: "trigger_process.snapshot.resolve",
        retention_policy_version: decision.retention_policy_version,
        redaction_policy_version: decision.redaction_policy_version,
      }),
    ).resolves.toMatchObject({ authorized: true, retention_until: retentionUntil });
  });

  it("does not make a Context decision reusable for another bot", async () => {
    const { access } = policy();
    const decision = await access.context_snapshots.resolve(contextRequest);

    await expect(
      access.verifier.verify({
        access_decision_ref: decision.access_decision_ref,
        operation: "get",
        object_ref: contextRequest.context_snapshot_ref,
        owner_service: "trigger_processor",
        owner_object_id: contextRequest.trigger_process_id,
        owner_state_version: contextRequest.context_snapshot_version,
        scope: {
          scope_kind: "bot",
          workspace_id: contextRequest.workspace_id,
          bot_id: "bot-other",
          owner_agent_id: contextRequest.owner_agent_id,
          deployment_environment: contextRequest.deployment_environment,
          release_channel: contextRequest.release_channel,
        },
        scope_fingerprint: "unused-by-owner-policy",
        capability: "trigger_process.snapshot.resolve",
        retention_policy_version: decision.retention_policy_version,
        redaction_policy_version: decision.redaction_policy_version,
      }),
    ).rejects.toThrow(/binding mismatch/u);
  });
});
