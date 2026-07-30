import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SkillContentRequestV1Schema,
  SkillContentResponseV1Schema,
  assertSkillContentResponseSemanticBindingsV1,
} from "../../src/index.js";

const hash = `sha256:${"b".repeat(64)}` as const;

describe("SkillContentContractV1", () => {
  it("binds signed content to one resolution, package, manifest and five-minute cap", () => {
    const request = {
      schema_version: "skill_content_request.v1",
      resolution_id: "resolution_01",
      runtime_run_id: "run_01",
      workspace_id: "ws_01",
      bot_id: "bot_01",
      owner_agent_id: "agent_01",
      deployment_environment: "prod",
      release_channel: "stable",
      expected_package_digest: hash,
      expected_manifest_digest: hash,
      security_revocation_epoch: 4,
      trace_id: "trace_01",
    } as const;
    const response = {
      code: "skill_content_authorized",
      message: "authorized",
      retryable: false,
      trace_id: "trace_01",
      details: {
        content_ref: "signed:content:01",
        content_type: "application/zip",
        size_bytes: 10,
        package_digest: hash,
        manifest_digest: hash,
        entrypoint: "SKILL.md",
        expires_at: "2026-07-24T00:05:00.000Z",
        runtime_target: "filesystem_bundle.v1",
      },
    } as const;
    expect(Value.Check(SkillContentRequestV1Schema, request)).toBe(true);
    expect(Value.Check(SkillContentResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertSkillContentResponseSemanticBindingsV1(
        request,
        response,
        "2026-07-24T01:00:00.000Z",
        Date.parse("2026-07-24T00:00:00.000Z"),
      ),
    ).not.toThrow();
    expect(() =>
      assertSkillContentResponseSemanticBindingsV1(
        request,
        {
          ...response,
          details: {
            ...response.details,
            expires_at: "2026-07-24T00:05:00.001Z",
          },
        },
        "2026-07-24T01:00:00.000Z",
        Date.parse("2026-07-24T00:00:00.000Z"),
      ),
    ).toThrow(/semantic binding/u);
  });

  it("rejects credentials and inline files in the body", () => {
    expect(
      Value.Check(SkillContentRequestV1Schema, {
        schema_version: "skill_content_request.v1",
        resolution_id: "resolution_01",
        runtime_run_id: "run_01",
        workspace_id: "ws_01",
        bot_id: "bot_01",
        deployment_environment: "prod",
        release_channel: "stable",
        expected_package_digest: hash,
        expected_manifest_digest: hash,
        security_revocation_epoch: 1,
        trace_id: "trace_01",
        service_credential: "spoofed",
      }),
    ).toBe(false);
  });
});
