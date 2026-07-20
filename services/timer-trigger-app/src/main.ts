import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { startService } from "@pai/service-kit";

import { buildTimerTriggerApp } from "./app.js";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

const databaseUrl = process.env.PAI_DATABASE_URL;
const postgresComposition = databaseUrl === undefined ? undefined : await openVerifiedOwnerPostgresCompositionV1(TIMER_REPOSITORY_CONTRACT_V1, databaseUrl);
if (postgresComposition === undefined && process.env.NODE_ENV === "production") throw new Error("PAI_DATABASE_URL is required for owner PostgreSQL verification in production");
await startService({
  serviceId: "timer_trigger_app",
  defaultPort: 3006,
  buildApp(options) {
    const app = buildTimerTriggerApp({ ...options, readinessChecks: [...(options.readinessChecks ?? []), ...(postgresComposition === undefined ? [] : [{ name: "owner_postgres", check: postgresComposition.checkReadiness }])] });
    if (postgresComposition !== undefined) app.addHook("onClose", postgresComposition.close);
    return app;
  },
});
