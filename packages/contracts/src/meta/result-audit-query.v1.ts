import { Type, type Static } from "@sinclair/typebox";

import {
  MetaBotScopeV1Properties,
  MetaIdentifierV1Schema,
  MetaJsonObjectV1Schema,
  MetaSafeCountV1Schema,
  MetaSafeVersionV1Schema,
  MetaTimestampV1Schema,
} from "./primitives.v1.js";

const resultStatus = Type.Union([
  Type.Literal("complete"),
  Type.Literal("partial_pending"),
  Type.Literal("partial_failed"),
]);

export const MetaResultAuditQueryRequestV1Schema = Type.Object(
  {
    meta_result_id: MetaIdentifierV1Schema,
    ...MetaBotScopeV1Properties,
    cursor: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    limit: Type.Integer({ minimum: 1, maximum: 200 }),
    trace_id: Type.Optional(MetaIdentifierV1Schema),
  },
  { additionalProperties: false },
);

export const MetaResultAuditItemV1Schema = Type.Object(
  {
    audit_id: MetaIdentifierV1Schema,
    result_version: MetaSafeVersionV1Schema,
    previous_result_status: Type.Union([resultStatus, Type.Null()]),
    result_status: resultStatus,
    operation: MetaIdentifierV1Schema,
    changed_failure_ids: Type.Array(MetaIdentifierV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
    actor_kind: Type.Union([
      Type.Literal("service"),
      Type.Literal("operator"),
      Type.Literal("system"),
    ]),
    actor_ref: MetaIdentifierV1Schema,
    payload_summary: MetaJsonObjectV1Schema,
    created_at: MetaTimestampV1Schema,
  },
  { additionalProperties: false },
);

export const MetaResultAuditQueryResponseV1Schema = Type.Object(
  {
    meta_result_id: MetaIdentifierV1Schema,
    trigger_process_id: MetaIdentifierV1Schema,
    bot_id: MetaIdentifierV1Schema,
    result_version: MetaSafeVersionV1Schema,
    result_status: resultStatus,
    items: Type.Array(MetaResultAuditItemV1Schema, { maxItems: 200 }),
    next_cursor: Type.Union([MetaIdentifierV1Schema, Type.Null()]),
    has_more: Type.Boolean(),
    redacted_field_count: MetaSafeCountV1Schema,
    trace_id: MetaIdentifierV1Schema,
  },
  { additionalProperties: false },
);

export const MetaResultAuditQueryContractV1Schema = Type.Union(
  [
    MetaResultAuditQueryRequestV1Schema,
    MetaResultAuditQueryResponseV1Schema,
  ],
  { $id: "urn:pai:meta:result-audit-query:v1" },
);

export type MetaResultAuditQueryRequestV1 = Static<
  typeof MetaResultAuditQueryRequestV1Schema
>;
export type MetaResultAuditQueryResponseV1 = Static<
  typeof MetaResultAuditQueryResponseV1Schema
>;

export function assertMetaResultAuditQueryResponseSemanticBindingsV1(
  response: MetaResultAuditQueryResponseV1,
): void {
  if (response.has_more !== (response.next_cursor !== null)) {
    throw new Error("MetaResultAuditQueryContractV1 cursor mismatch");
  }
  let prior: Static<typeof MetaResultAuditItemV1Schema> | undefined;
  for (const item of response.items) {
    if (
      item.result_version > response.result_version ||
      (prior !== undefined &&
        (prior.result_version > item.result_version ||
          (prior.result_version === item.result_version &&
            prior.audit_id.localeCompare(item.audit_id) >= 0)))
    ) {
      throw new Error("MetaResultAuditQueryContractV1 ordering mismatch");
    }
    prior = item;
  }
}
