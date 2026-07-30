import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SKILL_PACKAGE_MAX_BYTES_V1,
  SKILL_VALIDATION_RECORD_TTL_SECONDS_V1,
  SkillValidateRequestV1Schema,
  SkillValidateResponseV1Schema,
  assertSkillValidateRequestSemanticBindingsV1,
  assertSkillValidateResponseSemanticBindingsV1,
} from "../../src/index.js";

const hash = `sha256:${"c".repeat(64)}` as const;

describe("SkillValidateContractV1", () => {
  it("enforces raw byte and normalized manifest boundaries", () => {
    expect(SKILL_VALIDATION_RECORD_TTL_SECONDS_V1).toBe(1_800);
    const request = {
      schema_version: "skill_validate_request.v1",
      artifact_ref: "staging:skill-upload-01",
      content_digest: hash,
      media_type: "application/zip",
      size_bytes: 2_048,
      idempotency_key: `validate:${hash}`,
      trace_id: "trace_01",
    } as const;
    const response = {
      code: "skill_package_validated",
      message: "validated",
      retryable: false,
      trace_id: "trace_01",
      details: {
        validation_id: "validation_01",
        package_digest: hash,
        manifest_digest: hash,
        normalized_manifest: {
          schema_version: "skill_package_manifest.v1",
          runtime_target: "filesystem_bundle.v1",
          files: [
            {
              path: "SKILL.md",
              mode: "0644",
              size_bytes: 2_048,
              sha256: hash,
            },
          ],
        },
        diagnostics: [],
        expires_at: "2026-07-24T01:00:00.000Z",
      },
    } as const;
    expect(Value.Check(SkillValidateRequestV1Schema, request)).toBe(true);
    expect(Value.Check(SkillValidateResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertSkillValidateRequestSemanticBindingsV1(request),
    ).not.toThrow();
    expect(() =>
      assertSkillValidateResponseSemanticBindingsV1(request, response),
    ).not.toThrow();
    expect(() =>
      assertSkillValidateResponseSemanticBindingsV1(request, {
        ...response,
        trace_id: "trace_spoof",
      }),
    ).toThrow(/binding mismatch/u);
    expect(
      Value.Check(SkillValidateRequestV1Schema, {
        ...request,
        size_bytes: SKILL_PACKAGE_MAX_BYTES_V1 + 1,
      }),
    ).toBe(false);
  });

  it("rejects unsafe, duplicate, and non-canonical manifest paths", () => {
    const request = {
      schema_version: "skill_validate_request.v1",
      artifact_ref: "staging:1",
      content_digest: hash,
      media_type: "application/zip",
      size_bytes: 1,
      idempotency_key: `validate:${hash}`,
      trace_id: "trace_01",
    } as const;
    const response = {
      code: "skill_package_validated",
      message: "validated",
      retryable: false,
      trace_id: "trace_01",
      details: {
        validation_id: "validation_01",
        package_digest: hash,
        manifest_digest: hash,
        normalized_manifest: {
          schema_version: "skill_package_manifest.v1",
          runtime_target: "filesystem_bundle.v1",
          files: [
            { path: "../SKILL.md", mode: "0644", size_bytes: 1, sha256: hash },
          ],
        },
        diagnostics: [],
        expires_at: "2026-07-24T01:00:00.000Z",
      },
    } as const;
    expect(() =>
      assertSkillValidateResponseSemanticBindingsV1(request, response),
    ).toThrow(/paths/u);
  });
});
