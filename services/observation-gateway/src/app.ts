import { createServiceApp, type ServiceAppOptions } from "@pai/service-kit";

export function buildObservationGatewayApp(
  options: ServiceAppOptions = {},
): ReturnType<typeof createServiceApp> {
  return createServiceApp("observation_gateway", options);
}
