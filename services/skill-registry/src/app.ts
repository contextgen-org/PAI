import { createServiceApp } from "@pai/service-kit";

export function buildSkillRegistryApp(): ReturnType<typeof createServiceApp> {
  return createServiceApp("skill_registry");
}
