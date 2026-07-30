import { Type, type Static } from "@sinclair/typebox";

import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import { canonicalJsonV1 } from "../shared/canonical-json.v1.js";
import {
  KnowThatIdV1Schema,
  KnowThatJsonValueV1Schema,
  KnowThatTimestampV1Schema,
  KnowThatTraceIdV1Schema,
  assertKnowThatSchemaV1,
} from "./primitives.v1.js";

export const KNOWTHAT_FEEDBACK_TYPES_V1 = [
  "confirm",
  "deny",
  "clarify",
  "correct",
] as const;

export const KnowThatFeedbackTypeV1Schema = Type.Union(
  KNOWTHAT_FEEDBACK_TYPES_V1.map((value) => Type.Literal(value)),
);

export const KnowThatFeedbackPayloadV1Schema = Type.Record(
  Type.String(),
  KnowThatJsonValueV1Schema,
);

export const KnowThatFeedbackRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("knowthat_feedback.v1"),
    feedback_type: KnowThatFeedbackTypeV1Schema,
    payload: KnowThatFeedbackPayloadV1Schema,
    evidence_ref: TypedEvidenceRefV1Schema,
    idempotency_key: Type.String({ minLength: 1, maxLength: 512 }),
    trace_id: KnowThatTraceIdV1Schema,
  },
  {
    $id: "urn:pai:knowthat:feedback-request:v1",
    additionalProperties: false,
    maxCanonicalJsonBytes: 65_536,
  },
);

export const KnowThatFeedbackResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("knowthat_feedback.v1"),
    id: KnowThatIdV1Schema,
    bot_id: KnowThatIdV1Schema,
    fact_id: KnowThatIdV1Schema,
    feedback_type: KnowThatFeedbackTypeV1Schema,
    payload: KnowThatFeedbackPayloadV1Schema,
    evidence_ref: TypedEvidenceRefV1Schema,
    created_at: KnowThatTimestampV1Schema,
    duplicate_replayed: Type.Boolean(),
  },
  {
    $id: "urn:pai:knowthat:feedback-response:v1",
    additionalProperties: false,
    maxCanonicalJsonBytes: 65_536,
  },
);

export type KnowThatFeedbackTypeV1 = Static<
  typeof KnowThatFeedbackTypeV1Schema
>;
export type KnowThatFeedbackRequestV1 = Static<
  typeof KnowThatFeedbackRequestV1Schema
>;
export type KnowThatFeedbackResponseV1 = Static<
  typeof KnowThatFeedbackResponseV1Schema
>;

export function assertKnowThatFeedbackRequestV1(
  value: unknown,
): asserts value is KnowThatFeedbackRequestV1 {
  assertKnowThatSchemaV1(
    KnowThatFeedbackRequestV1Schema,
    value,
    "KnowThat feedback request",
  );
}

export function assertKnowThatFeedbackResponseSemanticBindingsV1(
  request: KnowThatFeedbackRequestV1,
  factId: string,
  response: KnowThatFeedbackResponseV1,
): void {
  if (
    response.fact_id !== factId ||
    response.feedback_type !== request.feedback_type ||
    response.evidence_ref !== request.evidence_ref ||
    canonicalJsonV1(response.payload) !== canonicalJsonV1(request.payload)
  ) {
    throw new Error("KnowThat feedback response binding mismatch");
  }
}
