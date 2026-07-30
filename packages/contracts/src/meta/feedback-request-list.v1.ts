import { Type, type Static } from "@sinclair/typebox";

import { FeedbackDedupeScopeRefValueV1Schema } from "./feedback-dedupe-scope-ref.v1.js";
import { MetaFeedbackDeliveryStatusV1Schema } from "./feedback-request.v1.js";
import {
  MetaBotScopeV1Properties,
  MetaIdentifierV1Schema,
  MetaTimestampV1Schema,
} from "./primitives.v1.js";

export const MetaFeedbackRequestListRequestV1Schema = Type.Object(
  {
    status: Type.Literal("open"),
    assignee: MetaIdentifierV1Schema,
    ...MetaBotScopeV1Properties,
    cursor: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    limit: Type.Integer({ minimum: 1, maximum: 200 }),
    trace_id: Type.Optional(MetaIdentifierV1Schema),
  },
  { additionalProperties: false },
);

export const MetaFeedbackRequestListItemV1Schema = Type.Object(
  {
    feedback_request_id: MetaIdentifierV1Schema,
    bot_id: MetaIdentifierV1Schema,
    dedupe_scope_ref: FeedbackDedupeScopeRefValueV1Schema,
    question_key: MetaIdentifierV1Schema,
    question_ref: MetaIdentifierV1Schema,
    status: Type.Literal("open"),
    assignee: MetaIdentifierV1Schema,
    delivery_mode: Type.Union([
      Type.Literal("proactive"),
      Type.Literal("internal_queue"),
    ]),
    delivery_status: MetaFeedbackDeliveryStatusV1Schema,
    created_at: MetaTimestampV1Schema,
    expires_at: MetaTimestampV1Schema,
  },
  { additionalProperties: false },
);

export const MetaFeedbackRequestListResponseV1Schema = Type.Object(
  {
    assignee: MetaIdentifierV1Schema,
    items: Type.Array(MetaFeedbackRequestListItemV1Schema, {
      maxItems: 200,
    }),
    next_cursor: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    has_more: Type.Boolean(),
    trace_id: MetaIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const MetaFeedbackRequestListContractV1Schema = Type.Union(
  [
    MetaFeedbackRequestListRequestV1Schema,
    MetaFeedbackRequestListResponseV1Schema,
  ],
  { $id: "urn:pai:meta:feedback-request-list:v1" },
);

export type MetaFeedbackRequestListRequestV1 = Static<
  typeof MetaFeedbackRequestListRequestV1Schema
>;
export type MetaFeedbackRequestListResponseV1 = Static<
  typeof MetaFeedbackRequestListResponseV1Schema
>;

export function assertMetaFeedbackRequestListResponseSemanticBindingsV1(
  response: MetaFeedbackRequestListResponseV1,
): void {
  if (response.has_more !== (response.next_cursor !== null)) {
    throw new Error("MetaFeedbackRequestListContractV1 cursor mismatch");
  }
  let previous:
    | Static<typeof MetaFeedbackRequestListItemV1Schema>
    | undefined;
  for (const item of response.items) {
    if (
      item.assignee !== response.assignee ||
      (previous !== undefined &&
        (Date.parse(previous.created_at) > Date.parse(item.created_at) ||
          (previous.created_at === item.created_at &&
            previous.feedback_request_id.localeCompare(
              item.feedback_request_id,
            ) >= 0)))
    ) {
      throw new Error("MetaFeedbackRequestListContractV1 binding mismatch");
    }
    previous = item;
  }
}
