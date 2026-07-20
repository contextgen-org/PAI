import { startService } from "@pai/service-kit";

import { buildMetaCognitionApp } from "./app.js";

await startService({ serviceId: "meta_cognition", defaultPort: 3003, buildApp: buildMetaCognitionApp });
