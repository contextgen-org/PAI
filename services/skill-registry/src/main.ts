import { startService } from "@pai/service-kit";

import { buildSkillRegistryApp } from "./app.js";

await startService({ serviceId: "skill_registry", defaultPort: 3007, buildApp: buildSkillRegistryApp });
