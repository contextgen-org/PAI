import { startService } from "@pai/service-kit";

import { buildActionRuntimeApp } from "./app.js";

await startService({ serviceId: "action_runtime", defaultPort: 3002, buildApp: buildActionRuntimeApp });
