import { Type, type Static, type TSchema } from "@sinclair/typebox";

import { FeedbackDedupeScopeRefValueV1Schema } from "./feedback-dedupe-scope-ref.v1.js";
import {
  MetaBotScopeV1Properties,
  MetaIdentifierV1Schema,
  MetaJsonObjectV1Schema,
  MetaSafeVersionV1Schema,
  MetaSha256V1Schema,
  MetaTimestampV1Schema,
} from "./primitives.v1.js";

export const META_FEEDBACK_REQUEST_STATUSES_V1 = [
  "open",
  "answered",
  "cancelled",
  "expired",
  "superseded",
] as const;

export const MetaFeedbackRequestStatusV1Schema = Type.Union(
  META_FEEDBACK_REQUEST_STATUSES_V1.map((status) => Type.Literal(status)),
);

export const MetaFeedbackDeliveryStatusV1Schema = Type.Union([
  Type.Literal("not_applicable"),
  Type.Literal("pending"),
  Type.Literal("dispatching"),
  Type.Literal("delivered"),
  Type.Literal("retry_wait"),
  Type.Literal("failed"),
]);

const common = {
  schema_version: Type.Literal("feedback_request.v1"),
  feedback_request_id: MetaIdentifierV1Schema,
  ...MetaBotScopeV1Properties,
  dedupe_scope_ref: FeedbackDedupeScopeRefValueV1Schema,
  question_key: MetaIdentifierV1Schema,
  question_payload_ref: MetaIdentifierV1Schema,
  question_payload_hash: MetaSha256V1Schema,
  status: MetaFeedbackRequestStatusV1Schema,
  delivery_mode: Type.Union([
    Type.Literal("proactive"),
    Type.Literal("internal_queue"),
  ]),
  target_actor_ref: MetaIdentifierV1Schema,
  target_binding_ref: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
  delivery_channel: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
  delivery_status: MetaFeedbackDeliveryStatusV1Schema,
  delivery_version: MetaSafeVersionV1Schema,
  created_at: MetaTimestampV1Schema,
  updated_at: MetaTimestampV1Schema,
  expires_at: MetaTimestampV1Schema,
  answered_by_trigger_id: Type.Union([
    MetaIdentifierV1Schema,
    Type.Null(),
  ]),
  answer_payload: Type.Union([MetaJsonObjectV1Schema, Type.Null()]),
} as const;

function feedbackSource<T extends Record<string, TSchema>>(source: T) {
  return Type.Object(
    {
      ...common,
      ...source,
    },
    { additionalProperties: false },
  );
}

export const FeedbackRequestV1Schema = Type.Union(
  [
    feedbackSource({
      source_kind: Type.Literal("meta_job"),
      meta_job_id: MetaIdentifierV1Schema,
      trigger_process_id: MetaIdentifierV1Schema,
    }),
    feedbackSource({
      source_kind: Type.Literal("service_command"),
      source_service: Type.Union([
        Type.Literal("memory_service"),
        Type.Literal("timer_trigger_app"),
      ]),
      source_ref: MetaIdentifierV1Schema,
      command_id: MetaIdentifierV1Schema,
      request_hash: MetaSha256V1Schema,
    }),
    feedbackSource({
      source_kind: Type.Literal("operator"),
      operator_principal_id: MetaIdentifierV1Schema,
      source_ref: MetaIdentifierV1Schema,
    }),
  ],
  { $id: "urn:pai:meta:feedback-request:v1" },
);

export type FeedbackRequestV1 = Static<typeof FeedbackRequestV1Schema>;

export function assertFeedbackRequestSemanticBindingsV1(
  request: FeedbackRequestV1,
): void {
  if (
    Date.parse(request.created_at) > Date.parse(request.updated_at) ||
    Date.parse(request.updated_at) > Date.parse(request.expires_at) ||
    (request.status === "answered") !==
      (request.answered_by_trigger_id !== null &&
        request.answer_payload !== null) ||
    (request.delivery_mode === "proactive" &&
      (request.target_binding_ref === null ||
        request.delivery_channel === null ||
        request.delivery_status === "not_applicable")) ||
    (request.delivery_mode === "internal_queue" &&
      request.delivery_status !== "not_applicable")
  ) {
    throw new Error("FeedbackRequestV1 semantic binding mismatch");
  }
}
