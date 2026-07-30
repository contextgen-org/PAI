import type {
  DeploymentEnvironmentV1,
  ReleaseChannelV1,
  ServiceIdV1,
} from "@pai/contracts";
import {
  OWNER_EVENT_SCHEMA_V1,
  ensureActiveOwnerTransportEpochV1,
  openOwnerEventDispatchRuntimeV1,
  type OwnerEventDispatchRuntimeV1,
} from "@pai/eventing";
import {
  openVerifiedOwnerPostgresCompositionV1,
  type OwnerRepositoryContractV1,
  type VerifiedOwnerPostgresCompositionV1,
} from "@pai/persistence";

import { ACTION_RUNTIME_REPOSITORY_CONTRACT_V1 } from "@pai/action-runtime/db/permission-manifest.v1";
import { KNOWTHAT_REPOSITORY_CONTRACT_V1 } from "@pai/knowthat/db/permission-manifest.v1";
import { MEMORY_REPOSITORY_CONTRACT_V1 } from "@pai/memory/db/permission-manifest.v1";
import { META_COGNITION_REPOSITORY_CONTRACT_V1 } from "@pai/meta-cognition/db/permission-manifest.v1";
import { SKILL_REGISTRY_REPOSITORY_CONTRACT_V1 } from "@pai/skill-registry/db/permission-manifest.v1";
import { TIMER_REPOSITORY_CONTRACT_V1 } from "@pai/timer-trigger-app/db/permission-manifest.v1";
import { TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1 } from "@pai/trigger-processor/db/permission-manifest.v1";

export interface ProductionEventDispatcherCompositionOptionsV1 {
  readonly deployment_environment: DeploymentEnvironmentV1;
  readonly release_channel: ReleaseChannelV1;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface ProductionEventDispatcherCompositionV1 {
  readonly owner_services: readonly ServiceIdV1[];
  readonly event_outbox_tables: readonly string[];
  start(): void;
  checkReadiness(signal?: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

interface OwnerDispatcherSpecV1 {
  readonly owner_service: DispatchOwnerServiceV1;
  readonly database_url_env: string;
  readonly contract: OwnerRepositoryContractV1;
}

interface OwnerDispatcherRuntimeV1 {
  readonly owner_service: DispatchOwnerServiceV1;
  readonly event_outbox_tables: readonly string[];
  start(): void;
  checkReadiness(signal?: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

const OWNER_DISPATCHER_SPECS_V1 = Object.freeze([
  Object.freeze({
    owner_service: "action_runtime",
    database_url_env: "PAI_ACTION_RUNTIME_DATABASE_URL",
    contract: ACTION_RUNTIME_REPOSITORY_CONTRACT_V1,
  }),
  Object.freeze({
    owner_service: "trigger_processor",
    database_url_env: "PAI_TRIGGER_PROCESSOR_DATABASE_URL",
    contract: TRIGGER_PROCESSOR_REPOSITORY_CONTRACT_V1,
  }),
  Object.freeze({
    owner_service: "memory",
    database_url_env: "PAI_MEMORY_DATABASE_URL",
    contract: MEMORY_REPOSITORY_CONTRACT_V1,
  }),
  Object.freeze({
    owner_service: "meta_cognition",
    database_url_env: "PAI_META_COGNITION_DATABASE_URL",
    contract: META_COGNITION_REPOSITORY_CONTRACT_V1,
  }),
  Object.freeze({
    owner_service: "knowthat",
    database_url_env: "PAI_KNOWTHAT_DATABASE_URL",
    contract: KNOWTHAT_REPOSITORY_CONTRACT_V1,
  }),
  Object.freeze({
    owner_service: "skill_registry",
    database_url_env: "PAI_SKILL_REGISTRY_DATABASE_URL",
    contract: SKILL_REGISTRY_REPOSITORY_CONTRACT_V1,
  }),
  Object.freeze({
    owner_service: "timer_trigger_app",
    database_url_env: "PAI_TIMER_TRIGGER_APP_DATABASE_URL",
    contract: TIMER_REPOSITORY_CONTRACT_V1,
  }),
] satisfies readonly OwnerDispatcherSpecV1[]);

type DispatchOwnerServiceV1 =
  | "action_runtime"
  | "trigger_processor"
  | "memory"
  | "meta_cognition"
  | "knowthat"
  | "skill_registry"
  | "timer_trigger_app";

const OWNER_DISPATCHER_SPEC_BY_SERVICE_V1 = new Map(
  OWNER_DISPATCHER_SPECS_V1.map((spec) => [spec.owner_service, spec] as const),
);

function requiredEnvV1(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
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

function requiredPositiveIntegerV1(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): number {
  const value = requiredEnvV1(env, key);
  if (!/^[1-9][0-9]*$/u.test(value)) {
    throw new Error(`${key} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${key} is outside its supported range`);
  }
  return parsed;
}

function ownerServicesFromEnvV1(
  env: Readonly<Record<string, string | undefined>>,
): readonly DispatchOwnerServiceV1[] {
  const raw = env.PAI_EVENT_DISPATCH_OWNER_SERVICES;
  if (raw === undefined) {
    return OWNER_DISPATCHER_SPECS_V1.map(({ owner_service }) => owner_service);
  }
  const requested = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (requested.length === 0) {
    throw new Error("PAI_EVENT_DISPATCH_OWNER_SERVICES must not be empty");
  }
  const seen = new Set<string>();
  return Object.freeze(
    requested.map((ownerService) => {
      if (
        seen.has(ownerService) ||
        !OWNER_DISPATCHER_SPEC_BY_SERVICE_V1.has(
          ownerService as DispatchOwnerServiceV1,
        )
      ) {
        throw new Error(
          `PAI_EVENT_DISPATCH_OWNER_SERVICES contains an unsupported owner: ${ownerService}`,
        );
      }
      seen.add(ownerService);
      return ownerService as DispatchOwnerServiceV1;
    }),
  );
}

function ownerDatabaseUrlV1(
  env: Readonly<Record<string, string | undefined>>,
  spec: OwnerDispatcherSpecV1,
  selectedOwnerCount: number,
): string {
  const ownerSpecific = env[spec.database_url_env];
  if (ownerSpecific !== undefined) return requiredEnvV1(env, spec.database_url_env);
  if (selectedOwnerCount === 1 && env.PAI_DATABASE_URL !== undefined) {
    return requiredEnvV1(env, "PAI_DATABASE_URL");
  }
  throw new Error(
    `${spec.database_url_env} is required for ${spec.owner_service} event dispatcher; PAI_DATABASE_URL is allowed only for single-owner runs`,
  );
}

async function openOwnerDispatcherRuntimeV1(
  spec: OwnerDispatcherSpecV1,
  databaseUrl: string,
  options: Readonly<{
    redis_url: string;
    deployment_environment: DeploymentEnvironmentV1;
    release_channel: ReleaseChannelV1;
    stream_epoch: string;
    stream_generation: number;
    worker_id: string;
  }>,
): Promise<OwnerDispatcherRuntimeV1> {
  let postgres:
    | VerifiedOwnerPostgresCompositionV1<OwnerRepositoryContractV1>
    | undefined;
  let dispatch: OwnerEventDispatchRuntimeV1 | undefined;
  try {
    postgres = await openVerifiedOwnerPostgresCompositionV1(
      spec.contract,
      databaseUrl,
    );
    await ensureActiveOwnerTransportEpochV1(
      spec.owner_service as keyof typeof OWNER_EVENT_SCHEMA_V1,
      postgres.postgres,
      "redis_stream",
      options.stream_epoch,
      options.stream_generation,
    );
    dispatch = await openOwnerEventDispatchRuntimeV1(postgres.outbox, {
      redis_url: options.redis_url,
      deployment_environment: options.deployment_environment,
      release_channel: options.release_channel,
      stream_epoch: options.stream_epoch,
      stream_generation: options.stream_generation,
      worker_id: `${options.worker_id}:${spec.owner_service}`,
    });
    return Object.freeze({
      owner_service: spec.owner_service,
      event_outbox_tables: dispatch.event_outbox_tables,
      start() {
        dispatch!.start();
      },
      async checkReadiness(signal?: AbortSignal) {
        signal?.throwIfAborted();
        await postgres!.checkReadiness(signal ?? new AbortController().signal);
        signal?.throwIfAborted();
        await dispatch!.checkReadiness(signal);
      },
      async close() {
        try {
          await dispatch?.close();
        } finally {
          await postgres?.close();
        }
      },
    });
  } catch (error) {
    try {
      await dispatch?.close();
    } finally {
      await postgres?.close();
    }
    throw error;
  }
}

export async function openProductionEventDispatcherCompositionV1(
  options: ProductionEventDispatcherCompositionOptionsV1,
): Promise<ProductionEventDispatcherCompositionV1> {
  const env = options.env ?? process.env;
  const redisUrl = requiredEnvV1(env, "PAI_REDIS_URL");
  const streamEpoch = requiredEnvV1(env, "PAI_EVENT_STREAM_EPOCH");
  const streamGeneration = requiredPositiveIntegerV1(
    env,
    "PAI_EVENT_STREAM_GENERATION",
  );
  const workerId =
    env.PAI_EVENT_DISPATCH_WORKER_ID ??
    env.HOSTNAME ??
    `event_dispatcher:pid:${process.pid}`;
  if (workerId.length === 0 || workerId.length > 96) {
    throw new Error("PAI_EVENT_DISPATCH_WORKER_ID is outside its supported range");
  }
  const selectedOwners = ownerServicesFromEnvV1(env);
  const runtimes: OwnerDispatcherRuntimeV1[] = [];
  let closed = false;
  try {
    for (const ownerService of selectedOwners) {
      const spec = OWNER_DISPATCHER_SPEC_BY_SERVICE_V1.get(ownerService);
      if (spec === undefined) {
        throw new Error(`unsupported event dispatcher owner: ${ownerService}`);
      }
      runtimes.push(
        await openOwnerDispatcherRuntimeV1(
          spec,
          ownerDatabaseUrlV1(env, spec, selectedOwners.length),
          {
            redis_url: redisUrl,
            deployment_environment: options.deployment_environment,
            release_channel: options.release_channel,
            stream_epoch: streamEpoch,
            stream_generation: streamGeneration,
            worker_id: workerId,
          },
        ),
      );
    }
    return Object.freeze({
      owner_services: Object.freeze([...selectedOwners]),
      event_outbox_tables: Object.freeze(
        runtimes.flatMap((runtime) =>
          runtime.event_outbox_tables.map(
            (table) => `${runtime.owner_service}.${table}`,
          ),
        ),
      ),
      start() {
        if (closed) throw new Error("event dispatcher composition is closed");
        for (const runtime of runtimes) runtime.start();
      },
      async checkReadiness(signal?: AbortSignal) {
        signal?.throwIfAborted();
        for (const runtime of runtimes) {
          signal?.throwIfAborted();
          await runtime.checkReadiness(signal);
        }
      },
      async close() {
        if (closed) return;
        closed = true;
        await Promise.all(runtimes.map((runtime) => runtime.close()));
      },
    });
  } catch (error) {
    await Promise.all(runtimes.map((runtime) => runtime.close().catch(() => undefined)));
    throw error;
  }
}
