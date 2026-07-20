import { listen } from "@pai/service-kit";

import { buildSkillRegistryApp } from "./app.js";

await listen(buildSkillRegistryApp(), 3007);
