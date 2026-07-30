import { createHash } from "node:crypto";

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ToolPermissionProfileV1Schema,
  assertToolPermissionProfileRevisionTransitionV1,
  assertToolPermissionProfileSemanticBindingsV1,
  toolPermissionProfileCanonicalBytesV1,
  type ToolPermissionProfileV1,
} from "../../src/action-runtime/tool-permission-profile.v1.js";

const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;

function profile(
  overrides: Partial<ToolPermissionProfileV1> = {},
): ToolPermissionProfileV1 {
  const unhashed = {
    schema_version: "tool_permission_profile.v1" as const,
    selector: {
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "prod" as const,
      release_channel: "stable" as const,
    },
    profile_ref: "tool-profile:1",
    revision: 1,
    profile_hash: `sha256:${"0".repeat(64)}`,
    allowed_tools: ["calendar.read", "lark-doc"],
    tool_arg_constraints: { "lark-doc": { max_bytes: 1_024 } },
    resource_scopes: { docs: ["workspace-1"] },
    network_scope: { mode: "deny_all" },
    filesystem_scope: { mode: "isolated", write: false },
    timer_scope: { mode: "deny_all" },
    memory_scope: { mode: "read_none", write: false },
    policy_epoch: 3,
    effective_at: "2026-07-27T00:00:00Z",
    ...overrides,
  } satisfies ToolPermissionProfileV1;
  return {
    ...unhashed,
    profile_hash: sha256(toolPermissionProfileCanonicalBytesV1(unhashed)),
  };
}

describe("ToolPermissionProfileV1", () => {
  it("binds the full selector and canonical profile hash", () => {
    const value = profile();
    expect(Value.Check(ToolPermissionProfileV1Schema, value)).toBe(true);
    expect(() =>
      assertToolPermissionProfileSemanticBindingsV1(value, sha256),
    ).not.toThrow();
    expect(() =>
      assertToolPermissionProfileSemanticBindingsV1(
        { ...value, allowed_tools: ["lark-doc", "calendar.read"] },
        sha256,
      ),
    ).toThrow(/code-point sorted/u);
  });

  it("rejects hash drift and unsafe revisions", () => {
    const first = profile();
    expect(() =>
      assertToolPermissionProfileSemanticBindingsV1(
        { ...first, policy_epoch: 4 },
        sha256,
      ),
    ).toThrow(/profile_hash mismatch/u);
    const second = profile({
      profile_ref: "tool-profile:2",
      revision: 2,
      policy_epoch: 4,
      effective_at: "2026-07-27T01:00:00Z",
    });
    expect(() =>
      assertToolPermissionProfileRevisionTransitionV1(first, second),
    ).not.toThrow();
    expect(() =>
      assertToolPermissionProfileRevisionTransitionV1(first, {
        ...second,
        policy_epoch: 2,
      }),
    ).toThrow(/transition mismatch/u);
  });

  it("caps JSON number identities at Number.MAX_SAFE_INTEGER", () => {
    expect(
      Value.Check(ToolPermissionProfileV1Schema, {
        ...profile(),
        revision: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
  });
});
