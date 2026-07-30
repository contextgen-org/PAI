import { Type, type Static } from "@sinclair/typebox";

import { ServiceIdV1Schema } from "../shared/service-id.v1.js";
import { TypedEvidenceRefV1Schema } from "../shared/typed-evidence-ref.v1.js";
import {
  TerminalOutcomeV1Schema,
} from "./trigger-process-state.v1.js";
import {
  ContextSnapshotV1Schema,
} from "./context-compose.v1.js";
import {
  StructuredIntentV1Schema,
} from "./structured-intent.v1.js";
import {
  TriggerActorTypeV1Schema,
  TriggerSourceV1Schema,
} from "./trigger-admission.v1.js";
import {
  TriggerProcessorBotScopeV1Properties,
  TriggerProcessorIdentifierV1Schema,
  TriggerProcessorPositiveVersionV1Schema,
  TriggerProcessorReasonCodeV1Schema,
  TriggerProcessorSha256V1Schema,
  TriggerProcessorTimestampV1Schema,
} from "./contract-primitives.v1.js";
import {
  SnapshotOverflowRefV1Schema,
  assertSnapshotOverflowRefSemanticBindingsV1,
} from "./snapshot-overflow-ref.v1.js";

const nullableIdentifier = Type.Union([
  TriggerProcessorIdentifierV1Schema,
  Type.Null(),
]);
const nullableReason = Type.Union([
  TriggerProcessorReasonCodeV1Schema,
  Type.Null(),
]);
const nullableTimestamp = Type.Union([
  TriggerProcessorTimestampV1Schema,
  Type.Null(),
]);

const sourceSequenceSchema = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const TriggerProcessSourceSequenceMapV1Schema = Type.Object(
  {
    trigger_processor: Type.Optional(sourceSequenceSchema),
    action_runtime: Type.Optional(sourceSequenceSchema),
    meta_cognition: Type.Optional(sourceSequenceSchema),
    memory: Type.Optional(sourceSequenceSchema),
    knowthat: Type.Optional(sourceSequenceSchema),
    skill_registry: Type.Optional(sourceSequenceSchema),
    timer_trigger_app: Type.Optional(sourceSequenceSchema),
    observation_gateway: Type.Optional(sourceSequenceSchema),
  },
  { additionalProperties: false },
);

const overflowableEntryIdentity = {
  source_service: ServiceIdV1Schema,
  source_event_id: TriggerProcessorIdentifierV1Schema,
  source_sequence_no: Type.Optional(TriggerProcessorPositiveVersionV1Schema),
  append_sequence_no: TriggerProcessorPositiveVersionV1Schema,
  payload_ref: TriggerProcessorIdentifierV1Schema,
  payload_hash: TriggerProcessorSha256V1Schema,
  created_at: TriggerProcessorTimestampV1Schema,
} as const;

export const TriggerProcessSnapshotEventRefV1Schema = Type.Object(
  {
    ...overflowableEntryIdentity,
    event_type: TriggerProcessorIdentifierV1Schema,
    schema_version: TriggerProcessorIdentifierV1Schema,
    occurred_at: TriggerProcessorTimestampV1Schema,
    runtime_run_id: nullableIdentifier,
    artifact_refs: Type.Array(TriggerProcessorIdentifierV1Schema, {
      maxItems: 10_000,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

const triggerEnvelopeSchema = Type.Object(
  {
    trigger_id: TriggerProcessorIdentifierV1Schema,
    source: TriggerSourceV1Schema,
    actor_type: TriggerActorTypeV1Schema,
    actor_id: TriggerProcessorIdentifierV1Schema,
    payload_ref: TriggerProcessorIdentifierV1Schema,
    payload_hash: TriggerProcessorSha256V1Schema,
    accepted_at: TriggerProcessorTimestampV1Schema,
  },
  { additionalProperties: false },
);

const agentRuntimeStateSchema = Type.Object(
  {
    runtime_run_id: TriggerProcessorIdentifierV1Schema,
    status: Type.Union([
      Type.Literal("queued"),
      Type.Literal("running"),
      Type.Literal("cancelling"),
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("cancelled"),
    ]),
    start_attempt_no: TriggerProcessorPositiveVersionV1Schema,
    start_fence_generation: TriggerProcessorPositiveVersionV1Schema,
    current_lease_generation: Type.Union([
      TriggerProcessorPositiveVersionV1Schema,
      Type.Null(),
    ]),
    updated_at: TriggerProcessorTimestampV1Schema,
  },
  { additionalProperties: false },
);

const actionTraceSchema = Type.Object(
  {
    ...overflowableEntryIdentity,
    step: TriggerProcessorPositiveVersionV1Schema,
    action_type: TriggerProcessorReasonCodeV1Schema,
    status: TriggerProcessorReasonCodeV1Schema,
    tool_name: nullableIdentifier,
    skill_key: nullableIdentifier,
    started_at: nullableTimestamp,
    completed_at: nullableTimestamp,
    reason_code: nullableReason,
  },
  { additionalProperties: false },
);

const toolResultSchema = Type.Object(
  {
    ...overflowableEntryIdentity,
    tool_invocation_id: TriggerProcessorIdentifierV1Schema,
    tool_name: TriggerProcessorIdentifierV1Schema,
    status: Type.Union([
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("cancelled"),
    ]),
    artifact_ref: nullableIdentifier,
    reason_code: nullableReason,
    completed_at: TriggerProcessorTimestampV1Schema,
  },
  { additionalProperties: false },
);

export const TriggerProcessSnapshotV1Schema = Type.Object(
  {
    schema_version: Type.Literal("trigger_process_snapshot.v1"),
    snapshot_id: TriggerProcessorIdentifierV1Schema,
    snapshot_version: TriggerProcessorPositiveVersionV1Schema,
    snapshot_hash: TriggerProcessorSha256V1Schema,
    trigger_process_id: TriggerProcessorIdentifierV1Schema,
    ...TriggerProcessorBotScopeV1Properties,
    phase: Type.Union([
      Type.Literal("admission"),
      Type.Literal("context"),
      Type.Literal("intent"),
      Type.Literal("execution"),
      Type.Literal("cooldown"),
      Type.Literal("meta_enqueued"),
      Type.Literal("closed"),
    ]),
    trigger: triggerEnvelopeSchema,
    context_snapshot: Type.Union([ContextSnapshotV1Schema, Type.Null()]),
    intent: Type.Union([StructuredIntentV1Schema, Type.Null()]),
    runtime_run_id: nullableIdentifier,
    policy_snapshot_id: nullableIdentifier,
    runtime_state: Type.Union([agentRuntimeStateSchema, Type.Null()]),
    action_trace: Type.Array(actionTraceSchema, { maxItems: 50 }),
    tool_results: Type.Array(toolResultSchema, { maxItems: 100 }),
    event_trace: Type.Array(TriggerProcessSnapshotEventRefV1Schema, {
      maxItems: 100,
    }),
    input_event_range: Type.Object(
      {
        first_append_sequence_no: Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
        last_append_sequence_no: Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
      },
      { additionalProperties: false },
    ),
    overflow_refs: Type.Array(SnapshotOverflowRefV1Schema, {
      maxItems: 10_000,
    }),
    last_append_sequence_no: Type.Integer({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    last_sequence_by_source: TriggerProcessSourceSequenceMapV1Schema,
    terminal_outcome: Type.Union([TerminalOutcomeV1Schema, Type.Null()]),
    terminal_outcome_finalized_at: nullableTimestamp,
    canonical_process_id: nullableIdentifier,
    successor_process_id: nullableIdentifier,
    superseded_by_process_id: nullableIdentifier,
    snapshot_transfer_ref: nullableIdentifier,
    boundary_system_event_ref: Type.Union([
      TypedEvidenceRefV1Schema,
      Type.Null(),
    ]),
    canonical_reason_code: nullableReason,
    user_visible_response: Type.Optional(
      Type.String({ minLength: 1, maxLength: 65_536 }),
    ),
    open_loops: Type.Array(Type.String({ minLength: 1, maxLength: 4_096 }), {
      maxItems: 10_000,
    }),
    created_at: TriggerProcessorTimestampV1Schema,
    updated_at: TriggerProcessorTimestampV1Schema,
    cooldown_until: nullableTimestamp,
    snapshot_retention_until: TriggerProcessorTimestampV1Schema,
  },
  {
    $id: "urn:pai:trigger-processor:process-snapshot:v1",
    additionalProperties: false,
  },
);

export type TriggerProcessSnapshotV1 = Static<
  typeof TriggerProcessSnapshotV1Schema
>;

export function assertTriggerProcessSnapshotSemanticBindingsV1(
  snapshot: TriggerProcessSnapshotV1,
): void {
  const runtimeBindingsPresent = snapshot.runtime_run_id !== null;
  const range = snapshot.input_event_range;
  const terminalPresent = snapshot.terminal_outcome !== null;
  const closedPendingMergedOutcome =
    snapshot.phase === "closed" &&
    !terminalPresent &&
    snapshot.canonical_process_id !== null;
  if (
    runtimeBindingsPresent !== (snapshot.policy_snapshot_id !== null) ||
    runtimeBindingsPresent !== (snapshot.runtime_state !== null) ||
    (snapshot.runtime_state !== null &&
      snapshot.runtime_state.runtime_run_id !== snapshot.runtime_run_id) ||
    (snapshot.intent !== null && snapshot.context_snapshot === null) ||
    (runtimeBindingsPresent &&
      (snapshot.context_snapshot === null || snapshot.intent === null)) ||
    (snapshot.phase === "admission" &&
      (snapshot.context_snapshot !== null ||
        snapshot.intent !== null ||
        runtimeBindingsPresent)) ||
    (snapshot.phase === "context" &&
      (snapshot.intent !== null || runtimeBindingsPresent)) ||
    (snapshot.phase === "intent" &&
      (snapshot.context_snapshot === null || runtimeBindingsPresent)) ||
    ((snapshot.phase === "execution" || snapshot.phase === "cooldown") &&
      (snapshot.context_snapshot === null ||
        snapshot.intent === null ||
        !runtimeBindingsPresent)) ||
    (snapshot.phase !== "closed" && terminalPresent) ||
    (snapshot.phase === "closed" &&
      !terminalPresent &&
      !closedPendingMergedOutcome) ||
    terminalPresent !== (snapshot.terminal_outcome_finalized_at !== null) ||
    terminalPresent !== (snapshot.canonical_reason_code !== null) ||
    (snapshot.phase === "cooldown" && snapshot.cooldown_until === null) ||
    range.last_append_sequence_no !== snapshot.last_append_sequence_no ||
    range.first_append_sequence_no > range.last_append_sequence_no ||
    (snapshot.event_trace.length === 0 &&
      snapshot.overflow_refs.length === 0 &&
      (range.first_append_sequence_no !== 0 ||
        range.last_append_sequence_no !== 0)) ||
    (snapshot.overflow_refs.length === 0 &&
      snapshot.event_trace.length > 0 &&
      (snapshot.event_trace[0]?.append_sequence_no !==
        range.first_append_sequence_no ||
        snapshot.event_trace.at(-1)?.append_sequence_no !==
          range.last_append_sequence_no)) ||
    snapshot.event_trace.some(
      (event, index) =>
        index > 0 &&
        event.append_sequence_no !==
          (snapshot.event_trace[index - 1]?.append_sequence_no ?? 0) + 1,
    ) ||
    snapshot.action_trace.some(
      (action, index) =>
        index > 0 &&
        action.append_sequence_no <=
          (snapshot.action_trace[index - 1]?.append_sequence_no ?? 0),
    ) ||
    (snapshot.cooldown_until !== null &&
      Date.parse(snapshot.snapshot_retention_until) <=
        Date.parse(snapshot.cooldown_until))
  ) {
    throw new Error("TriggerProcessSnapshotV1 semantic binding mismatch");
  }

  for (const entry of snapshot.overflow_refs) {
    assertSnapshotOverflowRefSemanticBindingsV1(entry);
  }
  const sortedOverflow = [...snapshot.overflow_refs].sort((left, right) =>
    left.first_append_sequence_no - right.first_append_sequence_no ||
    left.last_append_sequence_no - right.last_append_sequence_no ||
    left.source_service.localeCompare(right.source_service) ||
    left.object_ref.localeCompare(right.object_ref),
  );
  if (
    snapshot.overflow_refs.some(
      (entry, index) => entry !== sortedOverflow[index],
    ) ||
    snapshot.overflow_refs.some(
      (entry) =>
        Date.parse(entry.retention_until) <
          Date.parse(snapshot.snapshot_retention_until),
    )
  ) {
    throw new Error("TriggerProcessSnapshotV1 overflow manifest mismatch");
  }

  const sourceRanges = [
    ...snapshot.event_trace
      .filter((event) => event.source_sequence_no !== undefined)
      .map((event) => ({
        source: event.source_service,
        append: event.append_sequence_no,
        first: event.source_sequence_no!,
        last: event.source_sequence_no!,
      })),
    ...snapshot.overflow_refs
      .filter((entry) => entry.source_sequence_range !== undefined)
      .map((entry) => ({
        source: entry.source_service,
        append: entry.first_append_sequence_no,
        first: entry.source_sequence_range!.first_source_sequence_no,
        last: entry.source_sequence_range!.last_source_sequence_no,
      })),
  ].sort((left, right) => left.append - right.append);
  const lastBySource = new Map<string, number>();
  for (const sourceRange of sourceRanges) {
    const previous = lastBySource.get(sourceRange.source);
    if (previous !== undefined && sourceRange.first <= previous) {
      throw new Error("TriggerProcessSnapshotV1 source sequence is not monotonic");
    }
    lastBySource.set(sourceRange.source, sourceRange.last);
  }
  const sourceWatermarks = snapshot.last_sequence_by_source as Readonly<
    Record<string, number | undefined>
  >;
  for (const [source, sequence] of lastBySource) {
    if (sourceWatermarks[source] !== sequence) {
      throw new Error("TriggerProcessSnapshotV1 source watermark mismatch");
    }
  }

  if (range.last_append_sequence_no > 0) {
    const coverage = [
      ...snapshot.overflow_refs.map((entry) => [
        entry.first_append_sequence_no,
        entry.last_append_sequence_no,
      ] as const),
      ...snapshot.event_trace.map((entry) => [
        entry.append_sequence_no,
        entry.append_sequence_no,
      ] as const),
    ].sort((left, right) => left[0] - right[0] || left[1] - right[1]);
    let coveredUntil = range.first_append_sequence_no - 1;
    for (const [first, last] of coverage) {
      if (first !== coveredUntil + 1) {
        throw new Error(
          "TriggerProcessSnapshotV1 append range overlaps or has a gap",
        );
      }
      coveredUntil = last;
    }
    if (
      coverage.length === 0 ||
      coverage[0]?.[0] !== range.first_append_sequence_no ||
      coveredUntil < range.last_append_sequence_no
    ) {
      throw new Error("TriggerProcessSnapshotV1 append range has a gap");
    }
  }
}
