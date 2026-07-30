import { Type, type Static, type TSchema } from "@sinclair/typebox";

import {
  TimerTriggerBusinessPayloadV1Schema,
  assertTimerTriggerBusinessPayloadV1,
} from "../trigger-processor/trigger-submit.v1.js";
import {
  TimerIdentifierV1Schema,
  TimerIdentityV1Properties,
  TimerPositiveVersionV1Schema,
  TimerScheduleStatusV1Schema,
  TimerTimezoneV1Schema,
  TimerUtcTimestampV1Schema,
  assertTimerIanaTimezoneV1,
  assertTimerUtcTimestampV1,
  type TimerIdentityV1,
} from "./primitives.v1.js";

export const TIMER_WRITE_METHODS_V1 = [
  "timer.create",
  "timer.remind_after",
  "timer.remind_at",
  "timer.create_recurring",
  "timer.update",
  "timer.pause",
  "timer.resume",
  "timer.cancel",
  "timer.snooze",
] as const;

const common = {
  schema_version: Type.Literal("timer.schedule_command.v1"),
  ...TimerIdentityV1Properties,
  runtime_run_id: TimerIdentifierV1Schema,
  trigger_process_id: TimerIdentifierV1Schema,
  client_request_id: TimerIdentifierV1Schema,
  trace_id: TimerIdentifierV1Schema,
} as const;

const scheduleFields = {
  name: Type.String({ minLength: 1, maxLength: 512 }),
  message: Type.String({ minLength: 1, maxLength: 32_768 }),
  timezone: TimerTimezoneV1Schema,
  end_time: Type.Optional(TimerUtcTimestampV1Schema),
  catch_up: Type.Boolean(),
  payload: Type.Optional(TimerTriggerBusinessPayloadV1Schema),
  priority_hint: Type.Optional(
    Type.Union([Type.Literal("strong"), Type.Literal("weak")]),
  ),
  intent_hint: Type.Optional(Type.String({ minLength: 1, maxLength: 2_048 })),
} as const;

const onceSchedule = Type.Object(
  {
    ...scheduleFields,
    schedule_type: Type.Literal("once"),
    fire_at: TimerUtcTimestampV1Schema,
  },
  { additionalProperties: false },
);

const recurringSchedule = Type.Object(
  {
    ...scheduleFields,
    schedule_type: Type.Literal("recurring"),
    rrule: Type.String({ minLength: 1, maxLength: 2_048 }),
  },
  { additionalProperties: false },
);

function createBranch<
  const TMethod extends
    | "timer.create"
    | "timer.remind_after"
    | "timer.remind_at"
    | "timer.create_recurring",
  const TSchedule extends TSchema,
>(
  method: TMethod,
  schedule: TSchedule,
) {
  return Type.Object(
    {
      ...common,
      method: Type.Literal(method),
      command: Type.Literal("create"),
      schedule,
    },
    { additionalProperties: false },
  );
}

const updatePatch = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
    message: Type.Optional(Type.String({ minLength: 1, maxLength: 32_768 })),
    fire_at: Type.Optional(TimerUtcTimestampV1Schema),
    rrule: Type.Optional(Type.String({ minLength: 1, maxLength: 2_048 })),
    timezone: Type.Optional(TimerTimezoneV1Schema),
    end_time: Type.Optional(TimerUtcTimestampV1Schema),
    catch_up: Type.Optional(Type.Boolean()),
    payload: Type.Optional(TimerTriggerBusinessPayloadV1Schema),
    priority_hint: Type.Optional(
      Type.Union([Type.Literal("strong"), Type.Literal("weak")]),
    ),
    intent_hint: Type.Optional(Type.String({ minLength: 1, maxLength: 2_048 })),
  },
  { additionalProperties: false, minProperties: 1 },
);

function scheduleTransitionBranch<
  const TMethod extends "timer.pause" | "timer.resume" | "timer.cancel",
  const TCommand extends "pause" | "resume" | "cancel",
>(method: TMethod, command: TCommand) {
  return Type.Object(
    {
      ...common,
      method: Type.Literal(method),
      command: Type.Literal(command),
      schedule_id: TimerIdentifierV1Schema,
      expected_schedule_version: TimerPositiveVersionV1Schema,
      reason: Type.String({ minLength: 1, maxLength: 2_048 }),
    },
    { additionalProperties: false },
  );
}

export const TimerScheduleCreateCommandV1Schema = Type.Union([
  createBranch("timer.create", Type.Union([onceSchedule, recurringSchedule])),
  createBranch("timer.remind_after", onceSchedule),
  createBranch("timer.remind_at", onceSchedule),
  createBranch("timer.create_recurring", recurringSchedule),
]);

export const TimerScheduleUpdateCommandV1Schema = Type.Object(
  {
    ...common,
    method: Type.Literal("timer.update"),
    command: Type.Literal("update"),
    schedule_id: TimerIdentifierV1Schema,
    expected_schedule_version: TimerPositiveVersionV1Schema,
    patch: updatePatch,
  },
  { additionalProperties: false },
);

export const TimerSchedulePauseCommandV1Schema =
  scheduleTransitionBranch("timer.pause", "pause");
export const TimerScheduleResumeCommandV1Schema =
  scheduleTransitionBranch("timer.resume", "resume");
export const TimerScheduleCancelCommandV1Schema =
  scheduleTransitionBranch("timer.cancel", "cancel");

export const TimerOccurrenceSnoozeCommandV1Schema = Type.Object(
  {
    ...common,
    method: Type.Literal("timer.snooze"),
    command: Type.Literal("snooze"),
    schedule_id: TimerIdentifierV1Schema,
    occurrence_id: TimerIdentifierV1Schema,
    expected_schedule_version: TimerPositiveVersionV1Schema,
    expected_occurrence_version: TimerPositiveVersionV1Schema,
    effective_fire_at: TimerUtcTimestampV1Schema,
    reason: Type.String({ minLength: 1, maxLength: 2_048 }),
  },
  { additionalProperties: false },
);

export const TimerScheduleCommandV1Schema = Type.Union(
  [
    TimerScheduleCreateCommandV1Schema,
    TimerScheduleUpdateCommandV1Schema,
    TimerSchedulePauseCommandV1Schema,
    TimerScheduleResumeCommandV1Schema,
    TimerScheduleCancelCommandV1Schema,
    TimerOccurrenceSnoozeCommandV1Schema,
  ],
  { $id: "urn:pai:timer:schedule-command:v1" },
);

const responseCommon = {
  schema_version: Type.Literal("timer.schedule_command.v1"),
  timer_command_request_id: TimerIdentifierV1Schema,
  schedule_id: TimerIdentifierV1Schema,
  schedule_version: TimerPositiveVersionV1Schema,
  duplicate_replayed: Type.Boolean(),
} as const;

function createResponseBranch(
  method:
    | "timer.create"
    | "timer.remind_after"
    | "timer.remind_at"
    | "timer.create_recurring",
) {
  return Type.Object(
    {
      ...responseCommon,
      method: Type.Literal(method),
      command: Type.Literal("create"),
      occurrence_id: Type.Optional(TimerIdentifierV1Schema),
      schedule_status: Type.Literal("active"),
      next_fire_at: Type.Optional(TimerUtcTimestampV1Schema),
      timezone: TimerTimezoneV1Schema,
    },
    { additionalProperties: false },
  );
}

function transitionResponseBranch<
  const TMethod extends "timer.pause" | "timer.resume" | "timer.cancel",
  const TCommand extends "pause" | "resume" | "cancel",
  const TStatus extends "paused" | "active" | "cancelled",
>(method: TMethod, command: TCommand, status: TStatus) {
  return Type.Object(
    {
      ...responseCommon,
      method: Type.Literal(method),
      command: Type.Literal(command),
      schedule_status: Type.Literal(status),
    },
    { additionalProperties: false },
  );
}

export const TimerScheduleCreateResponseV1Schema = Type.Union([
  createResponseBranch("timer.create"),
  createResponseBranch("timer.remind_after"),
  createResponseBranch("timer.remind_at"),
  createResponseBranch("timer.create_recurring"),
]);

export const TimerScheduleUpdateResponseV1Schema = Type.Object(
  {
    ...responseCommon,
    method: Type.Literal("timer.update"),
    command: Type.Literal("update"),
    schedule_status: Type.Union([
      Type.Literal("active"),
      Type.Literal("paused"),
    ]),
    next_fire_at: Type.Optional(TimerUtcTimestampV1Schema),
    timezone: TimerTimezoneV1Schema,
  },
  { additionalProperties: false },
);

export const TimerSchedulePauseResponseV1Schema =
  transitionResponseBranch("timer.pause", "pause", "paused");
export const TimerScheduleResumeResponseV1Schema =
  transitionResponseBranch("timer.resume", "resume", "active");
export const TimerScheduleCancelResponseV1Schema =
  transitionResponseBranch("timer.cancel", "cancel", "cancelled");

export const TimerOccurrenceSnoozeResponseV1Schema = Type.Object(
  {
    ...responseCommon,
    method: Type.Literal("timer.snooze"),
    command: Type.Literal("snooze"),
    occurrence_id: TimerIdentifierV1Schema,
    occurrence_version: TimerPositiveVersionV1Schema,
    occurrence_status: Type.Literal("pending"),
    effective_fire_at: TimerUtcTimestampV1Schema,
  },
  { additionalProperties: false },
);

export const TimerScheduleCommandResponseV1Schema = Type.Union(
  [
    TimerScheduleCreateResponseV1Schema,
    TimerScheduleUpdateResponseV1Schema,
    TimerSchedulePauseResponseV1Schema,
    TimerScheduleResumeResponseV1Schema,
    TimerScheduleCancelResponseV1Schema,
    TimerOccurrenceSnoozeResponseV1Schema,
  ],
  { $id: "urn:pai:timer:schedule-command-response:v1" },
);

export const TimerRetryableErrorCodeV1Schema = Type.Union([
  Type.Literal("dependency_unavailable"),
  Type.Literal("rate_limited"),
  Type.Literal("dispatch_timeout"),
]);

export const TimerNonRetryableErrorCodeV1Schema = Type.Union([
  Type.Literal("schema_validation_failed"),
  Type.Literal("authorization_scope_mismatch"),
  Type.Literal("timer_owner_binding_mismatch"),
  Type.Literal("schedule_not_found"),
  Type.Literal("version_conflict"),
  Type.Literal("invalid_state_transition"),
  Type.Literal("idempotency_conflict"),
  Type.Literal("occurrence_not_dispatchable"),
  Type.Literal("stale_dispatch_fence"),
]);

export const TimerErrorV1Schema = Type.Union([
  Type.Object(
    {
      code: TimerRetryableErrorCodeV1Schema,
      retryable: Type.Literal(true),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      code: TimerNonRetryableErrorCodeV1Schema,
      retryable: Type.Literal(false),
    },
    { additionalProperties: false },
  ),
]);

export type TimerScheduleCommandV1 = Static<
  typeof TimerScheduleCommandV1Schema
>;
export type TimerScheduleCommandResponseV1 = Static<
  typeof TimerScheduleCommandResponseV1Schema
>;
export type TimerErrorV1 = Static<typeof TimerErrorV1Schema>;

function identityOf(command: TimerScheduleCommandV1): TimerIdentityV1 {
  return {
    workspace_id: command.workspace_id,
    bot_id: command.bot_id,
    owner_agent_id: command.owner_agent_id,
    deployment_environment: command.deployment_environment,
    release_channel: command.release_channel,
  };
}

export function timerCommandIdempotencyKeyV1(
  command: Pick<
    TimerScheduleCommandV1,
    "runtime_run_id" | "method" | "client_request_id"
  >,
): string {
  return `${command.runtime_run_id}:${command.method}:${command.client_request_id}`;
}

export function assertTimerScheduleCommandBindingsV1(
  command: TimerScheduleCommandV1,
  expectedIdentity?: TimerIdentityV1,
): void {
  const actualIdentity = identityOf(command);
  if (
    expectedIdentity !== undefined &&
    (Object.keys(actualIdentity) as (keyof TimerIdentityV1)[]).some(
      (key) => actualIdentity[key] !== expectedIdentity[key],
    )
  ) {
    throw new TypeError("Timer command identity does not match the principal");
  }
  if ("schedule" in command) {
    assertTimerIanaTimezoneV1(command.schedule.timezone);
    if ("fire_at" in command.schedule) {
      assertTimerUtcTimestampV1(command.schedule.fire_at, "fire_at");
    }
    if (command.schedule.end_time !== undefined) {
      assertTimerUtcTimestampV1(command.schedule.end_time, "end_time");
      if (
        "fire_at" in command.schedule &&
        Date.parse(command.schedule.end_time) < Date.parse(command.schedule.fire_at)
      ) {
        throw new TypeError("end_time cannot precede fire_at");
      }
    }
    if (command.schedule.payload !== undefined) {
      assertTimerTriggerBusinessPayloadV1(command.schedule.payload);
    }
  }
  if (command.command === "update") {
    if (
      command.patch.fire_at !== undefined &&
      command.patch.rrule !== undefined
    ) {
      throw new TypeError("Timer update cannot set fire_at and rrule together");
    }
    if (command.patch.timezone !== undefined) {
      assertTimerIanaTimezoneV1(command.patch.timezone);
    }
    if (command.patch.fire_at !== undefined) {
      assertTimerUtcTimestampV1(command.patch.fire_at, "fire_at");
    }
    if (command.patch.end_time !== undefined) {
      assertTimerUtcTimestampV1(command.patch.end_time, "end_time");
    }
    if (command.patch.payload !== undefined) {
      assertTimerTriggerBusinessPayloadV1(command.patch.payload);
    }
  }
  if (command.command === "snooze") {
    assertTimerUtcTimestampV1(
      command.effective_fire_at,
      "effective_fire_at",
    );
  }
}

export function assertTimerErrorHttpBindingV1(
  error: TimerErrorV1,
  httpStatus: number,
): void {
  const retryableStatuses = new Set([429, 502, 503, 504]);
  if (
    (error.retryable && !retryableStatuses.has(httpStatus)) ||
    (!error.retryable && retryableStatuses.has(httpStatus))
  ) {
    throw new TypeError("Timer error retryability and HTTP status disagree");
  }
}

export function assertTimerScheduleCommandResponseBindingsV1(
  response: TimerScheduleCommandResponseV1,
): void {
  if (
    "schedule_status" in response &&
    response.schedule_status === "cancelled" &&
    "next_fire_at" in response
  ) {
    throw new TypeError("A cancelled Timer response cannot expose next_fire_at");
  }
  if (
    "timezone" in response &&
    !["active", "paused"].includes(
      response.schedule_status as Static<typeof TimerScheduleStatusV1Schema>,
    )
  ) {
    throw new TypeError("Timer response timezone is bound to an active schedule");
  }
}
