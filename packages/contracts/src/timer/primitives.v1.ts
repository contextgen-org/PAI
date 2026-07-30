import { Type, type Static } from "@sinclair/typebox";

import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";

export const TimerIdentifierV1Schema = Type.String({
  minLength: 1,
  maxLength: 512,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$",
});

export const TimerReasonCodeV1Schema = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: "^[a-z][a-z0-9_]*(?:[._-][a-z0-9_]+)*$",
});

export const TimerSha256V1Schema = Type.String({
  minLength: 71,
  maxLength: 71,
  pattern: "^sha256:[a-f0-9]{64}$",
});

export const TimerUtcTimestampV1Schema = Type.String({
  minLength: 20,
  maxLength: 30,
  pattern:
    "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?Z$",
});

export const TimerLocalDateV1Schema = Type.String({
  minLength: 10,
  maxLength: 10,
  pattern: "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])$",
});

export const TimerLocalTimeV1Schema = Type.String({
  minLength: 8,
  maxLength: 8,
  pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d$",
});

export const TimerTimezoneV1Schema = Type.String({
  minLength: 1,
  maxLength: 255,
});

export const TimerPositiveVersionV1Schema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const TimerNonNegativeVersionV1Schema = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const TimerOccurrenceKeyV1Schema = Type.String({
  minLength: 46,
  maxLength: 46,
  pattern: "^v1:[A-Za-z0-9_-]{43}$",
});

export const TimerIdentityV1Properties = {
  workspace_id: TimerIdentifierV1Schema,
  bot_id: TimerIdentifierV1Schema,
  owner_agent_id: TimerIdentifierV1Schema,
  deployment_environment: DeploymentEnvironmentV1Schema,
  release_channel: ReleaseChannelV1Schema,
} as const;

export const TimerIdentityV1Schema = Type.Object(TimerIdentityV1Properties, {
  additionalProperties: false,
  $id: "urn:pai:timer:identity:v1",
});

export const TimerScheduleStatusV1Schema = Type.Union([
  Type.Literal("active"),
  Type.Literal("paused"),
  Type.Literal("cancelled"),
  Type.Literal("completed"),
  Type.Literal("expired"),
  Type.Literal("failed"),
]);

export const TimerOccurrenceStatusV1Schema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("dispatching"),
  Type.Literal("retry_wait"),
  Type.Literal("dispatched"),
  Type.Literal("failed"),
  Type.Literal("skipped"),
  Type.Literal("cancelled"),
]);

export const TimerScheduleTypeV1Schema = Type.Union([
  Type.Literal("once"),
  Type.Literal("recurring"),
]);

export type TimerIdentityV1 = Static<typeof TimerIdentityV1Schema>;
export type TimerScheduleStatusV1 = Static<
  typeof TimerScheduleStatusV1Schema
>;
export type TimerOccurrenceStatusV1 = Static<
  typeof TimerOccurrenceStatusV1Schema
>;
export type TimerScheduleTypeV1 = Static<typeof TimerScheduleTypeV1Schema>;

export function isTimerIdentityEqualV1(
  left: TimerIdentityV1,
  right: TimerIdentityV1,
): boolean {
  return (
    left.workspace_id === right.workspace_id &&
    left.bot_id === right.bot_id &&
    left.owner_agent_id === right.owner_agent_id &&
    left.deployment_environment === right.deployment_environment &&
    left.release_channel === right.release_channel
  );
}

export function assertTimerUtcTimestampV1(
  value: string,
  label: string,
): void {
  if (
    !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z$/u.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new TypeError(`${label} must be a canonical UTC timestamp`);
  }
}

export function assertTimerIanaTimezoneV1(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new TypeError("timezone must be an IANA timezone");
    }
    throw error;
  }
}

export function assertTimerLocalDateV1(value: string): void {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new TypeError("local_date must be a real Gregorian date");
  }
}
