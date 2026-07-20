import { describe, expect, it } from "vitest";

import { validateWorkloadCredentialClaimsV1 } from "../../src/index.js";

const baseClaims = {
  iss: "pai-workload" as const,
  sub: "trigger_processor" as const,
  aud: "action_runtime" as const,
  jti: "jti_01",
  iat: 100,
  nbf: 100,
  exp: 400,
  capability: ["runtime.read", "runtime.start"],
  scope_kind: "bot" as const,
  workspace_id: "workspace_01",
  bot_id: "bot_01",
  owner_agent_id: "agent_01",
  deployment_environment: "dev" as const,
  release_channel: "stable" as const,
};

describe("WorkloadCredentialClaimsV1", () => {
  it("accepts a 300-second bot-scoped token", () => {
    expect(validateWorkloadCredentialClaimsV1(baseClaims)).toEqual({
      ok: true,
      value: baseClaims,
    });
  });

  it("rejects array audience, service aliases, and excessive TTL", () => {
    const badShape = validateWorkloadCredentialClaimsV1({
      ...baseClaims,
      aud: ["action_runtime"],
      sub: "trigger-processor",
    });
    expect(badShape.ok).toBe(false);

    const badTtl = validateWorkloadCredentialClaimsV1({
      ...baseClaims,
      exp: 401,
    });
    expect(badTtl).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "credential_ttl_exceeded" }),
      ]),
    });
  });

  it("rejects a future iat paired with an already-active nbf", () => {
    expect(
      validateWorkloadCredentialClaimsV1({
        ...baseClaims,
        iat: 200,
        nbf: 100,
        exp: 400,
      }),
    ).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "invalid_time_window" }),
      ]),
    });
  });

  it("rejects unsorted capabilities and delegated scope drift", () => {
    const result = validateWorkloadCredentialClaimsV1({
      ...baseClaims,
      capability: ["runtime.start", "runtime.read"],
      delegated_principal: {
        principal_type: "developer",
        principal_id: "developer_01",
        roles: ["reviewer"],
        source_issuer: "supabase",
        source_subject: "user_01",
        auth_time: 100,
        scope_kind: "bot",
        workspace_id: "workspace_01",
        bot_id: "another_bot",
        owner_agent_id: "agent_01",
        deployment_environment: "dev",
        release_channel: "stable",
      },
    });
    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "capability_not_sorted" }),
        expect.objectContaining({
          code: "authorization_scope_mismatch",
          fieldPath: "/delegated_principal/bot_id",
        }),
      ]),
    });
  });
});
