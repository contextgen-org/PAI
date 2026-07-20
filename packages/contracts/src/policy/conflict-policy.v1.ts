import { Type, type Static } from "@sinclair/typebox";

export const CONFLICT_DOMAINS = [
  "runtime_fact",
  "personal_preference",
  "project_decision",
  "rule",
  "relationship_state",
  "unclassified",
] as const;

export const ConflictDomainV1Schema = Type.Union(
  CONFLICT_DOMAINS.map((domain) => Type.Literal(domain)),
);

export const ConflictPolicyV1Schema = Type.Object(
  {
    policy_version: Type.Literal("1.0.0"),
    domain: ConflictDomainV1Schema,
    same_actor_scope: Type.Boolean(),
    authority_gate_passed: Type.Boolean(),
    left_rank: Type.Integer({ minimum: 0 }),
    right_rank: Type.Integer({ minimum: 0 }),
    rank_gap: Type.Integer({ minimum: 0 }),
    higher_confidence: Type.Number({ minimum: 0, maximum: 1 }),
    lower_confidence: Type.Number({ minimum: 0, maximum: 1 }),
    confidence_gate_passed: Type.Boolean(),
    auto_resolution_eligible: Type.Boolean(),
    decision: Type.Union([
      Type.Literal("auto_resolve"),
      Type.Literal("review"),
    ]),
  },
  {
    $id: "urn:pai:shared:conflict-policy:v1",
    additionalProperties: false,
  },
);

export type ConflictPolicyV1 = Static<typeof ConflictPolicyV1Schema>;

export interface ConflictPolicyInputV1 {
  readonly domain: Static<typeof ConflictDomainV1Schema>;
  readonly sameActorScope: boolean;
  readonly authorityGatePassed: boolean;
  readonly leftRank: number;
  readonly rightRank: number;
  readonly leftConfidence: number;
  readonly rightConfidence: number;
}

export function evaluateConflictPolicyV1(
  input: ConflictPolicyInputV1,
): ConflictPolicyV1 {
  const leftIsHigher = input.leftRank >= input.rightRank;
  const higherConfidence = leftIsHigher
    ? input.leftConfidence
    : input.rightConfidence;
  const lowerConfidence = leftIsHigher
    ? input.rightConfidence
    : input.leftConfidence;
  const rankGap = Math.abs(input.leftRank - input.rightRank);
  const confidenceGatePassed = higherConfidence >= lowerConfidence - 0.2;
  const autoResolutionEligible =
    input.domain !== "unclassified" &&
    input.sameActorScope &&
    input.authorityGatePassed &&
    rankGap >= 2 &&
    confidenceGatePassed;

  return {
    policy_version: "1.0.0",
    domain: input.domain,
    same_actor_scope: input.sameActorScope,
    authority_gate_passed: input.authorityGatePassed,
    left_rank: input.leftRank,
    right_rank: input.rightRank,
    rank_gap: rankGap,
    higher_confidence: higherConfidence,
    lower_confidence: lowerConfidence,
    confidence_gate_passed: confidenceGatePassed,
    auto_resolution_eligible: autoResolutionEligible,
    decision: autoResolutionEligible ? "auto_resolve" : "review",
  };
}
