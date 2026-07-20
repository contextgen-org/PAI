import { listen } from "@pai/service-kit";

import { buildTimerTriggerApp } from "./app.js";

await listen(buildTimerTriggerApp(), 3006);
