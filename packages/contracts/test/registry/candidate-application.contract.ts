import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  SkillCandidateApplicationRequestV1Schema,
  SkillCandidateApplicationResponseV1Schema,
  assertSkillCandidateApplicationSemanticBindingsV1,
} from "../../src/index.js";

const hash = `sha256:${"f".repeat(64)}` as const;

describe("SkillCandidateApplicationContractV1", () => {
  it("requires complete five-tuple provenance and authenticated reviewer binding", () => {
    const request = {
      schema_version: "skill_candidate_application.v1",
      application_id: "application_01",
      candidate_id: "candidate_01",
      review_version: 1,
      candidate_type: "new_skill",
      skill_key: "new-skill",
      workspace_id: "ws_01",
      bot_id: "bot_01",
      owner_agent_id: "agent_01",
      deployment_environment: "prod",
      release_channel: "stable",
      baseline_catalog_version: "cat_184",
      proposal_ref: "proposal_01",
      proposal_hash: hash,
      evidence_refs: [{ ref: "evidence_01", hash }],
      reviewer_principal_id: "reviewer_01",
      idempotency_key: "candidate:application_01:1",
      trace_id: "trace_01",
    } as const;
    const response = {
      code: "skill_candidate_application_updated",
      message: "received",
      retryable: false,
      trace_id: "trace_01",
      details: {
        application_id: "application_01",
        status: "received",
        response_ref: "response_01",
        response_hash: hash,
        duplicate_replayed: false,
      },
    } as const;
    expect(
      Value.Check(SkillCandidateApplicationRequestV1Schema, request),
    ).toBe(true);
    expect(
      Value.Check(SkillCandidateApplicationResponseV1Schema, response),
    ).toBe(true);
    expect(() =>
      assertSkillCandidateApplicationSemanticBindingsV1(
        request,
        response,
        "reviewer_01",
      ),
    ).not.toThrow();
    expect(() =>
      assertSkillCandidateApplicationSemanticBindingsV1(
        request,
        response,
        "spoofed",
      ),
    ).toThrow(/semantic/u);
  });

  it("does not permit candidate application to publish or activate", () => {
    expect(
      Value.Check(SkillCandidateApplicationResponseV1Schema, {
        code: "skill_candidate_application_updated",
        message: "received",
        retryable: false,
        trace_id: "trace_01",
        details: {
          application_id: "application_01",
          status: "draft_created",
          response_ref: "response_01",
          response_hash: hash,
          duplicate_replayed: false,
          catalog_version: "cat_185",
        },
      }),
    ).toBe(false);
  });
});
