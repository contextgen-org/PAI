import {
  loadServiceRuntimeConfig,
  requiresProductionDependenciesV1,
  startService,
} from "@pai/service-kit";

import {
  createLocalKnowThatCompositionV1,
  createProductionKnowThatCompositionV1,
  LOCAL_KNOWTHAT_DURABLE_OWNER_READINESS_CHECK_V1,
} from "./composition.v1.js";
import { knowThatConfigFromEnvironmentV1 } from "./config.v1.js";

const production = requiresProductionDependenciesV1();
const runtimeConfig = loadServiceRuntimeConfig({ port: 3005 });
const databaseUrl = process.env.PAI_DATABASE_URL;
const durable =
  databaseUrl === undefined
    ? undefined
    : await createProductionKnowThatCompositionV1({
        deployment_environment: runtimeConfig.deployment_environment,
        release_channel: runtimeConfig.release_channel,
        production_dependencies_required: production,
      });
if (durable === undefined && production) {
  throw new Error(
    "PAI_DATABASE_URL is required for KnowThat production composition",
  );
}
const localComposition =
  durable === undefined
    ? createLocalKnowThatCompositionV1(
        {
          async check() {
            throw new Error("Memory pre-promotion client is not composed");
          },
          async validate() {
            throw new Error("Memory pre-promotion client is not composed");
          },
          async ack() {
            throw new Error("Memory pre-promotion client is not composed");
          },
          async release() {
            throw new Error("Memory pre-promotion client is not composed");
          },
          async checkReadiness() {
            throw new Error("Memory pre-promotion client is not composed");
          },
        },
        knowThatConfigFromEnvironmentV1(process.env),
      )
    : undefined;

try {
  await startService({
    serviceId: "knowthat",
    defaultPort: 3005,
    requireWorkloadVerifier: production || durable !== undefined,
    buildApp(options) {
      const app =
        durable === undefined
          ? localComposition!.buildApp({
              ...options,
              readinessChecks: [
                ...(options.readinessChecks ?? []),
                LOCAL_KNOWTHAT_DURABLE_OWNER_READINESS_CHECK_V1,
              ],
            })
          : durable.buildApp(options);
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
