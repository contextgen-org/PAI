import { Type, type Static, type TLiteral, type TSchema } from "@sinclair/typebox";

import { DurableEventEnvelopeV1Schema } from "../shared/durable-event-envelope.v1.js";
import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorReasonCodeV1Schema,
} from "../trigger-processor/index-internal.v1.js";

const nullableReason = Type.Union([
  TriggerProcessorReasonCodeV1Schema,
  Type.Null(),
]);
const nullableSummary = Type.Union([
  Type.String({ minLength: 1, maxLength: 1_024 }),
  Type.Null(),
]);
const nullableRef = Type.Union([
  TriggerProcessorIdentifierV1Schema,
  Type.Null(),
]);
const nullableRuntimeEventError = Type.Union([
  Type.Object(
    {
      failure_class: Type.String({ minLength: 1, maxLength: 256 }),
      code: Type.String({ minLength: 1, maxLength: 256 }),
      message: Type.String({ minLength: 1, maxLength: 1_024 }),
      retryable: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
  Type.Null(),
]);

function runtimeToolEventEnvelopeV1<
  TEvent extends string,
  TPayload extends TSchema,
>(eventType: TLiteral<TEvent>, payload: TPayload) {
  return Type.Object(
    {
      event_id: DurableEventEnvelopeV1Schema.properties.event_id,
      event_type: eventType,
      schema_version: Type.Literal("runtime_event.v1"),
      producer: Type.Literal("action_runtime"),
      occurred_at: DurableEventEnvelopeV1Schema.properties.occurred_at,
      idempotency_key:
        DurableEventEnvelopeV1Schema.properties.idempotency_key,
      trace_id: DurableEventEnvelopeV1Schema.properties.trace_id,
      payload,
    },
    { additionalProperties: false },
  );
}

const runtimeToolIdentity = {
  trigger_process_id: TriggerProcessorIdentifierV1Schema,
  runtime_run_id: TriggerProcessorIdentifierV1Schema,
  sequence_no: Type.Integer({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  }),
  ...TriggerProcessorBotScopeV1Properties,
  start_attempt_no: TriggerProcessorPositiveVersionV1Schema,
  start_fence_generation: TriggerProcessorPositiveVersionV1Schema,
} as const;

export const TOOL_INVOCATION_EVENT_BRANCH_SCHEMAS_V1 = Object.freeze(
  ([
    ["runtime.tool.requested", "requested"],
    ["runtime.tool.completed", "completed"],
    ["runtime.tool.failed", "failed"],
    ["runtime.tool.cancelled", "cancelled"],
  ] as const).map(([eventType, status]) =>
    runtimeToolEventEnvelopeV1(
      Type.Literal(eventType),
      Type.Object(
        {
          ...runtimeToolIdentity,
          tool_invocation_id: TriggerProcessorIdentifierV1Schema,
          tool_name: TriggerProcessorIdentifierV1Schema,
          status: Type.Literal(status),
          policy_snapshot_id: TriggerProcessorIdentifierV1Schema,
          capability_token_id: TriggerProcessorIdentifierV1Schema,
          input_ref: TriggerProcessorIdentifierV1Schema,
          output_ref: nullableRef,
          side_effect_status: Type.Union([
            Type.Literal("none"),
            Type.Literal("produced"),
            Type.Literal("unknown"),
          ]),
          downstream_idempotency_key: TriggerProcessorIdentifierV1Schema,
          external_response_ref: nullableRef,
          external_error_ref: nullableRef,
          duplicate_replayed: Type.Boolean(),
          error: nullableRuntimeEventError,
          duration_ms: Type.Union([
            Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
            Type.Null(),
          ]),
          reason_code: nullableReason,
          error_summary: nullableSummary,
          artifact_ref: nullableRef,
        },
        { additionalProperties: false },
      ),
    ),
  ),
);

export const ToolInvocationEventV1Schema = Type.Union(
  [...TOOL_INVOCATION_EVENT_BRANCH_SCHEMAS_V1],
  { $id: "urn:pai:action-runtime:tool-event:v1" },
);

export type ToolInvocationEventV1 = Static<
  typeof ToolInvocationEventV1Schema
>;

export function assertToolInvocationEventSemanticBindingsV1(
  event: ToolInvocationEventV1,
): void {
  const payload = event.payload;
  if (payload.artifact_ref !== payload.output_ref) {
    throw new Error("Runtime tool artifact projection is inconsistent");
  }
  switch (event.event_type) {
    case "runtime.tool.requested":
      if (
        payload.output_ref !== null ||
        payload.side_effect_status !== "none" ||
        payload.external_response_ref !== null ||
        payload.external_error_ref !== null ||
        payload.error !== null ||
        payload.duplicate_replayed
      ) {
        throw new Error("Runtime tool request facts are inconsistent");
      }
      return;
    case "runtime.tool.completed":
      if (
        payload.output_ref === null ||
        payload.side_effect_status === "unknown" ||
        payload.external_response_ref === null ||
        payload.external_error_ref !== null ||
        payload.error !== null
      ) {
        throw new Error("Runtime tool completion facts are inconsistent");
      }
      return;
    case "runtime.tool.failed":
      if (
        payload.output_ref === null ||
        payload.external_response_ref !== null ||
        payload.external_error_ref === null ||
        payload.error === null ||
        (payload.side_effect_status === "unknown" &&
          payload.error.failure_class !== "external_outcome_unknown")
      ) {
        throw new Error("Runtime tool failure facts are inconsistent");
      }
      return;
    case "runtime.tool.cancelled":
      if (
        payload.output_ref !== null ||
        payload.side_effect_status !== "none" ||
        payload.external_response_ref !== null ||
        payload.external_error_ref !== null ||
        payload.error !== null
      ) {
        throw new Error("Runtime tool cancellation facts are inconsistent");
      }
  }
}
