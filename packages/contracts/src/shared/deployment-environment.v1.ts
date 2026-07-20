import { Type, type Static } from "@sinclair/typebox";

export const DEPLOYMENT_ENVIRONMENTS = ["local", "dev", "staging", "prod"] as const;

export const DeploymentEnvironmentV1Schema = Type.Union(
  DEPLOYMENT_ENVIRONMENTS.map((environment) => Type.Literal(environment)),
  { $id: "urn:pai:shared:deployment-environment:v1" },
);

export type DeploymentEnvironmentV1 = Static<
  typeof DeploymentEnvironmentV1Schema
>;
