import { openOwnerEventDispatchRuntimeFromEnvV1 } from "@pai/eventing";
import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import {
  SkillRegistryApplicationV1,
} from "./skill-registry-application.v1.js";
import {
  createSkillRegistryPostgresApplicationRepositoryV1,
  createSkillRegistryPostgresDelegateV1,
} from "./db/postgres-application-repository.v1.js";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { openSkillRegistryObjectStoreV1 } from "./production-object-store.v1.js";
import { createSkillRegistryPackageInspectorV1 } from "./production-package-inspector.v1.js";
import {
  createSkillRegistryRuntimePolicyReaderV1,
  createSkillRegistryWorkloadSignerFromEnvV1,
} from "./production-runtime-policy-reader.v1.js";
import { createSkillRegistryValidationArtifactReaderV1 } from "./production-validation-artifact-reader.v1.js";

// Production adapters must not add a hidden five-second deadline below the
// bounded service readiness deadline while a cold owner composition attests.
const SKILL_REGISTRY_ADAPTER_READINESS_TIMEOUT_MS_V1 = 25_000;

export interface SkillRegistryProductionCompositionV1 {
  readonly application: SkillRegistryApplicationV1;
  start(): void;
  checkReadiness(): Promise<void>;
  close(): Promise<void>;
}

export interface OpenSkillRegistryProductionCompositionOptionsV1 {
  readonly env?: NodeJS.ProcessEnv;
  readonly deployment_environment: "local" | "dev" | "staging" | "prod";
  readonly release_channel: "stable" | "canary";
  readonly production_dependencies_required: boolean;
}

function requiredEnvV1(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for the Skill Registry production composition`);
  }
  return value;
}

/**
 * Owns every production-only adapter in one place.  The service entry point
 * must never substitute an empty applications object: doing so exposes health
 * endpoints while every business route is absent.
 */
export async function openSkillRegistryProductionCompositionV1(
  options: OpenSkillRegistryProductionCompositionOptionsV1,
): Promise<SkillRegistryProductionCompositionV1> {
  const env = options.env ?? process.env;
  const databaseUrl = requiredEnvV1(env, "PAI_DATABASE_URL");
  const composition = await openVerifiedOwnerPostgresCompositionV1(
    SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
    databaseUrl,
  );
  let objectStore:
    | Awaited<ReturnType<typeof openSkillRegistryObjectStoreV1>>
    | undefined;
  let eventDispatch:
    | Awaited<ReturnType<typeof openOwnerEventDispatchRuntimeFromEnvV1>>
    | undefined;
  try {
    objectStore = await openSkillRegistryObjectStoreV1({
      database_url: databaseUrl,
      reconciler_database_url: requiredEnvV1(
        env,
        "PAI_OBJECT_STORE_RECONCILER_DATABASE_URL",
      ),
      supabase_url: requiredEnvV1(env, "PAI_SUPABASE_URL"),
      supabase_secret_key: requiredEnvV1(env, "PAI_SUPABASE_SECRET_KEY"),
      worker_id: requiredEnvV1(env, "PAI_SKILL_REGISTRY_OBJECT_STORE_WORKER_ID"),
      composition,
    });
    eventDispatch = await openOwnerEventDispatchRuntimeFromEnvV1(
      composition.outbox,
      {
        deployment_environment: options.deployment_environment,
        release_channel: options.release_channel,
        production_dependencies_required:
          options.production_dependencies_required,
        transport_epoch_postgres: composition.postgres,
      },
    );
    const delegate = createSkillRegistryPostgresDelegateV1(
      composition,
    );
    const repository = createSkillRegistryPostgresApplicationRepositoryV1({
      composition,
      delegate,
    });
    const policyReader = createSkillRegistryRuntimePolicyReaderV1({
      action_runtime_url: requiredEnvV1(env, "PAI_ACTION_RUNTIME_URL"),
      signer: createSkillRegistryWorkloadSignerFromEnvV1(env),
    });
    const inspector = createSkillRegistryPackageInspectorV1();
    const validationArtifactReader =
      createSkillRegistryValidationArtifactReaderV1({
        composition,
        object_store: objectStore.object_store,
        object_access_decisions: objectStore.object_access_decisions,
      });
    const application = new SkillRegistryApplicationV1({
      repository,
      object_store: objectStore.object_store,
      object_store_metadata_kind: "postgresql",
      object_store_readiness: () =>
        objectStore!.checkReadiness(
          AbortSignal.timeout(SKILL_REGISTRY_ADAPTER_READINESS_TIMEOUT_MS_V1),
        ),
      object_access_decisions: objectStore.object_access_decisions,
      package_inspector: inspector,
      validation_artifact_reader: validationArtifactReader,
      policy_input_reader: policyReader,
      deployment_mode: "production",
    });
    return Object.freeze({
      application,
      start() {
        objectStore!.start();
        eventDispatch!.start();
      },
      async checkReadiness() {
        await Promise.all([
          application.checkReadiness(),
          eventDispatch!.checkReadiness(),
        ]);
      },
      async close() {
        await Promise.allSettled([
          eventDispatch?.close(),
          objectStore?.close(),
        ]);
        await composition.close();
      },
    });
  } catch (error) {
    await Promise.allSettled([eventDispatch?.close(), objectStore?.close()]);
    await composition.close();
    throw error;
  }
}
