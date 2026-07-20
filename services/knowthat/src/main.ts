import { startService } from "@pai/service-kit";

import { buildKnowThatApp } from "./app.js";

await startService({ serviceId: "knowthat", defaultPort: 3005, buildApp: buildKnowThatApp });
