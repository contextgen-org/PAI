import { listen } from "@pai/service-kit";

import { buildMetaCognitionApp } from "./app.js";

await listen(buildMetaCognitionApp(), 3003);
