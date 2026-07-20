import type { OwnerDatabaseApplicationDependenciesV1 } from "@pai/persistence";
import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

export function buildSkillRegistryApp(
  options: ServiceAppOptions = {},
  ownerDatabase?: OwnerDatabaseApplicationDependenciesV1<
    typeof SKILL_REGISTRY_REPOSITORY_CONTRACT_V1
  >,
): ReturnType<typeof createServiceApp> {
  const app = createServiceApp("skill_registry", options);
  if (ownerDatabase !== undefined) app.decorate("ownerDatabase", ownerDatabase);
  return app;
}
