import {
  loadServiceRuntimeConfig,
  requiresProductionDependenciesV1,
} from "@pai/service-kit";

import { openProductionEventDispatcherCompositionV1 } from "./production-composition.v1.js";

const runtimeConfig = loadServiceRuntimeConfig({ port: 3010 });
const production = requiresProductionDependenciesV1();

if (!production && process.env.PAI_EVENT_DISPATCH_ENABLE_LOCAL !== "true") {
  throw new Error(
    "event dispatcher requires production dependencies; set PAI_EVENT_DISPATCH_ENABLE_LOCAL=true for explicit local runs",
  );
}

const composition = await openProductionEventDispatcherCompositionV1({
  deployment_environment: runtimeConfig.deployment_environment,
  release_channel: runtimeConfig.release_channel,
});

let closing = false;
async function closeAndExit(signal: NodeJS.Signals): Promise<void> {
  if (closing) return;
  closing = true;
  try {
    await composition.close();
    process.exit(0);
  } catch (error) {
    console.error(`event dispatcher failed to stop after ${signal}`, error);
    process.exit(1);
  }
}

process.once("SIGINT", (signal) => {
  void closeAndExit(signal);
});
process.once("SIGTERM", (signal) => {
  void closeAndExit(signal);
});

composition.start();
