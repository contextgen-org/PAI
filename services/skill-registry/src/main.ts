import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import { startService } from "@pai/service-kit";

import { buildSkillRegistryApp } from "./app.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

const databaseUrl = process.env.PAI_DATABASE_URL;
const postgresComposition = databaseUrl === undefined ? undefined : await openVerifiedOwnerPostgresCompositionV1(SKILL_REGISTRY_REPOSITORY_CONTRACT_V1, databaseUrl);
if (postgresComposition === undefined && process.env.NODE_ENV === "production") throw new Error("PAI_DATABASE_URL is required for owner PostgreSQL verification in production");
await startService({
  serviceId: "skill_registry",
  defaultPort: 3007,
  buildApp(options) {
    const app = buildSkillRegistryApp({ ...options, readinessChecks: [...(options.readinessChecks ?? []), ...(postgresComposition === undefined ? [] : [{ name: "owner_postgres", check: postgresComposition.checkReadiness }])] });
    if (postgresComposition !== undefined) app.addHook("onClose", postgresComposition.close);
    return app;
  },
});
