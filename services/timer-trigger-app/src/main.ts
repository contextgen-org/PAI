import { startService } from "@pai/service-kit";

import { buildTimerTriggerApp } from "./app.js";

await startService({ serviceId: "timer_trigger_app", defaultPort: 3006, buildApp: buildTimerTriggerApp });
