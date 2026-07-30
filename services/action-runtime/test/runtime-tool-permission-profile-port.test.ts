import { createHash } from "node:crypto";

import {
  toolPermissionProfileCanonicalBytesV1,
  type ToolPermissionProfileV1,
} from "@pai/contracts";
import type { PostgresQueryPortV1 } from "@pai/persistence";
import { describe, expect, it, vi } from "vitest";

import { createPostgresRuntimeToolPermissionProfilePortV1 } from "../src/db/runtime-tool-permission-profile-port.v1.js";
import { RuntimeExecutionErrorV1 } from "../src/runtime-execution.v1.js";

function sha256V1(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function profileV1(
  toolArgConstraints: Readonly<Record<string, unknown>> = {},
): ToolPermissionProfileV1 {
  const unhashed: ToolPermissionProfileV1 = {
    schema_version: "tool_permission_profile.v1",
    selector: {
      workspace_id: "workspace-live",
      bot_id: "bot-live",
      owner_agent_id: "agent-live",
      deployment_environment: "local",
      release_channel: "stable",
    },
    profile_ref: "tool-profile:live",
    revision: 1,
    profile_hash: `sha256:${"0".repeat(64)}`,
    allowed_tools: ["search"],
    tool_arg_constraints: { ...toolArgConstraints },
    resource_scopes: {},
    network_scope: {},
    filesystem_scope: {},
    timer_scope: {},
    memory_scope: {},
    policy_epoch: 1,
    effective_at: "2026-07-27T00:00:00.000Z",
  };
  return {
    ...unhashed,
    profile_hash: sha256V1(toolPermissionProfileCanonicalBytesV1(unhashed)),
  };
}

function rowV1(profile: ToolPermissionProfileV1) {
  return {
    ...profile.selector,
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
    effective_at: profile.effective_at,
  };
}

function requestV1(profile: ToolPermissionProfileV1) {
  return {
    ...profile.selector,
    profile_ref: profile.profile_ref,
    revision: profile.revision,
    profile_hash: profile.profile_hash,
    policy_epoch: profile.policy_epoch,
  };
}

describe("PostgreSQL exact runtime ToolPermissionProfile port", () => {
  it("binds the immutable owner identity and enforces supported max_bytes", async () => {
    const profile = profileV1({ search: { max_bytes: 16 } });
    const query = vi.fn(async () => ({ rows: [rowV1(profile)] }));
    const port = createPostgresRuntimeToolPermissionProfilePortV1({
      query,
    } as PostgresQueryPortV1);

    const resolved = await port.resolveExact(requestV1(profile));

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      [
        "workspace-live",
        "bot-live",
        "agent-live",
        "local",
        "stable",
        "tool-profile:live",
        "1",
        profile.profile_hash,
        "1",
      ],
    );
    expect(resolved.validateArguments("search", { q: "x" })).toBe(true);
    expect(resolved.validateArguments("search", { query: "0123456789" })).toBe(
      false,
    );
    expect(resolved.validateArguments("unknown", {})).toBe(false);
  });

  it("fails closed for constraint keys without an owner-defined meaning", async () => {
    const profile = profileV1({ search: { invented_allow: true } });
    const port = createPostgresRuntimeToolPermissionProfilePortV1({
      async query() {
        return { rows: [rowV1(profile)] };
      },
    });

    const resolved = await port.resolveExact(requestV1(profile));
    expect(resolved.validateArguments("search", {})).toBe(false);
  });

  it("rejects missing or hash-drifted exact owner artifacts", async () => {
    const profile = profileV1();
    const missing = createPostgresRuntimeToolPermissionProfilePortV1({
      async query() {
        return { rows: [] };
      },
    });
    await expect(missing.resolveExact(requestV1(profile))).rejects.toMatchObject({
      code: "tool_policy_denied",
      retryable: false,
    });

    const drifted = createPostgresRuntimeToolPermissionProfilePortV1({
      async query() {
        return { rows: [{ ...rowV1(profile), allowed_tools: ["other"] }] };
      },
    });
    await expect(drifted.resolveExact(requestV1(profile))).rejects.toMatchObject({
      code: "tool_policy_denied",
    });
  });

  it("maps storage failures as retryable and preserves AbortSignal cancellation", async () => {
    const profile = profileV1();
    const unavailable = createPostgresRuntimeToolPermissionProfilePortV1({
      async query() {
        throw new Error("database unavailable");
      },
    });
    await expect(unavailable.resolveExact(requestV1(profile))).rejects.toMatchObject({
      code: "reservation_unavailable",
      retryable: true,
    });

    const controller = new AbortController();
    const reason = new Error("cancelled");
    controller.abort(reason);
    await expect(
      unavailable.resolveExact(requestV1(profile), controller.signal),
    ).rejects.toBe(reason);
  });

  it("uses the runtime error type for exact owner failures", async () => {
    const profile = profileV1();
    const port = createPostgresRuntimeToolPermissionProfilePortV1({
      async query() {
        return { rows: [] };
      },
    });
    await expect(port.resolveExact(requestV1(profile))).rejects.toBeInstanceOf(
      RuntimeExecutionErrorV1,
    );
  });
});
