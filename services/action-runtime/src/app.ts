import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

export function buildActionRuntimeApp(
  options: ServiceAppOptions = {},
): ReturnType<typeof createServiceApp> {
  return createServiceApp("action_runtime", options);
}
