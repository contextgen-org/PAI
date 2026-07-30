import { Type, type Static } from "@sinclair/typebox";

export const CONFLICT_DOMAINS = [
  "runtime_fact",
  "personal_preference",
  "project_decision",
  "rule",
  "relationship_state",
  "unclassified",
] as const;

export const CONFLICT_SOURCES_V1 = [
  "explicit_feedback",
  "super_user_explicit",
  "approved_artifact",
  "system_event_tool_result",
  "user_explicit",
  "developer_note",
  "agent_observation",
  "meta_inference",
] as const;

export const CONFLICT_POLICY_VERSION_V1 = "1.0.0" as const;

export const ConflictDomainV1Schema = Type.Union(
  CONFLICT_DOMAINS.map((domain) => Type.Literal(domain)),
);

export const ConflictSourceV1Schema = Type.Union(
  CONFLICT_SOURCES_V1.map((source) => Type.Literal(source)),
);

type ConflictDomainV1 = Static<typeof ConflictDomainV1Schema>;
type ConflictSourceV1 = Static<typeof ConflictSourceV1Schema>;

/**
 * Versioned, domain-local source authority. Numeric values are meaningful only
 * inside one domain row; callers never provide or override them.
 */
export const CONFLICT_SOURCE_RANK_MATRIX_V1 = Object.freeze({
  runtime_fact: Object.freeze({
    explicit_feedback: 7,
    super_user_explicit: 6,
    approved_artifact: 8,
    system_event_tool_result: 9,
    user_explicit: 5,
    developer_note: 4,
    agent_observation: 2,
    meta_inference: 1,
  }),
  personal_preference: Object.freeze({
    explicit_feedback: 9,
    super_user_explicit: 7,
    approved_artifact: 4,
    system_event_tool_result: 2,
    user_explicit: 8,
    developer_note: 3,
    agent_observation: 2,
    meta_inference: 1,
  }),
  project_decision: Object.freeze({
    explicit_feedback: 9,
    super_user_explicit: 9,
    approved_artifact: 8,
    system_event_tool_result: 5,
    user_explicit: 5,
    developer_note: 6,
    agent_observation: 2,
    meta_inference: 1,
  }),
  rule: Object.freeze({
    explicit_feedback: 9,
    super_user_explicit: 9,
    approved_artifact: 8,
    system_event_tool_result: 4,
    user_explicit: 5,
    developer_note: 6,
    agent_observation: 2,
    meta_inference: 1,
  }),
  relationship_state: Object.freeze({
    explicit_feedback: 9,
    super_user_explicit: 7,
    approved_artifact: 4,
    system_event_tool_result: 3,
    user_explicit: 8,
    developer_note: 4,
    agent_observation: 2,
    meta_inference: 1,
  }),
  unclassified: Object.freeze({
    explicit_feedback: 0,
    super_user_explicit: 0,
    approved_artifact: 0,
    system_event_tool_result: 0,
    user_explicit: 0,
    developer_note: 0,
    agent_observation: 0,
    meta_inference: 0,
  }),
} as const satisfies Readonly<
  Record<ConflictDomainV1, Readonly<Record<ConflictSourceV1, number>>>
>);

export const ConflictPolicyV1Schema = Type.Object(
  {
    policy_version: Type.Literal(CONFLICT_POLICY_VERSION_V1),
    domain: ConflictDomainV1Schema,
    same_domain: Type.Boolean(),
    same_actor_scope: Type.Boolean(),
    authority_gate_passed: Type.Boolean(),
    left_source: ConflictSourceV1Schema,
    right_source: ConflictSourceV1Schema,
    left_rank: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    right_rank: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    rank_gap: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
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
  readonly leftDomain: ConflictDomainV1;
  readonly rightDomain: ConflictDomainV1;
  readonly sameActorScope: boolean;
  readonly authorityGatePassed: boolean;
  readonly leftSource: ConflictSourceV1;
  readonly rightSource: ConflictSourceV1;
  readonly leftConfidence: number;
  readonly rightConfidence: number;
}

function includes<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function assertPolicyInputV1(input: ConflictPolicyInputV1): void {
  if (
    !includes(CONFLICT_DOMAINS, input.leftDomain) ||
    !includes(CONFLICT_DOMAINS, input.rightDomain) ||
    !includes(CONFLICT_SOURCES_V1, input.leftSource) ||
    !includes(CONFLICT_SOURCES_V1, input.rightSource) ||
    typeof input.sameActorScope !== "boolean" ||
    typeof input.authorityGatePassed !== "boolean" ||
    !Number.isFinite(input.leftConfidence) ||
    input.leftConfidence < 0 ||
    input.leftConfidence > 1 ||
    !Number.isFinite(input.rightConfidence) ||
    input.rightConfidence < 0 ||
    input.rightConfidence > 1
  ) {
    throw new Error("ConflictPolicyV1 input is invalid");
  }
}

export function evaluateConflictPolicyV1(
  input: ConflictPolicyInputV1,
): ConflictPolicyV1 {
  assertPolicyInputV1(input);
  const sameDomain = input.leftDomain === input.rightDomain;
  const domain = sameDomain ? input.leftDomain : "unclassified";
  const leftRank = CONFLICT_SOURCE_RANK_MATRIX_V1[domain][input.leftSource];
  const rightRank = CONFLICT_SOURCE_RANK_MATRIX_V1[domain][input.rightSource];
  const leftIsHigher = leftRank >= rightRank;
  const higherConfidence = leftIsHigher
    ? input.leftConfidence
    : input.rightConfidence;
  const lowerConfidence = leftIsHigher
    ? input.rightConfidence
    : input.leftConfidence;
  const rankGap = Math.abs(leftRank - rightRank);
  const confidenceGatePassed = higherConfidence >= lowerConfidence - 0.2;
  const autoResolutionEligible =
    sameDomain &&
    domain !== "unclassified" &&
    domain !== "rule" &&
    input.sameActorScope &&
    input.authorityGatePassed &&
    rankGap >= 2 &&
    confidenceGatePassed;

  return {
    policy_version: CONFLICT_POLICY_VERSION_V1,
    domain,
    same_domain: sameDomain,
    same_actor_scope: input.sameActorScope,
    authority_gate_passed: input.authorityGatePassed,
    left_source: input.leftSource,
    right_source: input.rightSource,
    left_rank: leftRank,
    right_rank: rightRank,
    rank_gap: rankGap,
    higher_confidence: higherConfidence,
    lower_confidence: lowerConfidence,
    confidence_gate_passed: confidenceGatePassed,
    auto_resolution_eligible: autoResolutionEligible,
    decision: autoResolutionEligible ? "auto_resolve" : "review",
  };
}
