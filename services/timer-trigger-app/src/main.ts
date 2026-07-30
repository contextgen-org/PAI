import { openOwnerEventDispatchRuntimeFromEnvV1 } from "@pai/eventing";
import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import {
  loadServiceRuntimeConfig,
  requiresProductionDependenciesV1,
  startService,
} from "@pai/service-kit";

import { buildTimerTriggerApp } from "./app.js";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { createPostgresTimerStateRepositoryV1 } from "./db/postgres-timer-state-repository.v1.js";
import {
  createTimerTriggerProcessorHttpPortV1,
  createTimerWorkloadSignerFromEnvV1,
} from "./production-trigger-processor.v1.js";
import { createTimerApplicationWithVerifiedPostgresStateV1 } from "./timer-application.v1.js";

const production = requiresProductionDependenciesV1();
const runtimeConfig = loadServiceRuntimeConfig({ port: 3006 });
const databaseUrl = process.env.PAI_DATABASE_URL;
const postgresComposition = databaseUrl === undefined ? undefined : await openVerifiedOwnerPostgresCompositionV1(TIMER_REPOSITORY_CONTRACT_V1, databaseUrl);
if (postgresComposition === undefined && production) throw new Error("PAI_DATABASE_URL is required for owner PostgreSQL verification in production");
const timerApplication = postgresComposition === undefined
  ? undefined
  : createTimerApplicationWithVerifiedPostgresStateV1(
      createPostgresTimerStateRepositoryV1(postgresComposition),
      postgresComposition.deployment,
      createTimerTriggerProcessorHttpPortV1({
        trigger_processor_url:
          process.env.PAI_TRIGGER_PROCESSOR_URL ??
          (() => {
            throw new Error("PAI_TRIGGER_PROCESSOR_URL is required for Timer composition");
          })(),
        signer: createTimerWorkloadSignerFromEnvV1(process.env),
        ...(process.env.PAI_TIMER_INTERNAL_REQUEST_TIMEOUT_MS === undefined
          ? {}
          : {
              request_timeout_ms: Number(
                process.env.PAI_TIMER_INTERNAL_REQUEST_TIMEOUT_MS,
              ),
            }),
      }),
    );
const ownerEventDispatch = postgresComposition === undefined
  ? undefined
  : await openOwnerEventDispatchRuntimeFromEnvV1(postgresComposition.outbox, {
      deployment_environment: runtimeConfig.deployment_environment,
      release_channel: runtimeConfig.release_channel,
      production_dependencies_required: production,
      transport_epoch_postgres: postgresComposition.postgres,
    });
ownerEventDispatch?.start();
try {
  await startService({
    serviceId: "timer_trigger_app",
    defaultPort: 3006,
    requireWorkloadVerifier: production,
    buildApp(options) {
      const app = buildTimerTriggerApp(
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
                ...(ownerEventDispatch === undefined
                  ? []
                  : [{ name: "owner_event_dispatch", check: ownerEventDispatch.checkReadiness }]),
              ]),
        ],
      },
      timerApplication === undefined ? {} : { timer: timerApplication },
      // The executable entry point must never advertise readiness with only
      // /health and /ready registered. Local unit tests may opt into a partial
      // app explicitly, but main is a traffic-bearing service composition.
      { require_complete_pipeline: true },
      );
      if (postgresComposition !== undefined) {
        app.addHook("onClose", async () => {
          try {
            await ownerEventDispatch?.close();
          } finally {
            await postgresComposition.close();
          }
        });
      }
      return app;
    },
  });
} catch (error) {
  try {
    await ownerEventDispatch?.close();
  } finally {
    await postgresComposition?.close();
  }
  throw error;
}
