import { Type, type Static } from "@sinclair/typebox";

import {
  SkillRuntimeScopeV1Properties,
  SkillRegistryIdentifierV1Schema,
  SkillRegistryPositiveIntegerV1Schema,
  SkillRegistrySha256V1Schema,
  skillRegistryEnvelopeV1,
} from "./primitives.v1.js";

export const SkillCandidateTypeV1Schema = Type.Union([
  Type.Literal("new_skill"),
  Type.Literal("skill_update"),
  Type.Literal("deprecation"),
]);

export const SkillCandidateApplicationStatusV1Schema = Type.Union([
  Type.Literal("received"),
  Type.Literal("validating"),
  Type.Literal("draft_created"),
  Type.Literal("deprecation_review_created"),
  Type.Literal("rejected"),
  Type.Literal("failed"),
]);

export const SkillCandidateEvidenceRefV1Schema = Type.Object(
  {
    ref: SkillRegistryIdentifierV1Schema,
    hash: SkillRegistrySha256V1Schema,
  },
  { additionalProperties: false },
);

export const SkillCandidateApplicationRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("skill_candidate_application.v1"),
    application_id: SkillRegistryIdentifierV1Schema,
    candidate_id: SkillRegistryIdentifierV1Schema,
    review_version: SkillRegistryPositiveIntegerV1Schema,
    candidate_type: SkillCandidateTypeV1Schema,
    skill_key: SkillRegistryIdentifierV1Schema,
    ...SkillRuntimeScopeV1Properties,
    baseline_catalog_version: SkillRegistryIdentifierV1Schema,
    proposal_ref: SkillRegistryIdentifierV1Schema,
    proposal_hash: SkillRegistrySha256V1Schema,
    evidence_refs: Type.Array(SkillCandidateEvidenceRefV1Schema, {
      minItems: 1,
      maxItems: 256,
    }),
    reviewer_principal_id: SkillRegistryIdentifierV1Schema,
    idempotency_key: SkillRegistryIdentifierV1Schema,
    trace_id: SkillRegistryIdentifierV1Schema,
  },
  {
    $id: "urn:pai:skill-registry:candidate-application-request:v1",
    additionalProperties: false,
  },
);

export const SkillCandidateApplicationDetailsV1Schema = Type.Object(
  {
    application_id: SkillRegistryIdentifierV1Schema,
    status: SkillCandidateApplicationStatusV1Schema,
    staging_version_id: Type.Optional(SkillRegistryIdentifierV1Schema),
    review_ref: Type.Optional(SkillRegistryIdentifierV1Schema),
    response_ref: SkillRegistryIdentifierV1Schema,
    response_hash: SkillRegistrySha256V1Schema,
    duplicate_replayed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SkillCandidateApplicationResponseV1Schema =
  skillRegistryEnvelopeV1(
    "skill_candidate_application_updated",
    SkillCandidateApplicationDetailsV1Schema,
  );

export const SkillCandidateApplicationContractV1Schema = Type.Union(
  [
    SkillCandidateApplicationRequestV1Schema,
    SkillCandidateApplicationResponseV1Schema,
  ],
  { $id: "urn:pai:skill-registry:candidate-application:v1" },
);

export type SkillCandidateApplicationRequestV1 = Static<
  typeof SkillCandidateApplicationRequestV1Schema
>;
export type SkillCandidateApplicationDetailsV1 = Static<
  typeof SkillCandidateApplicationDetailsV1Schema
>;
export type SkillCandidateApplicationResponseV1 = Static<
  typeof SkillCandidateApplicationResponseV1Schema
>;

export function assertSkillCandidateApplicationSemanticBindingsV1(
  request: SkillCandidateApplicationRequestV1,
  response: SkillCandidateApplicationResponseV1,
  authenticatedReviewerPrincipalId: string,
): void {
  const refs = request.evidence_refs.map(
    (evidence) => `${evidence.ref}\u0000${evidence.hash}`,
  );
  if (
    request.reviewer_principal_id !== authenticatedReviewerPrincipalId ||
    response.details.application_id !== request.application_id ||
    new Set(refs).size !== refs.length ||
    (request.candidate_type === "deprecation" &&
      response.details.status === "draft_created") ||
    (request.candidate_type !== "deprecation" &&
      response.details.status === "deprecation_review_created")
  ) {
    throw new Error("SkillCandidateApplicationContractV1 semantic mismatch");
  }
}
