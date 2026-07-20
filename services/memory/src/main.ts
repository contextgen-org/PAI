import { startService } from "@pai/service-kit";

import { buildMemoryApp } from "./app.js";

await startService({ serviceId: "memory", defaultPort: 3004, buildApp: buildMemoryApp });
