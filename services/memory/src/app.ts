import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

export function buildMemoryApp(
  options: ServiceAppOptions = {},
): ReturnType<typeof createServiceApp> {
  return createServiceApp("memory", options);
}
