import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

export function buildTriggerProcessorApp(
  options: ServiceAppOptions = {},
): ReturnType<typeof createServiceApp> {
  return createServiceApp("trigger_processor", options);
}
