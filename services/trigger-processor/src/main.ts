import {
  openVerifiedOwnerPostgresCompositionV1,
  ownerDatabaseApplicationDependenciesV1,
} from "@pai/persistence";
import {
  requiresProductionDependenciesV1,
  startService,
} from "@pai/service-kit";

import {
  buildTriggerProcessorApp,
  TRIGGER_ADMISSION_INTERNAL_AUTH_POLICIES_V1,
} from "./app.js";
import { createTriggerAdmissionApplicationV1 } from "./application/trigger-admission.v1.js";
import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";

const databaseUrl = process.env.PAI_DATABASE_URL;
const postgresComposition =
  databaseUrl === undefined
    ? undefined
    : await openVerifiedOwnerPostgresCompositionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        databaseUrl,
      );
const triggerAdmission =
  postgresComposition === undefined
    ? undefined
    : createTriggerAdmissionApplicationV1(
        ownerDatabaseApplicationDependenciesV1(postgresComposition),
      );
const productionDependenciesRequired = requiresProductionDependenciesV1();
if (postgresComposition === undefined && productionDependenciesRequired) {
  throw new Error(
    "PAI_DATABASE_URL is required for owner PostgreSQL verification in production",
  );
}
const requireWorkloadVerifier =
  productionDependenciesRequired || postgresComposition !== undefined;
await startService({
  serviceId: "trigger_processor",
  defaultPort: 3001,
  internalRouteAuthPolicies: TRIGGER_ADMISSION_INTERNAL_AUTH_POLICIES_V1,
  requireWorkloadVerifier,
  buildApp(options) {
    const app = buildTriggerProcessorApp(
      {
        ...options,
        readinessChecks: [
          ...(options.readinessChecks ?? []),
          ...(postgresComposition === undefined
            ? []
            : [
                {
                  name: "owner_postgres",
                  check: postgresComposition.checkReadiness,
                },
              ]),
        ],
      },
      triggerAdmission,
    );
    if (postgresComposition !== undefined) {
      app.addHook("onClose", postgresComposition.close);
    }
    return app;
  },
});
