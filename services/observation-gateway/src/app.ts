import { createServiceApp } from "@pai/service-kit";

export function buildObservationGatewayApp(): ReturnType<typeof createServiceApp> {
  return createServiceApp("observation_gateway");
}
