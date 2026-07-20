import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

import {
  createTriggerAdmissionApplicationV1,
  type TriggerProcessorOwnerDatabaseV1,
} from "./application/trigger-admission.v1.js";

export function buildTriggerProcessorApp(
  options: ServiceAppOptions = {},
  ownerDatabase?: TriggerProcessorOwnerDatabaseV1,
): ReturnType<typeof createServiceApp> {
  const app = createServiceApp("trigger_processor", options);
  if (ownerDatabase !== undefined) {
    app.decorate("ownerDatabase", ownerDatabase);
    app.decorate(
      "triggerAdmission",
      createTriggerAdmissionApplicationV1(ownerDatabase),
    );
  }
  return app;
}
