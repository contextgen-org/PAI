import {
  requiresProductionDependenciesV1,
  startService,
} from "@pai/service-kit";

import { buildObservationGatewayApp } from "./app.js";
import { createObservationProductionCompositionV1 } from "./production-composition.v1.js";

const production = requiresProductionDependenciesV1();
const observationEnvironmentKeys = [
  "PAI_TRIGGER_PROCESSOR_URL",
  "PAI_ACTION_RUNTIME_URL",
  "PAI_META_COGNITION_URL",
  "PAI_OBSERVATION_AUDIT_SPOOL_PATH",
  "PAI_OBSERVATION_ALLOWED_CALLERS",
] as const;
const configuredDependencyCount = observationEnvironmentKeys.filter(
  (name) => process.env[name] !== undefined,
).length;
if (
  configuredDependencyCount !== 0 &&
  configuredDependencyCount !== observationEnvironmentKeys.length
) {
  throw new Error(
    "Observation production dependencies must be configured as one complete set",
  );
}
const composition =
  production || configuredDependencyCount > 0
    ? createObservationProductionCompositionV1(process.env)
    : undefined;
await startService({
  serviceId: "observation_gateway",
  defaultPort: 3008,
  requireWorkloadVerifier: production,
  buildApp: (options) =>
    buildObservationGatewayApp(
      options,
      composition === undefined
        ? {}
        : { observation: composition.application },
      {
        require_complete_pipeline: true,
        require_durable_audit: true,
        ...(composition === undefined
          ? {}
          : { allowed_callers: composition.allowed_callers }),
      },
    ),
});
