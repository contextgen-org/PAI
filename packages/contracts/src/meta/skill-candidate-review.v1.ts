import { Type, type Static } from "@sinclair/typebox";

import {
  MetaIdentifierV1Schema,
  MetaReasonCodeV1Schema,
  MetaSafeVersionV1Schema,
  MetaTimestampV1Schema,
} from "./primitives.v1.js";

export const MetaSkillCandidateReviewRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("meta_skill_candidate_review.v1"),
    candidate_id: MetaIdentifierV1Schema,
    expected_status: Type.Literal("proposed"),
    expected_review_version: MetaSafeVersionV1Schema,
    expected_updated_at: MetaTimestampV1Schema,
    decision: Type.Union([
      Type.Literal("accept"),
      Type.Literal("reject"),
      Type.Literal("supersede"),
    ]),
    reviewer_principal_id: MetaIdentifierV1Schema,
    reason_code: MetaReasonCodeV1Schema,
    idempotency_key: MetaIdentifierV1Schema,
    trace_id: MetaIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const MetaSkillCandidateReviewResponseV1Schema = Type.Object(
  {
    candidate_id: MetaIdentifierV1Schema,
    status: Type.Union([
      Type.Literal("accepted"),
      Type.Literal("rejected"),
      Type.Literal("superseded"),
    ]),
    review_version: MetaSafeVersionV1Schema,
    application_id: Type.Union([
      MetaIdentifierV1Schema,
      Type.Null(),
    ]),
    delivery_id: Type.Union([
      MetaIdentifierV1Schema,
      Type.Null(),
    ]),
    duplicate_replayed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const MetaSkillCandidateReviewContractV1Schema = Type.Union(
  [
    MetaSkillCandidateReviewRequestV1Schema,
    MetaSkillCandidateReviewResponseV1Schema,
  ],
  { $id: "urn:pai:meta:skill-candidate-review:v1" },
);

export type MetaSkillCandidateReviewRequestV1 = Static<
  typeof MetaSkillCandidateReviewRequestV1Schema
>;
export type MetaSkillCandidateReviewResponseV1 = Static<
  typeof MetaSkillCandidateReviewResponseV1Schema
>;

export function assertMetaSkillCandidateReviewSemanticBindingsV1(
  pathCandidateId: string,
  request: MetaSkillCandidateReviewRequestV1,
  response: MetaSkillCandidateReviewResponseV1,
  authenticatedReviewerPrincipalId: string,
): void {
  const expectedStatus =
    request.decision === "accept"
      ? "accepted"
      : request.decision === "reject"
        ? "rejected"
        : "superseded";
  const accepted = response.status === "accepted";
  if (
    request.candidate_id !== pathCandidateId ||
    response.candidate_id !== pathCandidateId ||
    request.reviewer_principal_id !==
      authenticatedReviewerPrincipalId ||
    request.expected_review_version >= Number.MAX_SAFE_INTEGER ||
    response.review_version !== request.expected_review_version + 1 ||
    response.status !== expectedStatus ||
    accepted !==
      (response.application_id !== null &&
        response.delivery_id !== null) ||
    (!accepted &&
      (response.application_id !== null ||
        response.delivery_id !== null))
  ) {
    throw new Error(
      "MetaSkillCandidateReviewContractV1 semantic binding mismatch",
    );
  }
}
