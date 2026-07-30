import {
  loadServiceRuntimeConfig,
  requiresProductionDependenciesV1,
} from "@pai/service-kit";

import { openProductionEventRedriverCompositionV1 } from "./production-composition.v1.js";

const runtimeConfig = loadServiceRuntimeConfig({ port: 3011 });
const production = requiresProductionDependenciesV1();

if (!production && process.env.PAI_EVENT_REDRIVER_ENABLE_LOCAL !== "true") {
  throw new Error(
    "event redriver requires production dependencies; set PAI_EVENT_REDRIVER_ENABLE_LOCAL=true for explicit local runs",
  );
}

const composition = await openProductionEventRedriverCompositionV1({
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
    console.error(`event redriver failed to stop after ${signal}`, error);
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
