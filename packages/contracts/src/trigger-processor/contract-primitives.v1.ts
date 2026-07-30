import { Type } from "@sinclair/typebox";

import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import {
  JsonSafeNonNegativeIntegerV1,
  JsonSafePositiveIntegerV1,
} from "../shared/json-safe-integer.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";

export const TriggerProcessorIdentifierV1Schema = Type.String({
  minLength: 1,
  maxLength: 512,
});

// Runtime control capabilities are compact signed JWTs, not identifiers. A
// realistic asymmetric JWT can exceed the generic 512-byte identifier bound
// once all owner bindings are present, while the Action Runtime verifier
// already enforces this exact upper bound before JOSE processing.
export const TriggerProcessorControlTokenV1Schema = Type.String({
  minLength: 1,
  maxLength: 8_192,
});

export const TriggerProcessorReasonCodeV1Schema = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: "^[a-z][a-z0-9_]*(?:[._-][a-z0-9_]+)*$",
});

export const TriggerProcessorSha256V1Schema = Type.String({
  minLength: 71,
  maxLength: 71,
  pattern: "^sha256:[a-f0-9]{64}$",
});

export const TriggerProcessorTimestampV1Schema = Type.String({
  minLength: 20,
  maxLength: 35,
  pattern:
    "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$",
});

export const TriggerProcessorUtcTimestampV1Schema = Type.String({
  minLength: 20,
  maxLength: 30,
  pattern:
    "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?Z$",
});

export const TriggerProcessorPositiveVersionV1Schema =
  JsonSafePositiveIntegerV1;

export const TriggerProcessorNonNegativeVersionV1Schema =
  JsonSafeNonNegativeIntegerV1;

export const TriggerProcessorBotScopeV1Properties = {
  workspace_id: TriggerProcessorIdentifierV1Schema,
  bot_id: TriggerProcessorIdentifierV1Schema,
  owner_agent_id: TriggerProcessorIdentifierV1Schema,
  deployment_environment: DeploymentEnvironmentV1Schema,
  release_channel: ReleaseChannelV1Schema,
} as const;

export const TriggerProcessorBotScopeV1Schema = Type.Object(
  TriggerProcessorBotScopeV1Properties,
  { additionalProperties: false },
);

export const TriggerProcessorStringSetV1Schema = Type.Array(
  TriggerProcessorIdentifierV1Schema,
  { maxItems: 10_000, uniqueItems: true },
);
