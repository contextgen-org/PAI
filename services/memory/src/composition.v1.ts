import { createHash } from "node:crypto";

import {
  openOwnerCommandDispatchRuntimeFromEnvV1,
  openOwnerEventDispatchRuntimeFromEnvV1,
} from "@pai/eventing";
import { openVerifiedOwnerPostgresCompositionV1 } from "@pai/persistence";

import {
  InMemoryMemoryStateRepositoryV1,
  MEMORY_EMBEDDING_PROFILE_V1,
  MemoryApplicationV1,
  type MemoryEmbeddingPortV1,
} from "./memory-application.v1.js";
import { MEMORY_REPOSITORY_CONTRACT_V1 } from "./db/permission-manifest.v1.js";
import { createPostgresMemoryStateRepositoryV1 } from "./db/postgres-memory-state-repository.v1.js";
import { PostgresMemoryHttpApplicationV1 } from "./postgres-memory-http-application.v1.js";
import {
  createMemoryIntegrationWorkerV1,
  createPostgresMemoryIntegrationQueueV1,
} from "./integration-worker.v1.js";
import { createMemoryMetaCommandTransportFromEnvV1 } from "./production-command-dispatch.v1.js";
import { createMemoryEmbeddingProviderFromEnvV1 } from "./production-embedding.v1.js";

export const LOCAL_MEMORY_DURABLE_OWNER_READINESS_CHECK_V1 = Object.freeze({
  name: "durable_owner_repository",
  async check(): Promise<void> {
    throw new Error(
      "Memory is using the local in-memory owner; a durable PostgreSQL repository is not composed",
    );
  },
});

export interface ProductionMemoryCompositionV1 {
  readonly application: PostgresMemoryHttpApplicationV1;
  readonly readiness_checks: readonly Readonly<{
    name: string;
    check(signal: AbortSignal): Promise<void>;
  }>[];
  start(): void;
  close(): Promise<void>;
}

function requiredEnvV1(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (typeof value !== "string" || value.length === 0 || value.includes("\u0000")) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export async function createProductionMemoryCompositionV1(
  options: Readonly<{
    deployment_environment: "local" | "dev" | "staging" | "prod";
    release_channel: "stable" | "canary";
    production_dependencies_required?: boolean;
    env?: NodeJS.ProcessEnv;
  }>,
): Promise<ProductionMemoryCompositionV1> {
  const env = options.env ?? process.env;
  const postgres = await openVerifiedOwnerPostgresCompositionV1(
    MEMORY_REPOSITORY_CONTRACT_V1,
    requiredEnvV1(env, "PAI_DATABASE_URL"),
  );
  let eventDispatch: Awaited<ReturnType<typeof openOwnerEventDispatchRuntimeFromEnvV1>> | undefined;
  let commandDispatch: Awaited<ReturnType<typeof openOwnerCommandDispatchRuntimeFromEnvV1>> | undefined;
  let integrationWorker:
    | ReturnType<typeof createMemoryIntegrationWorkerV1>
    | undefined;
  try {
    const productionDependenciesRequired =
      options.production_dependencies_required ?? true;
    eventDispatch = await openOwnerEventDispatchRuntimeFromEnvV1(postgres.outbox, {
      deployment_environment: options.deployment_environment,
      release_channel: options.release_channel,
      production_dependencies_required: productionDependenciesRequired,
      transport_epoch_postgres: postgres.postgres,
      env,
    });
    if (productionDependenciesRequired && eventDispatch === undefined) {
      throw new Error("Memory owner event dispatch is not composed");
    }
    const httpEpochConfigured =
      env.PAI_INTERNAL_HTTP_TRANSPORT_EPOCH !== undefined;
    const httpGenerationConfigured =
      env.PAI_INTERNAL_HTTP_TRANSPORT_GENERATION !== undefined;
    if (httpEpochConfigured !== httpGenerationConfigured) {
      throw new Error(
        "PAI_INTERNAL_HTTP_TRANSPORT_EPOCH and PAI_INTERNAL_HTTP_TRANSPORT_GENERATION must be configured together",
      );
    }
    if (
      productionDependenciesRequired ||
      (httpEpochConfigured && httpGenerationConfigured)
    ) {
      commandDispatch = await openOwnerCommandDispatchRuntimeFromEnvV1(
        postgres.outbox,
        {
          production_dependencies_required: productionDependenciesRequired,
          transport_epoch_postgres: postgres.postgres,
          transport: createMemoryMetaCommandTransportFromEnvV1(env),
          env,
        },
      );
    }
    if (productionDependenciesRequired && commandDispatch === undefined) {
      throw new Error("Memory owner command dispatch is not composed");
    }
    const embedding = createMemoryEmbeddingProviderFromEnvV1(env);
    const core = new MemoryApplicationV1(
      createPostgresMemoryStateRepositoryV1(postgres),
      embedding,
      { promotion_token_hmac_secret: requiredEnvV1(env, "PAI_MEMORY_PROMOTION_TOKEN_HMAC_SECRET") },
    );
    const application = new PostgresMemoryHttpApplicationV1(
      core,
      postgres,
      embedding,
      requiredEnvV1(env, "PAI_MEMORY_PROMOTION_TOKEN_HMAC_SECRET"),
    );
    integrationWorker = createMemoryIntegrationWorkerV1({
      application,
      composition: postgres,
      embedding,
      queue: createPostgresMemoryIntegrationQueueV1(postgres.postgres),
      worker_id: requiredEnvV1(env, "PAI_MEMORY_INTEGRATION_WORKER_ID"),
    });
    let started = false;
    let closed = false;
    return Object.freeze({
      application,
      readiness_checks: Object.freeze([
        { name: "owner_postgres", check: postgres.checkReadiness },
        ...(eventDispatch === undefined
          ? []
          : [{ name: "owner_event_dispatch", check: eventDispatch.checkReadiness }]),
        ...(commandDispatch === undefined
          ? []
          : [{ name: "owner_command_dispatch", check: commandDispatch.checkReadiness }]),
        {
          name: "memory_integration_worker",
          check: integrationWorker.checkReadiness,
        },
      ]),
      start() {
        if (closed) throw new Error("Memory production composition is closed");
        if (started) return;
        started = true;
        eventDispatch?.start();
        commandDispatch?.start();
        integrationWorker?.start();
      },
      async close() {
        if (closed) return;
        closed = true;
        try {
          await Promise.all([
            eventDispatch?.close(),
            commandDispatch?.close(),
            integrationWorker?.close(),
          ]);
        } finally {
          await postgres.close();
        }
      },
    });
  } catch (error) {
    try {
      await Promise.all([
        eventDispatch?.close(),
        commandDispatch?.close(),
        integrationWorker?.close(),
      ]);
    } finally {
      await postgres.close();
    }
    throw error;
  }
}

class LocalDeterministicMemoryEmbeddingV1
  implements MemoryEmbeddingPortV1
{
  public async checkReadiness(): Promise<void> {}

  public async embed(
    inputs: readonly string[],
    profile: typeof MEMORY_EMBEDDING_PROFILE_V1,
  ): Promise<readonly (readonly number[])[]> {
    return inputs.map((input) => {
      const digest = createHash("sha256").update(input, "utf8").digest();
      const vector = Array.from(
        { length: profile.dimensions },
        () => 0,
      );
      for (let offset = 0; offset < digest.length; offset += 1) {
        const index =
          (digest[offset]! + offset * 257) % profile.dimensions;
        vector[index] = (vector[index] ?? 0) + 1;
      }
      return Object.freeze(vector);
    });
  }
}

/**
 * Local-only composition. Production must use the owner PostgreSQL writers and
 * a version-pinned embedding provider; main fails closed before selecting this
 * in a production environment.
 */
export function createLocalMemoryCompositionV1(): Readonly<{
  application: MemoryApplicationV1;
}> {
  return Object.freeze({
    application: new MemoryApplicationV1(
      new InMemoryMemoryStateRepositoryV1(),
      new LocalDeterministicMemoryEmbeddingV1(),
    ),
  });
}
