import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  MetaSkillCandidateReviewContractV1Schema,
  MetaSkillCandidateReviewRequestV1Schema,
  MetaSkillCandidateReviewResponseV1Schema,
  SkillCandidateApplicationRequestV1Schema,
  SkillCandidateApplicationResponseV1Schema,
  assertMetaSkillCandidateReviewSemanticBindingsV1,
  assertSkillCandidateApplicationSemanticBindingsV1,
} from "../../src/index.js";
import { hashA } from "./owner-fixtures.v1.js";

const request = {
  schema_version: "meta_skill_candidate_review.v1",
  candidate_id: "candidate-1",
  expected_status: "proposed",
  expected_review_version: 1,
  expected_updated_at: "2026-07-23T00:00:00.000Z",
  decision: "accept",
  reviewer_principal_id: "reviewer-1",
  reason_code: "review_approved",
  idempotency_key: "candidate-1:review:1",
  trace_id: "trace-1",
} as const;

const response = {
  candidate_id: "candidate-1",
  status: "accepted",
  review_version: 2,
  application_id: "application-1",
  delivery_id: "delivery-1",
  duplicate_replayed: false,
} as const;

describe("MetaSkillCandidateReviewContractV1", () => {
  it("binds path, authenticated reviewer, decision, and exact review version", () => {
    expect(
      Value.Check(MetaSkillCandidateReviewRequestV1Schema, request),
    ).toBe(true);
    expect(
      Value.Check(MetaSkillCandidateReviewResponseV1Schema, response),
    ).toBe(true);
    expect(
      Value.Check(MetaSkillCandidateReviewContractV1Schema, request),
    ).toBe(true);
    expect(
      Value.Check(MetaSkillCandidateReviewContractV1Schema, response),
    ).toBe(true);
    expect(() =>
      assertMetaSkillCandidateReviewSemanticBindingsV1(
        "candidate-1",
        request,
        response,
        "reviewer-1",
      ),
    ).not.toThrow();
  });

  it.each([
    [
      "path",
      "other-candidate",
      request,
      response,
      "reviewer-1",
    ],
    [
      "reviewer",
      "candidate-1",
      request,
      response,
      "spoofed-reviewer",
    ],
    [
      "version",
      "candidate-1",
      request,
      { ...response, review_version: 3 },
      "reviewer-1",
    ],
    [
      "decision",
      "candidate-1",
      request,
      { ...response, status: "rejected" },
      "reviewer-1",
    ],
    [
      "delivery",
      "candidate-1",
      request,
      { ...response, delivery_id: null },
      "reviewer-1",
    ],
  ] as const)(
    "rejects %s semantic drift",
    (_label, path, candidateRequest, candidateResponse, reviewer) => {
      expect(() =>
        assertMetaSkillCandidateReviewSemanticBindingsV1(
          path,
          candidateRequest,
          candidateResponse,
          reviewer,
        ),
      ).toThrow(/semantic binding/u);
    },
  );

  it("produces the exact Skill Registry candidate application contract", () => {
    const applicationRequest = {
      schema_version: "skill_candidate_application.v1",
      application_id: response.application_id,
      candidate_id: response.candidate_id,
      review_version: response.review_version,
      candidate_type: "new_skill",
      skill_key: "candidate-skill",
      workspace_id: "workspace-1",
      bot_id: "bot-1",
      owner_agent_id: "agent-1",
      deployment_environment: "dev",
      release_channel: "stable",
      baseline_catalog_version: "catalog-1",
      proposal_ref: "proposal-1",
      proposal_hash: hashA,
      evidence_refs: [{ ref: "evidence-1", hash: hashA }],
      reviewer_principal_id: request.reviewer_principal_id,
      idempotency_key: response.application_id,
      trace_id: request.trace_id,
    } as const;
    const applicationResponse = {
      code: "skill_candidate_application_updated",
      message: "received",
      retryable: false,
      trace_id: request.trace_id,
      details: {
        application_id: response.application_id,
        status: "received",
        response_ref: "skill-response-1",
        response_hash: hashA,
        duplicate_replayed: false,
      },
    } as const;

    expect(
      Value.Check(
        SkillCandidateApplicationRequestV1Schema,
        applicationRequest,
      ),
    ).toBe(true);
    expect(
      Value.Check(
        SkillCandidateApplicationResponseV1Schema,
        applicationResponse,
      ),
    ).toBe(true);
    expect(() =>
      assertSkillCandidateApplicationSemanticBindingsV1(
        applicationRequest,
        applicationResponse,
        request.reviewer_principal_id,
      ),
    ).not.toThrow();
  });
});
