import { listen } from "@pai/service-kit";

import { buildObservationGatewayApp } from "./app.js";

await listen(buildObservationGatewayApp(), 3008);
