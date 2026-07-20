import { createServiceApp } from "@pai/service-kit";

export function buildTimerTriggerApp(): ReturnType<typeof createServiceApp> {
  return createServiceApp("timer_trigger_app");
}
