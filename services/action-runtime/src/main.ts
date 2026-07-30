import { openOwnerEventDispatchRuntimeFromEnvV1 } from "@pai/eventing";
import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";
import {
  loadServiceRuntimeConfig,
  requiresProductionDependenciesV1,
  startService,
} from "@pai/service-kit";

import { buildActionRuntimeApp } from "./app.js";
import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { createPostgresRuntimeEventOwnerRepositoryV1 } from "./db/runtime-event-read-repository.v1.js";
import { createPostgresRuntimeQueryRepositoryV1 } from "./db/runtime-query-repository.v1.js";
import { createPostgresToolPermissionProfileCurrentReadRepositoryV1 } from "./db/tool-permission-profile-current-read-repository.v1.js";
import { openProductionActionRuntimeCompositionV1 } from "./production-composition.v1.js";
import { createRuntimeEventReadApplicationV1 } from "./runtime-event-read.v1.js";
import { createRuntimeQueryApplicationV1 } from "./runtime-query.v1.js";
import { openRedisRuntimeTokenLiveBusV1 } from "./runtime-token-live-bus.v1.js";
import { createRuntimeTokenStreamApplicationV1 } from "./runtime-token-stream.v1.js";
import { createToolPermissionProfileCurrentReadApplicationV1 } from "./tool-permission-profile-current-read.v1.js";

const runtimeConfig = loadServiceRuntimeConfig({ port: 3002 });
const productionDependenciesRequired = requiresProductionDependenciesV1();

if (productionDependenciesRequired) {
  const composition = await openProductionActionRuntimeCompositionV1({
    deployment_environment: runtimeConfig.deployment_environment,
    release_channel: runtimeConfig.release_channel,
  });
  try {
    await startService({
      serviceId: "action_runtime",
      defaultPort: 3002,
      requireWorkloadVerifier: true,
      buildApp(options) {
        const app = buildActionRuntimeApp(
          {
            ...options,
            readinessChecks: [
              ...(options.readinessChecks ?? []),
              ...composition.readiness_checks,
            ],
          },
          composition.applications,
          { require_complete_pipeline: true },
        );
        app.addHook("onReady", async () => composition.start());
        app.addHook("onClose", async () => composition.close());
        return app;
      },
    });
  } catch (error) {
    await composition.close();
    throw error;
  }
} else {
  const databaseUrl = process.env.PAI_DATABASE_URL;
  const postgresComposition =
    databaseUrl === undefined
      ? undefined
      : await openVerifiedOwnerPostgresCompositionV1(
          ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
          databaseUrl,
        );
  const ownerEventDispatch =
    postgresComposition === undefined
      ? undefined
      : await openOwnerEventDispatchRuntimeFromEnvV1(
          postgresComposition.outbox,
          {
            deployment_environment: runtimeConfig.deployment_environment,
            release_channel: runtimeConfig.release_channel,
            production_dependencies_required: false,
            transport_epoch_postgres: postgresComposition.postgres,
          },
        );
  const runtimeQuery =
    postgresComposition === undefined
      ? undefined
      : createRuntimeQueryApplicationV1(
          createPostgresRuntimeQueryRepositoryV1(
            postgresComposition.postgres,
          ),
        );
  const runtimeTokenBus =
    runtimeQuery === undefined || process.env.PAI_REDIS_URL === undefined
      ? undefined
      : await openRedisRuntimeTokenLiveBusV1(process.env.PAI_REDIS_URL);
  ownerEventDispatch?.start();
  try {
    await startService({
      serviceId: "action_runtime",
      defaultPort: 3002,
      requireWorkloadVerifier: postgresComposition !== undefined,
      buildApp(options) {
        const app = buildActionRuntimeApp(
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
                      : [
                          {
                            name: "owner_event_dispatch",
                            check: ownerEventDispatch.checkReadiness,
                          },
                        ]),
                  ]),
            ],
          },
          postgresComposition === undefined
            ? {}
            : {
                tool_permission_profile_current_read:
                  createToolPermissionProfileCurrentReadApplicationV1(
                    createPostgresToolPermissionProfileCurrentReadRepositoryV1(
                      postgresComposition.postgres,
                    ),
                  ),
                runtime_event_read: createRuntimeEventReadApplicationV1(
                  createPostgresRuntimeEventOwnerRepositoryV1(
                    postgresComposition.postgres,
                  ),
                ),
                ...(runtimeQuery === undefined
                  ? {}
                  : { runtime_query: runtimeQuery }),
                ...(runtimeQuery === undefined || runtimeTokenBus === undefined
                  ? {}
                  : {
                      runtime_token_stream:
                        createRuntimeTokenStreamApplicationV1(
                          runtimeQuery,
                          runtimeTokenBus.source,
                        ),
                    }),
              },
          { require_complete_pipeline: false },
        );
        app.addHook("onClose", async () => {
          try {
            await ownerEventDispatch?.close();
          } finally {
            try {
              await runtimeTokenBus?.close();
            } finally {
              await postgresComposition?.close();
            }
          }
        });
        return app;
      },
    });
  } catch (error) {
    try {
      await ownerEventDispatch?.close();
    } finally {
      try {
        await runtimeTokenBus?.close();
      } finally {
        await postgresComposition?.close();
      }
    }
    throw error;
  }
}
