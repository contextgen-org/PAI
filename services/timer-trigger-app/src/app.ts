import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

export function buildTimerTriggerApp(
  options: ServiceAppOptions = {},
): ReturnType<typeof createServiceApp> {
  return createServiceApp("timer_trigger_app", options);
}
