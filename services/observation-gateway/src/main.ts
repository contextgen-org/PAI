import { startService } from "@pai/service-kit";

import { buildObservationGatewayApp } from "./app.js";

await startService({ serviceId: "observation_gateway", defaultPort: 3008, buildApp: buildObservationGatewayApp });
