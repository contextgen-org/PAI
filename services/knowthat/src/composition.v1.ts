import type { ServiceAppOptions } from "@pai/service-kit";
import { openOwnerEventDispatchRuntimeFromEnvV1 } from "@pai/eventing";
import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import { buildKnowThatApp } from "./app.js";
import {
  createKnowThatApplicationV1,
  type KnowThatApplicationV1,
} from "./knowthat-application.v1.js";
import {
  DEFAULT_KNOWTHAT_CONFIG_V1,
  knowThatConfigFromEnvironmentV1,
  type KnowThatConfigV1,
} from "./config.v1.js";
import { KNOWTHAT_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { createInMemoryKnowThatStoreV1 } from "./knowthat-store.v1.js";
import type { KnowThatMemoryPrePromotionPortV1 } from "./knowthat-types.v1.js";
import { createPostgresKnowThatStoreV1 } from "./postgres-knowthat-store.v1.js";
import { createKnowThatMemoryClientFromEnvV1 } from "./production-memory-client.v1.js";
import { createKnowThatPromotionCommandWorkerV1 } from "./promotion-command-worker.v1.js";

export const LOCAL_KNOWTHAT_DURABLE_OWNER_READINESS_CHECK_V1 = Object.freeze({
  name: "durable_owner_repository",
  async check(): Promise<void> {
    throw new Error(
      "KnowThat is using the local in-memory owner; a durable PostgreSQL repository is not composed",
    );
  },
});

export interface KnowThatLocalCompositionV1 {
  readonly application: KnowThatApplicationV1;
  readonly buildApp: (
    options?: ServiceAppOptions,
  ) => ReturnType<typeof buildKnowThatApp>;
}

export interface ProductionKnowThatCompositionV1 {
  readonly application: KnowThatApplicationV1;
  readonly readiness_checks: readonly Readonly<{
    name: string;
    check(signal: AbortSignal): Promise<void>;
  }>[];
  readonly buildApp: (
    options?: ServiceAppOptions,
  ) => ReturnType<typeof buildKnowThatApp>;
  start(): void;
  close(): Promise<void>;
}

function requiredEnvV1(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\u0000")
  ) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalIntegerV1(
  env: NodeJS.ProcessEnv,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const value = env[key];
  if (value === undefined) return undefined;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error(`${key} must be an unsigned base-10 integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} is outside its supported range`);
  }
  return parsed;
}

function requiredIntegerV1(
  env: NodeJS.ProcessEnv,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const value = optionalIntegerV1(env, key, minimum, maximum);
  if (value === undefined) throw new Error(`${key} is required`);
  return value;
}

export async function createProductionKnowThatCompositionV1(
  options: Readonly<{
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
    production_dependencies_required?: boolean;
    env?: NodeJS.ProcessEnv;
  }>,
): Promise<ProductionKnowThatCompositionV1> {
  const env = options.env ?? process.env;
  const config = knowThatConfigFromEnvironmentV1(env);
  const productionDependenciesRequired =
    options.production_dependencies_required ?? true;
  const postgres = await openVerifiedOwnerPostgresCompositionV1(
    KNOWTHAT_REPOSITORY_CONTRACT_V1,
    requiredEnvV1(env, "PAI_DATABASE_URL"),
  );
  let eventDispatch:
    | Awaited<ReturnType<typeof openOwnerEventDispatchRuntimeFromEnvV1>>
    | undefined;
  let worker:
    | ReturnType<typeof createKnowThatPromotionCommandWorkerV1>
    | undefined;
  let closed = false;
  let started = false;

  const closeV1 = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await Promise.all([
        worker?.close().catch(() => undefined),
        eventDispatch?.close().catch(() => undefined),
      ]);
    } finally {
      await postgres.close();
    }
  };

  try {
    eventDispatch = await openOwnerEventDispatchRuntimeFromEnvV1(
      postgres.outbox,
      {
        deployment_environment: options.deployment_environment,
        release_channel: options.release_channel,
        production_dependencies_required: productionDependenciesRequired,
        transport_epoch_postgres: postgres.postgres,
        env,
      },
    );
    if (productionDependenciesRequired && eventDispatch === undefined) {
      throw new Error("KnowThat owner event dispatch is not composed");
    }

    const memory = createKnowThatMemoryClientFromEnvV1(env);
    const store = createPostgresKnowThatStoreV1(postgres, config, {
      memory_command_worker_id: requiredEnvV1(
        env,
        "PAI_KNOWTHAT_PROMOTION_COMMAND_WORKER_ID",
      ),
      memory_command_transport_epoch: requiredEnvV1(
        env,
        "PAI_INTERNAL_HTTP_TRANSPORT_EPOCH",
      ),
      memory_command_transport_generation: requiredIntegerV1(
        env,
        "PAI_INTERNAL_HTTP_TRANSPORT_GENERATION",
        1,
        Number.MAX_SAFE_INTEGER,
      ),
    });
    const application = createKnowThatApplicationV1(store, memory, config);
    const pollIntervalMs = optionalIntegerV1(
      env,
      "PAI_KNOWTHAT_PROMOTION_COMMAND_POLL_INTERVAL_MS",
      50,
      60_000,
    );
    const batchSize = optionalIntegerV1(
      env,
      "PAI_KNOWTHAT_PROMOTION_COMMAND_BATCH_SIZE",
      1,
      100,
    );
    worker = createKnowThatPromotionCommandWorkerV1({
      application,
      ...(pollIntervalMs === undefined
        ? {}
        : { poll_interval_ms: pollIntervalMs }),
      ...(batchSize === undefined ? {} : { batch_size: batchSize }),
    });
    const readinessChecks: ProductionKnowThatCompositionV1["readiness_checks"] =
      Object.freeze([
        { name: "owner_postgres", check: postgres.checkReadiness },
        ...(eventDispatch === undefined
          ? []
          : [
              {
                name: "owner_event_dispatch",
                check: (signal: AbortSignal) =>
                  eventDispatch!.checkReadiness(signal),
              },
            ]),
        {
          name: "memory_pre_promotion_client",
          check: async (signal: AbortSignal) => {
            if (memory.checkReadiness === undefined) {
              throw new Error("KnowThat Memory readiness check is not composed");
            }
            await memory.checkReadiness(signal);
          },
        },
        {
          name: "knowthat_promotion_command_worker",
          check: worker.checkReadiness,
        },
      ]);

    const composition: ProductionKnowThatCompositionV1 = Object.freeze({
      application,
      readiness_checks: readinessChecks,
      buildApp(options: ServiceAppOptions = {}) {
        return buildKnowThatApp(
          {
            ...options,
            readinessChecks: [
              ...(options.readinessChecks ?? []),
              ...composition.readiness_checks,
            ],
          },
          application,
          { require_complete_pipeline: true },
        );
      },
      start() {
        if (closed) throw new Error("KnowThat production composition is closed");
        if (started) return;
        started = true;
        eventDispatch?.start();
        worker?.start();
      },
      close: closeV1,
    });
    return composition;
  } catch (error) {
    await closeV1();
    throw error;
  }
}

/**
 * Explicit local/test composition. Production must inject a durable owner
 * repository and real Memory pre-promotion client; it must never select this.
 */
export function createLocalKnowThatCompositionV1(
  memory: KnowThatMemoryPrePromotionPortV1,
  config: KnowThatConfigV1 = DEFAULT_KNOWTHAT_CONFIG_V1,
): KnowThatLocalCompositionV1 {
  const store = createInMemoryKnowThatStoreV1(config);
  const application = createKnowThatApplicationV1(store, memory, config);
  return Object.freeze({
    application,
    buildApp(options: ServiceAppOptions = {}) {
      return buildKnowThatApp(
        options,
        application,
        { require_complete_pipeline: true },
      );
    },
  });
}
