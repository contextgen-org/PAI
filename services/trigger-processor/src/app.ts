import { createServiceApp } from "@pai/service-kit";

export function buildTriggerProcessorApp(): ReturnType<typeof createServiceApp> {
  return createServiceApp("trigger_processor");
}
