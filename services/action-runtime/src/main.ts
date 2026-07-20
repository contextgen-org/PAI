import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { startService } from "@pai/service-kit";

import { buildActionRuntimeApp } from "./app.js";
import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

const databaseUrl = process.env.PAI_DATABASE_URL;
const postgresComposition =
  databaseUrl === undefined
    ? undefined
    : await openVerifiedOwnerPostgresCompositionV1(
        ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
        databaseUrl,
      );
if (postgresComposition === undefined && process.env.NODE_ENV === "production") {
  throw new Error("PAI_DATABASE_URL is required for owner PostgreSQL verification in production");
}
await startService({
  serviceId: "action_runtime",
  defaultPort: 3002,
  buildApp(options) {
    const app = buildActionRuntimeApp({
      ...options,
      readinessChecks: [
        ...(options.readinessChecks ?? []),
        ...(postgresComposition === undefined
          ? []
          : [{ name: "owner_postgres", check: postgresComposition.checkReadiness }]),
      ],
    });
    if (postgresComposition !== undefined) {
      app.addHook("onClose", postgresComposition.close);
    }
    return app;
  },
});
