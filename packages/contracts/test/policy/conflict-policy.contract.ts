import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  CONFLICT_SOURCE_RANK_MATRIX_V1,
  ConflictPolicyV1Schema,
  evaluateConflictPolicyV1,
} from "../../src/index.js";

describe("ConflictPolicyV1", () => {
  it("derives ranks from the canonical domain matrix", () => {
    expect(
      evaluateConflictPolicyV1({
        leftDomain: "project_decision",
        rightDomain: "project_decision",
        sameActorScope: true,
        authorityGatePassed: true,
        leftSource: "approved_artifact",
        rightSource: "agent_observation",
        leftConfidence: 0.7,
        rightConfidence: 0.9,
      }),
    ).toMatchObject({
      left_rank:
        CONFLICT_SOURCE_RANK_MATRIX_V1.project_decision.approved_artifact,
      right_rank:
        CONFLICT_SOURCE_RANK_MATRIX_V1.project_decision.agent_observation,
      rank_gap: 6,
      confidence_gate_passed: true,
      auto_resolution_eligible: true,
      decision: "auto_resolve",
    });
  });

  it.each([
    {
      leftDomain: "unclassified",
      rightDomain: "unclassified",
      authorityGatePassed: true,
    },
    {
      leftDomain: "rule",
      rightDomain: "rule",
      authorityGatePassed: true,
    },
    {
      leftDomain: "runtime_fact",
      rightDomain: "project_decision",
      authorityGatePassed: true,
    },
    {
      leftDomain: "project_decision",
      rightDomain: "project_decision",
      authorityGatePassed: false,
    },
  ] as const)("routes an ineligible conflict to review", (input) => {
    expect(
      evaluateConflictPolicyV1({
        ...input,
        sameActorScope: true,
        leftSource: "approved_artifact",
        rightSource: "agent_observation",
        leftConfidence: 0.9,
        rightConfidence: 0.9,
      }).decision,
    ).toBe("review");
  });

  it("does not accept caller-supplied ranks", () => {
    const result = evaluateConflictPolicyV1({
      leftDomain: "personal_preference",
      rightDomain: "personal_preference",
      sameActorScope: true,
      authorityGatePassed: true,
      leftSource: "meta_inference",
      rightSource: "explicit_feedback",
      leftConfidence: 1,
      rightConfidence: 1,
      leftRank: 999,
      rightRank: 0,
    } as never);
    expect(result.left_rank).toBe(
      CONFLICT_SOURCE_RANK_MATRIX_V1.personal_preference.meta_inference,
    );
    expect(result.right_rank).toBe(
      CONFLICT_SOURCE_RANK_MATRIX_V1.personal_preference.explicit_feedback,
    );
  });

  it("rejects rank projections that cannot round-trip through JavaScript", () => {
    const result = evaluateConflictPolicyV1({
      leftDomain: "project_decision",
      rightDomain: "project_decision",
      sameActorScope: true,
      authorityGatePassed: true,
      leftSource: "approved_artifact",
      rightSource: "agent_observation",
      leftConfidence: 0.7,
      rightConfidence: 0.9,
    });
    expect(
      Value.Check(ConflictPolicyV1Schema, {
        ...result,
        left_rank: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
  });
});
