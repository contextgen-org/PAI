import {
  loadServiceRuntimeConfig,
  requiresProductionDependenciesV1,
  startService,
} from "@pai/service-kit";

import { buildMemoryApp } from "./app.js";
import {
  createLocalMemoryCompositionV1,
  createProductionMemoryCompositionV1,
  LOCAL_MEMORY_DURABLE_OWNER_READINESS_CHECK_V1,
} from "./composition.v1.js";

const production = requiresProductionDependenciesV1();
const runtimeConfig = loadServiceRuntimeConfig({ port: 3004 });
const durable = process.env.PAI_DATABASE_URL === undefined
  ? undefined
  : await createProductionMemoryCompositionV1({
      deployment_environment: runtimeConfig.deployment_environment,
      release_channel: runtimeConfig.release_channel,
      production_dependencies_required: production,
    });
if (durable === undefined && production) {
  throw new Error("PAI_DATABASE_URL is required for Memory production composition");
}
const localComposition = durable === undefined ? createLocalMemoryCompositionV1() : undefined;
try {
  await startService({
    serviceId: "memory",
    defaultPort: 3004,
    requireWorkloadVerifier: production,
    buildApp(options) {
      const app = buildMemoryApp(
        {
          ...options,
          readinessChecks: [
            ...(options.readinessChecks ?? []),
            ...(durable === undefined
              ? [LOCAL_MEMORY_DURABLE_OWNER_READINESS_CHECK_V1]
              : durable.readiness_checks),
          ],
        },
        { memory: (durable?.application ?? localComposition?.application) as never },
        { require_complete_pipeline: durable !== undefined },
      );
      if (durable !== undefined) {
        app.addHook("onReady", async () => durable.start());
        app.addHook("onClose", async () => durable.close());
      }
      return app;
    },
  });
} catch (error) {
  await durable?.close();
  throw error;
}
