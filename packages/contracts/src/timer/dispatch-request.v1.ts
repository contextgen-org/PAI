import { createHash } from "node:crypto";

import { Type, type Static } from "@sinclair/typebox";

import { canonicalJsonV1 } from "../shared/canonical-json.v1.js";
import {
  TimerIdentifierV1Schema,
  TimerIdentityV1Properties,
  TimerLocalDateV1Schema,
  TimerLocalTimeV1Schema,
  TimerOccurrenceKeyV1Schema,
  TimerPositiveVersionV1Schema,
  TimerSha256V1Schema,
  TimerTimezoneV1Schema,
  TimerUtcTimestampV1Schema,
  assertTimerUtcTimestampV1,
  type TimerIdentityV1,
} from "./primitives.v1.js";
import {
  TimerTriggerSubmitPayloadV1Schema,
  assertCanonicalTimerTriggerTimeV1,
} from "../trigger-processor/trigger-submit.v1.js";

export const TimerDispatchRequestV1Schema = Type.Object(
  {
    schema_version: Type.Literal("timer.dispatch_request.v1"),
    ...TimerIdentityV1Properties,
    schedule_id: TimerIdentifierV1Schema,
    schedule_version: TimerPositiveVersionV1Schema,
    occurrence_id: TimerIdentifierV1Schema,
    occurrence_version: TimerPositiveVersionV1Schema,
    occurrence_key: TimerOccurrenceKeyV1Schema,
    scheduled_fire_at: TimerUtcTimestampV1Schema,
    effective_fire_at: TimerUtcTimestampV1Schema,
    local_date: TimerLocalDateV1Schema,
    local_time: TimerLocalTimeV1Schema,
    timezone: TimerTimezoneV1Schema,
    payload_schema_version: Type.Literal("timer.trigger_payload.v1"),
    dispatch_payload: TimerTriggerSubmitPayloadV1Schema,
    dispatch_payload_hash: TimerSha256V1Schema,
    dispatch_generation: TimerPositiveVersionV1Schema,
    claim_token: TimerIdentifierV1Schema,
    locked_until: TimerUtcTimestampV1Schema,
    trace_id: TimerIdentifierV1Schema,
  },
  {
    additionalProperties: false,
    $id: "urn:pai:timer:dispatch-request:v1",
  },
);

export const TimerDispatchResponseV1Schema = Type.Union(
  [
    Type.Object(
      {
        schema_version: Type.Literal("timer.dispatch_request.v1"),
        occurrence_id: TimerIdentifierV1Schema,
        occurrence_version: TimerPositiveVersionV1Schema,
        dispatch_attempt_id: TimerIdentifierV1Schema,
        trigger_process_id: TimerIdentifierV1Schema,
        status: Type.Literal("dispatched"),
        duplicate_replayed: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        schema_version: Type.Literal("timer.dispatch_request.v1"),
        occurrence_id: TimerIdentifierV1Schema,
        occurrence_version: TimerPositiveVersionV1Schema,
        dispatch_attempt_id: TimerIdentifierV1Schema,
        status: Type.Literal("retry_wait"),
        duplicate_replayed: Type.Literal(false),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        schema_version: Type.Literal("timer.dispatch_request.v1"),
        occurrence_id: TimerIdentifierV1Schema,
        occurrence_version: TimerPositiveVersionV1Schema,
        dispatch_attempt_id: TimerIdentifierV1Schema,
        status: Type.Literal("failed"),
        duplicate_replayed: Type.Literal(false),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:timer:dispatch-response:v1" },
);

export type TimerDispatchRequestV1 = Static<
  typeof TimerDispatchRequestV1Schema
>;
export type TimerDispatchResponseV1 = Static<
  typeof TimerDispatchResponseV1Schema
>;

export function timerDispatchPayloadHashV1(
  payload: TimerDispatchRequestV1["dispatch_payload"],
): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalJsonV1(payload), "utf8")
    .digest("hex")}`;
}

function identityOf(
  value: TimerDispatchRequestV1 | TimerDispatchRequestV1["dispatch_payload"],
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

export function assertTimerDispatchRequestBindingsV1(
  request: TimerDispatchRequestV1,
  expectedIdentity?: TimerIdentityV1,
  now = new Date(),
): void {
  const payload = request.dispatch_payload;
  assertCanonicalTimerTriggerTimeV1(payload);
  for (const [label, timestamp] of [
    ["scheduled_fire_at", request.scheduled_fire_at],
    ["effective_fire_at", request.effective_fire_at],
    ["locked_until", request.locked_until],
  ] as const) {
    assertTimerUtcTimestampV1(timestamp, label);
  }
  if (
    (expectedIdentity !== undefined &&
      !sameIdentity(identityOf(request), expectedIdentity)) ||
    !sameIdentity(identityOf(request), identityOf(payload)) ||
    payload.schedule_id !== request.schedule_id ||
    payload.schedule_version !== request.schedule_version ||
    payload.occurrence_id !== request.occurrence_id ||
    payload.occurrence_key !== request.occurrence_key ||
    payload.scheduled_for !== request.scheduled_fire_at ||
    payload.local_date !== request.local_date ||
    payload.local_time !== request.local_time ||
    payload.timezone !== request.timezone ||
    request.dispatch_payload_hash !== timerDispatchPayloadHashV1(payload)
  ) {
    throw new TypeError("Timer dispatch request binding mismatch");
  }
  if (
    Date.parse(request.locked_until) <= now.getTime() ||
    Date.parse(request.effective_fire_at) < Date.parse(request.scheduled_fire_at)
  ) {
    throw new TypeError("Timer dispatch request has an invalid lease or fire time");
  }
}

export function assertTimerDispatchResponseBindingsV1(
  request: TimerDispatchRequestV1,
  response: TimerDispatchResponseV1,
): void {
  if (
    response.occurrence_id !== request.occurrence_id ||
    response.occurrence_version !== request.occurrence_version + 1 ||
    response.dispatch_attempt_id !==
      `dispatch_${request.occurrence_id}_${request.dispatch_generation}`
  ) {
    throw new TypeError(
      "Timer dispatch response CAS or attempt binding mismatch",
    );
  }
}
