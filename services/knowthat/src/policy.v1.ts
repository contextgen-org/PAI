import {
  evaluateConflictPolicyV1,
  evaluateDirectActivePolicyV1,
  type ConflictPolicyV1,
  type DirectActivePolicyV1,
} from "@pai/contracts";

import type {
  KnowThatCategoryV1,
  KnowThatFactV1,
  KnowThatSourceV1,
  KnowThatWriteItemV1,
} from "./knowthat-types.v1.js";

type ConflictDomainV1 = ConflictPolicyV1["domain"];
type EvidenceRefTypeV1 =
  | "memory_point"
  | "trigger_process"
  | "trigger_event"
  | "user_feedback"
  | "developer_note"
  | "system_event"
  | "artifact"
  | "tool_result";

const DOMAIN_BY_CATEGORY: Readonly<
  Record<KnowThatCategoryV1, ConflictDomainV1>
> = Object.freeze({
  world_state: "runtime_fact",
  preference: "personal_preference",
  relationship_state: "relationship_state",
  project_fact: "project_decision",
  rule: "rule",
  user_profile: "unclassified",
  self_state: "unclassified",
});

const SOURCE_REF_TYPES: Readonly<
  Record<KnowThatSourceV1, readonly EvidenceRefTypeV1[]>
> = Object.freeze({
  explicit_feedback: ["user_feedback", "developer_note"] as const,
  super_user_explicit: ["developer_note", "user_feedback"] as const,
  approved_artifact: ["artifact"] as const,
  system_event_tool_result: ["system_event", "tool_result"] as const,
  user_explicit: [
    "trigger_event",
    "trigger_process",
    "user_feedback",
  ] as const,
  developer_note: ["developer_note"] as const,
  agent_observation: [
    "trigger_event",
    "trigger_process",
    "tool_result",
  ] as const,
  meta_inference: [
    "memory_point",
    "trigger_event",
    "trigger_process",
  ] as const,
});

/*
 * The shared evaluator owns all domain-local ranks. This service only derives
 * whether a source is authoritative from the knowledge domain and a typed,
 * source-compatible evidence reference. No request field can provide rank.
 */
const AUTHORITY_SOURCES: Readonly<
  Record<ConflictDomainV1, readonly KnowThatSourceV1[]>
> = Object.freeze({
  runtime_fact: [
    "system_event_tool_result",
    "approved_artifact",
    "explicit_feedback",
  ] as const,
  personal_preference: [
    "explicit_feedback",
    "user_explicit",
  ] as const,
  project_decision: [
    "explicit_feedback",
    "approved_artifact",
    "super_user_explicit",
  ] as const,
  relationship_state: [
    "explicit_feedback",
    "user_explicit",
  ] as const,
  rule: [] as const,
  unclassified: [] as const,
});

function evidenceRefType(ref: string): EvidenceRefTypeV1 | null {
  const separator = ref.indexOf(":");
  if (separator <= 0) return null;
  const type = ref.slice(0, separator) as EvidenceRefTypeV1;
  return Object.hasOwn(
    {
      memory_point: true,
      trigger_process: true,
      trigger_event: true,
      user_feedback: true,
      developer_note: true,
      system_event: true,
      artifact: true,
      tool_result: true,
    },
    type,
  )
    ? type
    : null;
}

function sourceBindingValid(fact: KnowThatFactV1): boolean {
  const type = evidenceRefType(fact.source_ref);
  return type !== null && SOURCE_REF_TYPES[fact.source].includes(type);
}

export interface KnowThatCanonicalConflictDecisionV1 {
  readonly policy: ConflictPolicyV1;
  readonly left_rank: number;
  readonly right_rank: number;
  readonly authority_gate_passed: boolean;
  readonly rank_source: "shared.conflict_policy.v1";
  readonly higher_side: "left" | "right" | "equal";
}

export function evaluateKnowThatCanonicalConflictV1(
  left: KnowThatFactV1,
  right: KnowThatFactV1,
): KnowThatCanonicalConflictDecisionV1 {
  const leftDomain = DOMAIN_BY_CATEGORY[left.category];
  const rightDomain = DOMAIN_BY_CATEGORY[right.category];
  const authorityGatePassed =
    leftDomain === rightDomain &&
    leftDomain !== "rule" &&
    leftDomain !== "unclassified" &&
    sourceBindingValid(left) &&
    sourceBindingValid(right) &&
    AUTHORITY_SOURCES[leftDomain].includes(left.source) &&
    AUTHORITY_SOURCES[rightDomain].includes(right.source);
  const policy = evaluateConflictPolicyV1({
    leftDomain,
    rightDomain,
    sameActorScope:
      left.workspace_id === right.workspace_id &&
      left.bot_id === right.bot_id &&
      left.owner_agent_id === right.owner_agent_id &&
      left.deployment_environment === right.deployment_environment &&
      left.release_channel === right.release_channel,
    authorityGatePassed,
    leftSource: left.source,
    rightSource: right.source,
    leftConfidence: left.confidence,
    rightConfidence: right.confidence,
  });
  return Object.freeze({
    policy,
    left_rank: policy.left_rank,
    right_rank: policy.right_rank,
    authority_gate_passed: authorityGatePassed,
    rank_source: "shared.conflict_policy.v1",
    higher_side:
      policy.left_rank === policy.right_rank
        ? "equal"
        : policy.left_rank > policy.right_rank
          ? "left"
          : "right",
  });
}

export function knowThatCanonicalSourceRankV1(
  category: KnowThatCategoryV1,
  source: KnowThatSourceV1,
): number {
  const domain = DOMAIN_BY_CATEGORY[category];
  return evaluateConflictPolicyV1({
    leftDomain: domain,
    rightDomain: domain,
    sameActorScope: true,
    authorityGatePassed: false,
    leftSource: source,
    rightSource: source,
    leftConfidence: 0,
    rightConfidence: 0,
  }).left_rank;
}

export function evaluateKnowThatDirectActivePolicyV1(input: Readonly<{
  item: KnowThatWriteItemV1;
  forced_candidate: boolean;
}>): DirectActivePolicyV1 {
  const item = input.item;
  const sourceRefType = evidenceRefType(item.source_ref);
  return evaluateDirectActivePolicyV1({
    proposedStatus: item.proposed_status,
    directActiveHint: item.direct_active_hint,
    riskLevel: item.risk_level,
    evidencePending: item.evidence_pending,
    explicitness: item.explicitness,
    confidence: item.confidence,
    sourceAndEvidenceValid:
      sourceRefType !== null &&
      SOURCE_REF_TYPES[item.source].includes(sourceRefType) &&
      item.evidence_refs.includes(item.source_ref),
    hasOpenConflict: input.forced_candidate,
    categoryGatePassed:
      item.category !== "relationship_state" &&
      item.category !== "self_state",
    validityGatePassed:
      item.category !== "world_state" || item.valid_until !== undefined,
    category: item.category,
    ruleAllowlisted: false,
    changesProtectedBoundary: item.category === "rule",
  });
}
