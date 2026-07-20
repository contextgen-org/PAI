import { listen } from "@pai/service-kit";

import { buildActionRuntimeApp } from "./app.js";

await listen(buildActionRuntimeApp(), 3002);
