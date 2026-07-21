import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

export function buildKnowThatApp(
  options: ServiceAppOptions = {},
): ReturnType<typeof createServiceApp> {
  return createServiceApp("knowthat", options);
}
