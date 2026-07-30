import { Type, type Static } from "@sinclair/typebox";

import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  KnowThatIdV1Schema,
  KnowThatRiskLevelV1Schema,
  assertKnowThatSchemaV1,
} from "./primitives.v1.js";

export const KnowThatPromotionSuggestionV1Schema = Type.Object(
  {
    suggestion_id: KnowThatIdV1Schema,
    source_meta_job_id: KnowThatIdV1Schema,
    candidate_id: KnowThatIdV1Schema,
    target_candidate_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    suggested_action: Type.Union([
      Type.Literal("promote"),
      Type.Literal("keep_candidate"),
      Type.Literal("reject"),
      Type.Literal("expire"),
      Type.Literal("request_feedback"),
    ]),
    reason: Type.String({ minLength: 1, maxLength: 4_096 }),
    new_evidence_refs: Type.Array(TypedEvidenceRefV1Schema, {
      maxItems: 64,
      uniqueItems: true,
    }),
    risk_level: KnowThatRiskLevelV1Schema,
    confidence_delta: Type.Number({ minimum: -1, maximum: 1 }),
    validation_profile: Type.Union([
      Type.Literal("standard"),
      Type.Literal("confirmed_low_risk"),
    ]),
    idempotency_key: Type.String({ minLength: 1, maxLength: 512 }),
  },
  {
    $id: "urn:pai:knowthat:promotion-suggestion:v1",
    additionalProperties: false,
  },
);

export type KnowThatPromotionSuggestionV1 = Static<
  typeof KnowThatPromotionSuggestionV1Schema
>;

export function assertKnowThatPromotionSuggestionSemanticBindingsV1(
  suggestion: KnowThatPromotionSuggestionV1,
): void {
  if (
    suggestion.idempotency_key !==
    `candidate_review:${suggestion.source_meta_job_id}:${suggestion.suggestion_id}`
  ) {
    throw new Error(
      "KnowThat promotion suggestion idempotency key is not canonical",
    );
  }
}

export function assertKnowThatPromotionSuggestionV1(
  value: unknown,
): asserts value is KnowThatPromotionSuggestionV1 {
  assertKnowThatSchemaV1(
    KnowThatPromotionSuggestionV1Schema,
    value,
    "KnowThat promotion suggestion",
  );
  assertKnowThatPromotionSuggestionSemanticBindingsV1(value);
}
