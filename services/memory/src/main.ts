import { listen } from "@pai/service-kit";

import { buildMemoryApp } from "./app.js";

await listen(buildMemoryApp(), 3004);
