import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

export function buildSkillRegistryApp(
  options: ServiceAppOptions = {},
): ReturnType<typeof createServiceApp> {
  return createServiceApp("skill_registry", options);
}
