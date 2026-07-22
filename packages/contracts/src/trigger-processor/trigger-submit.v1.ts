import { Type, type Static } from "@sinclair/typebox";

import { DEPLOYMENT_ENVIRONMENTS } from "../shared/deployment-environment.v1.js";
import { RELEASE_CHANNELS } from "../shared/release-channel.v1.js";

const localDatePattern = "^\\d{4}-\\d{2}-\\d{2}$";
const localTimePattern = "^(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d$";
const canonicalTimestampPattern =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?(?:Z|[+-]\\d{2}:\\d{2})$";
const occurrenceKeyPattern = "^v1:[A-Za-z0-9_-]{43}$";
const nonEmptyIdentifier = Type.String({ minLength: 1, maxLength: 512 });
const dedupeKeySchema = Type.String({ minLength: 1, maxLength: 1_024 });
const deploymentEnvironmentValueSchema = Type.Union(
  DEPLOYMENT_ENVIRONMENTS.map((environment) => Type.Literal(environment)),
);
const releaseChannelValueSchema = Type.Union(
  RELEASE_CHANNELS.map((channel) => Type.Literal(channel)),
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
  local_date: Type.String({ pattern: localDatePattern }),
  local_time: Type.String({ pattern: localTimePattern }),
  timezone: Type.String({ minLength: 1, maxLength: 255 }),
  scheduled_for: Type.String({ pattern: canonicalTimestampPattern }),
  occurrence_key: Type.String({ pattern: occurrenceKeyPattern }),
  message: Type.String({ minLength: 1, maxLength: 8_192 }),
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
export type TriggerSubmitRequestV1 = Static<typeof TriggerSubmitRequestV1Schema>;
