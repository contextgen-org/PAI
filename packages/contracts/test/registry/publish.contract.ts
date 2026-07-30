import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SkillPublishRequestV1Schema,
  SkillPublishResponseV1Schema,
  assertSkillPublishRequestSemanticBindingsV1,
  assertSkillPublishSemanticBindingsV1,
} from "../../src/index.js";

const hash = `sha256:${"d".repeat(64)}` as const;

describe("SkillPublishContractV1", () => {
  it("binds immutable publish to validation, artifact and both digests", () => {
    const request = {
      schema_version: "skill_publish_request.v1",
      skill_name: "lark-doc",
      semver: "1.4.0",
      validation_id: "validation_01",
      package_digest: hash,
      manifest_digest: hash,
      artifact_ref: "staging:01",
      idempotency_key: `publish:lark-doc:1.4.0:${hash}`,
      trace_id: "trace_01",
    } as const;
    const response = {
      code: "skill_version_published",
      message: "published",
      retryable: false,
      trace_id: "trace_01",
      details: {
        skill_version_id: "version_01",
        skill_name: "lark-doc",
        version: "1.4.0",
        state: "published",
        package_digest: hash,
        manifest_digest: hash,
        runtime_target: "filesystem_bundle.v1",
        created_at: "2026-07-24T00:00:00.000Z",
        duplicate_replayed: false,
      },
    } as const;
    expect(Value.Check(SkillPublishRequestV1Schema, request)).toBe(true);
    expect(Value.Check(SkillPublishResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertSkillPublishSemanticBindingsV1(request, response),
    ).not.toThrow();
    expect(() =>
      assertSkillPublishRequestSemanticBindingsV1({
        ...request,
        idempotency_key: "publish:caller-selected",
      }),
    ).toThrow(/idempotency binding/u);
    expect(
      Value.Check(SkillPublishResponseV1Schema, {
        ...response,
        details: { ...response.details, activation_revision_id: "spoofed" },
      }),
    ).toBe(false);
  });
});
