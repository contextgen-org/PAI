import { Type, type Static } from "@sinclair/typebox";

import { FeedbackDedupeScopeRefValueV1Schema } from "./feedback-dedupe-scope-ref.v1.js";
import {
  MetaBotScopeV1Properties,
  MetaIdentifierV1Schema,
  MetaSha256V1Schema,
} from "./primitives.v1.js";

export const MetaFeedbackRequestSuggestionRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("meta.feedback_request_suggestion.v1"),
    source_kind: Type.Literal("service_command"),
    source_service: Type.Union([
      Type.Literal("memory_service"),
      Type.Literal("timer_trigger_app"),
    ]),
    source_ref: MetaIdentifierV1Schema,
    command_id: MetaIdentifierV1Schema,
    ...MetaBotScopeV1Properties,
    dedupe_scope_ref: FeedbackDedupeScopeRefValueV1Schema,
    question_key: MetaIdentifierV1Schema,
    question_ref: MetaIdentifierV1Schema,
    question_hash: MetaSha256V1Schema,
    request_hash: MetaSha256V1Schema,
    trace_id: MetaIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const MetaFeedbackRequestSuggestionResponseV1Schema = Type.Union([
  Type.Object(
    {
      status: Type.Union([
        Type.Literal("accepted"),
        Type.Literal("replayed"),
      ]),
      feedback_request_id: MetaIdentifierV1Schema,
      command_id: MetaIdentifierV1Schema,
      request_hash: MetaSha256V1Schema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("conflict"),
      code: Type.Union([
        Type.Literal("idempotency_body_drift"),
        Type.Literal("open_request_conflict"),
      ]),
      existing_feedback_request_id: Type.Optional(
        MetaIdentifierV1Schema,
      ),
    },
    { additionalProperties: false },
  ),
]);

export const MetaFeedbackRequestSuggestionContractV1Schema = Type.Union(
  [
    MetaFeedbackRequestSuggestionRequestV1Schema,
    MetaFeedbackRequestSuggestionResponseV1Schema,
  ],
  { $id: "urn:pai:meta:feedback-request-suggestion:v1" },
);

export type MetaFeedbackRequestSuggestionRequestV1 = Static<
  typeof MetaFeedbackRequestSuggestionRequestV1Schema
>;
export type MetaFeedbackRequestSuggestionResponseV1 = Static<
  typeof MetaFeedbackRequestSuggestionResponseV1Schema
>;
