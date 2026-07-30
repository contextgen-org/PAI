import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { DeploymentEnvironmentV1Schema } from "../shared/deployment-environment.v1.js";
import { ReleaseChannelV1Schema } from "../shared/release-channel.v1.js";

export const KnowThatIdV1Schema = Type.String({
  minLength: 1,
  maxLength: 512,
  pattern: "^[^\\u0000-\\u001f\\u007f]+$",
});

export const KnowThatTraceIdV1Schema = Type.String({
  minLength: 1,
  maxLength: 256,
  pattern: "^[^\\u0000-\\u001f\\u007f]+$",
});

export const KnowThatTimestampV1Schema = Type.String({
  minLength: 20,
  maxLength: 35,
  pattern:
    "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$",
});

export const KnowThatHashV1Schema = Type.String({
  pattern: "^sha256:[0-9a-f]{64}$",
});

export const KnowThatScopeV1Schema = Type.Object(
  {
    workspace_id: KnowThatIdV1Schema,
    bot_id: KnowThatIdV1Schema,
    owner_agent_id: KnowThatIdV1Schema,
    deployment_environment: DeploymentEnvironmentV1Schema,
    release_channel: ReleaseChannelV1Schema,
  },
  { additionalProperties: false },
);

export const KNOWTHAT_CATEGORIES_V1 = [
  "user_profile",
  "relationship_state",
  "world_state",
  "self_state",
  "project_fact",
  "preference",
  "rule",
] as const;

export const KnowThatCategoryV1Schema = Type.Union(
  KNOWTHAT_CATEGORIES_V1.map((value) => Type.Literal(value)),
);

export const KNOWTHAT_SOURCES_V1 = [
  "explicit_feedback",
  "super_user_explicit",
  "approved_artifact",
  "system_event_tool_result",
  "user_explicit",
  "developer_note",
  "agent_observation",
  "meta_inference",
] as const;

export const KnowThatSourceV1Schema = Type.Union(
  KNOWTHAT_SOURCES_V1.map((value) => Type.Literal(value)),
);

export const KnowThatRiskLevelV1Schema = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("critical"),
]);

export const KnowThatExplicitnessV1Schema = Type.Union([
  Type.Literal("explicit_statement"),
  Type.Literal("strong_implication"),
  Type.Literal("weak_implication"),
  Type.Literal("inferred"),
]);

export const KnowThatJsonValueV1Schema = Type.Recursive((This) =>
  Type.Union([
    Type.Null(),
    Type.Boolean(),
    Type.Number(),
    Type.String(),
    Type.Array(This),
    Type.Record(Type.String(), This),
  ]),
);

export type KnowThatScopeV1 = Static<typeof KnowThatScopeV1Schema>;
export type KnowThatCategoryV1 = Static<typeof KnowThatCategoryV1Schema>;
export type KnowThatSourceV1 = Static<typeof KnowThatSourceV1Schema>;
export type KnowThatRiskLevelV1 = Static<typeof KnowThatRiskLevelV1Schema>;
export type KnowThatExplicitnessV1 = Static<
  typeof KnowThatExplicitnessV1Schema
>;

export function assertKnowThatSchemaV1<TSchemaValue extends TSchema>(
  schema: TSchemaValue,
  value: unknown,
  label: string,
): asserts value is Static<TSchemaValue> {
  if (!Value.Check(schema, value)) {
    const issues = [...Value.Errors(schema, value)].map(
      (issue) => `${issue.path || "/"}: ${issue.message}`,
    );
    throw new Error(`${label} is invalid: ${issues.join("; ")}`);
  }
}
