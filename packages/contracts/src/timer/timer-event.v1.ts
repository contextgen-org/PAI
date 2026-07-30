import {
  Type,
  type Static,
  type TSchema,
} from "@sinclair/typebox";

import type { ServiceIdV1 } from "../shared/service-id.v1.js";
import { TimerCatchUpPolicySnapshotV1Schema } from "./catch-up-batch.v1.js";
import {
  TimerIdentifierV1Schema,
  TimerIdentityV1Properties,
  TimerOccurrenceStatusV1Schema,
  TimerPositiveVersionV1Schema,
  TimerReasonCodeV1Schema,
  TimerScheduleStatusV1Schema,
  TimerSha256V1Schema,
  TimerUtcTimestampV1Schema,
} from "./primitives.v1.js";

export const TIMER_DURABLE_EVENT_TYPES_V1 = [
  "timer.schedule.created",
  "timer.schedule.updated",
  "timer.schedule.paused",
  "timer.schedule.resumed",
  "timer.schedule.cancelled",
  "timer.schedule.completed",
  "timer.schedule.expired",
  "timer.schedule.failed",
  "timer.occurrence.due",
  "timer.occurrence.dispatched",
  "timer.occurrence.skipped",
  "timer.occurrence.failed",
  "timer.occurrence.cancelled",
  "timer.occurrence.snoozed",
  "timer.catch_up.batch_created",
  "timer.catch_up.occurrence_summarized",
] as const;

export const TIMER_AUDIT_ONLY_EVENT_TYPES_V1 = [
  "timer.catch_up.timeout",
  "timer.dst.shifted",
  "timer.missed_recovery.scanned",
] as const;

export const TIMER_AUDIT_EVENT_TYPES_V1 = [
  ...TIMER_DURABLE_EVENT_TYPES_V1,
  ...TIMER_AUDIT_ONLY_EVENT_TYPES_V1,
] as const;

const eventBase = {
  event_id: TimerIdentifierV1Schema,
  schema_version: Type.Literal("timer.event.v1"),
  producer: Type.Literal("timer_trigger_app"),
  occurred_at: TimerUtcTimestampV1Schema,
  idempotency_key: Type.String({ minLength: 1, maxLength: 1_024 }),
  trace_id: TimerIdentifierV1Schema,
} as const;

const eventIdentity = {
  ...TimerIdentityV1Properties,
  aggregate_id: TimerIdentifierV1Schema,
} as const;

const schedulePayload = Type.Object(
  {
    ...eventIdentity,
    schedule_id: TimerIdentifierV1Schema,
    schedule_version: TimerPositiveVersionV1Schema,
    previous_status: Type.Union([TimerScheduleStatusV1Schema, Type.Null()]),
    next_status: TimerScheduleStatusV1Schema,
    reason_code: Type.Union([TimerReasonCodeV1Schema, Type.Null()]),
  },
  { additionalProperties: false },
);

const occurrencePayload = Type.Object(
  {
    ...eventIdentity,
    schedule_id: TimerIdentifierV1Schema,
    schedule_version: TimerPositiveVersionV1Schema,
    occurrence_id: TimerIdentifierV1Schema,
    occurrence_version: TimerPositiveVersionV1Schema,
    scheduled_fire_at: TimerUtcTimestampV1Schema,
    effective_fire_at: TimerUtcTimestampV1Schema,
    previous_status: Type.Union([
      TimerOccurrenceStatusV1Schema,
      Type.Null(),
    ]),
    next_status: TimerOccurrenceStatusV1Schema,
    reason_code: Type.Union([TimerReasonCodeV1Schema, Type.Null()]),
  },
  { additionalProperties: false },
);

const snoozedPayload = Type.Object(
  {
    ...eventIdentity,
    schedule_id: TimerIdentifierV1Schema,
    schedule_version: TimerPositiveVersionV1Schema,
    occurrence_id: TimerIdentifierV1Schema,
    occurrence_version: TimerPositiveVersionV1Schema,
    scheduled_fire_at: TimerUtcTimestampV1Schema,
    previous_effective_fire_at: TimerUtcTimestampV1Schema,
    effective_fire_at: TimerUtcTimestampV1Schema,
    reason_code: TimerReasonCodeV1Schema,
  },
  { additionalProperties: false },
);

const batchCreatedPayload = Type.Object(
  {
    ...eventIdentity,
    catch_up_batch_id: TimerIdentifierV1Schema,
    window_start: TimerUtcTimestampV1Schema,
    window_end: TimerUtcTimestampV1Schema,
    occurrence_count: Type.Integer({ minimum: 1, maximum: 1_000 }),
    deadline_at: TimerUtcTimestampV1Schema,
    policy_snapshot: TimerCatchUpPolicySnapshotV1Schema,
  },
  { additionalProperties: false },
);

const occurrenceSummarizedPayload = Type.Object(
  {
    ...eventIdentity,
    catch_up_batch_id: TimerIdentifierV1Schema,
    occurrence_id: TimerIdentifierV1Schema,
    summary_ref: TimerIdentifierV1Schema,
    summary_hash: TimerSha256V1Schema,
    skip_reason: TimerReasonCodeV1Schema,
  },
  { additionalProperties: false },
);

export const TIMER_DURABLE_EVENT_PAYLOAD_SCHEMAS_V1 = Object.freeze({
  "timer.schedule.created": schedulePayload,
  "timer.schedule.updated": schedulePayload,
  "timer.schedule.paused": schedulePayload,
  "timer.schedule.resumed": schedulePayload,
  "timer.schedule.cancelled": schedulePayload,
  "timer.schedule.completed": schedulePayload,
  "timer.schedule.expired": schedulePayload,
  "timer.schedule.failed": schedulePayload,
  "timer.occurrence.due": occurrencePayload,
  "timer.occurrence.dispatched": occurrencePayload,
  "timer.occurrence.skipped": occurrencePayload,
  "timer.occurrence.failed": occurrencePayload,
  "timer.occurrence.cancelled": occurrencePayload,
  "timer.occurrence.snoozed": snoozedPayload,
  "timer.catch_up.batch_created": batchCreatedPayload,
  "timer.catch_up.occurrence_summarized": occurrenceSummarizedPayload,
} as const satisfies Readonly<
  Record<(typeof TIMER_DURABLE_EVENT_TYPES_V1)[number], TSchema>
>);

const noCrossServiceConsumers = Object.freeze([]) as readonly ServiceIdV1[];

/**
 * Timer rev199 defines the durable owner union, but does not assign any of
 * these events to a cross-service consumer. Timer -> Trigger Processor
 * dispatch is the synchronous TimerDispatchRequestV1 command path, not an
 * owner-event subscription. Keep the route map explicit and fail closed until
 * a live Timer revision names a consumer.
 */
export const TIMER_DURABLE_EVENT_CONSUMERS_V1 = Object.freeze({
  "timer.schedule.created": noCrossServiceConsumers,
  "timer.schedule.updated": noCrossServiceConsumers,
  "timer.schedule.paused": noCrossServiceConsumers,
  "timer.schedule.resumed": noCrossServiceConsumers,
  "timer.schedule.cancelled": noCrossServiceConsumers,
  "timer.schedule.completed": noCrossServiceConsumers,
  "timer.schedule.expired": noCrossServiceConsumers,
  "timer.schedule.failed": noCrossServiceConsumers,
  "timer.occurrence.due": noCrossServiceConsumers,
  "timer.occurrence.dispatched": noCrossServiceConsumers,
  "timer.occurrence.skipped": noCrossServiceConsumers,
  "timer.occurrence.failed": noCrossServiceConsumers,
  "timer.occurrence.cancelled": noCrossServiceConsumers,
  "timer.occurrence.snoozed": noCrossServiceConsumers,
  "timer.catch_up.batch_created": noCrossServiceConsumers,
  "timer.catch_up.occurrence_summarized": noCrossServiceConsumers,
} as const satisfies Readonly<
  Record<
    (typeof TIMER_DURABLE_EVENT_TYPES_V1)[number],
    readonly ServiceIdV1[]
  >
>);

function eventOf<
  const TType extends string,
  const TPayload extends TSchema,
>(
  eventType: TType,
  payload: TPayload,
) {
  return Type.Object(
    {
      ...eventBase,
      event_type: Type.Literal(eventType),
      payload,
    },
    { additionalProperties: false },
  );
}

export const TimerEventEnvelopeV1Schema = Type.Union(
  [
    eventOf("timer.schedule.created", schedulePayload),
    eventOf("timer.schedule.updated", schedulePayload),
    eventOf("timer.schedule.paused", schedulePayload),
    eventOf("timer.schedule.resumed", schedulePayload),
    eventOf("timer.schedule.cancelled", schedulePayload),
    eventOf("timer.schedule.completed", schedulePayload),
    eventOf("timer.schedule.expired", schedulePayload),
    eventOf("timer.schedule.failed", schedulePayload),
    eventOf("timer.occurrence.due", occurrencePayload),
    eventOf("timer.occurrence.dispatched", occurrencePayload),
    eventOf("timer.occurrence.skipped", occurrencePayload),
    eventOf("timer.occurrence.failed", occurrencePayload),
    eventOf("timer.occurrence.cancelled", occurrencePayload),
    eventOf("timer.occurrence.snoozed", snoozedPayload),
    eventOf("timer.catch_up.batch_created", batchCreatedPayload),
    eventOf(
      "timer.catch_up.occurrence_summarized",
      occurrenceSummarizedPayload,
    ),
  ],
  { $id: "urn:pai:timer:event-envelope:v1" },
);

export const TimerAuditOnlyEventTypeV1Schema = Type.Union(
  TIMER_AUDIT_ONLY_EVENT_TYPES_V1.map((eventType) =>
    Type.Literal(eventType),
  ),
  { $id: "urn:pai:timer:audit-only-event-type:v1" },
);

export const TimerAuditEventTypeV1Schema = Type.Union(
  TIMER_AUDIT_EVENT_TYPES_V1.map((eventType) => Type.Literal(eventType)),
  { $id: "urn:pai:timer:audit-event-type:v1" },
);

export type TimerEventEnvelopeV1 = Static<
  typeof TimerEventEnvelopeV1Schema
>;
export type TimerAuditOnlyEventTypeV1 = Static<
  typeof TimerAuditOnlyEventTypeV1Schema
>;
export type TimerAuditEventTypeV1 = Static<
  typeof TimerAuditEventTypeV1Schema
>;

const scheduleTransitions = Object.freeze({
  "timer.schedule.created": Object.freeze({
    previous: [null],
    next: ["active"],
  }),
  "timer.schedule.updated": Object.freeze({
    previous: ["active", "paused"],
    next: ["active", "paused"],
  }),
  "timer.schedule.paused": Object.freeze({
    previous: ["active"],
    next: ["paused"],
  }),
  "timer.schedule.resumed": Object.freeze({
    previous: ["paused"],
    next: ["active"],
  }),
  "timer.schedule.cancelled": Object.freeze({
    previous: ["active", "paused"],
    next: ["cancelled"],
  }),
  "timer.schedule.completed": Object.freeze({
    previous: ["active"],
    next: ["completed"],
  }),
  "timer.schedule.expired": Object.freeze({
    previous: ["active", "paused"],
    next: ["expired"],
  }),
  "timer.schedule.failed": Object.freeze({
    previous: ["active", "paused"],
    next: ["failed"],
  }),
} as const);

const occurrenceTransitions = Object.freeze({
  "timer.occurrence.due": Object.freeze({
    previous: [null],
    next: ["pending"],
  }),
  "timer.occurrence.dispatched": Object.freeze({
    previous: ["dispatching"],
    next: ["dispatched"],
  }),
  "timer.occurrence.skipped": Object.freeze({
    previous: ["pending", "retry_wait"],
    next: ["skipped"],
  }),
  "timer.occurrence.failed": Object.freeze({
    previous: ["dispatching", "retry_wait"],
    next: ["failed"],
  }),
  "timer.occurrence.cancelled": Object.freeze({
    previous: ["pending", "retry_wait", "dispatching"],
    next: ["cancelled"],
  }),
} as const);

export function assertTimerEventEnvelopeBindingsV1(
  event: TimerEventEnvelopeV1,
): void {
  if (
    event.event_type === "timer.schedule.created" ||
    event.event_type === "timer.schedule.updated" ||
    event.event_type === "timer.schedule.paused" ||
    event.event_type === "timer.schedule.resumed" ||
    event.event_type === "timer.schedule.cancelled" ||
    event.event_type === "timer.schedule.completed" ||
    event.event_type === "timer.schedule.expired" ||
    event.event_type === "timer.schedule.failed"
  ) {
    const transition =
      scheduleTransitions[
        event.event_type as keyof typeof scheduleTransitions
      ];
    if (
      event.payload.aggregate_id !== event.payload.schedule_id ||
      !transition.previous.includes(
        event.payload.previous_status as never,
      ) ||
      !transition.next.includes(event.payload.next_status as never)
    ) {
      throw new TypeError("Timer schedule event transition binding mismatch");
    }
    if (
      event.event_type === "timer.schedule.updated" &&
      event.payload.previous_status !== event.payload.next_status
    ) {
      throw new TypeError("Timer schedule.updated cannot change status");
    }
    return;
  }
  if (
    event.event_type === "timer.occurrence.due" ||
    event.event_type === "timer.occurrence.dispatched" ||
    event.event_type === "timer.occurrence.skipped" ||
    event.event_type === "timer.occurrence.failed" ||
    event.event_type === "timer.occurrence.cancelled"
  ) {
    const transition = occurrenceTransitions[event.event_type];
    if (
      event.payload.aggregate_id !== event.payload.occurrence_id ||
      !transition.previous.includes(
        event.payload.previous_status as never,
      ) ||
      !transition.next.includes(event.payload.next_status as never)
    ) {
      throw new TypeError("Timer occurrence event transition binding mismatch");
    }
    return;
  }
  if (event.event_type === "timer.occurrence.snoozed") {
    if (
      event.payload.aggregate_id !== event.payload.occurrence_id ||
      event.payload.previous_effective_fire_at ===
        event.payload.effective_fire_at ||
      Date.parse(event.payload.effective_fire_at) <
        Date.parse(event.payload.scheduled_fire_at)
    ) {
      throw new TypeError("Timer occurrence snooze binding mismatch");
    }
    return;
  }
  if (event.event_type === "timer.catch_up.batch_created") {
    if (
      event.payload.aggregate_id !== event.payload.catch_up_batch_id ||
      Date.parse(event.payload.window_start) >
        Date.parse(event.payload.window_end) ||
      Date.parse(event.payload.deadline_at) <=
        Date.parse(event.occurred_at) ||
      event.payload.occurrence_count >
        event.payload.policy_snapshot.max_catch_up_occurrences
    ) {
      throw new TypeError("Timer catch-up batch event binding mismatch");
    }
    return;
  }
  if (
    event.event_type === "timer.catch_up.occurrence_summarized" &&
    (
    event.payload.aggregate_id !== event.payload.catch_up_batch_id ||
    event.payload.occurrence_id.length < 1
    )
  ) {
    throw new TypeError("Timer catch-up summary event binding mismatch");
  }
}
