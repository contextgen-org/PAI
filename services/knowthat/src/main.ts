import { listen } from "@pai/service-kit";

import { buildKnowThatApp } from "./app.js";

await listen(buildKnowThatApp(), 3005);
