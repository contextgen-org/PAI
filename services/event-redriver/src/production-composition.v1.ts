import {
  DURABLE_EVENT_TARGET_CONSUMERS_V1,
  type DeploymentEnvironmentV1,
  type ReleaseChannelV1,
  type ServiceIdV1,
} from "@pai/contracts";
import {
  createDurableSentOutboxReconcilerV1,
  createPostgresOwnerSentOutboxRedriverStoreV1,
  createRedisNamespaceV1,
  ensureActiveOwnerTransportEpochV1,
  OWNER_EVENT_SCHEMA_V1,
  openVerifiedRedisStreamCompositionV1,
  type DurableSentOutboxReconciliationSummaryV1,
  type VerifiedRedisStreamCompositionV1,
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

import { EventRedriverWorkerV1 } from "./index.js";

export interface ProductionEventRedriverCompositionOptionsV1 {
  readonly deployment_environment: DeploymentEnvironmentV1;
  readonly release_channel: ReleaseChannelV1;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface ProductionEventRedriverCompositionV1 {
  readonly owner_services: readonly ServiceIdV1[];
  readonly event_outbox_tables: readonly string[];
  readonly worker: EventRedriverWorkerV1;
  start(): void;
  runOnce(signal?: AbortSignal): Promise<DurableSentOutboxReconciliationSummaryV1>;
  checkReadiness(signal?: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

interface OwnerRedriverRuntimeV1 {
  readonly owner_service: RedrivenOwnerServiceV1;
  readonly event_outbox_tables: readonly string[];
  runOnce(signal?: AbortSignal): Promise<DurableSentOutboxReconciliationSummaryV1>;
  checkReadiness(signal?: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

interface OwnerRedriverSpecV1 {
  readonly owner_service: RedrivenOwnerServiceV1;
  readonly database_url_env: string;
  readonly contract: OwnerRepositoryContractV1;
}

const OWNER_REDRIVER_SPECS_V1 = Object.freeze([
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
] satisfies readonly OwnerRedriverSpecV1[]);

type RedrivenOwnerServiceV1 =
  | "action_runtime"
  | "trigger_processor"
  | "memory"
  | "meta_cognition"
  | "knowthat"
  | "skill_registry"
  | "timer_trigger_app";

const OWNER_REDRIVER_SPEC_BY_SERVICE_V1 = new Map(
  OWNER_REDRIVER_SPECS_V1.map((spec) => [spec.owner_service, spec] as const),
);

const EMPTY_REDRIVER_SUMMARY_V1 = Object.freeze({
  claimed: 0,
  probed: 0,
  present: 0,
  missing: 0,
  rematerialized: 0,
  retryable_failures: 0,
  permanent_failures: 0,
});

function addRedriverSummaryV1(
  left: DurableSentOutboxReconciliationSummaryV1,
  right: DurableSentOutboxReconciliationSummaryV1,
): DurableSentOutboxReconciliationSummaryV1 {
  return Object.freeze({
    claimed: left.claimed + right.claimed,
    probed: left.probed + right.probed,
    present: left.present + right.present,
    missing: left.missing + right.missing,
    rematerialized: left.rematerialized + right.rematerialized,
    retryable_failures: left.retryable_failures + right.retryable_failures,
    permanent_failures: left.permanent_failures + right.permanent_failures,
  });
}

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

function optionalPositiveIntegerV1(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const raw = env[key];
  if (raw === undefined) return undefined;
  if (!/^[1-9][0-9]*$/u.test(raw)) {
    throw new Error(`${key} must be a positive integer`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} is outside its supported range`);
  }
  return parsed;
}

function requiredPositiveIntegerV1(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const value = optionalPositiveIntegerV1(env, key, minimum, maximum);
  if (value === undefined) throw new Error(`${key} is required`);
  return value;
}

function ownerServicesFromEnvV1(
  env: Readonly<Record<string, string | undefined>>,
): readonly RedrivenOwnerServiceV1[] {
  const raw = env.PAI_EVENT_REDRIVER_OWNER_SERVICES;
  if (raw === undefined) {
    return OWNER_REDRIVER_SPECS_V1.map(({ owner_service }) => owner_service);
  }
  const requested = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (requested.length === 0) {
    throw new Error("PAI_EVENT_REDRIVER_OWNER_SERVICES must not be empty");
  }
  const seen = new Set<string>();
  return Object.freeze(
    requested.map((ownerService) => {
      if (
        seen.has(ownerService) ||
        !OWNER_REDRIVER_SPEC_BY_SERVICE_V1.has(
          ownerService as RedrivenOwnerServiceV1,
        )
      ) {
        throw new Error(
          `PAI_EVENT_REDRIVER_OWNER_SERVICES contains an unsupported owner: ${ownerService}`,
        );
      }
      seen.add(ownerService);
      return ownerService as RedrivenOwnerServiceV1;
    }),
  );
}

function ownerDatabaseUrlV1(
  env: Readonly<Record<string, string | undefined>>,
  spec: OwnerRedriverSpecV1,
  selectedOwnerCount: number,
): string {
  const ownerSpecific = env[spec.database_url_env];
  if (ownerSpecific !== undefined) return requiredEnvV1(env, spec.database_url_env);
  if (selectedOwnerCount === 1 && env.PAI_DATABASE_URL !== undefined) {
    return requiredEnvV1(env, "PAI_DATABASE_URL");
  }
  throw new Error(
    `${spec.database_url_env} is required for ${spec.owner_service} event redriver; PAI_DATABASE_URL is allowed only for single-owner runs`,
  );
}

function eventRoutesV1(): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(DURABLE_EVENT_TARGET_CONSUMERS_V1).map(
        ([target, consumer]) => [target, `consumer:${consumer}`],
      ),
    ),
  );
}

async function openOwnerRedriverRuntimeV1(
  spec: OwnerRedriverSpecV1,
  databaseUrl: string,
  redisUrl: string,
  options: Readonly<{
    deployment_environment: DeploymentEnvironmentV1;
    release_channel: ReleaseChannelV1;
    stream_epoch: string;
    stream_generation: number;
    worker_id: string;
    batch_size: number;
    lease_seconds: number;
    probe_interval_ms: number;
  }>,
): Promise<OwnerRedriverRuntimeV1> {
  let postgres:
    | VerifiedOwnerPostgresCompositionV1<OwnerRepositoryContractV1>
    | undefined;
  let redis: VerifiedRedisStreamCompositionV1 | undefined;
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
    redis = await openVerifiedRedisStreamCompositionV1({
      url: redisUrl,
      namespace: createRedisNamespaceV1({
        deployment_environment: options.deployment_environment,
        release_channel: options.release_channel,
        owner_service: spec.owner_service,
        stream_epoch: options.stream_epoch,
        stream_generation: options.stream_generation,
      }),
      routes: eventRoutesV1(),
    });
    const eventOutboxTables = Object.freeze(
      postgres.outbox.outbox_tables.filter((table) =>
        table.endsWith("event_outbox"),
      ),
    );
    if (eventOutboxTables.length === 0) {
      throw new Error(`${spec.owner_service} has no event outbox to redrive`);
    }
    const reconcilers = eventOutboxTables.map((table) =>
      createDurableSentOutboxReconcilerV1(
        createPostgresOwnerSentOutboxRedriverStoreV1(
          postgres!.repository,
          postgres!.unit_of_work,
          table,
        ),
        redis!.referenceProbe,
        redis!.transport,
        {
          owner_service: spec.owner_service,
          worker_id: `${options.worker_id}:${spec.owner_service}:${table}`,
          batch_size: options.batch_size,
          lease_seconds: options.lease_seconds,
          probe_interval_ms: options.probe_interval_ms,
          current_transport_epoch: options.stream_epoch,
          current_transport_generation: options.stream_generation,
        },
      ),
    );
    return Object.freeze({
      owner_service: spec.owner_service,
      event_outbox_tables: eventOutboxTables,
      async runOnce(signal?: AbortSignal) {
        let summary: DurableSentOutboxReconciliationSummaryV1 =
          EMPTY_REDRIVER_SUMMARY_V1;
        for (const reconciler of reconcilers) {
          signal?.throwIfAborted();
          summary = addRedriverSummaryV1(
            summary,
            await reconciler.reconcileBatch(signal),
          );
        }
        signal?.throwIfAborted();
        return summary;
      },
      async checkReadiness(signal?: AbortSignal) {
        signal?.throwIfAborted();
        await postgres!.checkReadiness(signal ?? new AbortController().signal);
        signal?.throwIfAborted();
        await redis!.checkReadiness(signal);
      },
      async close() {
        try {
          await redis?.close();
        } finally {
          await postgres?.close();
        }
      },
    });
  } catch (error) {
    try {
      await redis?.close();
    } finally {
      await postgres?.close();
    }
    throw error;
  }
}

export async function openProductionEventRedriverCompositionV1(
  options: ProductionEventRedriverCompositionOptionsV1,
): Promise<ProductionEventRedriverCompositionV1> {
  const env = options.env ?? process.env;
  const redisUrl = requiredEnvV1(env, "PAI_REDIS_URL");
  const streamEpoch = requiredEnvV1(env, "PAI_EVENT_STREAM_EPOCH");
  const streamGeneration = requiredPositiveIntegerV1(
    env,
    "PAI_EVENT_STREAM_GENERATION",
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const workerId =
    env.PAI_EVENT_REDRIVER_WORKER_ID ??
    env.HOSTNAME ??
    `event_redriver:pid:${process.pid}`;
  if (workerId.length === 0 || workerId.length > 96) {
    throw new Error("PAI_EVENT_REDRIVER_WORKER_ID is outside its supported range");
  }
  const batchSize =
    optionalPositiveIntegerV1(
      env,
      "PAI_EVENT_REDRIVER_BATCH_SIZE",
      1,
      16,
    ) ?? 16;
  const leaseSeconds =
    optionalPositiveIntegerV1(
      env,
      "PAI_EVENT_REDRIVER_LEASE_SECONDS",
      1,
      3_600,
    ) ?? 30;
  const probeIntervalMs =
    optionalPositiveIntegerV1(
      env,
      "PAI_EVENT_REDRIVER_PROBE_INTERVAL_MS",
      1_000,
      86_400_000,
    ) ?? 300_000;
  const selectedOwners = ownerServicesFromEnvV1(env);
  const runtimes: OwnerRedriverRuntimeV1[] = [];
  let closed = false;
  try {
    for (const ownerService of selectedOwners) {
      const spec = OWNER_REDRIVER_SPEC_BY_SERVICE_V1.get(ownerService);
      if (spec === undefined) {
        throw new Error(`unsupported event redriver owner: ${ownerService}`);
      }
      runtimes.push(
        await openOwnerRedriverRuntimeV1(
          spec,
          ownerDatabaseUrlV1(env, spec, selectedOwners.length),
          redisUrl,
          {
            deployment_environment: options.deployment_environment,
            release_channel: options.release_channel,
            stream_epoch: streamEpoch,
            stream_generation: streamGeneration,
            worker_id: workerId,
            batch_size: batchSize,
            lease_seconds: leaseSeconds,
            probe_interval_ms: probeIntervalMs,
          },
        ),
      );
    }
    const reconciler = Object.freeze({
      async reconcileBatch(signal: AbortSignal) {
        let summary: DurableSentOutboxReconciliationSummaryV1 =
          EMPTY_REDRIVER_SUMMARY_V1;
        for (const runtime of runtimes) {
          signal.throwIfAborted();
          summary = addRedriverSummaryV1(
            summary,
            await runtime.runOnce(signal),
          );
        }
        signal.throwIfAborted();
        return summary;
      },
    });
    const worker = new EventRedriverWorkerV1({ reconciler });
    return Object.freeze({
      owner_services: Object.freeze([...selectedOwners]),
      event_outbox_tables: Object.freeze(
        runtimes.flatMap((runtime) =>
          runtime.event_outbox_tables.map(
            (table) => `${runtime.owner_service}.${table}`,
          ),
        ),
      ),
      worker,
      start() {
        if (closed) throw new Error("event redriver composition is closed");
        worker.start();
      },
      runOnce(signal?: AbortSignal) {
        if (closed) {
          return Promise.reject(
            new Error("event redriver composition is closed"),
          );
        }
        if (signal === undefined) return worker.runOnce();
        return reconciler.reconcileBatch(signal);
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
        try {
          await worker.stop();
        } finally {
          await Promise.all(runtimes.map((runtime) => runtime.close()));
        }
      },
    });
  } catch (error) {
    await Promise.all(runtimes.map((runtime) => runtime.close().catch(() => undefined)));
    throw error;
  }
}
