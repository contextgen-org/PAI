import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SkillContextCatalogContractV1Schema,
  assertSkillContextCatalogBindingsV1,
} from "../../src/skill-registry/context-catalog.v1.js";

const request = {
  schema_version: "skill_context_catalog_request.v1" as const,
  workspace_id: "workspace-1",
  bot_id: "bot-1",
  owner_agent_id: "agent-1",
  deployment_environment: "prod" as const,
  release_channel: "stable" as const,
  limit: 500,
  trace_id: "trace-1",
};

const response = {
  code: "skill_context_catalog_found" as const,
  message: "context catalog found",
  retryable: false as const,
  trace_id: "trace-1",
  details: {
    schema_version: "skill_context_catalog_response.v1" as const,
    workspace_id: "workspace-1",
    bot_id: "bot-1",
    owner_agent_id: "agent-1",
    deployment_environment: "prod" as const,
    release_channel: "stable" as const,
    catalog_version: "catalog-1",
    as_of: "2026-07-28T00:00:00.000Z",
    items: [
      {
        skill_key: "summarize",
        name: "Summarize",
        description: "Produces a bounded summary.",
        active_version: "skill-version-1",
        package_digest: `sha256:${"a".repeat(64)}`,
        manifest_digest: `sha256:${"b".repeat(64)}`,
        runtime_target: "filesystem_bundle.v1" as const,
      },
    ],
  },
};

describe("TP -> Skill Registry context catalog", () => {
  it("binds exact immutable package facts to the bot scope", () => {
    expect(Value.Check(SkillContextCatalogContractV1Schema, request)).toBe(true);
    expect(Value.Check(SkillContextCatalogContractV1Schema, response)).toBe(true);
    expect(() => assertSkillContextCatalogBindingsV1(request, response)).not.toThrow();
    expect(() =>
      assertSkillContextCatalogBindingsV1(request, {
        ...response,
        details: { ...response.details, bot_id: "other-bot" },
      }),
    ).toThrow(/scope binding mismatch/u);
  });
});
