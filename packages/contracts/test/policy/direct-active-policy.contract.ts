import { describe, expect, it } from "vitest";

import { evaluateDirectActivePolicyV1 } from "../../src/index.js";

const eligible = {
  proposedStatus: "active" as const,
  directActiveHint: true,
  riskLevel: "low" as const,
  evidencePending: false,
  explicitness: "explicit_statement" as const,
  confidence: 0.9,
  sourceAndEvidenceValid: true,
  hasOpenConflict: false,
  categoryGatePassed: true,
  validityGatePassed: true,
  category: "project_fact",
  ruleAllowlisted: false,
  changesProtectedBoundary: false,
};

describe("DirectActivePolicyV1", () => {
  it("activates only when every documented gate passes", () => {
    expect(evaluateDirectActivePolicyV1(eligible)).toEqual({
      policy_version: "knowthat.direct_active.v1",
      status: "active",
      reason_code: "eligible",
    });
  });

  it("returns a stable candidate reason at the first failed gate", () => {
    expect(
      evaluateDirectActivePolicyV1({ ...eligible, confidence: 0.899 }),
    ).toMatchObject({
      status: "candidate",
      reason_code: "confidence_below_threshold",
    });
    expect(
      evaluateDirectActivePolicyV1({
        ...eligible,
        category: "rule",
        ruleAllowlisted: false,
      }),
    ).toMatchObject({
      status: "candidate",
      reason_code: "rule_not_allowlisted",
    });
  });
});
