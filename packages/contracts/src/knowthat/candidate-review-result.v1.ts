import { Type, type Static } from "@sinclair/typebox";

import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  KnowThatIdV1Schema,
  KnowThatJsonValueV1Schema,
  assertKnowThatSchemaV1,
} from "./primitives.v1.js";

export const KnowThatFeedbackRequestSuggestionV1Schema = Type.Object(
  {
    candidate_id: KnowThatIdV1Schema,
    conflict_id: Type.Optional(KnowThatIdV1Schema),
    dedupe_scope_ref: Type.String({
      minLength: 3,
      maxLength: 1_024,
      pattern: "^(?:candidate|conflict):[^\\r\\n]+$",
    }),
    question_key: Type.String({ minLength: 1, maxLength: 256 }),
    question_payload: Type.Record(
      Type.String(),
      KnowThatJsonValueV1Schema,
    ),
    reason: Type.String({ minLength: 1, maxLength: 4_096 }),
    evidence_refs: Type.Array(TypedEvidenceRefV1Schema, {
      maxItems: 64,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

const decision = Type.Union([
  Type.Literal("promote"),
  Type.Literal("keep_candidate"),
  Type.Literal("reject"),
  Type.Literal("expire"),
  Type.Literal("request_feedback"),
]);

export const KnowThatCandidateReviewResultV1Schema = Type.Object(
  {
    review_id: KnowThatIdV1Schema,
    suggestion_id: KnowThatIdV1Schema,
    candidate_id: KnowThatIdV1Schema,
    target_candidate_version: Type.Integer({
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    status: Type.Union([
      Type.Literal("accepted"),
      Type.Literal("rejected"),
      Type.Literal("stale_candidate_version"),
    ]),
    decision,
    linkage_check_ids: Type.Array(KnowThatIdV1Schema, {
      maxItems: 256,
      uniqueItems: true,
    }),
    feedback_request_suggestion: Type.Optional(
      KnowThatFeedbackRequestSuggestionV1Schema,
    ),
    candidate_version_after: Type.Optional(
      Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
    ),
    duplicate_replayed: Type.Boolean(),
    reason_code: Type.String({ minLength: 1, maxLength: 256 }),
  },
  {
    $id: "urn:pai:knowthat:candidate-review-result:v1",
    additionalProperties: false,
  },
);

export type KnowThatFeedbackRequestSuggestionV1 = Static<
  typeof KnowThatFeedbackRequestSuggestionV1Schema
>;
export type KnowThatCandidateReviewResultV1 = Static<
  typeof KnowThatCandidateReviewResultV1Schema
>;

export function assertKnowThatCandidateReviewResultSemanticBindingsV1(
  result: KnowThatCandidateReviewResultV1,
): void {
  const feedback = result.feedback_request_suggestion;
  if (
    (result.status === "accepted" &&
      result.decision === "request_feedback") !==
      (feedback !== undefined) ||
    (feedback !== undefined &&
      (feedback.candidate_id !== result.candidate_id ||
        feedback.dedupe_scope_ref !==
          (feedback.conflict_id === undefined
            ? `candidate:${result.candidate_id}`
            : `conflict:${feedback.conflict_id}`)))
  ) {
    throw new Error(
      "KnowThat candidate review feedback suggestion binding mismatch",
    );
  }
}

export function assertKnowThatCandidateReviewResultV1(
  value: unknown,
): asserts value is KnowThatCandidateReviewResultV1 {
  assertKnowThatSchemaV1(
    KnowThatCandidateReviewResultV1Schema,
    value,
    "KnowThat candidate review result",
  );
  assertKnowThatCandidateReviewResultSemanticBindingsV1(value);
}
