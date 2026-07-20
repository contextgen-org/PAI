import { startService } from "@pai/service-kit";

import { buildTriggerProcessorApp } from "./app.js";
import { verifyTriggerProcessorPostgresCompositionV1 } from "./db/postgres-composition.v1.js";

const databaseUrl = process.env.PAI_DATABASE_URL;
if (databaseUrl !== undefined) {
  await verifyTriggerProcessorPostgresCompositionV1(databaseUrl);
} else if (process.env.NODE_ENV === "production") {
  throw new Error(
    "PAI_DATABASE_URL is required for PostgreSQL deployment verification in production",
  );
}

await startService({ serviceId: "trigger_processor", defaultPort: 3001, buildApp: buildTriggerProcessorApp });
