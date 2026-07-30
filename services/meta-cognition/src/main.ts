import { openOwnerEventDispatchRuntimeFromEnvV1 } from "@pai/eventing";
import {
  openVerifiedOwnerPostgresCompositionV1,
  ownerDatabaseApplicationDependenciesV1,
} from "@pai/persistence";
import {
  loadServiceRuntimeConfig,
  requiresProductionDependenciesV1,
  startService,
} from "@pai/service-kit";

import { buildMetaCognitionApp } from "./app.js";
import { metaCognitionConfigFromEnvironmentV1 } from "./config.v1.js";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { createPostgresMetaFeedbackSuggestionApplicationV1 } from "./meta-feedback-suggestion.v1.js";
import { createMetaQueryApplicationV1 } from "./meta-query.v1.js";
import { createPostgresMetaQueryRepositoryV1 } from "./db/postgres-meta-query-repository.v1.js";
import {
  createMetaProductionCompositionV1,
  META_PRODUCTION_COMPOSITION_ENVIRONMENT_KEYS_V1,
} from "./production-composition.v1.js";

metaCognitionConfigFromEnvironmentV1(process.env);
const production = requiresProductionDependenciesV1();
const runtimeConfig = loadServiceRuntimeConfig({ port: 3003 });
const databaseUrl = process.env.PAI_DATABASE_URL;
const postgresComposition = databaseUrl === undefined
  ? undefined
  : await openVerifiedOwnerPostgresCompositionV1(
      META_COGNITION_REPOSITORY_CONTRACT_V1,
      databaseUrl,
    );
const productionCompositionEnvironmentKeys = [
  "PAI_DATABASE_URL",
  ...META_PRODUCTION_COMPOSITION_ENVIRONMENT_KEYS_V1,
  "DEEPSEEK_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
] as const;
const configuredProductionDependencyCount =
  productionCompositionEnvironmentKeys.filter(
    (key) => process.env[key] !== undefined,
  ).length;
if (
  postgresComposition === undefined &&
  (production || configuredProductionDependencyCount > 0)
) {
  throw new Error("PAI_DATABASE_URL is required for Meta production composition");
}
const metaComposition = postgresComposition === undefined
  ? undefined
  : createMetaProductionCompositionV1(postgresComposition, process.env);
const ownerEventDispatch = postgresComposition === undefined
  ? undefined
  : await openOwnerEventDispatchRuntimeFromEnvV1(postgresComposition.outbox, {
      deployment_environment: runtimeConfig.deployment_environment,
      release_channel: runtimeConfig.release_channel,
      production_dependencies_required: production,
      transport_epoch_postgres: postgresComposition.postgres,
    });
ownerEventDispatch?.start();
metaComposition?.worker.start();
const feedbackSuggestionApplication =
  postgresComposition === undefined
    ? undefined
    : createPostgresMetaFeedbackSuggestionApplicationV1(
        ownerDatabaseApplicationDependenciesV1(postgresComposition),
      );
const queryApplication = postgresComposition === undefined
  ? undefined
  : createMetaQueryApplicationV1(
      createPostgresMetaQueryRepositoryV1(postgresComposition),
    );
try {
  await startService({
    serviceId: "meta_cognition",
    defaultPort: 3003,
    requireWorkloadVerifier: production,
    buildApp(options) {
      const app = buildMetaCognitionApp(
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
                  ...(metaComposition === undefined
                    ? []
                    : [
                        {
                          name: "meta_job_worker",
                          check: metaComposition.worker.checkReadiness,
                        },
                      ]),
                ]),
          ],
        },
        metaComposition?.application,
        { require_job_pipeline: true },
        queryApplication,
        undefined,
        feedbackSuggestionApplication,
      );
      if (postgresComposition !== undefined) {
        app.addHook("onClose", async () => {
          try {
            await metaComposition?.worker.close();
          } finally {
            try {
              await ownerEventDispatch?.close();
            } finally {
              await postgresComposition.close();
            }
          }
        });
      }
      return app;
    },
  });
} catch (error) {
  try {
    await metaComposition?.worker.close();
  } finally {
    try {
      await ownerEventDispatch?.close();
    } finally {
      await postgresComposition?.close();
    }
  }
  throw error;
}
