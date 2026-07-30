import { createHash } from "node:crypto";

import type { VerifiedWorkloadCredential } from "@pai/auth";
import {
  toolPermissionProfileCanonicalBytesV1,
  type ToolPermissionProfileV1,
} from "@pai/contracts";
import { describe, expect, it, vi } from "vitest";

import { buildActionRuntimeApp } from "../src/app.js";
import { createPostgresToolPermissionProfileCurrentReadRepositoryV1 } from "../src/db/tool-permission-profile-current-read-repository.v1.js";
import {
  ToolPermissionProfileCurrentReadErrorV1,
  createToolPermissionProfileCurrentReadApplicationV1,
  type ToolPermissionProfileCurrentOwnerRowV1,
} from "../src/tool-permission-profile-current-read.v1.js";

const selector = {
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
};

function row(
  overrides: Partial<ToolPermissionProfileCurrentOwnerRowV1> = {},
): ToolPermissionProfileCurrentOwnerRowV1 {
  const profile: ToolPermissionProfileV1 = {
    schema_version: "tool_permission_profile.v1",
    selector,
    profile_ref: "tool-profile:1",
    revision: 1,
    profile_hash: `sha256:${"0".repeat(64)}`,
    allowed_tools: ["calendar.read", "lark-doc"],
    tool_arg_constraints: {},
    resource_scopes: {},
    network_scope: { mode: "deny_all" },
    filesystem_scope: { mode: "isolated", write: false },
    timer_scope: { mode: "deny_all" },
    memory_scope: { mode: "read_none", write: false },
    policy_epoch: 1,
    effective_at: "2026-07-27T00:00:00.000Z",
  };
  profile.profile_hash = `sha256:${createHash("sha256")
    .update(toolPermissionProfileCanonicalBytesV1(profile), "utf8")
    .digest("hex")}`;
  return {
    ...selector,
    profile_ref: profile.profile_ref,
    revision: String(profile.revision),
    profile_hash: profile.profile_hash,
    allowed_tools: profile.allowed_tools,
    tool_arg_constraints: profile.tool_arg_constraints,
    resource_scopes: profile.resource_scopes,
    network_scope: profile.network_scope,
    filesystem_scope: profile.filesystem_scope,
    timer_scope: profile.timer_scope,
    memory_scope: profile.memory_scope,
    policy_epoch: String(profile.policy_epoch),
    pointer_version: "3",
    effective_at: profile.effective_at,
    ...overrides,
  };
}

const principal = {
  sub: "trigger_processor" as const,
  aud: "action_runtime" as const,
  capability: ["runtime.tool_permission_profile.current.read"],
  scope: selector,
};

function credential(): VerifiedWorkloadCredential {
  return {
    claims: {
      iss: "pai-workload",
      sub: "trigger_processor",
      aud: "action_runtime",
      jti: "credential-1",
      iat: 100,
      nbf: 100,
      exp: 200,
      capability: ["runtime.tool_permission_profile.current.read"],
      scope_kind: "bot",
      ...selector,
    },
    protectedHeader: { alg: "EdDSA", kid: "key-1", typ: "JWT" },
  };
}

describe("Action Runtime current ToolPermissionProfile owner read", () => {
  it("verifies scope, schema and canonical hash before returning the owner artifact", async () => {
    const findCurrent = vi.fn(async () => row());
    const application = createToolPermissionProfileCurrentReadApplicationV1({
      findCurrent,
    });
    const response = await application.readCurrent(
      principal,
      selector,
      "trace-1",
    );
    expect(response).toMatchObject({
      code: "tool_permission_profile_current",
      details: {
        profile: { profile_ref: "tool-profile:1", revision: 1 },
        pointer_version: 3,
      },
      trace_id: "trace-1",
    });
    expect(findCurrent).toHaveBeenCalledWith(
      selector,
      expect.any(AbortSignal),
    );
  });

  it("fails closed before owner lookup for a mismatched selector", async () => {
    const findCurrent = vi.fn(async () => row());
    const application = createToolPermissionProfileCurrentReadApplicationV1({
      findCurrent,
    });
    await expect(
      application.readCurrent(
        principal,
        { ...selector, bot_id: "other-bot" },
        "trace-1",
      ),
    ).rejects.toMatchObject<ToolPermissionProfileCurrentReadErrorV1>({
      code: "authorization_scope_mismatch",
    });
    expect(findCurrent).not.toHaveBeenCalled();
  });

  it("treats database/profile drift as a closed owner error", async () => {
    const application = createToolPermissionProfileCurrentReadApplicationV1({
      async findCurrent() {
        return row({ profile_hash: `sha256:${"f".repeat(64)}` });
      },
    });
    await expect(
      application.readCurrent(principal, selector, "trace-1"),
    ).rejects.toMatchObject<ToolPermissionProfileCurrentReadErrorV1>({
      code: "owner_contract_drift",
      retryable: false,
    });
  });

  it("binds the documented GET route to Trigger Processor workload auth", async () => {
    const requirements: unknown[] = [];
    const application = createToolPermissionProfileCurrentReadApplicationV1({
      async findCurrent() {
        return row();
      },
    });
    const app = buildActionRuntimeApp(
      {
        logger: false,
        auth: {
          verifier: {
            async verify(_value, expected) {
              requirements.push(expected);
              return credential();
            },
          },
        },
      },
      { tool_permission_profile_current_read: application },
    );
    const query = new URLSearchParams(selector).toString();
    const response = await app.inject({
      method: "GET",
      url: `/internal/runtime/tool-permission-profiles/current?${query}`,
      headers: {
        authorization: "Bearer aaa.bbb.ccc",
        "x-trace-id": "trace-route-1",
      },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      code: "tool_permission_profile_current",
      trace_id: "trace-route-1",
    });
    expect(requirements).toEqual([
      {
        audience: "action_runtime",
        allowedCallers: ["trigger_processor"],
        requiredCapabilities: [
          "runtime.tool_permission_profile.current.read",
        ],
      },
    ]);
    await app.close();
  });

  it("queries the immutable revision through the exact five-tuple pointer", async () => {
    const query = vi.fn(async () => ({ rows: [row()] }));
    const repository =
      createPostgresToolPermissionProfileCurrentReadRepositoryV1({
        query,
      });
    await repository.findCurrent(selector, new AbortController().signal);
    const [sql, values] = query.mock.calls[0] as unknown as [
      string,
      unknown[],
    ];
    expect(sql).toContain(
      "action_runtime.tool_permission_profile_current",
    );
    expect(sql).toContain(
      "action_runtime.tool_permission_profile_revisions",
    );
    expect(sql).toContain("r.profile_hash = c.profile_hash");
    expect(sql).toContain("r.policy_epoch = c.policy_epoch");
    expect(sql).toContain('YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    expect(values).toEqual([
      "workspace-1",
      "bot-1",
      "agent-1",
      "dev",
      "stable",
    ]);
  });
});
