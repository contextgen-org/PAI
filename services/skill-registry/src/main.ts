import {
  loadServiceRuntimeConfig,
  requiresProductionDependenciesV1,
  startService,
} from "@pai/service-kit";

import { buildSkillRegistryApp } from "./app.js";
import { openSkillRegistryProductionCompositionV1 } from "./production-composition.v1.js";

const runtimeConfig = loadServiceRuntimeConfig({ port: 3007 });
const production = requiresProductionDependenciesV1();
const composition = await openSkillRegistryProductionCompositionV1({
  deployment_environment: runtimeConfig.deployment_environment,
  release_channel: runtimeConfig.release_channel,
  production_dependencies_required: production,
});
composition.start();

try {
  await startService({
    serviceId: "skill_registry",
    defaultPort: 3007,
    requireWorkloadVerifier: production,
    buildApp(options) {
      const app = buildSkillRegistryApp(
        {
          ...options,
          readinessChecks: [
            ...(options.readinessChecks ?? []),
            { name: "skill_registry_production", check: composition.checkReadiness },
          ],
        },
        { registry: composition.application },
        { require_complete_pipeline: true },
      );
      app.addHook("onClose", () => composition.close());
      return app;
    },
  });
} catch (error) {
  await composition.close();
  throw error;
}
