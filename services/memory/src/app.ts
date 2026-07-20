import type { OwnerDatabaseApplicationDependenciesV1 } from "@pai/persistence";
import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

import { MEMORY_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

export function buildMemoryApp(
  options: ServiceAppOptions = {},
  ownerDatabase?: OwnerDatabaseApplicationDependenciesV1<
    typeof MEMORY_REPOSITORY_CONTRACT_V1
  >,
): ReturnType<typeof createServiceApp> {
  const app = createServiceApp("memory", options);
  if (ownerDatabase !== undefined) app.decorate("ownerDatabase", ownerDatabase);
  return app;
}
