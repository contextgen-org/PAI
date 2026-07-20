import { Type, type Static } from "@sinclair/typebox";

export const SERVICE_IDS = [
  "trigger_processor",
  "action_runtime",
  "meta_cognition",
  "memory",
  "knowthat",
  "skill_registry",
  "timer_trigger_app",
  "observation_gateway",
] as const;

export const ServiceIdV1Schema = Type.Union(
  SERVICE_IDS.map((serviceId) => Type.Literal(serviceId)),
  { $id: "urn:pai:shared:service-id:v1" },
);

export type ServiceIdV1 = Static<typeof ServiceIdV1Schema>;
