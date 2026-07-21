import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { requiresProductionDependenciesV1, startService } from "@pai/service-kit";

import { buildMetaCognitionApp } from "./app.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

const databaseUrl = process.env.PAI_DATABASE_URL;
const postgresComposition = databaseUrl === undefined ? undefined : await openVerifiedOwnerPostgresCompositionV1(META_COGNITION_REPOSITORY_CONTRACT_V1, databaseUrl);
if (postgresComposition === undefined && requiresProductionDependenciesV1()) throw new Error("PAI_DATABASE_URL is required for owner PostgreSQL verification in production");
await startService({
  serviceId: "meta_cognition",
  defaultPort: 3003,
  buildApp(options) {
    const app = buildMetaCognitionApp({ ...options, readinessChecks: [...(options.readinessChecks ?? []), ...(postgresComposition === undefined ? [] : [{ name: "owner_postgres", check: postgresComposition.checkReadiness }])] });
    if (postgresComposition !== undefined) app.addHook("onClose", postgresComposition.close);
    return app;
  },
});
