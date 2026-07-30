import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ToolPermissionProfileCurrentReadContractV1Schema,
  assertToolPermissionProfileCurrentReadBindingV1,
} from "../../src/action-runtime/tool-permission-profile-current-read.v1.js";

const selector = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "prod" as const,
  release_channel: "stable" as const,
};
const request = {
  schema_version: "tool_permission_profile_current_read_request.v1" as const,
  selector,
  trace_id: "trace-1",
};
const success = {
  code: "tool_permission_profile_current" as const,
  message: "current profile",
  retryable: false as const,
  details: {
    profile: {
      schema_version: "tool_permission_profile.v1" as const,
      selector,
      profile_ref: "tool-profile:7",
      revision: 7,
      profile_hash: `sha256:${"a".repeat(64)}`,
      allowed_tools: [],
      tool_arg_constraints: {},
      resource_scopes: {},
      network_scope: {},
      filesystem_scope: {},
      timer_scope: {},
      memory_scope: {},
      policy_epoch: 4,
      effective_at: "2026-07-27T00:00:00Z",
    },
    pointer_version: 9,
  },
  trace_id: "trace-1",
};

describe("TP -> Action Runtime current ToolPermissionProfile", () => {
  it("requires the complete five-tuple and preserves owner identity", () => {
    expect(Value.Check(ToolPermissionProfileCurrentReadContractV1Schema, request)).toBe(true);
    expect(Value.Check(ToolPermissionProfileCurrentReadContractV1Schema, success)).toBe(true);
    expect(() =>
      assertToolPermissionProfileCurrentReadBindingV1(request, success),
    ).not.toThrow();
    expect(() =>
      assertToolPermissionProfileCurrentReadBindingV1(request, {
        ...success,
        details: {
          ...success.details,
          profile: {
            ...success.details.profile,
            selector: { ...selector, bot_id: "other-bot" },
          },
        },
      }),
    ).toThrow(/scope binding mismatch/u);
  });

  it("keeps scope denial indistinguishable from hidden resources", () => {
    expect(
      Value.Check(ToolPermissionProfileCurrentReadContractV1Schema, {
        code: "authorization_scope_mismatch",
        message: "scope mismatch",
        retryable: false,
        details: {},
        trace_id: "trace-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(ToolPermissionProfileCurrentReadContractV1Schema, {
        ...request,
        selector: { workspace_id: "workspace-1", bot_id: "bot-1" },
      }),
    ).toBe(false);
  });
});
