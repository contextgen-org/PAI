import type { OwnerDatabaseApplicationDependenciesV1 } from "@pai/persistence";
import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

export function buildMetaCognitionApp(
  options: ServiceAppOptions = {},
  ownerDatabase?: OwnerDatabaseApplicationDependenciesV1<
    typeof META_COGNITION_REPOSITORY_CONTRACT_V1
  >,
): ReturnType<typeof createServiceApp> {
  const app = createServiceApp("meta_cognition", options);
  if (ownerDatabase !== undefined) app.decorate("ownerDatabase", ownerDatabase);
  return app;
}
