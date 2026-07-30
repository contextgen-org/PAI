import { Type, type Static } from "@sinclair/typebox";

import {
  MetaIdentifierV1Schema,
  MetaJsonObjectV1Schema,
} from "./primitives.v1.js";

export const MetaFeedbackAnswerRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("meta_feedback_answer.v1"),
    feedback_request_id: MetaIdentifierV1Schema,
    trigger_id: MetaIdentifierV1Schema,
    bot_id: MetaIdentifierV1Schema,
    answer_payload: MetaJsonObjectV1Schema,
    trace_id: MetaIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const MetaFeedbackAnswerResponseV1Schema = Type.Union([
  Type.Object(
    {
      feedback_request_id: MetaIdentifierV1Schema,
      status: Type.Literal("answered"),
      answered_by_trigger_id: MetaIdentifierV1Schema,
      duplicate_replayed: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      feedback_request_id: MetaIdentifierV1Schema,
      status: Type.Union([
        Type.Literal("answered"),
        Type.Literal("cancelled"),
        Type.Literal("expired"),
        Type.Literal("superseded"),
      ]),
      code: Type.Union([
        Type.Literal("idempotency_conflict"),
        Type.Literal("feedback_request_closed"),
      ]),
      answered_by_trigger_id: Type.Union([
        MetaIdentifierV1Schema,
        Type.Null(),
      ]),
      duplicate_replayed: Type.Literal(false),
    },
    { additionalProperties: false },
  ),
]);

export const MetaFeedbackAnswerContractV1Schema = Type.Union(
  [
    MetaFeedbackAnswerRequestV1Schema,
    MetaFeedbackAnswerResponseV1Schema,
  ],
  { $id: "urn:pai:meta:feedback-answer:v1" },
);

export type MetaFeedbackAnswerRequestV1 = Static<
  typeof MetaFeedbackAnswerRequestV1Schema
>;
export type MetaFeedbackAnswerResponseV1 = Static<
  typeof MetaFeedbackAnswerResponseV1Schema
>;

export function assertMetaFeedbackAnswerPathBindingV1(
  pathFeedbackRequestId: string,
  request: MetaFeedbackAnswerRequestV1,
): void {
  if (pathFeedbackRequestId !== request.feedback_request_id) {
    throw new Error("MetaFeedbackAnswerContractV1 path/body mismatch");
  }
}
