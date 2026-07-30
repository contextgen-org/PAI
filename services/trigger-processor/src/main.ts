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

import { buildTriggerProcessorApp } from "./app.js";
import { createTriggerAdmissionApplicationV1 } from "./application/trigger-admission.v1.js";
import { createTriggerProcessControlApplicationV1 } from "./application/process-control.v1.js";
import { createTriggerProcessObservationApplicationV1 } from "./application/process-observation.v1.js";
import { createRuntimeStartReservationValidationApplicationV1 } from "./application/runtime-start-reservation-validation.v1.js";
import { createTriggerProcessObservationRepositoryV1 } from "./db/process-observation-repository.v1.js";
import { createRuntimeStartReservationValidationRepositoryV1 } from "./db/runtime-start-reservation-validation-repository.v1.js";
import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { openProductionTriggerProcessorCompositionV1 } from "./production-composition.v1.js";
import {
  assertTriggerIngressConfigurationV1,
  createTriggerSupabaseIngressVerifierFromEnvV1,
} from "./supabase-ingress-config.v1.js";

const runtimeConfig = loadServiceRuntimeConfig({ port: 3001 });
const productionDependenciesRequired = requiresProductionDependenciesV1();
const productionComposition = productionDependenciesRequired
  ? await openProductionTriggerProcessorCompositionV1({
      deployment_environment: runtimeConfig.deployment_environment,
      release_channel: runtimeConfig.release_channel,
    })
  : undefined;

// Keep an intentionally incomplete local shell available for contract work,
// but never mistake its verified database for a ready production pipeline.
const databaseUrl = process.env.PAI_DATABASE_URL;
const postgresComposition =
  productionComposition === undefined && databaseUrl !== undefined
    ? await openVerifiedOwnerPostgresCompositionV1(
        TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
        databaseUrl,
      )
    : undefined;
const triggerAdmission =
  productionComposition?.trigger_admission ??
  (postgresComposition === undefined
    ? undefined
    : createTriggerAdmissionApplicationV1(
        ownerDatabaseApplicationDependenciesV1(postgresComposition),
      ));
const processControl =
  productionComposition?.process_control ??
  (postgresComposition === undefined
    ? undefined
    : createTriggerProcessControlApplicationV1(
        ownerDatabaseApplicationDependenciesV1(postgresComposition),
      ));
const processObservation =
  productionComposition?.process_observation ??
  (postgresComposition === undefined
    ? undefined
    : createTriggerProcessObservationApplicationV1(
        createTriggerProcessObservationRepositoryV1(postgresComposition.postgres),
      ));
const runtimeStartReservationValidation =
  postgresComposition === undefined
    ? undefined
    : createRuntimeStartReservationValidationApplicationV1(
        createRuntimeStartReservationValidationRepositoryV1(
          postgresComposition.read_committed_postgres,
        ),
      );
const supabaseIngressVerifier =
  createTriggerSupabaseIngressVerifierFromEnvV1(process.env);
if (postgresComposition === undefined && productionComposition === undefined && productionDependenciesRequired) {
  throw new Error("Trigger Processor production composition is required");
}
const ownerEventDispatch =
  postgresComposition === undefined
    ? undefined
    : await openOwnerEventDispatchRuntimeFromEnvV1(postgresComposition.outbox, {
        deployment_environment: runtimeConfig.deployment_environment,
        release_channel: runtimeConfig.release_channel,
        production_dependencies_required: false,
        transport_epoch_postgres: postgresComposition.postgres,
      });
ownerEventDispatch?.start();
assertTriggerIngressConfigurationV1(
  triggerAdmission !== undefined,
  supabaseIngressVerifier,
);
const requireWorkloadVerifier =
  productionDependenciesRequired || postgresComposition !== undefined;
try {
  await startService({
    serviceId: "trigger_processor",
    defaultPort: 3001,
    requireWorkloadVerifier,
    buildApp(options) {
      const app = buildTriggerProcessorApp(
        {
          ...options,
          readinessChecks: [
            ...(options.readinessChecks ?? []),
            ...(productionComposition?.readiness_checks ?? []),
            ...(postgresComposition === undefined
              ? []
              : [
                  { name: "owner_postgres", check: postgresComposition.checkReadiness },
                  ...(ownerEventDispatch === undefined
                    ? []
                    : [{ name: "owner_event_dispatch", check: ownerEventDispatch.checkReadiness }]),
                ]),
          ],
          ...(supabaseIngressVerifier === undefined ? {} : { supabaseIngressVerifier }),
        },
        triggerAdmission,
        processControl,
        processObservation,
        productionComposition?.internal_applications ?? {
          ...(runtimeStartReservationValidation === undefined
            ? {}
            : { runtime_start_reservation_validation: runtimeStartReservationValidation }),
        },
        { require_complete_pipeline: true },
      );
      if (productionComposition !== undefined) {
        app.addHook("onReady", async () => {
          productionComposition.start();
        });
        app.addHook("onClose", productionComposition.close);
      }
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
    await productionComposition?.close();
    await ownerEventDispatch?.close();
  } finally {
    await postgresComposition?.close();
  }
  throw error;
}
