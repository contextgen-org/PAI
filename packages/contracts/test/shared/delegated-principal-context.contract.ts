import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  DelegatedPrincipalContextV1Schema,
  DeploymentEnvironmentV1Schema,
  ReleaseChannelV1Schema,
} from "../../src/index.js";

describe("DelegatedPrincipalContextV1", () => {
  it("rejects global principals that smuggle bot tuple fields", () => {
    expect(
      Value.Check(
        DelegatedPrincipalContextV1Schema,
        [DeploymentEnvironmentV1Schema, ReleaseChannelV1Schema],
        {
          principal_type: "operator",
          principal_id: "operator_01",
          roles: ["operator"],
          source_issuer: "supabase",
          source_subject: "user_01",
          auth_time: 100,
          scope_kind: "global",
          bot_id: "bot_01",
        },
      ),
    ).toBe(false);
  });

  it("rejects auth timestamps that cannot round-trip through JavaScript", () => {
    expect(
      Value.Check(
        DelegatedPrincipalContextV1Schema,
        [DeploymentEnvironmentV1Schema, ReleaseChannelV1Schema],
        {
          principal_type: "operator",
          principal_id: "operator_01",
          roles: ["operator"],
          source_issuer: "supabase",
          source_subject: "user_01",
          auth_time: Number.MAX_SAFE_INTEGER + 1,
          scope_kind: "global",
        },
      ),
    ).toBe(false);
  });
});
