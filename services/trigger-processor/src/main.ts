import { startService } from "@pai/service-kit";

import { buildTriggerProcessorApp } from "./app.js";

await startService({ serviceId: "trigger_processor", defaultPort: 3001, buildApp: buildTriggerProcessorApp });
