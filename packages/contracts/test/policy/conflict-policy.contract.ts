import { describe, expect, it } from "vitest";

import { evaluateConflictPolicyV1 } from "../../src/index.js";

describe("ConflictPolicyV1", () => {
  it("auto-resolves only with authority, same scope, rank gap, and confidence gate", () => {
    expect(
      evaluateConflictPolicyV1({
        domain: "project_decision",
        sameActorScope: true,
        authorityGatePassed: true,
        leftRank: 5,
        rightRank: 3,
        leftConfidence: 0.7,
        rightConfidence: 0.9,
      }),
    ).toMatchObject({
      rank_gap: 2,
      confidence_gate_passed: true,
      auto_resolution_eligible: true,
      decision: "auto_resolve",
    });
  });

  it.each([
    { domain: "unclassified", authorityGatePassed: true, leftRank: 5, rightRank: 1 },
    { domain: "rule", authorityGatePassed: false, leftRank: 5, rightRank: 1 },
    { domain: "rule", authorityGatePassed: true, leftRank: 5, rightRank: 4 },
  ] as const)("routes an ineligible conflict to review", (input) => {
    expect(
      evaluateConflictPolicyV1({
        ...input,
        sameActorScope: true,
        leftConfidence: 0.9,
        rightConfidence: 0.9,
      }).decision,
    ).toBe("review");
  });
});
