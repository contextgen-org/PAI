import { Type } from "@sinclair/typebox";

import { DEPLOYMENT_ENVIRONMENTS } from "../shared/deployment-environment.v1.js";
import { EVIDENCE_REF_TYPES } from "../shared/typed-evidence-ref.v1.js";
import { RELEASE_CHANNELS } from "../shared/release-channel.v1.js";
import { SERVICE_IDS } from "../shared/service-id.v1.js";

export const MetaIdentifierV1Schema = Type.String({
  minLength: 1,
  maxLength: 512,
});

export const MetaReasonCodeV1Schema = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: "^[a-z][a-z0-9_]*(?:[._-][a-z0-9_]+)*$",
});

export const MetaSha256V1Schema = Type.String({
  minLength: 71,
  maxLength: 71,
  pattern: "^sha256:[a-f0-9]{64}$",
});

export const MetaTimestampV1Schema = Type.String({
  minLength: 20,
  maxLength: 30,
  pattern:
    "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?Z$",
});

export const MetaSafeVersionV1Schema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const MetaSafeCountV1Schema = Type.Integer({
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
});

export const MetaDeploymentEnvironmentValueV1Schema = Type.Union(
  DEPLOYMENT_ENVIRONMENTS.map((value) => Type.Literal(value)),
);

export const MetaReleaseChannelValueV1Schema = Type.Union(
  RELEASE_CHANNELS.map((value) => Type.Literal(value)),
);

export const MetaServiceIdValueV1Schema = Type.Union(
  SERVICE_IDS.map((value) => Type.Literal(value)),
);

export const MetaTypedEvidenceRefValueV1Schema = Type.String({
  minLength: 3,
  maxLength: 2_048,
  pattern: `^(${EVIDENCE_REF_TYPES.join("|")}):[^\\r\\n]+$`,
});

export const MetaBotScopeV1Properties = {
  workspace_id: MetaIdentifierV1Schema,
  bot_id: MetaIdentifierV1Schema,
  owner_agent_id: MetaIdentifierV1Schema,
  deployment_environment: MetaDeploymentEnvironmentValueV1Schema,
  release_channel: MetaReleaseChannelValueV1Schema,
} as const;

export const MetaJsonValueV1Schema = Type.Recursive((This) =>
  Type.Union([
    Type.String({ maxLength: 65_536 }),
    Type.Number(),
    Type.Boolean(),
    Type.Null(),
    Type.Array(This, { maxItems: 10_000 }),
    Type.Record(
      Type.String({ minLength: 1, maxLength: 256 }),
      This,
      { maxProperties: 1_000 },
    ),
  ]),
);

export const MetaJsonObjectV1Schema = Type.Record(
  Type.String({ minLength: 1, maxLength: 256 }),
  MetaJsonValueV1Schema,
  { maxProperties: 1_000 },
);
