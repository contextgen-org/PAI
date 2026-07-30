import {
  Type,
  type Static,
  type TProperties,
} from "@sinclair/typebox";

import {
  type ActionRuntimeDomainEventTypeV1,
} from "../action-runtime/runtime-events.v1.js";
import { ServiceIdV1Schema } from "../shared/service-id.v1.js";
import {
  TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1,
} from "./events.v1.js";
import {
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorTimestampV1Schema,
} from "./contract-primitives.v1.js";
import {
  CLOSED_STATUS_TERMINAL_OUTCOMES_V1,
  TerminalOutcomeV1Schema,
  TriggerProcessStateV1Schema,
} from "./trigger-process-state.v1.js";

export const TriggerProcessSseRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_process_sse_request.v1"),
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    last_event_id: Type.Optional(TriggerProcessorIdentifierV1Schema),
    start_after_append_sequence_no: Type.Optional(
      Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    ),
  },
  {
    $id: "urn:pai:trigger-processor:process-sse-request:v1",
    additionalProperties: false,
  },
);

const projectionBase = {
  schema_version: Type.Literal("trigger_process_sse_event.v1"),
  trigger_process_id: TriggerProcessorIdentifierV1Schema,
  occurred_at: TriggerProcessorTimestampV1Schema,
  trace_id: TriggerProcessorIdentifierV1Schema,
} as const;

const nullableOutcome = Type.Union([TerminalOutcomeV1Schema, Type.Null()]);
const nullableTimestamp = Type.Union([
  TriggerProcessorTimestampV1Schema,
  Type.Null(),
]);
const durableAppendSequence = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});
const summaryAppendSequence = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});
const runtimeObservationBase = {
  duration_ms: Type.Union([
    Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    Type.Null(),
  ]),
  reason_code: Type.Union([
    TriggerProcessorReasonCodeV1Schema,
    Type.Null(),
  ]),
  error_summary: Type.Union([
    Type.String({ minLength: 1, maxLength: 1_024 }),
    Type.Null(),
  ]),
  artifact_ref: Type.Union([
    TriggerProcessorIdentifierV1Schema,
    Type.Null(),
  ]),
} as const;

function runtimeSseEventBranch<
  const TEventType extends ActionRuntimeDomainEventTypeV1,
  const TStatus extends string,
  const TIdentityProperties extends TProperties,
>(
  eventType: TEventType,
  status: TStatus,
  identityProperties: TIdentityProperties,
) {
  return Type.Object(
    {
      ...projectionBase,
      append_sequence_no: durableAppendSequence,
      event_type: Type.Literal(eventType),
      observation_summary: Type.Object(
        {
          ...runtimeObservationBase,
          status: Type.Literal(status),
          ...identityProperties,
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  );
}

const runtimeRunIdentity = {
  runtime_run_id: TriggerProcessorIdentifierV1Schema,
} as const;
const runtimeToolIdentity = {
  tool_invocation_id: TriggerProcessorIdentifierV1Schema,
  tool_name: TriggerProcessorIdentifierV1Schema,
} as const;
const runtimeControlSignalIdentity = {
  runtime_signal_id: TriggerProcessorIdentifierV1Schema,
  safe_point_ref: Type.Union([
    TriggerProcessorIdentifierV1Schema,
    Type.Null(),
  ]),
  isolation_proof_ref: Type.Union([
    TriggerProcessorIdentifierV1Schema,
    Type.Null(),
  ]),
} as const;
const runtimeSkillIdentity = {
  skill_key: TriggerProcessorIdentifierV1Schema,
  skill_version: Type.Union([
    TriggerProcessorIdentifierV1Schema,
    Type.Null(),
  ]),
} as const;

const runtimeSseEventBranches = [
  runtimeSseEventBranch("runtime.run.started", "running", runtimeRunIdentity),
  runtimeSseEventBranch("runtime.run.completed", "completed", runtimeRunIdentity),
  runtimeSseEventBranch("runtime.run.failed", "failed", runtimeRunIdentity),
  runtimeSseEventBranch("runtime.run.cancelled", "cancelled", runtimeRunIdentity),
  runtimeSseEventBranch("runtime.run.preempted", "cancelled", runtimeRunIdentity),
  runtimeSseEventBranch("runtime.tool.requested", "requested", runtimeToolIdentity),
  runtimeSseEventBranch("runtime.tool.completed", "completed", runtimeToolIdentity),
  runtimeSseEventBranch("runtime.tool.failed", "failed", runtimeToolIdentity),
  runtimeSseEventBranch("runtime.tool.cancelled", "cancelled", runtimeToolIdentity),
  runtimeSseEventBranch("runtime.artifact.created", "available", runtimeRunIdentity),
  runtimeSseEventBranch("runtime.artifact.failed", "failed", runtimeRunIdentity),
  runtimeSseEventBranch(
    "runtime.control_signal.received",
    "received",
    runtimeControlSignalIdentity,
  ),
  runtimeSseEventBranch(
    "runtime.control_signal.handled",
    "handled",
    runtimeControlSignalIdentity,
  ),
  runtimeSseEventBranch(
    "runtime.skill.load.requested",
    "requested",
    runtimeSkillIdentity,
  ),
  runtimeSseEventBranch(
    "runtime.skill.load.resolved",
    "resolved",
    runtimeSkillIdentity,
  ),
  runtimeSseEventBranch(
    "runtime.skill.load.materialized",
    "materialized",
    runtimeSkillIdentity,
  ),
  runtimeSseEventBranch(
    "runtime.skill.load.failed",
    "failed",
    runtimeSkillIdentity,
  ),
] as const;
const acceptedPayload =
  TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1["trigger.accepted"];
const phaseChangedPayload =
  TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[
    "trigger_process.phase_changed"
  ];
const userRetractedPayload =
  TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[
    "trigger_process.user_message_retracted"
  ];
const systemInterruptedPayload =
  TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[
    "trigger_process.system_interrupted"
  ];
const weakMergedPayload =
  TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1["weak_trigger.merged"];
const outcomeFinalizedPayload =
  TRIGGER_PROCESSOR_DOMAIN_EVENT_PAYLOAD_SCHEMAS_V1[
    "trigger_process.outcome_finalized"
  ];

export const TriggerProcessSummaryV1Schema = Type.Object(
  {
    ...projectionBase,
    append_sequence_no: summaryAppendSequence,
    event_type: Type.Literal("trigger_process.summary"),
    observation_summary: Type.Object(
      {
        phase: TriggerProcessorIdentifierV1Schema,
        status: TriggerProcessorIdentifierV1Schema,
        reason_code: Type.Union([
          TriggerProcessorReasonCodeV1Schema,
          Type.Null(),
        ]),
        terminal_outcome: nullableOutcome,
        terminal_outcome_finalized_at: nullableTimestamp,
        observation_finalized: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const TriggerProcessSseEventV1Schema = Type.Union(
  [
    ...runtimeSseEventBranches,
    Type.Object(
      {
        ...projectionBase,
        append_sequence_no: durableAppendSequence,
        event_type: Type.Literal("trigger.accepted"),
        observation_summary: Type.Pick(acceptedPayload, [
          "trigger_id",
          "trigger_process_id",
          "admission_outcome",
          "priority",
          "dedupe_key",
          "request_hash",
          "reason_code",
          "source_ref",
        ]),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...projectionBase,
        append_sequence_no: durableAppendSequence,
        event_type: Type.Literal("trigger_process.phase_changed"),
        observation_summary: Type.Object(
          {
            trigger_process_id:
              phaseChangedPayload.properties.trigger_process_id,
            previous_state: TriggerProcessStateV1Schema,
            next_state: TriggerProcessStateV1Schema,
            expected_state_version:
              phaseChangedPayload.properties.expected_state_version,
            transition_id: phaseChangedPayload.properties.transition_id,
            reason_code: phaseChangedPayload.properties.reason_code,
            source_ref: phaseChangedPayload.properties.source_ref,
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...projectionBase,
        append_sequence_no: durableAppendSequence,
        event_type: Type.Literal("trigger_process.user_message_retracted"),
        observation_summary: Type.Pick(userRetractedPayload, [
          "trigger_process_id",
          "source_message_ref",
          "boundary_system_event_ref",
          "reason_code",
          "source_ref",
        ]),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...projectionBase,
        append_sequence_no: durableAppendSequence,
        event_type: Type.Literal("weak_trigger.merged"),
        observation_summary: Type.Pick(weakMergedPayload, [
          "weak_group_id",
          "canonical_process_id",
          "merged_process_ids",
          "merge_window_started_at",
          "reason_code",
          "source_ref",
        ]),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...projectionBase,
        append_sequence_no: durableAppendSequence,
        event_type: Type.Literal("trigger_process.system_interrupted"),
        observation_summary: Type.Pick(systemInterruptedPayload, [
          "trigger_process_id",
          "boundary_system_event_ref",
          "interrupt_source",
          "reason_code",
          "source_ref",
        ]),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...projectionBase,
        append_sequence_no: durableAppendSequence,
        event_type: Type.Literal("trigger_process.outcome_finalized"),
        observation_summary: Type.Object(
          {
            trigger_process_id:
              outcomeFinalizedPayload.properties.trigger_process_id,
            terminal_outcome:
              outcomeFinalizedPayload.properties.terminal_outcome,
            canonical_reason_code:
              outcomeFinalizedPayload.properties.canonical_reason_code,
            finalized_at: outcomeFinalizedPayload.properties.finalized_at,
            canonical_process_id:
              outcomeFinalizedPayload.properties.canonical_process_id,
            successor_process_id:
              outcomeFinalizedPayload.properties.successor_process_id,
            snapshot_transfer_ref:
              outcomeFinalizedPayload.properties.snapshot_transfer_ref,
            boundary_system_event_ref:
              outcomeFinalizedPayload.properties.boundary_system_event_ref,
            reason_code: outcomeFinalizedPayload.properties.reason_code,
            source_ref: outcomeFinalizedPayload.properties.source_ref,
            observation_finalized: Type.Boolean(),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...projectionBase,
        append_sequence_no: durableAppendSequence,
        event_type: Type.Literal("snapshot_gap_skipped"),
        observation_summary: Type.Object(
          {
            source_service: ServiceIdV1Schema,
            missing_source_sequence_range: Type.Object(
              {
                first_source_sequence_no: Type.Integer({
                  minimum: 1,
                  maximum: Number.MAX_SAFE_INTEGER,
                }),
                last_source_sequence_no: Type.Integer({
                  minimum: 1,
                  maximum: Number.MAX_SAFE_INTEGER,
                }),
              },
              { additionalProperties: false },
            ),
            last_contiguous_source_sequence_no: Type.Integer({
              minimum: 0,
              maximum: Number.MAX_SAFE_INTEGER,
            }),
            source_ref: TriggerProcessorIdentifierV1Schema,
            repair_status: Type.Union([
              Type.Literal("pending"),
              Type.Literal("not_required"),
              Type.Literal("completed"),
              Type.Literal("failed"),
            ]),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    TriggerProcessSummaryV1Schema,
  ],
  { $id: "urn:pai:trigger-processor:process-sse-event:v1" },
);

export type TriggerProcessSseRequestV1 = Static<
  typeof TriggerProcessSseRequestV1Schema
>;
export type TriggerProcessSseEventV1 = Static<
  typeof TriggerProcessSseEventV1Schema
>;
export type TriggerProcessSummaryV1 = Static<
  typeof TriggerProcessSummaryV1Schema
>;

const SUMMARY_STATUSES_BY_PHASE_V1 = {
  admission: ["running", "waiting"],
  context: ["running", "waiting"],
  intent: ["running", "waiting"],
  execution: ["running", "waiting", "preempt_requested", "cancelling"],
  cooldown: ["waiting"],
  meta_enqueued: ["waiting"],
  closed: ["completed", "failed", "preempted", "cancelled"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export function assertTriggerProcessSummarySemanticBindingsV1(
  event: TriggerProcessSummaryV1,
): void {
  const summary = event.observation_summary;
  const allowedStatuses =
    SUMMARY_STATUSES_BY_PHASE_V1[
      summary.phase as keyof typeof SUMMARY_STATUSES_BY_PHASE_V1
    ];
  const closed = summary.phase === "closed";
  const hasFinalizedOutcome =
    summary.terminal_outcome !== null &&
    summary.terminal_outcome_finalized_at !== null;
  if (
    allowedStatuses === undefined ||
    !(allowedStatuses as readonly string[]).includes(summary.status) ||
    (summary.terminal_outcome === null) !==
      (summary.terminal_outcome_finalized_at === null) ||
    (!closed && hasFinalizedOutcome) ||
    (summary.observation_finalized && !hasFinalizedOutcome)
  ) {
    throw new Error("TriggerProcessSummaryV1 semantic binding mismatch");
  }
  if (closed && hasFinalizedOutcome) {
    const allowedOutcomes =
      CLOSED_STATUS_TERMINAL_OUTCOMES_V1[
        summary.status as keyof typeof CLOSED_STATUS_TERMINAL_OUTCOMES_V1
      ];
    if (
      allowedOutcomes === undefined ||
      !(allowedOutcomes as readonly string[]).includes(
        summary.terminal_outcome as string,
      )
    ) {
      throw new Error("TriggerProcessSummaryV1 terminal binding mismatch");
    }
  }
}

export function assertTriggerProcessSummaryBindingsV1(
  event: TriggerProcessSummaryV1,
  expected: Readonly<{
    trigger_process_id: string;
    minimum_append_sequence_no: number;
  }>,
): void {
  if (
    !Number.isSafeInteger(expected.minimum_append_sequence_no) ||
    expected.minimum_append_sequence_no < 0 ||
    event.trigger_process_id !== expected.trigger_process_id ||
    event.append_sequence_no < expected.minimum_append_sequence_no
  ) {
    throw new Error("TriggerProcessSummaryV1 owner binding mismatch");
  }
}

export function assertTriggerProcessSseEventSemanticBindingsV1(
  event: TriggerProcessSseEventV1,
): void {
  if (event.event_type === "trigger_process.summary") {
    assertTriggerProcessSummarySemanticBindingsV1(event);
  }
  if (event.event_type === "snapshot_gap_skipped") {
    const range = event.observation_summary.missing_source_sequence_range;
    if (
      range.first_source_sequence_no > range.last_source_sequence_no ||
      event.observation_summary.last_contiguous_source_sequence_no + 1 !==
        range.first_source_sequence_no
    ) {
      throw new Error("TriggerProcessSseEventV1 gap marker binding mismatch");
    }
  }
  if (
    (event.event_type === "trigger.accepted" ||
      event.event_type === "trigger_process.phase_changed" ||
      event.event_type === "trigger_process.user_message_retracted" ||
      event.event_type === "trigger_process.system_interrupted" ||
      event.event_type === "trigger_process.outcome_finalized") &&
    event.observation_summary.trigger_process_id !== event.trigger_process_id
  ) {
    throw new Error("TriggerProcessSseEventV1 process binding mismatch");
  }
  if (
    event.event_type === "weak_trigger.merged" &&
    event.observation_summary.canonical_process_id !==
      event.trigger_process_id &&
    !event.observation_summary.merged_process_ids.includes(
      event.trigger_process_id,
    )
  ) {
    throw new Error("TriggerProcessSseEventV1 merge binding mismatch");
  }
  if (
    event.event_type === "trigger_process.phase_changed" &&
    (event.observation_summary.previous_state.phase ===
      event.observation_summary.next_state.phase &&
      event.observation_summary.previous_state.status ===
        event.observation_summary.next_state.status)
  ) {
    throw new Error("TriggerProcessSseEventV1 phase transition mismatch");
  }
}

export function parseTriggerProcessSseCursorV1(
  request: TriggerProcessSseRequestV1,
): number | null {
  if (
    request.last_event_id !== undefined &&
    request.start_after_append_sequence_no !== undefined
  ) {
    throw new Error("invalid_replay_cursor");
  }
  if (request.last_event_id !== undefined) {
    const separator = request.last_event_id.lastIndexOf(":");
    const processId = request.last_event_id.slice(0, separator);
    const sequence = request.last_event_id.slice(separator + 1);
    if (
      separator < 1 ||
      processId !== request.trigger_process_id ||
      !/^(?:0|[1-9][0-9]*)$/u.test(sequence)
    ) {
      throw new Error("invalid_replay_cursor");
    }
    const parsed = Number(sequence);
    if (!Number.isSafeInteger(parsed)) throw new Error("invalid_replay_cursor");
    return parsed;
  }
  return request.start_after_append_sequence_no ?? null;
}

export function triggerProcessSseEventIdV1(
  event: TriggerProcessSseEventV1,
): string {
  return `${event.trigger_process_id}:${event.append_sequence_no}`;
}
