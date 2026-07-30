import { Type, type Static } from "@sinclair/typebox";

import {
  KnowThatCandidateReviewResultV1Schema,
} from "./candidate-review-result.v1.js";
import {
  KnowThatPromotionSuggestionV1Schema,
  assertKnowThatPromotionSuggestionSemanticBindingsV1,
} from "./promotion-suggestion.v1.js";
import {
  KnowThatHashV1Schema,
  KnowThatIdV1Schema,
  KnowThatScopeV1Schema,
  KnowThatTraceIdV1Schema,
  assertKnowThatSchemaV1,
} from "./primitives.v1.js";

export const KnowThatCandidateReviewSourceEventV1Schema = Type.Object(
  {
    ...KnowThatScopeV1Schema.properties,
    source: Type.Literal("meta_cognition"),
    event_id: KnowThatIdV1Schema,
    idempotency_key: Type.String({ minLength: 1, maxLength: 512 }),
    payload_hash: KnowThatHashV1Schema,
    semantic_hash: KnowThatHashV1Schema,
    scope_fingerprint: KnowThatHashV1Schema,
    payload: Type.Object(
      {
        candidate_id: KnowThatIdV1Schema,
        suggestion_id: KnowThatIdV1Schema,
        source_meta_job_id: KnowThatIdV1Schema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const KnowThatCandidateReviewRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("knowthat.candidate_review.v1"),
    ...KnowThatScopeV1Schema.properties,
    ...KnowThatPromotionSuggestionV1Schema.properties,
    trace_id: KnowThatTraceIdV1Schema,
    source_event: KnowThatCandidateReviewSourceEventV1Schema,
  },
  { additionalProperties: false },
);

export const KnowThatCandidateReviewV1Schema = Type.Union(
  [
    KnowThatCandidateReviewRequestV1Schema,
    KnowThatCandidateReviewResultV1Schema,
  ],
  { $id: "urn:pai:knowthat:candidate-review:v1" },
);

export type KnowThatCandidateReviewRequestV1 = Static<
  typeof KnowThatCandidateReviewRequestV1Schema
>;
export type KnowThatCandidateReviewV1 = Static<
  typeof KnowThatCandidateReviewV1Schema
>;

export function assertKnowThatCandidateReviewRequestV1(
  value: unknown,
): asserts value is KnowThatCandidateReviewRequestV1 {
  assertKnowThatSchemaV1(
    KnowThatCandidateReviewRequestV1Schema,
    value,
    "KnowThat candidate review request",
  );
  assertKnowThatPromotionSuggestionSemanticBindingsV1(value);
  if (
    value.source_event.workspace_id !== value.workspace_id ||
    value.source_event.bot_id !== value.bot_id ||
    value.source_event.owner_agent_id !== value.owner_agent_id ||
    value.source_event.deployment_environment !==
      value.deployment_environment ||
    value.source_event.release_channel !== value.release_channel ||
    value.source_event.payload.candidate_id !== value.candidate_id ||
    value.source_event.payload.suggestion_id !== value.suggestion_id ||
    value.source_event.payload.source_meta_job_id !== value.source_meta_job_id
  ) {
    throw new Error(
      "KnowThat candidate review source event binding mismatch",
    );
  }
}
