import { Type, type Static } from "@sinclair/typebox";

import { DurableEventEnvelopeV1Schema } from "../shared/durable-event-envelope.v1.js";

const identifier = Type.String({ minLength: 1, maxLength: 512 });
const nullableIdentifier = Type.Union([identifier, Type.Null()]);
const nullableTimestamp = Type.Union([
  DurableEventEnvelopeV1Schema.properties.occurred_at,
  Type.Null(),
]);

export const TOOL_INVOCATION_QUERY_STATUSES_V1 = [
  "requested",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export const TOOL_INVOCATION_SIDE_EFFECT_STATUSES_V1 = [
  "none",
  "produced",
  "unknown",
] as const;

export const ToolInvocationQueryStatusV1Schema = Type.Union(
  TOOL_INVOCATION_QUERY_STATUSES_V1.map((status) => Type.Literal(status)),
);
export const ToolInvocationSideEffectStatusV1Schema = Type.Union(
  TOOL_INVOCATION_SIDE_EFFECT_STATUSES_V1.map((status) =>
    Type.Literal(status),
  ),
);

export const ToolInvocationQueryItemV1Schema = Type.Object(
  {
    tool_invocation_id: identifier,
    tool_name: identifier,
    status: ToolInvocationQueryStatusV1Schema,
    side_effect_status: ToolInvocationSideEffectStatusV1Schema,
    input_ref: nullableIdentifier,
    output_ref: nullableIdentifier,
    failure_class: nullableIdentifier,
    started_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
    completed_at: nullableTimestamp,
  },
  { additionalProperties: false },
);

export const ToolInvocationListDetailsV1Schema = Type.Object(
  {
    runtime_run_id: identifier,
    items: Type.Array(ToolInvocationQueryItemV1Schema, {
      maxItems: 200,
    }),
    next_cursor: nullableIdentifier,
    has_more: Type.Boolean(),
  },
  {
    $id: "urn:pai:action-runtime:tool-invocation-list:v1",
    additionalProperties: false,
  },
);

export type ToolInvocationQueryItemV1 = Static<
  typeof ToolInvocationQueryItemV1Schema
>;
export type ToolInvocationListDetailsV1 = Static<
  typeof ToolInvocationListDetailsV1Schema
>;

export function assertToolInvocationListDetailsSemanticBindingsV1(
  details: ToolInvocationListDetailsV1,
): void {
  if (details.has_more !== (details.next_cursor !== null)) {
    throw new Error("ToolInvocationListDetailsV1 cursor binding mismatch");
  }
  let previous: ToolInvocationQueryItemV1 | undefined;
  for (const item of details.items) {
    const terminal =
      item.status === "completed" ||
      item.status === "failed" ||
      item.status === "cancelled";
    if (
      terminal !== (item.completed_at !== null) ||
      (item.status === "failed") !== (item.failure_class !== null) ||
      (item.output_ref !== null && item.status !== "completed") ||
      (item.side_effect_status === "produced" && item.status !== "completed") ||
      (item.completed_at !== null &&
        Date.parse(item.started_at) > Date.parse(item.completed_at))
    ) {
      throw new Error("ToolInvocationListDetailsV1 item binding mismatch");
    }
    if (previous !== undefined) {
      const previousStarted = Date.parse(previous.started_at);
      const currentStarted = Date.parse(item.started_at);
      if (
        previousStarted < currentStarted ||
        (previousStarted === currentStarted &&
          previous.tool_invocation_id.localeCompare(item.tool_invocation_id) <= 0)
      ) {
        throw new Error("ToolInvocationListDetailsV1 ordering mismatch");
      }
    }
    previous = item;
  }
}
