import { Type, type Static } from "@sinclair/typebox";

import {
  TimerTriggerSubmitPayloadV1Schema,
  assertCanonicalTimerTriggerTimeV1,
} from "../trigger-processor/trigger-submit.v1.js";
import { timerDispatchPayloadHashV1 } from "./dispatch-request.v1.js";
import {
  TimerIdentifierV1Schema,
  TimerIdentityV1Properties,
  TimerLocalDateV1Schema,
  TimerLocalTimeV1Schema,
  TimerNonNegativeVersionV1Schema,
  TimerOccurrenceKeyV1Schema,
  TimerOccurrenceStatusV1Schema,
  TimerPositiveVersionV1Schema,
  TimerReasonCodeV1Schema,
  TimerScheduleStatusV1Schema,
  TimerScheduleTypeV1Schema,
  TimerSha256V1Schema,
  TimerTimezoneV1Schema,
  TimerUtcTimestampV1Schema,
  assertTimerIanaTimezoneV1,
  assertTimerLocalDateV1,
  assertTimerUtcTimestampV1,
  type TimerIdentityV1,
} from "./primitives.v1.js";

const nullableTimestamp = Type.Union([TimerUtcTimestampV1Schema, Type.Null()]);
const nullableIdentifier = Type.Union([TimerIdentifierV1Schema, Type.Null()]);

export const TimerScheduleV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.schedule.v1"),
    ...TimerIdentityV1Properties,
    schedule_id: TimerIdentifierV1Schema,
    name: Type.String({ minLength: 1, maxLength: 512 }),
    message: Type.String({ minLength: 1, maxLength: 32_768 }),
    status: TimerScheduleStatusV1Schema,
    schedule_type: TimerScheduleTypeV1Schema,
    fire_at: nullableTimestamp,
    rrule: Type.Union([
      Type.String({ minLength: 1, maxLength: 2_048 }),
      Type.Null(),
    ]),
    timezone: TimerTimezoneV1Schema,
    end_time: nullableTimestamp,
    payload: Type.Object({}, { additionalProperties: true }),
    catch_up: Type.Boolean(),
    max_catch_up_window_seconds: Type.Integer({
      minimum: 60,
      maximum: 2_592_000,
    }),
    max_catch_up_occurrences: Type.Integer({
      minimum: 1,
      maximum: 1_000,
    }),
    next_fire_at: nullableTimestamp,
    schedule_version: TimerPositiveVersionV1Schema,
    created_by: TimerIdentifierV1Schema,
    created_by_runtime_run_id: TimerIdentifierV1Schema,
    created_by_trigger_process_id: TimerIdentifierV1Schema,
    client_request_id: TimerIdentifierV1Schema,
    created_at: TimerUtcTimestampV1Schema,
    updated_at: TimerUtcTimestampV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:schedule:v1",
  },
);

export const TimerOccurrenceV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.occurrence.v1"),
    ...TimerIdentityV1Properties,
    occurrence_id: TimerIdentifierV1Schema,
    schedule_id: TimerIdentifierV1Schema,
    occurrence_key: TimerOccurrenceKeyV1Schema,
    occurrence_version: TimerPositiveVersionV1Schema,
    scheduled_fire_at: TimerUtcTimestampV1Schema,
    effective_fire_at: TimerUtcTimestampV1Schema,
    local_date: TimerLocalDateV1Schema,
    local_time: TimerLocalTimeV1Schema,
    timezone: TimerTimezoneV1Schema,
    schedule_end_time: nullableTimestamp,
    schedule_version: TimerPositiveVersionV1Schema,
    dispatch_payload: TimerTriggerSubmitPayloadV1Schema,
    dispatch_payload_hash: TimerSha256V1Schema,
    payload_schema_version: Type.Literal("timer.trigger_payload.v1"),
    status: TimerOccurrenceStatusV1Schema,
    trigger_id: nullableIdentifier,
    trigger_process_id: nullableIdentifier,
    dedupe_key: Type.String({
      minLength: 52,
      maxLength: 52,
      pattern: "^timer:v1:[A-Za-z0-9_-]{43}$",
    }),
    error: Type.Union([
      Type.Object({}, { additionalProperties: true }),
      Type.Null(),
    ]),
    attempt_count: TimerNonNegativeVersionV1Schema,
    next_dispatch_at: nullableTimestamp,
    catch_up_batch_id: nullableIdentifier,
    is_catch_up: Type.Boolean(),
    dispatch_generation: TimerNonNegativeVersionV1Schema,
    claim_token: nullableIdentifier,
    locked_by: nullableIdentifier,
    locked_until: nullableTimestamp,
    created_at: TimerUtcTimestampV1Schema,
    updated_at: TimerUtcTimestampV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:occurrence:v1",
  },
);

export const TimerOccurrenceClaimV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.occurrence_claim.v1"),
    ...TimerIdentityV1Properties,
    occurrence_id: TimerIdentifierV1Schema,
    occurrence_version: TimerPositiveVersionV1Schema,
    schedule_id: TimerIdentifierV1Schema,
    schedule_version: TimerPositiveVersionV1Schema,
    previous_status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("retry_wait"),
      Type.Literal("dispatching"),
    ]),
    status: Type.Literal("dispatching"),
    dispatch_generation: TimerPositiveVersionV1Schema,
    claim_token: TimerIdentifierV1Schema,
    locked_by: TimerIdentifierV1Schema,
    locked_until: TimerUtcTimestampV1Schema,
    dispatch_payload: TimerTriggerSubmitPayloadV1Schema,
    dispatch_payload_hash: TimerSha256V1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:occurrence-claim:v1",
  },
);

export const TimerOccurrenceTransitionV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.occurrence_transition.v1"),
    ...TimerIdentityV1Properties,
    occurrence_id: TimerIdentifierV1Schema,
    expected_occurrence_version: TimerPositiveVersionV1Schema,
    expected_schedule_version: TimerPositiveVersionV1Schema,
    expected_status: TimerOccurrenceStatusV1Schema,
    expected_dispatch_generation: TimerNonNegativeVersionV1Schema,
    expected_claim_token: nullableIdentifier,
    next_status: TimerOccurrenceStatusV1Schema,
    reason_code: Type.Union([TimerReasonCodeV1Schema, Type.Null()]),
    next_retry_at: nullableTimestamp,
    trigger_id: nullableIdentifier,
    trigger_process_id: nullableIdentifier,
    trace_id: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:occurrence-transition:v1",
  },
);

export type TimerScheduleV1 = Static<typeof TimerScheduleV1Schema>;
export type TimerOccurrenceV1 = Static<typeof TimerOccurrenceV1Schema>;
export type TimerOccurrenceClaimV1 = Static<
  typeof TimerOccurrenceClaimV1Schema
>;
export type TimerOccurrenceTransitionV1 = Static<
  typeof TimerOccurrenceTransitionV1Schema
>;

function identityOfOccurrence(value: TimerOccurrenceV1): TimerIdentityV1 {
  return {
    workspace_id: value.workspace_id,
    bot_id: value.bot_id,
    owner_agent_id: value.owner_agent_id,
    deployment_environment: value.deployment_environment,
    release_channel: value.release_channel,
  };
}

function identityOfPayload(
  value: TimerOccurrenceV1["dispatch_payload"],
): TimerIdentityV1 {
  return {
    workspace_id: value.workspace_id,
    bot_id: value.bot_id,
    owner_agent_id: value.owner_agent_id,
    deployment_environment: value.deployment_environment,
    release_channel: value.release_channel,
  };
}

function sameIdentity(left: TimerIdentityV1, right: TimerIdentityV1): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

export function assertTimerScheduleBindingsV1(
  schedule: TimerScheduleV1,
): void {
  assertTimerIanaTimezoneV1(schedule.timezone);
  for (const [label, timestamp] of [
    ["fire_at", schedule.fire_at],
    ["end_time", schedule.end_time],
    ["next_fire_at", schedule.next_fire_at],
    ["created_at", schedule.created_at],
    ["updated_at", schedule.updated_at],
  ] as const) {
    if (timestamp !== null) assertTimerUtcTimestampV1(timestamp, label);
  }
  if (
    (schedule.schedule_type === "once" &&
      (schedule.fire_at === null || schedule.rrule !== null)) ||
    (schedule.schedule_type === "recurring" &&
      (schedule.rrule === null || schedule.fire_at !== null))
  ) {
    throw new TypeError("Timer schedule type and recurrence fields disagree");
  }
  if (
    ["cancelled", "completed", "expired", "failed"].includes(
      schedule.status,
    ) &&
    schedule.next_fire_at !== null
  ) {
    throw new TypeError("Timer schedule status and next_fire_at disagree");
  }
  if (
    schedule.end_time !== null &&
    schedule.next_fire_at !== null &&
    Date.parse(schedule.end_time) < Date.parse(schedule.next_fire_at)
  ) {
    throw new TypeError("Timer schedule end_time precedes next_fire_at");
  }
  if (
    Date.parse(schedule.updated_at) < Date.parse(schedule.created_at) ||
    (schedule.end_time !== null &&
      schedule.fire_at !== null &&
      Date.parse(schedule.end_time) < Date.parse(schedule.fire_at))
  ) {
    throw new TypeError("Timer schedule timestamp ordering is inconsistent");
  }
}

export function assertTimerOccurrenceBindingsV1(
  occurrence: TimerOccurrenceV1,
): void {
  assertTimerLocalDateV1(occurrence.local_date);
  assertTimerIanaTimezoneV1(occurrence.timezone);
  for (const [label, timestamp] of [
    ["scheduled_fire_at", occurrence.scheduled_fire_at],
    ["effective_fire_at", occurrence.effective_fire_at],
    ["schedule_end_time", occurrence.schedule_end_time],
    ["next_dispatch_at", occurrence.next_dispatch_at],
    ["locked_until", occurrence.locked_until],
    ["created_at", occurrence.created_at],
    ["updated_at", occurrence.updated_at],
  ] as const) {
    if (timestamp !== null) assertTimerUtcTimestampV1(timestamp, label);
  }
  assertCanonicalTimerTriggerTimeV1(occurrence.dispatch_payload);
  if (
    occurrence.schedule_end_time !== null &&
    Date.parse(occurrence.scheduled_fire_at) >
      Date.parse(occurrence.schedule_end_time)
  ) {
    throw new TypeError("Timer occurrence exceeds schedule_end_time");
  }
  if (
    Date.parse(occurrence.effective_fire_at) <
      Date.parse(occurrence.scheduled_fire_at) ||
    Date.parse(occurrence.updated_at) < Date.parse(occurrence.created_at)
  ) {
    throw new TypeError("Timer occurrence timestamp ordering is inconsistent");
  }
  if (
    occurrence.dedupe_key !== `timer:${occurrence.occurrence_key}` ||
    occurrence.dispatch_payload.schedule_id !== occurrence.schedule_id ||
    occurrence.dispatch_payload.schedule_version !== occurrence.schedule_version ||
    occurrence.dispatch_payload.occurrence_id !== occurrence.occurrence_id ||
    occurrence.dispatch_payload.occurrence_key !== occurrence.occurrence_key ||
    occurrence.dispatch_payload.scheduled_for !==
      occurrence.scheduled_fire_at ||
    occurrence.dispatch_payload.local_date !== occurrence.local_date ||
    occurrence.dispatch_payload.local_time !== occurrence.local_time ||
    occurrence.dispatch_payload.timezone !== occurrence.timezone ||
    occurrence.dispatch_payload_hash !==
      timerDispatchPayloadHashV1(occurrence.dispatch_payload) ||
    !sameIdentity(
      identityOfOccurrence(occurrence),
      identityOfPayload(occurrence.dispatch_payload),
    )
  ) {
    throw new TypeError("Timer occurrence dispatch snapshot binding mismatch");
  }
  if (
    occurrence.is_catch_up !== occurrence.dispatch_payload.is_catch_up ||
    occurrence.catch_up_batch_id !==
      occurrence.dispatch_payload.catch_up_batch_id
  ) {
    throw new TypeError("Timer occurrence catch-up binding mismatch");
  }
  const claimed = occurrence.status === "dispatching";
  if (
    claimed !==
      (occurrence.claim_token !== null &&
        occurrence.locked_by !== null &&
        occurrence.locked_until !== null) ||
    (!claimed &&
      (occurrence.claim_token !== null ||
        occurrence.locked_by !== null ||
        occurrence.locked_until !== null)) ||
    (claimed && occurrence.dispatch_generation < 1)
  ) {
    throw new TypeError("Timer occurrence lease state is inconsistent");
  }
  if (
    occurrence.status === "retry_wait" !==
    (occurrence.next_dispatch_at !== null)
  ) {
    throw new TypeError("Timer occurrence retry state is inconsistent");
  }
  const hasTriggerId = occurrence.trigger_id !== null;
  const hasTriggerProcessId = occurrence.trigger_process_id !== null;
  if (
    hasTriggerId !== hasTriggerProcessId ||
    (occurrence.status === "dispatched") !==
      (hasTriggerId && hasTriggerProcessId)
  ) {
    throw new TypeError("Timer occurrence dispatch result is inconsistent");
  }
}
