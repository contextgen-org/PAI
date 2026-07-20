import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

export function buildMetaCognitionApp(
  options: ServiceAppOptions = {},
): ReturnType<typeof createServiceApp> {
  return createServiceApp("meta_cognition", options);
}
