import { Type, type Static } from "@sinclair/typebox";

import {
  TimerIdentifierV1Schema,
  TimerIdentityV1Properties,
  TimerScheduleStatusV1Schema,
  TimerSha256V1Schema,
  type TimerIdentityV1,
} from "./primitives.v1.js";
import {
  TimerOccurrenceV1Schema,
  TimerScheduleV1Schema,
  type TimerOccurrenceV1,
  type TimerScheduleV1,
} from "./occurrence.v1.js";

export const TimerScheduleCursorV1Schema = Type.String({
  minLength: 76,
  maxLength: 1_100,
  pattern: "^v1:sha256:[a-f0-9]{64}:[A-Za-z0-9_-]{1,1024}$",
});

export const TimerScheduleQueryV1Schema = Type.Union(
  [
    Type.Object(
      {
        schema_version: Type.Literal("timer.schedule_query.v1"),
        ...TimerIdentityV1Properties,
        method: Type.Literal("timer.list"),
        runtime_run_id: TimerIdentifierV1Schema,
        trace_id: TimerIdentifierV1Schema,
        status: Type.Optional(TimerScheduleStatusV1Schema),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        cursor: Type.Optional(TimerScheduleCursorV1Schema),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        schema_version: Type.Literal("timer.schedule_query.v1"),
        ...TimerIdentityV1Properties,
        method: Type.Literal("timer.get"),
        runtime_run_id: TimerIdentifierV1Schema,
        trace_id: TimerIdentifierV1Schema,
        schedule_id: TimerIdentifierV1Schema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        schema_version: Type.Literal("timer.schedule_query.v1"),
        ...TimerIdentityV1Properties,
        method: Type.Literal("timer.history"),
        runtime_run_id: TimerIdentifierV1Schema,
        trace_id: TimerIdentifierV1Schema,
        schedule_id: TimerIdentifierV1Schema,
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        cursor: Type.Optional(TimerScheduleCursorV1Schema),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:timer:schedule-query:v1" },
);

export const TimerScheduleQueryResponseV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.schedule_query_response.v1"),
    identity: Type.Object(TimerIdentityV1Properties, {
      additionalProperties: false,
    }),
    schedules: Type.Array(TimerScheduleV1Schema, {
      maxItems: 100,
      uniqueItems: true,
    }),
    occurrences: Type.Optional(
      Type.Array(TimerOccurrenceV1Schema, {
        maxItems: 100,
        uniqueItems: true,
      }),
    ),
    next_cursor: Type.Optional(TimerScheduleCursorV1Schema),
    returned: Type.Integer({ minimum: 0, maximum: 100 }),
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:schedule-query-response:v1",
  },
);

export type TimerScheduleQueryV1 = Static<typeof TimerScheduleQueryV1Schema>;
export type TimerScheduleQueryResponseV1 = Static<
  typeof TimerScheduleQueryResponseV1Schema
>;
export type TimerScheduleCursorV1 = Static<
  typeof TimerScheduleCursorV1Schema
>;

function identityOf(
  value: TimerScheduleV1 | TimerOccurrenceV1,
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

export function assertTimerScheduleQueryResponseBindingsV1(
  response: TimerScheduleQueryResponseV1,
  expectedIdentity: TimerIdentityV1,
): void {
  const scheduleIds = new Set(
    response.schedules.map((schedule) => schedule.schedule_id),
  );
  if (
    !sameIdentity(response.identity, expectedIdentity) ||
    response.returned !== response.schedules.length ||
    response.schedules.some(
      (schedule) => !sameIdentity(identityOf(schedule), expectedIdentity),
    ) ||
    response.occurrences?.some(
      (occurrence) =>
        !sameIdentity(identityOf(occurrence), expectedIdentity) ||
        !scheduleIds.has(occurrence.schedule_id),
    ) === true
  ) {
    throw new TypeError("Timer query response scope or count binding mismatch");
  }
}

export function assertTimerQueryIdentityV1(
  query: TimerScheduleQueryV1,
  expectedIdentity: TimerIdentityV1,
): void {
  if (
    query.workspace_id !== expectedIdentity.workspace_id ||
    query.bot_id !== expectedIdentity.bot_id ||
    query.owner_agent_id !== expectedIdentity.owner_agent_id ||
    query.deployment_environment !==
      expectedIdentity.deployment_environment ||
    query.release_channel !== expectedIdentity.release_channel
  ) {
    throw new TypeError("Timer query identity does not match the principal");
  }
}

export function timerScheduleCursorV1(
  scopeFingerprint: Static<typeof TimerSha256V1Schema>,
  opaquePosition: string,
): TimerScheduleCursorV1 {
  if (!/^[A-Za-z0-9_-]{1,1024}$/u.test(opaquePosition)) {
    throw new TypeError("Timer cursor position is invalid");
  }
  return `v1:${scopeFingerprint}:${opaquePosition}`;
}

export function assertTimerScheduleCursorScopeV1(
  cursor: TimerScheduleCursorV1,
  expectedScopeFingerprint: Static<typeof TimerSha256V1Schema>,
): void {
  if (!cursor.startsWith(`v1:${expectedScopeFingerprint}:`)) {
    throw new TypeError("Timer cursor belongs to another identity scope");
  }
}
