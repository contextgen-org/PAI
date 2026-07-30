import {
  Type,
  type Static,
  type TLiteral,
  type TSchema,
} from "@sinclair/typebox";

import { DurableEventEnvelopeV1Schema } from "../shared/durable-event-envelope.v1.js";
import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorTimestampV1Schema,
} from "../trigger-processor/index-internal.v1.js";
import {
  TOOL_INVOCATION_EVENT_BRANCH_SCHEMAS_V1,
  assertToolInvocationEventSemanticBindingsV1,
  type ToolInvocationEventV1,
} from "./tool-events.v1.js";

export {
  ToolInvocationEventV1Schema,
  assertToolInvocationEventSemanticBindingsV1,
  type ToolInvocationEventV1,
} from "./tool-events.v1.js";

export const ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1 = Object.freeze([
  "runtime.run.started",
  "runtime.run.completed",
  "runtime.run.failed",
  "runtime.run.cancelled",
  "runtime.run.preempted",
  "runtime.tool.requested",
  "runtime.tool.completed",
  "runtime.tool.failed",
  "runtime.tool.cancelled",
  "runtime.artifact.created",
  "runtime.artifact.failed",
  "runtime.control_signal.received",
  "runtime.control_signal.handled",
  "runtime.skill.load.requested",
  "runtime.skill.load.resolved",
  "runtime.skill.load.materialized",
  "runtime.skill.load.failed",
] as const);

export const ActionRuntimeDomainEventTypeV1Schema = Type.Union(
  ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1.map((eventType) =>
    Type.Literal(eventType),
  ),
);

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
const runtimeSequenceNo = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});
const runtimeStatus = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("preempt_requested"),
  Type.Literal("cancelling"),
  Type.Literal("cancelled"),
  Type.Literal("completed"),
  Type.Literal("failed"),
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
const runtimeControlRequester = Type.Union([
  Type.Literal("trigger_processor"),
  Type.Literal("action_runtime"),
]);

function runtimeEventEnvelope<TEvent extends string, TPayload extends TSchema>(
  eventType: TLiteral<TEvent>,
  payload: TPayload,
) {
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

const runtimeIdentity = {
  trigger_process_id: TriggerProcessorIdentifierV1Schema,
  runtime_run_id: TriggerProcessorIdentifierV1Schema,
  sequence_no: runtimeSequenceNo,
  ...TriggerProcessorBotScopeV1Properties,
  start_attempt_no: TriggerProcessorPositiveVersionV1Schema,
  start_fence_generation: TriggerProcessorPositiveVersionV1Schema,
} as const;

const runtimeRunEventBranches = ([
  ["runtime.run.started", "running"],
  ["runtime.run.completed", "completed"],
  ["runtime.run.failed", "failed"],
  ["runtime.run.cancelled", "cancelled"],
  ["runtime.run.preempted", "cancelled"],
] as const).map(
  ([eventType, status]) =>
    runtimeEventEnvelope(
      Type.Literal(eventType),
      Type.Object(
        {
          ...runtimeIdentity,
          status: Type.Literal(status),
          previous_status: runtimeStatus,
          next_status: Type.Literal(status),
          model: Type.String({ minLength: 1, maxLength: 256 }),
          reason: nullableReason,
          duration_ms: Type.Union([
            Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
            Type.Null(),
          ]),
          reason_code: nullableReason,
          error_summary: nullableSummary,
          terminal_artifact_ref: nullableRef,
        },
        { additionalProperties: false },
      ),
    ),
);

const artifactEventBranches = [
  ["runtime.artifact.created", "available"],
  ["runtime.artifact.failed", "failed"],
] as const;

const skillStatusByEvent = [
  ["runtime.skill.load.requested", "requested"],
  ["runtime.skill.load.resolved", "resolved"],
  ["runtime.skill.load.materialized", "materialized"],
  ["runtime.skill.load.failed", "failed"],
] as const;

const runtimeDomainEventBranches = [
    ...runtimeRunEventBranches,
    ...TOOL_INVOCATION_EVENT_BRANCH_SCHEMAS_V1,
    ...artifactEventBranches.map(([eventType, status]) =>
      runtimeEventEnvelope(
        Type.Literal(eventType),
        Type.Object(
          {
            ...runtimeIdentity,
            artifact_id: TriggerProcessorIdentifierV1Schema,
            artifact_ref:
              status === "available"
                ? TriggerProcessorIdentifierV1Schema
                : Type.Null(),
            artifact_kind: TriggerProcessorIdentifierV1Schema,
            content_hash: TriggerProcessorSha256V1Schema,
            size_bytes: Type.Integer({
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
            }),
            media_type: Type.String({
              minLength: 1,
              maxLength: 256,
            }),
            retention_until: TriggerProcessorTimestampV1Schema,
            status: Type.Literal(status),
            artifact_status: Type.Literal(status),
            redaction_status: Type.Literal("complete"),
            error: nullableRuntimeEventError,
            reason_code: nullableReason,
            error_summary: nullableSummary,
          },
          { additionalProperties: false },
        ),
      ),
    ),
    runtimeEventEnvelope(
      Type.Literal("runtime.control_signal.received"),
      Type.Object(
        {
          ...runtimeIdentity,
          runtime_signal_id: TriggerProcessorIdentifierV1Schema,
          signal_type: Type.Union([
            Type.Literal("cancel"),
            Type.Literal("preempt"),
            Type.Literal("user_retract"),
          ]),
          requested_by: runtimeControlRequester,
          control_valid_until: TriggerProcessorTimestampV1Schema,
          status: Type.Literal("received"),
          handled_status: Type.Null(),
          target_lease_generation: Type.Union([
            TriggerProcessorPositiveVersionV1Schema,
            Type.Null(),
          ]),
          handled_lease_generation: Type.Null(),
          final_fencing_generation: Type.Null(),
          safe_point_reached: Type.Null(),
          late_events_isolated: Type.Null(),
          last_runtime_sequence_no: Type.Null(),
          safe_point_ref: Type.Null(),
          isolation_proof_ref: Type.Null(),
          reason_code: nullableReason,
        },
        { additionalProperties: false },
      ),
    ),
    runtimeEventEnvelope(
      Type.Literal("runtime.control_signal.handled"),
      Type.Object(
        {
          ...runtimeIdentity,
          runtime_signal_id: TriggerProcessorIdentifierV1Schema,
          signal_type: Type.Union([
            Type.Literal("cancel"),
            Type.Literal("preempt"),
            Type.Literal("user_retract"),
          ]),
          requested_by: runtimeControlRequester,
          control_valid_until: TriggerProcessorTimestampV1Schema,
          status: Type.Literal("handled"),
          handled_status: Type.Union([
            Type.Literal("handled_safe_point"),
            Type.Literal("cancelled_isolated_after_timeout"),
            Type.Literal("isolation_unproven"),
            Type.Literal("already_terminal"),
            Type.Literal("no_run_tombstoned"),
          ]),
          target_lease_generation: Type.Union([
            TriggerProcessorPositiveVersionV1Schema,
            Type.Null(),
          ]),
          handled_lease_generation: Type.Union([
            TriggerProcessorPositiveVersionV1Schema,
            Type.Null(),
          ]),
          final_fencing_generation: TriggerProcessorPositiveVersionV1Schema,
          safe_point_reached: Type.Boolean(),
          late_events_isolated: Type.Boolean(),
          last_runtime_sequence_no: Type.Union([
            Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
            Type.Null(),
          ]),
          safe_point_ref: nullableRef,
          isolation_proof_ref: nullableRef,
          reason_code: nullableReason,
        },
        { additionalProperties: false },
      ),
    ),
    ...skillStatusByEvent.map(([eventType, status]) =>
      runtimeEventEnvelope(
        Type.Literal(eventType),
        Type.Object(
          {
            ...runtimeIdentity,
            skill_key: TriggerProcessorIdentifierV1Schema,
            skill_version: Type.Union([
              TriggerProcessorIdentifierV1Schema,
              Type.Null(),
            ]),
            status: Type.Literal(status),
            reason_code: nullableReason,
            error_summary: nullableSummary,
            materialized_artifact_ref: nullableRef,
          },
          { additionalProperties: false },
        ),
      ),
    ),
  ] as const;

export const RuntimeDomainEventV1Schema = Type.Union(
  [...runtimeDomainEventBranches],
  { $id: "urn:pai:action-runtime:runtime-event:v1" },
);

export const ACTION_RUNTIME_DOMAIN_EVENT_BRANCH_SCHEMAS_V1 = Object.freeze(
  Object.fromEntries(
    ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1.map((eventType, index) => [
      eventType,
      runtimeDomainEventBranches[index],
    ]),
  ) as Readonly<
    Record<
      (typeof ACTION_RUNTIME_DOMAIN_EVENT_TYPES_V1)[number],
      (typeof runtimeDomainEventBranches)[number]
    >
  >,
);

export type ActionRuntimeDomainEventTypeV1 = Static<
  typeof ActionRuntimeDomainEventTypeV1Schema
>;
export type RuntimeDomainEventV1 = Static<typeof RuntimeDomainEventV1Schema>;

export function assertRuntimeDomainEventSemanticBindingsV1(
  event: RuntimeDomainEventV1,
): void {
  if (
    !Number.isSafeInteger(event.payload.sequence_no) ||
    event.payload.sequence_no < 1
  ) {
    throw new Error("Runtime event sequence is invalid");
  }
  if (
    event.event_type.startsWith("runtime.run.") &&
    "next_status" in event.payload &&
    "previous_status" in event.payload
  ) {
    const payload = event.payload;
    if (
      payload.status !== payload.next_status ||
      payload.reason !== payload.reason_code ||
      (event.event_type === "runtime.run.started" &&
        payload.previous_status !== "queued") ||
      (event.event_type !== "runtime.run.started" &&
        !["running", "preempt_requested", "cancelling"].includes(
          payload.previous_status,
        ))
    ) {
      throw new Error("Runtime run lifecycle projection is inconsistent");
    }
    return;
  }
  if (
    event.event_type.startsWith("runtime.tool.") &&
    "tool_invocation_id" in event.payload &&
    "side_effect_status" in event.payload
  ) {
    assertToolInvocationEventSemanticBindingsV1(
      event as ToolInvocationEventV1,
    );
    return;
  }
  if (
    event.event_type.startsWith("runtime.artifact.") &&
    "artifact_status" in event.payload
  ) {
    const payload = event.payload;
    if (
      payload.status !== payload.artifact_status ||
      (event.event_type === "runtime.artifact.created" &&
        (payload.artifact_ref === null || payload.error !== null)) ||
      (event.event_type === "runtime.artifact.failed" &&
        (payload.artifact_ref !== null || payload.error === null))
    ) {
      throw new Error("Runtime artifact lifecycle facts are inconsistent");
    }
    return;
  }
  if (event.event_type !== "runtime.control_signal.handled") return;
  const payload = event.payload;
  if (
    payload.final_fencing_generation < payload.start_fence_generation ||
    (payload.target_lease_generation !== null &&
      payload.handled_lease_generation !== null &&
      payload.handled_lease_generation < payload.target_lease_generation)
  ) {
    throw new Error("Runtime control handled fence regressed");
  }
  switch (payload.handled_status) {
    case "handled_safe_point":
      if (!payload.safe_point_reached || payload.safe_point_ref === null) {
        throw new Error("Runtime safe-point control proof is incomplete");
      }
      return;
    case "cancelled_isolated_after_timeout":
      if (
        payload.safe_point_reached ||
        !payload.late_events_isolated ||
        payload.isolation_proof_ref === null
      ) {
        throw new Error("Runtime timeout isolation proof is incomplete");
      }
      return;
    case "isolation_unproven":
      if (
        payload.safe_point_reached ||
        payload.late_events_isolated ||
        payload.isolation_proof_ref !== null
      ) {
        throw new Error("Runtime unproven isolation state is inconsistent");
      }
      return;
    case "no_run_tombstoned":
      if (
        payload.target_lease_generation !== null ||
        payload.handled_lease_generation !== null ||
        payload.last_runtime_sequence_no !== null ||
        !payload.late_events_isolated ||
        payload.isolation_proof_ref === null
      ) {
        throw new Error("Runtime no-run tombstone proof is incomplete");
      }
      return;
    case "already_terminal":
      if (
        payload.last_runtime_sequence_no === null ||
        !payload.late_events_isolated
      ) {
        throw new Error("Runtime terminal control proof is incomplete");
      }
      return;
  }
}
