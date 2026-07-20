import { Type, type Static } from "@sinclair/typebox";

import { DeploymentEnvironmentV1Schema } from "./deployment-environment.v1.js";
import { ReleaseChannelV1Schema } from "./release-channel.v1.js";

const principalProperties = {
  principal_type: Type.Union([
    Type.Literal("user"),
    Type.Literal("developer"),
    Type.Literal("operator"),
  ]),
  principal_id: Type.String({ minLength: 1 }),
  roles: Type.Array(Type.String({ minLength: 1 }), {
    uniqueItems: true,
  }),
  source_issuer: Type.String({ minLength: 1 }),
  source_subject: Type.String({ minLength: 1 }),
  auth_time: Type.Integer({ minimum: 0 }),
};

const botScopeProperties = {
  workspace_id: Type.String({ minLength: 1 }),
  bot_id: Type.String({ minLength: 1 }),
  owner_agent_id: Type.String({ minLength: 1 }),
  deployment_environment: Type.Ref(DeploymentEnvironmentV1Schema),
  release_channel: Type.Ref(ReleaseChannelV1Schema),
};

export const DelegatedPrincipalContextV1Schema = Type.Union(
  [
    Type.Object(
      {
        ...principalProperties,
        scope_kind: Type.Literal("bot"),
        ...botScopeProperties,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...principalProperties,
        scope_kind: Type.Literal("global"),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "urn:pai:shared:delegated-principal-context:v1" },
);

export type DelegatedPrincipalContextV1 = Static<
  typeof DelegatedPrincipalContextV1Schema
>;
