import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SKILL_INVALID_RUNTIME_POLICY_REASONS_V1,
  SKILL_RESOLVE_ERROR_PRECEDENCE_V1,
  SkillResolveRequestV1Schema,
  SkillResolveResponseV1Schema,
  assertSkillResolveRequestSemanticBindingsV1,
  assertSkillResolveResponseSemanticBindingsV1,
} from "../../src/index.js";

const hash = `sha256:${"a".repeat(64)}` as const;
const at = "2026-07-24T00:00:00.000Z";
const request = {
  schema_version: "skill_resolution_request.v1",
  runtime_run_id: "run_01",
  start_attempt_no: 1,
  workspace_id: "ws_01",
  bot_id: "bot_01",
  owner_agent_id: "agent_01",
  deployment_environment: "prod",
  release_channel: "stable",
  expected_catalog_version: "cat_184",
  catalog_as_of: at,
  policy_input_ref: "runtime_policy_input_run_01",
  policy_input_hash: hash,
  skills: [
    { name: "lark-doc", version_constraint: "catalog_revision", required: true },
  ],
  idempotency_key: "run_01:skill-resolution:attempt:1",
  trace_id: "trace_01",
} as const;

describe("SkillResolveContractV1", () => {
  it("closes request fields and binds the attempt idempotency identity", () => {
    expect(Value.Check(SkillResolveRequestV1Schema, request)).toBe(true);
    expect(() =>
      assertSkillResolveRequestSemanticBindingsV1(request),
    ).not.toThrow();
    expect(
      Value.Check(SkillResolveRequestV1Schema, {
        ...request,
        inline_policy: {},
      }),
    ).toBe(false);
    expect(() =>
      assertSkillResolveRequestSemanticBindingsV1({
        ...request,
        idempotency_key: "run_01:skill-resolution:attempt:2",
      }),
    ).toThrow(/attempt identity/u);
  });

  it("binds catalog, policy lifetime, scope, digests, and target", () => {
    const response = {
      code: "skill_resolution_succeeded",
      message: "resolved",
      retryable: false,
      trace_id: request.trace_id,
      details: {
        schema_version: "skill_resolution_response.v1",
        resolution_attempt_id: "resolution_attempt_01",
        runtime_run_id: request.runtime_run_id,
        start_attempt_no: request.start_attempt_no,
        workspace_id: request.workspace_id,
        bot_id: request.bot_id,
        owner_agent_id: request.owner_agent_id,
        deployment_environment: request.deployment_environment,
        release_channel: request.release_channel,
        requested_catalog_version: request.expected_catalog_version,
        effective_catalog_version: request.expected_catalog_version,
        catalog_as_of: request.catalog_as_of,
        security_revocation_epoch: 3,
        policy_input_hash: request.policy_input_hash,
        valid_until: "2026-07-24T01:00:00.000Z",
        resolved_skills: [
          {
            resolution_id: "resolution_01",
            skill_id: "skill_01",
            skill_key: "lark-doc",
            version_id: "version_01",
            version: "1.4.0",
            package_digest: hash,
            manifest_digest: hash,
            runtime_target: "filesystem_bundle.v1",
            granted_capability_refs: ["doc.read"],
            required: true,
            valid_until: "2026-07-24T01:00:00.000Z",
          },
        ],
        degradation_notes: [],
        duplicate_replayed: false,
      },
    } as const;
    expect(Value.Check(SkillResolveResponseV1Schema, response)).toBe(true);
    expect(() =>
      assertSkillResolveResponseSemanticBindingsV1(
        request,
        response,
        response.details.valid_until,
      ),
    ).not.toThrow();
    expect(() =>
      assertSkillResolveResponseSemanticBindingsV1(
        request,
        {
          ...response,
          details: {
            ...response.details,
            effective_catalog_version: "latest",
          },
        },
        response.details.valid_until,
      ),
    ).toThrow(/semantic binding/u);
  });

  it("publishes the exact closed policy reason set and top-level precedence", () => {
    expect(SKILL_INVALID_RUNTIME_POLICY_REASONS_V1).toEqual([
      "expires_at_missing",
      "expired",
      "lifetime_exceeded",
      "ref_hash_mismatch",
      "skill_permission_summary_missing",
      "skill_permission_summary_ref_hash_mismatch",
      "skill_permission_summary_scope_mismatch",
    ]);
    expect(SKILL_RESOLVE_ERROR_PRECEDENCE_V1).toEqual([
      "authorization_scope_mismatch",
      "invalid_runtime_policy",
      "catalog_version_conflict",
      "permission_denied",
      "version_revoked",
      "required_skill_unavailable",
    ]);
  });
});
