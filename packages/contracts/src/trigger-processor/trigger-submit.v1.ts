import { Type, type Static } from "@sinclair/typebox";

import { canonicalJsonV1 } from "../shared/canonical-json.v1.js";
import { DEPLOYMENT_ENVIRONMENTS } from "../shared/deployment-environment.v1.js";
import { RELEASE_CHANNELS } from "../shared/release-channel.v1.js";

const localDatePattern =
  "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])$";
const localTimePattern = "^(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d$";
const canonicalTimestampPattern =
  "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$";
const occurrenceKeyPattern = "^v1:[A-Za-z0-9_-]{43}$";
const nonEmptyIdentifier = Type.String({ minLength: 1, maxLength: 512 });
const dedupeKeySchema = Type.String({ minLength: 1, maxLength: 1_024 });
const deploymentEnvironmentValueSchema = Type.Union(
  DEPLOYMENT_ENVIRONMENTS.map((environment) => Type.Literal(environment)),
);
const releaseChannelValueSchema = Type.Union(
  RELEASE_CHANNELS.map((channel) => Type.Literal(channel)),
);

export const TimerTriggerBusinessPayloadV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.trigger_payload.v1"),
    value: Type.Object(
      {},
      {
        additionalProperties: true,
      },
    ),
  },
  {
    additionalProperties: false,
    description:
      "The complete object is limited to 8192 canonical JSON UTF-8 bytes by assertTimerTriggerBusinessPayloadV1.",
  },
);

const timerPayloadBase = {
  workspace_id: nonEmptyIdentifier,
  bot_id: nonEmptyIdentifier,
  owner_agent_id: nonEmptyIdentifier,
  deployment_environment: deploymentEnvironmentValueSchema,
  release_channel: releaseChannelValueSchema,
  schedule_id: nonEmptyIdentifier,
  schedule_version: Type.Integer({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  }),
  occurrence_id: nonEmptyIdentifier,
  local_date: Type.String({
    pattern: localDatePattern,
    description: "Real Gregorian calendar date; enforced by the Timer semantic guard.",
  }),
  local_time: Type.String({ pattern: localTimePattern }),
  timezone: Type.String({
    minLength: 1,
    maxLength: 255,
    description: "IANA time-zone identifier; enforced by the Timer semantic guard.",
  }),
  scheduled_for: Type.String({
    pattern: canonicalTimestampPattern,
    description:
      "RFC3339 instant that must resolve to the declared local date/time and timezone.",
  }),
  occurrence_key: Type.String({ pattern: occurrenceKeyPattern }),
  message: Type.String({ minLength: 1, maxLength: 8_192 }),
  trigger_payload: Type.Optional(TimerTriggerBusinessPayloadV1Schema),
};

export const TimerTriggerSubmitPayloadV1Schema = Type.Union([
  Type.Object(
    {
      ...timerPayloadBase,
      is_catch_up: Type.Literal(false),
      catch_up_batch_id: Type.Null(),
      missed_window_summary: Type.Null(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...timerPayloadBase,
      is_catch_up: Type.Literal(true),
      catch_up_batch_id: nonEmptyIdentifier,
      missed_window_summary: Type.String({ minLength: 1, maxLength: 2_048 }),
    },
    { additionalProperties: false },
  ),
]);

const triggerSubmitScopeProperties = {
  workspace_id: nonEmptyIdentifier,
  bot_id: nonEmptyIdentifier,
  owner_agent_id: nonEmptyIdentifier,
  deployment_environment: deploymentEnvironmentValueSchema,
  release_channel: releaseChannelValueSchema,
} as const;

const delegatedActorTypeSchema = Type.Union([
  Type.Literal("super_user"),
  Type.Literal("user"),
  Type.Literal("agent"),
  Type.Literal("developer"),
]);

/**
 * Gateway payloads deliberately remain domain-neutral. Trigger Processor owns
 * admission, not the chat/notification payload vocabulary, but still requires
 * a non-empty bounded JSON object at this trust boundary.
 */
export const GatewayTriggerSubmitPayloadV1Schema = Type.Object(
  {},
  {
    additionalProperties: true,
    minProperties: 1,
    maxProperties: 256,
  },
);

const gatewaySubmitProperties = {
  ...triggerSubmitScopeProperties,
  actor_type: delegatedActorTypeSchema,
  actor_id: nonEmptyIdentifier,
  payload: GatewayTriggerSubmitPayloadV1Schema,
  dedupe_key: dedupeKeySchema,
  priority_hint: Type.Optional(
    Type.Union([Type.Literal("strong"), Type.Literal("weak")]),
  ),
} as const;

export const ChatTriggerSubmitRequestV1Schema = Type.Object(
  {
    ...gatewaySubmitProperties,
    source: Type.Literal("chat"),
  },
  { additionalProperties: false },
);

export const NotificationTriggerSubmitRequestV1Schema = Type.Object(
  {
    ...gatewaySubmitProperties,
    source: Type.Literal("notification"),
  },
  { additionalProperties: false },
);

export const TimerTriggerSubmitRequestV1Schema = Type.Object(
  {
    ...triggerSubmitScopeProperties,
    source: Type.Literal("timer"),
    actor_type: Type.Literal("system"),
    actor_id: Type.Literal("timer_app"),
    payload: TimerTriggerSubmitPayloadV1Schema,
    dedupe_key: dedupeKeySchema,
  },
  { additionalProperties: false },
);

/** Canonical public POST /v1/triggers request owned by Trigger Processor. */
export const TriggerSubmitRequestV1Schema = Type.Union(
  [
    ChatTriggerSubmitRequestV1Schema,
    NotificationTriggerSubmitRequestV1Schema,
    TimerTriggerSubmitRequestV1Schema,
  ],
  {
    $id: "urn:pai:trigger-processor:trigger-submit-request:v1",
  },
);

export type GatewayTriggerSubmitPayloadV1 = Static<
  typeof GatewayTriggerSubmitPayloadV1Schema
>;
export type ChatTriggerSubmitRequestV1 = Static<
  typeof ChatTriggerSubmitRequestV1Schema
>;
export type NotificationTriggerSubmitRequestV1 = Static<
  typeof NotificationTriggerSubmitRequestV1Schema
>;
export type TimerTriggerSubmitRequestV1 = Static<
  typeof TimerTriggerSubmitRequestV1Schema
>;
export type TimerTriggerSubmitPayloadV1 = Static<
  typeof TimerTriggerSubmitPayloadV1Schema
>;
export type TimerTriggerBusinessPayloadV1 = Static<
  typeof TimerTriggerBusinessPayloadV1Schema
>;
export type TriggerSubmitRequestV1 = Static<typeof TriggerSubmitRequestV1Schema>;

function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function canonicalLocalTupleAt(
  scheduledFor: string,
  timeZone: string,
): Readonly<{ local_date: string; local_time: string }> | undefined {
  const timestamp = new Date(scheduledFor);
  if (!Number.isFinite(timestamp.getTime())) return undefined;
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(timestamp);
    const part = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
      parts.find((candidate) => candidate.type === type)?.value;
    const year = part("year");
    const month = part("month");
    const day = part("day");
    const hour = part("hour");
    const minute = part("minute");
    const second = part("second");
    if (
      year === undefined ||
      month === undefined ||
      day === undefined ||
      hour === undefined ||
      minute === undefined ||
      second === undefined
    ) {
      return undefined;
    }
    return {
      local_date: `${year}-${month}-${day}`,
      local_time: `${hour}:${minute}:${second}`,
    };
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

/**
 * Semantic Timer time validation shared by ingress and owner implementations.
 * JSON Schema carries the wire shape; this guard proves calendar, IANA-zone,
 * instant, and local-tuple consistency before any owner mutation.
 */
export function isCanonicalTimerTriggerTimeV1(
  payload: Pick<
    TimerTriggerSubmitPayloadV1,
    "local_date" | "local_time" | "timezone" | "scheduled_for"
  >,
): boolean {
  if (
    !new RegExp(localDatePattern, "u").test(payload.local_date) ||
    !isRealCalendarDate(payload.local_date) ||
    !new RegExp(localTimePattern, "u").test(payload.local_time) ||
    !new RegExp(canonicalTimestampPattern, "u").test(payload.scheduled_for)
  ) {
    return false;
  }
  const scheduledDate = payload.scheduled_for.slice(0, 10);
  if (!isRealCalendarDate(scheduledDate)) return false;
  const localTuple = canonicalLocalTupleAt(
    payload.scheduled_for,
    payload.timezone,
  );
  return (
    localTuple?.local_date === payload.local_date &&
    localTuple.local_time === payload.local_time
  );
}

export function assertCanonicalTimerTriggerTimeV1(
  payload: Pick<
    TimerTriggerSubmitPayloadV1,
    "local_date" | "local_time" | "timezone" | "scheduled_for"
  >,
): void {
  if (!isCanonicalTimerTriggerTimeV1(payload)) {
    throw new TypeError(
      "Timer local date/time, IANA timezone, and scheduled_for instant are inconsistent",
    );
  }
}

/**
 * Timer owns the small business hint, while Trigger Processor owns the outer
 * trigger wire contract. The complete versioned hint is limited to 8 KiB of
 * canonical JSON and must never be used as a ContextSnapshot replacement.
 */
export function assertTimerTriggerBusinessPayloadV1(
  payload: TimerTriggerBusinessPayloadV1,
): void {
  try {
    canonicalJsonV1(payload, {
      max_bytes: 8_192,
      max_depth: 64,
      max_nodes: 10_000,
      max_container_entries: 1_000,
    });
  } catch (error) {
    throw new TypeError(
      "Timer trigger business payload must be canonical JSON within 8192 canonical JSON bytes",
      { cause: error },
    );
  }
}
