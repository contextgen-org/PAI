import type { OwnerDatabaseApplicationDependenciesV1 } from "@pai/persistence";
import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

export function buildActionRuntimeApp(
  options: ServiceAppOptions = {},
  ownerDatabase?: OwnerDatabaseApplicationDependenciesV1<
    typeof ACTION_RUNTIME_REPOSITORY_CONTRACT_V1
  >,
): ReturnType<typeof createServiceApp> {
  const app = createServiceApp("action_runtime", options);
  if (ownerDatabase !== undefined) app.decorate("ownerDatabase", ownerDatabase);
  return app;
}
