import { Type, type Static } from "@sinclair/typebox";

export const DIRECT_ACTIVE_REASON_CODES = [
  "eligible",
  "proposed_status_not_active",
  "direct_active_hint_missing",
  "risk_not_low",
  "evidence_pending",
  "not_explicit_statement",
  "confidence_below_threshold",
  "invalid_source_or_evidence",
  "open_conflict",
  "category_gate_failed",
  "validity_gate_failed",
  "rule_not_allowlisted",
  "rule_changes_protected_boundary",
] as const;

export const DirectActivePolicyV1Schema = Type.Object(
  {
    policy_version: Type.Literal("knowthat.direct_active.v1"),
    status: Type.Union([Type.Literal("active"), Type.Literal("candidate")]),
    reason_code: Type.Union(
      DIRECT_ACTIVE_REASON_CODES.map((reason) => Type.Literal(reason)),
    ),
  },
  {
    $id: "urn:pai:shared:direct-active-policy:v1",
    additionalProperties: false,
  },
);

export type DirectActivePolicyV1 = Static<typeof DirectActivePolicyV1Schema>;

export interface DirectActivePolicyInputV1 {
  readonly proposedStatus: "active" | "candidate";
  readonly directActiveHint: boolean;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly evidencePending: boolean;
  readonly explicitness:
    | "explicit_statement"
    | "strong_implication"
    | "weak_implication"
    | "inferred";
  readonly confidence: number;
  readonly sourceAndEvidenceValid: boolean;
  readonly hasOpenConflict: boolean;
  readonly categoryGatePassed: boolean;
  readonly validityGatePassed: boolean;
  readonly category: string;
  readonly ruleAllowlisted: boolean;
  readonly changesProtectedBoundary: boolean;
}

function assertDirectActivePolicyInputV1(
  input: DirectActivePolicyInputV1,
): void {
  if (
    !["active", "candidate"].includes(input.proposedStatus) ||
    !["low", "medium", "high", "critical"].includes(input.riskLevel) ||
    ![
      "explicit_statement",
      "strong_implication",
      "weak_implication",
      "inferred",
    ].includes(input.explicitness) ||
    !Number.isFinite(input.confidence) ||
    input.confidence < 0 ||
    input.confidence > 1 ||
    typeof input.category !== "string" ||
    input.category.length === 0 ||
    [
      input.directActiveHint,
      input.evidencePending,
      input.sourceAndEvidenceValid,
      input.hasOpenConflict,
      input.categoryGatePassed,
      input.validityGatePassed,
      input.ruleAllowlisted,
      input.changesProtectedBoundary,
    ].some((value) => typeof value !== "boolean")
  ) {
    throw new Error("DirectActivePolicyV1 input is invalid");
  }
}

export function evaluateDirectActivePolicyV1(
  input: DirectActivePolicyInputV1,
): DirectActivePolicyV1 {
  assertDirectActivePolicyInputV1(input);
  const candidate = (reason_code: DirectActivePolicyV1["reason_code"]) => ({
    policy_version: "knowthat.direct_active.v1" as const,
    status: "candidate" as const,
    reason_code,
  });

  if (input.proposedStatus !== "active")
    return candidate("proposed_status_not_active");
  if (!input.directActiveHint) return candidate("direct_active_hint_missing");
  if (input.riskLevel !== "low") return candidate("risk_not_low");
  if (input.evidencePending) return candidate("evidence_pending");
  if (input.explicitness !== "explicit_statement")
    return candidate("not_explicit_statement");
  if (input.confidence < 0.9) return candidate("confidence_below_threshold");
  if (!input.sourceAndEvidenceValid)
    return candidate("invalid_source_or_evidence");
  if (input.hasOpenConflict) return candidate("open_conflict");
  if (!input.categoryGatePassed) return candidate("category_gate_failed");
  if (!input.validityGatePassed) return candidate("validity_gate_failed");
  if (input.category === "rule" && !input.ruleAllowlisted)
    return candidate("rule_not_allowlisted");
  if (input.category === "rule" && input.changesProtectedBoundary)
    return candidate("rule_changes_protected_boundary");

  return {
    policy_version: "knowthat.direct_active.v1",
    status: "active",
    reason_code: "eligible",
  };
}
