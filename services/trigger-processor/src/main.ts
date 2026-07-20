import { listen } from "@pai/service-kit";

import { buildTriggerProcessorApp } from "./app.js";

await listen(buildTriggerProcessorApp(), 3001);
