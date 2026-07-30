import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  RuntimePolicyInputReadArtifactV1Schema,
  assertRuntimePolicyInputReadArtifactBindingsV1,
  type RuntimePolicyInputReadArtifactV1,
} from "../../src/action-runtime/runtime-policy-input-read.v1.js";

const now = "2026-07-24T04:00:00.000Z";
const hash = `sha256:${"a".repeat(64)}` as const;
const scope = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
};

function artifact(
  overrides: Partial<RuntimePolicyInputReadArtifactV1> = {},
): RuntimePolicyInputReadArtifactV1 {
  const snapshot = {
    schema_version: "intent_policy_input_snapshot.v1" as const,
    snapshot_ref: "intent-policy:process-1:1",
    ...scope,
    bot_policy_revision_id: "bot-policy-r1",
    personality_ref: "personality:1",
    personality_version: 1,
    personality_hash: hash,
    safety_boundaries_ref: "safety:1",
    safety_boundaries_version: 1,
    safety_boundaries_hash: hash,
    tool_permission_profile_ref: "tool-profile:1",
    tool_permission_profile_revision: 1,
    tool_permission_profile_hash: hash,
    tool_policy_epoch: 1,
    catalog_version: "catalog-1",
    catalog_as_of: now,
    security_revocation_epoch: 1,
    skill_permission_summary_ref: "skill-permissions:1",
    skill_permission_summary_hash: hash,
    snapshot_hash: hash,
  };
  return {
    schema_version: "runtime_policy_input_read_artifact.v1",
    policy_input_ref: "policy-input:process-1:1",
    policy_input_hash: hash,
    trigger_process_id: "process-1",
    runtime_run_id: "run-1",
    start_attempt_no: 1,
    ...scope,
    expected_catalog_version: snapshot.catalog_version,
    catalog_as_of: snapshot.catalog_as_of,
    intent_policy_snapshot_ref: snapshot.snapshot_ref,
    intent_policy_snapshot_hash: snapshot.snapshot_hash,
    intent_policy_snapshot: snapshot,
    skill_permission_summary_ref: snapshot.skill_permission_summary_ref,
    skill_permission_summary_hash: snapshot.skill_permission_summary_hash,
    policy: {
      schema_version: "runtime_policy_input.v1",
      intent_policy_snapshot_ref: snapshot.snapshot_ref,
      intent_policy_snapshot_hash: snapshot.snapshot_hash,
      created_at: now,
      expires_at: "2026-07-24T05:00:00.000Z",
    },
    ...overrides,
  };
}

describe("RuntimePolicyInputReadContractV1", () => {
  it("accepts one owner artifact carrying canonical policy and all bindings", () => {
    const value = artifact();
    expect(Value.Check(RuntimePolicyInputReadArtifactV1Schema, value)).toBe(true);
    expect(() =>
      assertRuntimePolicyInputReadArtifactBindingsV1(
        value,
        Date.parse("2026-07-24T04:30:00.000Z"),
      ),
    ).not.toThrow();
  });

  it("rejects wrapper, snapshot and policy binding drift", () => {
    const value = artifact({ expected_catalog_version: "catalog-latest" });
    expect(Value.Check(RuntimePolicyInputReadArtifactV1Schema, value)).toBe(true);
    expect(() =>
      assertRuntimePolicyInputReadArtifactBindingsV1(
        value,
        Date.parse("2026-07-24T04:30:00.000Z"),
      ),
    ).toThrow(/binding mismatch/u);
  });

  it("rejects unknown fields and expired policies", () => {
    expect(
      Value.Check(RuntimePolicyInputReadArtifactV1Schema, {
        ...artifact(),
        caller_supplied_capabilities: ["admin"],
      }),
    ).toBe(false);
    expect(() =>
      assertRuntimePolicyInputReadArtifactBindingsV1(
        artifact(),
        Date.parse("2026-07-24T05:00:00.000Z"),
      ),
    ).toThrow(/lifetime is invalid/u);
  });
});
