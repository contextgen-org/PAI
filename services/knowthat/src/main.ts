import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { requiresProductionDependenciesV1, startService } from "@pai/service-kit";

import { buildKnowThatApp } from "./app.js";
import { KNOWTHAT_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

const databaseUrl = process.env.PAI_DATABASE_URL;
const postgresComposition = databaseUrl === undefined ? undefined : await openVerifiedOwnerPostgresCompositionV1(KNOWTHAT_REPOSITORY_CONTRACT_V1, databaseUrl);
if (postgresComposition === undefined && requiresProductionDependenciesV1()) throw new Error("PAI_DATABASE_URL is required for owner PostgreSQL verification in production");
await startService({
  serviceId: "knowthat",
  defaultPort: 3005,
  buildApp(options) {
    const app = buildKnowThatApp({
      ...options,
      readinessChecks: [...(options.readinessChecks ?? []), ...(postgresComposition === undefined ? [] : [{ name: "owner_postgres", check: postgresComposition.checkReadiness }])],
    });
    if (postgresComposition !== undefined) app.addHook("onClose", postgresComposition.close);
    return app;
  },
});
