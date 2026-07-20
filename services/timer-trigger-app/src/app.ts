import type { OwnerDatabaseApplicationDependenciesV1 } from "@pai/persistence";
import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

import { TIMER_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

export function buildTimerTriggerApp(
  options: ServiceAppOptions = {},
  ownerDatabase?: OwnerDatabaseApplicationDependenciesV1<
    typeof TIMER_REPOSITORY_CONTRACT_V1
  >,
): ReturnType<typeof createServiceApp> {
  const app = createServiceApp("timer_trigger_app", options);
  if (ownerDatabase !== undefined) app.decorate("ownerDatabase", ownerDatabase);
  return app;
}
